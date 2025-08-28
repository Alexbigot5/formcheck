# Authentication & Authorization

SmartForms AI backend implements multiple authentication methods with multi-tenant isolation and comprehensive security features.

## Authentication Methods

### 1. JWT Authentication (App Users)
For web application users and dashboard access.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Token Payload:**
```json
{
  "sub": "user_id",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 2. API Key Authentication (Programmatic Access)
For integrations, form submissions, and programmatic access.

**Headers:**
```
X-API-Key: sk_live_abc123...
```
or
```
Authorization: ApiKey sk_live_abc123...
```

**Key Format:** `sk_live_[64 hex characters]`
**Storage:** SHA-256 hash stored in database

### 3. Webhook HMAC Verification
For secure webhook endpoints with signature verification.

**Headers:**
```
X-Signature: sha256=<hmac_hex>
Content-Type: application/json
```

**Signature Calculation:**
```javascript
const signature = crypto
  .createHmac('sha256', HMAC_SECRET)
  .update(rawBody)
  .digest('hex');
```

## Security Features

### IP Allowlisting
API keys can optionally restrict access to specific IP addresses:

```json
{
  "ipAllowlist": ["192.168.1.100", "10.0.0.0/8"]
}
```

### Multi-Tenant Isolation
All requests are scoped to a team context:
- JWT users: Resolved via User → Owner → Team relationship
- API keys: Direct team association
- Cross-team access is strictly prohibited

### Constant-Time Comparison
HMAC signature verification uses constant-time comparison to prevent timing attacks.

## API Endpoints

### Create API Key
```http
POST /auth/api/keys
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Production Integration",
  "ipAllowlist": ["192.168.1.100"]
}
```

**Response:**
```json
{
  "id": "clp123...",
  "name": "Production Integration",
  "key": "sk_live_abc123...",
  "ipAllowlist": ["192.168.1.100"],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

⚠️ **Note:** The `key` field is only returned once during creation.

### List API Keys
```http
GET /auth/api/keys
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "keys": [
    {
      "id": "clp123...",
      "name": "Production Integration",
      "ipAllowlist": ["192.168.1.100"],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Delete API Key
```http
DELETE /auth/api/keys/:id
Authorization: Bearer <jwt_token>
```

## Usage Examples

### Form Submission with API Key
```javascript
const response = await fetch('/api/leads', {
  method: 'POST',
  headers: {
    'X-API-Key': 'sk_live_abc123...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'lead@example.com',
    name: 'John Doe',
    company: 'Acme Corp'
  })
});
```

### Webhook with HMAC
```javascript
const crypto = require('crypto');
const rawBody = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', process.env.HMAC_SECRET)
  .update(rawBody)
  .digest('hex');

await fetch('/webhooks/generic', {
  method: 'POST',
  headers: {
    'X-Signature': `sha256=${signature}`,
    'Content-Type': 'application/json'
  },
  body: rawBody
});
```

### Dashboard API with JWT
```javascript
const response = await fetch('/api/leads', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Missing authorization token"
}
```

### 403 Forbidden
```json
{
  "error": "IP not allowed"
}
```

### 404 Not Found
```json
{
  "error": "API key not found"
}
```

## Best Practices

1. **Rotate API Keys Regularly** - Delete old keys and create new ones
2. **Use IP Allowlisting** - Restrict API keys to known IP ranges
3. **Monitor Usage** - Track API key usage and detect anomalies
4. **Secure Storage** - Never log or expose API keys in plain text
5. **HTTPS Only** - Always use HTTPS in production
6. **Short JWT Expiry** - Use short-lived JWTs with refresh tokens
