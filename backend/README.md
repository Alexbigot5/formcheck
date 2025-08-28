# SmartForms AI Backend

TypeScript backend API built with Fastify, Prisma, and PostgreSQL.

## Features

- **Authentication**: JWT-based auth with registration/login
- **Forms Management**: CRUD operations for form schemas
- **Lead Management**: Lead capture, scoring, and timeline tracking
- **Integrations**: HubSpot, Salesforce, Slack webhooks
- **Database**: PostgreSQL with Prisma ORM
- **Security**: Environment validation, HMAC password hashing

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:4000`

## API Endpoints

### Health
- `GET /health` - Health check

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### Forms
- `GET /api/forms` - Get all forms
- `GET /api/forms/:id` - Get single form
- `POST /api/forms` - Create form
- `PUT /api/forms/:id` - Update form
- `DELETE /api/forms/:id` - Delete form

### Leads
- `GET /api/leads` - Get leads with filters
- `GET /api/leads/:id` - Get single lead with timeline
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `POST /api/leads/:id/timeline` - Add timeline event

### Integrations
- `POST /api/integrations/hubspot/callback` - HubSpot OAuth
- `POST /api/integrations/salesforce/callback` - Salesforce OAuth
- `GET /api/integrations/status` - Integration status
- `POST /api/integrations/slack/test` - Test Slack webhook
- `POST /api/webhooks/lead` - External lead webhook

## Environment Variables

```bash
NODE_ENV=development
PORT=4000
DATABASE_URL="postgresql://user:password@localhost:5432/smartforms"
JWT_SECRET="your-jwt-secret"
HMAC_SECRET="your-hmac-secret"
SECRET_VAULT_KEY="your-vault-key"

# Optional integrations
SLACK_WEBHOOK_URL=""
IMAP_HOST=""
IMAP_USER=""
IMAP_PASS=""
GMAIL_CLIENT_ID=""
GMAIL_CLIENT_SECRET=""
GMAIL_REDIRECT_URI=""

# Required CRM integrations
HUBSPOT_CLIENT_ID=""
HUBSPOT_CLIENT_SECRET=""
HUBSPOT_REDIRECT_URL="http://localhost:4000/integrations/hubspot/callback"
SALESFORCE_CLIENT_ID=""
SALESFORCE_CLIENT_SECRET=""
SALESFORCE_REDIRECT_URL="http://localhost:4000/integrations/salesforce/callback"
SALESFORCE_LOGIN_URL="https://login.salesforce.com"
```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations

## Database Schema

The database includes tables for:
- **Users**: Authentication and user management
- **Forms**: Form schemas and configuration
- **Leads**: Lead data and scoring
- **TimelineEvents**: Activity tracking for leads

## Development

The backend is structured with:
- `/src/config/` - Configuration and environment loading
- `/src/types/` - Shared TypeScript types
- `/src/modules/` - Feature modules (auth, forms, leads, integrations)
- `/src/plugins/` - Fastify plugins (Prisma, etc.)
- `/prisma/` - Database schema and migrations

## Production Deployment

1. Set up PostgreSQL database
2. Configure environment variables
3. Run migrations: `npm run prisma:migrate`
4. Build: `npm run build`
5. Start: `npm start`

## Security Notes

- JWT tokens for authentication
- HMAC for password hashing
- Environment validation with Zod
- CORS configured for cross-origin requests
- Rate limiting recommended for production
