import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import { authenticate } from '../../middleware/auth';
import { AuthenticatedRequest } from '../../types/auth';
import { NormalizedLead } from './normalizer';
import { deduplicateLead } from '../dedupe/index';
import { applyScoring, getScoringConfig, getScoringRules, initializeDefaultScoringConfig } from '../scoring/index';
import { routeLead, getRoutingRules, initializeDefaultRoutingRules } from '../routing/index';
import { enrichLead } from './enrichment';

// Column mapping schema for LinkedIn CSV
const columnMappingSchema = z.object({
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  location: z.string().optional(),
  industry: z.string().optional(),
  connectionDate: z.string().optional(),
  notes: z.string().optional(),
  linkedinUrl: z.string().optional()
});

type ColumnMapping = z.infer<typeof columnMappingSchema>;

// LinkedIn CSV upload schema
const linkedinCsvUploadSchema = z.object({
  columnMapping: columnMappingSchema,
  skipFirstRow: z.boolean().default(true),
  dedupePolicy: z.enum(['skip', 'merge', 'create_new']).default('merge'),
  source: z.string().default('linkedin_csv'),
  dryRun: z.boolean().default(false)
});

export async function registerLinkedInRoutes(app: FastifyInstance) {
  // Register multipart support for file uploads
  await app.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
      files: 1 // Only allow 1 file
    }
  });

  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  /**
   * POST /ingest/linkedin-csv - Process LinkedIn CSV upload
   */
  app.post('/ingest/linkedin-csv', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    const teamId = (request as any).teamId;

    try {
      app.log.info('LinkedIn CSV upload started', { teamId });

      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      if (!data.filename?.endsWith('.csv')) {
        return reply.code(400).send({ error: 'File must be a CSV' });
      }

      // Read file content
      const buffer = await data.toBuffer();
      const csvContent = buffer.toString('utf-8');

      // Parse form fields
      const fields = data.fields;
      const config = linkedinCsvUploadSchema.parse({
        columnMapping: JSON.parse((fields.columnMapping as any)?.value || '{}'),
        skipFirstRow: (fields.skipFirstRow as any)?.value === 'true',
        dedupePolicy: (fields.dedupePolicy as any)?.value || 'merge',
        source: (fields.source as any)?.value || 'linkedin_csv',
        dryRun: (fields.dryRun as any)?.value === 'true'
      });

      app.log.debug('CSV processing config', { config, filename: data.filename });

      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skip_records_with_empty_values: false
      });

      if (config.skipFirstRow && records.length > 0) {
        records.shift(); // Remove header row if needed
      }

      app.log.info(`Processing ${records.length} CSV records`, { dryRun: config.dryRun });

      // Get scoring and routing configurations
      let scoringConfig = await getScoringConfig(app, teamId);
      let scoringRules = await getScoringRules(app, teamId);

      if (!scoringConfig) {
        const initialized = await initializeDefaultScoringConfig(app, teamId, 'system');
        scoringConfig = initialized.config;
        scoringRules = initialized.rules;
      }

      let routingRules = await getRoutingRules(app, teamId);
      if (routingRules.length === 0) {
        routingRules = await initializeDefaultRoutingRules(app, teamId);
      }

      // Process results tracking
      const results = {
        processed: 0,
        created: 0,
        merged: 0,
        skipped: 0,
        errors: 0,
        results: [] as any[],
        dryRun: config.dryRun
      };

      // Process each CSV row
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNumber = i + 1;

        try {
          // Map CSV row to lead data
          const leadData = mapCsvRowToLead(row, config.columnMapping, config.source, teamId);
          
          if (!leadData.email) {
            results.skipped++;
            results.results.push({
              row: rowNumber,
              action: 'skipped',
              error: 'No email address found'
            });
            continue;
          }

          app.log.debug(`Processing CSV row ${rowNumber}`, {
            email: leadData.email,
            name: leadData.name,
            company: leadData.company
          });

          if (!config.dryRun) {
            // Step 1: Enrichment
            const enrichedLead = await enrichLead(app, leadData, teamId);

            // Step 2: Scoring
            const scoringResult = await applyScoring(app, enrichedLead, scoringConfig!, scoringRules!);

            // Update lead with scoring results
            const scoredLead = {
              ...enrichedLead,
              score: scoringResult.score,
              scoreBand: scoringResult.band
            };

            // Step 3: Deduplication
            const dedupeResult = await deduplicateLead(app, scoredLead, teamId);

            // Step 4: Routing (only for new leads)
            let routingResult = null;
            if (dedupeResult.action === 'created') {
              routingResult = await routeLead(app, scoredLead, routingRules, teamId);

              // Update lead with routing assignment
              if (routingResult.ownerId) {
                await app.prisma.lead.update({
                  where: { id: dedupeResult.leadId },
                  data: { ownerId: routingResult.ownerId }
                });
              }

              // Create SLA clock if needed
              if (routingResult.sla) {
                const slaTarget = new Date(Date.now() + routingResult.sla * 60 * 1000);
                await app.prisma.sLAClock.create({
                  data: {
                    leadId: dedupeResult.leadId,
                    targetAt: slaTarget
                  }
                });
              }
            }

            // Step 5: Save Message record
            await app.prisma.message.create({
              data: {
                leadId: dedupeResult.leadId,
                direction: 'IN',
                channel: 'FORM', // LinkedIn CSV is form-like data
                subject: `LinkedIn Import - ${leadData.name || leadData.email}`,
                body: JSON.stringify(row, null, 2),
                meta: {
                  source: 'linkedin_csv',
                  filename: data.filename,
                  rowNumber,
                  originalData: row,
                  columnMapping: config.columnMapping
                }
              }
            });

            // Step 6: Save Timeline Events
            await app.prisma.timelineEvent.create({
              data: {
                leadId: dedupeResult.leadId,
                type: 'SCORE_UPDATED',
                payload: {
                  action: 'linkedin_csv_import',
                  source: 'linkedin_csv',
                  rowNumber,
                  filename: data.filename,
                  dedupeAction: dedupeResult.action,
                  score: scoringResult.score,
                  band: scoringResult.band,
                  routing: routingResult ? {
                    ownerId: routingResult.ownerId,
                    pool: routingResult.pool,
                    reason: routingResult.reason
                  } : null
                }
              }
            });

            // Track results
            if (dedupeResult.action === 'created') {
              results.created++;
            } else if (dedupeResult.action === 'merged') {
              results.merged++;
            }

            results.results.push({
              row: rowNumber,
              email: leadData.email,
              name: leadData.name,
              action: dedupeResult.action,
              leadId: dedupeResult.leadId,
              duplicateId: dedupeResult.duplicateId,
              score: scoringResult.score,
              band: scoringResult.band,
              ownerId: routingResult?.ownerId
            });

          } else {
            // Dry run - just validate and show what would happen
            results.results.push({
              row: rowNumber,
              email: leadData.email,
              name: leadData.name,
              action: 'would_process',
              score: 0,
              band: 'MEDIUM'
            });
          }

          results.processed++;

        } catch (error) {
          results.errors++;
          results.results.push({
            row: rowNumber,
            action: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          app.log.error(`Failed to process CSV row ${rowNumber}:`, error);
        }
      }

      const message = config.dryRun 
        ? `Dry run completed: ${results.processed} rows would be processed`
        : `LinkedIn CSV import completed: ${results.created} created, ${results.merged} merged, ${results.skipped} skipped, ${results.errors} errors`;

      return reply.send({
        success: true,
        ...results,
        message
      });

    } catch (error) {
      app.log.error('LinkedIn CSV upload failed:', error);
      return reply.code(500).send({ 
        error: 'CSV upload failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /ingest/linkedin-csv/template - Download CSV template
   */
  app.get('/ingest/linkedin-csv/template', async (request, reply: FastifyReply) => {
    const template = {
      filename: 'linkedin_import_template.csv',
      headers: [
        'First Name',
        'Last Name',
        'Email Address',
        'Company',
        'Position',
        'Phone',
        'Website',
        'Location',
        'Industry',
        'Connected On',
        'Notes',
        'LinkedIn URL'
      ],
      sampleData: [
        {
          'First Name': 'John',
          'Last Name': 'Doe',
          'Email Address': 'john.doe@company.com',
          'Company': 'Acme Corp',
          'Position': 'VP of Sales',
          'Phone': '+1-555-123-4567',
          'Website': 'https://company.com',
          'Location': 'San Francisco, CA',
          'Industry': 'Technology',
          'Connected On': '2024-01-15',
          'Notes': 'Met at conference, interested in our product',
          'LinkedIn URL': 'https://linkedin.com/in/johndoe'
        }
      ],
      columnMappingOptions: {
        email: 'Email Address, Email, E-mail',
        firstName: 'First Name, Given Name, fname',
        lastName: 'Last Name, Surname, lname',
        fullName: 'Full Name, Name, Contact Name',
        company: 'Company, Organization, Company Name',
        title: 'Position, Title, Job Title, Role',
        phone: 'Phone, Phone Number, Mobile, Contact Number',
        website: 'Website, Company Website, URL',
        location: 'Location, Address, City',
        industry: 'Industry, Sector, Business Type',
        connectionDate: 'Connected On, Connection Date, Date Connected',
        notes: 'Notes, Comments, Description',
        linkedinUrl: 'LinkedIn URL, Profile URL, LinkedIn Profile'
      }
    };

    return reply.send(template);
  });
}

/**
 * Map CSV row to normalized lead data
 */
function mapCsvRowToLead(
  row: Record<string, any>,
  mapping: ColumnMapping,
  source: string,
  teamId: string
): NormalizedLead {
  // Helper function to get value from row using mapping
  const getValue = (mappingKey: keyof ColumnMapping): string | undefined => {
    const columnName = mapping[mappingKey];
    if (!columnName) return undefined;
    
    // Try exact match first
    if (row[columnName]) return row[columnName];
    
    // Try case-insensitive match
    const keys = Object.keys(row);
    const matchedKey = keys.find(key => 
      key.toLowerCase() === columnName.toLowerCase()
    );
    
    return matchedKey ? row[matchedKey] : undefined;
  };

  // Build lead data
  const leadData: NormalizedLead = {
    source,
    sourceRef: `csv_row_${Date.now()}`,
    fields: {},
    utm: {}
  };

  // Email (required)
  leadData.email = getValue('email');

  // Name - try fullName first, then combine firstName + lastName
  leadData.name = getValue('fullName') || 
    [getValue('firstName'), getValue('lastName')].filter(Boolean).join(' ').trim() ||
    undefined;

  // Company
  leadData.company = getValue('company');

  // Phone
  leadData.phone = getValue('phone');

  // Domain from email
  if (leadData.email) {
    leadData.domain = leadData.email.split('@')[1];
  }

  // Additional fields
  const title = getValue('title');
  if (title) leadData.fields.title = title;

  const website = getValue('website');
  if (website) leadData.fields.website = website;

  const location = getValue('location');
  if (location) leadData.fields.location = location;

  const industry = getValue('industry');
  if (industry) leadData.fields.industry = industry;

  const connectionDate = getValue('connectionDate');
  if (connectionDate) leadData.fields.connectionDate = connectionDate;

  const notes = getValue('notes');
  if (notes) leadData.fields.notes = notes;

  const linkedinUrl = getValue('linkedinUrl');
  if (linkedinUrl) leadData.fields.linkedinUrl = linkedinUrl;

  // Add LinkedIn-specific metadata
  leadData.fields.importSource = 'linkedin_csv';
  leadData.fields.importedAt = new Date().toISOString();

  // Set source-specific UTM-like tracking
  leadData.utm.source = 'linkedin';
  leadData.utm.medium = 'csv_import';
  leadData.utm.campaign = 'linkedin_connections';

  return leadData;
}

/**
 * Validate CSV structure and suggest column mappings
 */
export async function analyzeLinkedInCsv(csvContent: string): Promise<{
  totalRows: number;
  headers: string[];
  sampleData: Record<string, any>[];
  suggestedMapping: ColumnMapping;
  issues: string[];
}> {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });

    const headers = Object.keys(records[0] || {});
    const sampleData = records.slice(0, 3); // First 3 rows as sample

    // Suggest column mappings based on header names
    const suggestedMapping: ColumnMapping = {};
    const issues: string[] = [];

    // Email mapping (critical)
    const emailHeaders = headers.filter(h => 
      /email/i.test(h) || /e-?mail/i.test(h)
    );
    if (emailHeaders.length > 0) {
      suggestedMapping.email = emailHeaders[0];
    } else {
      issues.push('No email column detected - this is required');
    }

    // Name mappings
    const firstNameHeaders = headers.filter(h => 
      /first.?name/i.test(h) || /given.?name/i.test(h) || /fname/i.test(h)
    );
    if (firstNameHeaders.length > 0) {
      suggestedMapping.firstName = firstNameHeaders[0];
    }

    const lastNameHeaders = headers.filter(h => 
      /last.?name/i.test(h) || /surname/i.test(h) || /family.?name/i.test(h) || /lname/i.test(h)
    );
    if (lastNameHeaders.length > 0) {
      suggestedMapping.lastName = lastNameHeaders[0];
    }

    const fullNameHeaders = headers.filter(h => 
      /^name$/i.test(h) || /full.?name/i.test(h) || /contact.?name/i.test(h)
    );
    if (fullNameHeaders.length > 0) {
      suggestedMapping.fullName = fullNameHeaders[0];
    }

    // Company mapping
    const companyHeaders = headers.filter(h => 
      /company/i.test(h) || /organization/i.test(h) || /employer/i.test(h)
    );
    if (companyHeaders.length > 0) {
      suggestedMapping.company = companyHeaders[0];
    }

    // Title mapping
    const titleHeaders = headers.filter(h => 
      /position/i.test(h) || /title/i.test(h) || /job/i.test(h) || /role/i.test(h)
    );
    if (titleHeaders.length > 0) {
      suggestedMapping.title = titleHeaders[0];
    }

    // Phone mapping
    const phoneHeaders = headers.filter(h => 
      /phone/i.test(h) || /mobile/i.test(h) || /contact/i.test(h)
    );
    if (phoneHeaders.length > 0) {
      suggestedMapping.phone = phoneHeaders[0];
    }

    // Website mapping
    const websiteHeaders = headers.filter(h => 
      /website/i.test(h) || /url/i.test(h) || /site/i.test(h)
    );
    if (websiteHeaders.length > 0) {
      suggestedMapping.website = websiteHeaders[0];
    }

    // Location mapping
    const locationHeaders = headers.filter(h => 
      /location/i.test(h) || /address/i.test(h) || /city/i.test(h)
    );
    if (locationHeaders.length > 0) {
      suggestedMapping.location = locationHeaders[0];
    }

    // Industry mapping
    const industryHeaders = headers.filter(h => 
      /industry/i.test(h) || /sector/i.test(h) || /business/i.test(h)
    );
    if (industryHeaders.length > 0) {
      suggestedMapping.industry = industryHeaders[0];
    }

    // LinkedIn URL mapping
    const linkedinHeaders = headers.filter(h => 
      /linkedin/i.test(h) || /profile/i.test(h)
    );
    if (linkedinHeaders.length > 0) {
      suggestedMapping.linkedinUrl = linkedinHeaders[0];
    }

    // Connection date mapping
    const dateHeaders = headers.filter(h => 
      /connected/i.test(h) || /connection.?date/i.test(h) || /date/i.test(h)
    );
    if (dateHeaders.length > 0) {
      suggestedMapping.connectionDate = dateHeaders[0];
    }

    // Notes mapping
    const notesHeaders = headers.filter(h => 
      /notes/i.test(h) || /comments/i.test(h) || /description/i.test(h)
    );
    if (notesHeaders.length > 0) {
      suggestedMapping.notes = notesHeaders[0];
    }

    // Validation
    if (!suggestedMapping.email) {
      issues.push('Email column is required but not found');
    }
    if (!suggestedMapping.firstName && !suggestedMapping.lastName && !suggestedMapping.fullName) {
      issues.push('No name columns detected');
    }
    if (records.length === 0) {
      issues.push('CSV file appears to be empty');
    }
    if (records.length > 10000) {
      issues.push('CSV file is very large (>10k rows) - consider splitting into smaller files');
    }

    return {
      totalRows: records.length,
      headers,
      sampleData,
      suggestedMapping,
      issues
    };

  } catch (error) {
    throw new Error(`Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * POST /ingest/linkedin-csv/analyze - Analyze CSV before import
 */
export async function registerLinkedInAnalysisRoute(app: FastifyInstance) {
  app.post('/ingest/linkedin-csv/analyze', { preHandler: authenticate }, async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      // Get uploaded file
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }

      // Validate file type
      if (!data.filename?.endsWith('.csv')) {
        return reply.code(400).send({ error: 'File must be a CSV' });
      }

      // Read and analyze CSV
      const buffer = await data.toBuffer();
      const csvContent = buffer.toString('utf-8');

      const analysis = await analyzeLinkedInCsv(csvContent);

      return reply.send(analysis);

    } catch (error) {
      app.log.error('CSV analysis failed:', error);
      return reply.code(500).send({ 
        error: 'CSV analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
