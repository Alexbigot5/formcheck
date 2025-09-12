import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  HMAC_SECRET: z.string().min(16),
  SECRET_VAULT_KEY: z.string().min(16),

  // Frontend configuration
  FRONTEND_URL: z.string().url().default('http://localhost:8080'),

  SLACK_WEBHOOK_URL: z.string().url().optional(),

  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().optional(),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_SECURE: z.string().optional(),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REDIRECT_URI: z.string().url().optional(),

  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  HUBSPOT_REDIRECT_URL: z.string().url().optional(),

  SALESFORCE_CLIENT_ID: z.string().optional(),
  SALESFORCE_CLIENT_SECRET: z.string().optional(),
  SALESFORCE_REDIRECT_URL: z.string().url().optional(),
  SALESFORCE_LOGIN_URL: z.string().url().optional(),

  // Supabase configuration (for auth verification)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  console.log('=== LOADING ENVIRONMENT VARIABLES ===');
  console.log('Available env vars:', Object.keys(process.env).filter(key => 
    key.includes('DATABASE') || key.includes('JWT') || key.includes('SECRET') || 
    key.includes('PORT') || key.includes('NODE_ENV') || key.includes('SUPABASE')
  ));
  
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('=== ENVIRONMENT VALIDATION FAILED ===');
    console.error('Errors:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    console.error('Raw process.env sample:', {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET'
    });
    throw new Error('Invalid environment configuration');
  }
  console.log('=== ENVIRONMENT LOADED SUCCESSFULLY ===');
  return parsed.data;
}


