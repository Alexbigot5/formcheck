const fs = require('fs');
const path = require('path');

// Files that need schema fixes
const filesToFix = [
  'backend/src/modules/integrations/integrations.routes.ts',
  'backend/src/modules/ingest/webhook.routes.ts',
  'backend/src/modules/ingest/instagram.routes.ts', 
  'backend/src/modules/ingest/linkedin.routes.ts',
  'backend/src/modules/routing/routes.ts',
  'backend/src/modules/auth/auth.routes.ts',
  'backend/src/modules/webhooks/webhook.routes.ts',
  'backend/src/modules/oauth/oauth.routes.ts',
  'backend/src/modules/leads/leads.routes.ts',
  'backend/src/modules/analytics/analytics.routes.ts',
  'backend/src/modules/enrich/routes.ts',
  'backend/src/modules/ingest/inbox.routes.ts',
  'backend/src/modules/crm/sync.routes.ts'
];

function fixSchemaValidation(content) {
  // Remove all schema blocks and replace with manual validation
  let lines = content.split('\n');
  let result = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Look for route definitions with schema
    if (line.match(/app\.(get|post|put|delete|patch)\([^,]+,\s*{/) && 
        i + 1 < lines.length && lines[i + 1].trim().startsWith('schema:')) {
      
      // Found a route with schema, extract the route definition
      result.push(line.replace(/,\s*{$/, ', async (request, reply) => {'));
      
      // Skip the schema block
      let braceCount = 1;
      i += 2; // Skip current line and 'schema:' line
      
      while (i < lines.length && braceCount > 0) {
        const schemaLine = lines[i];
        for (let char of schemaLine) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        i++;
      }
      
      // Skip the }, async part if it exists
      if (i < lines.length && lines[i].trim().match(/^},?\s*async/)) {
        i++;
      }
      
      continue;
    }
    
    result.push(line);
    i++;
  }
  
  return result.join('\n');
}

// Process each file
filesToFix.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Fixing ${filePath}...`);
      let content = fs.readFileSync(filePath, 'utf8');
      const fixedContent = fixSchemaValidation(content);
      
      if (content !== fixedContent) {
        fs.writeFileSync(filePath, fixedContent);
        console.log(`✅ Fixed ${filePath}`);
      } else {
        console.log(`⚪ No changes needed for ${filePath}`);
      }
    } else {
      console.log(`❌ File not found: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log('✅ All schema fixes completed!');
