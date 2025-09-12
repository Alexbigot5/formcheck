# Railway Environment Variables Setup

## Required Environment Variables

You need to set these environment variables in your Railway project dashboard:

### Database Configuration
```
DATABASE_URL=postgresql://username:password@host:port/database
```
*Railway will provide this automatically when you add a PostgreSQL database service*

### Security Secrets
```
JWT_SECRET=your-jwt-secret-key-minimum-16-chars
HMAC_SECRET=your-hmac-secret-key-minimum-16-chars  
SECRET_VAULT_KEY=your-vault-secret-key-minimum-16-chars
```

### Application Configuration
```
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://your-frontend-domain.com
```

### Optional Integrations (set if needed)
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Email Configuration
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
IMAP_SECURE=true

# OAuth Credentials
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
GMAIL_REDIRECT_URI=https://your-backend-domain.railway.app/auth/gmail/callback

HUBSPOT_CLIENT_ID=your-hubspot-client-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
HUBSPOT_REDIRECT_URL=https://your-backend-domain.railway.app/auth/hubspot/callback

SALESFORCE_CLIENT_ID=your-salesforce-client-id
SALESFORCE_CLIENT_SECRET=your-salesforce-client-secret
SALESFORCE_REDIRECT_URL=https://your-backend-domain.railway.app/auth/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Click on your backend service
3. Go to the "Variables" tab
4. Add each environment variable one by one
5. Deploy your service

## Quick Setup Commands

Generate secure random secrets:
```bash
# Generate JWT_SECRET
openssl rand -hex 32

# Generate HMAC_SECRET  
openssl rand -hex 32

# Generate SECRET_VAULT_KEY
openssl rand -hex 32
```

## Database Setup

1. In Railway dashboard, click "Add Service" → "Database" → "PostgreSQL"
2. Railway will automatically create a `DATABASE_URL` environment variable
3. Your backend service will automatically have access to this database

## Troubleshooting

- Make sure all required variables are set
- Check that secrets are at least 16 characters long
- Verify DATABASE_URL is correctly formatted
- Ensure FRONTEND_URL matches your actual frontend domain
