# API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://api.yourdomain.com/api
```

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Get Token

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "signature": "0x...",
  "message": "Sign-in request for Homeshare",
  "role": "owner"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "role": "owner"
  }
}
```

### Verify Token

```http
POST /api/auth/verify
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "uuid",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "role": "owner"
  }
}
```

## Endpoints

### Health Check

Check API status.

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Properties

### List Properties

Get all properties across all chains. In the current development build, this endpoint returns database records created during runtime.

```http
GET /api/properties
```

**Query Parameters:** none

**Response:**
```json
{
  "properties": [
    {
      "id": "property_1700000000000_1234",
      "name": "Luxury Apartment Downtown",
      "description": "Modern 2BR apartment in city center",
      "location": "New York, NY",
      "totalValue": 1000000,
      "tokenSupply": 100000,
      "chain": "sepolia",
      "status": "draft",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Get Property Details

Get details of a specific property.

```http
GET /api/properties/:id
```

**Response:**
```json
{
  "property": {
    "id": "property_1700000000000_1234",
    "name": "Luxury Apartment Downtown",
    "description": "Modern 2BR apartment in city center",
    "location": "New York, NY",
    "totalValue": 1000000,
    "tokenSupply": 100000,
    "chain": "sepolia",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Property

Create a new property. Requires an authenticated owner token.

```http
POST /api/properties
```

**Request Body:**
```json
{
  "name": "Luxury Apartment Downtown",
  "description": "Modern 2BR apartment in city center",
  "location": "New York, NY",
  "totalValue": 1000000,
  "tokenSupply": 100000,
  "chain": "sepolia",
  "status": "draft"
}
```

**Response:**
```json
{
  "property": {
    "id": "property_1700000000000_1234",
    "name": "Luxury Apartment Downtown",
    "description": "Modern 2BR apartment in city center",
    "location": "New York, NY",
    "totalValue": 1000000,
    "tokenSupply": 100000,
    "chain": "sepolia",
    "status": "draft",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Investments

### List User Investments

Get all investments. In the current development build, you can optionally filter by investor.

```http
GET /api/investments
```

**Query Parameters:**
- `investor` (optional): Filter by investor wallet address

**Response:**
```json
{
  "investments": [
    {
      "id": "investment_1700000000000_1234",
      "propertyId": "property_1700000000000_1234",
      "investor": "0x1234...",
      "amount": 1000,
      "tokenAmount": 100,
      "chain": "sepolia",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Record Investment

Record a new investment.

```http
POST /api/investments
```

**Request Body:**
```json
{
  "propertyId": "property_1700000000000_1234",
  "investor": "0x1234...",
  "amount": 1000,
  "tokenAmount": 100,
  "chain": "sepolia"
}
```

**Response:**
```json
{
  "investment": {
    "id": "investment_1700000000000_1234",
    "propertyId": "property_1700000000000_1234",
    "investor": "0x1234...",
    "amount": 1000,
    "tokenAmount": 100,
    "chain": "sepolia",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## Chains

### List Supported Chains

Get all supported blockchain networks.

```http
GET /api/chains
```

**Response:**
```json
{
  "chains": [
    {
      "id": 1,
      "name": "Ethereum",
      "symbol": "ETH",
      "rpcUrl": "https://...",
      "blockExplorer": "https://etherscan.io",
      "isTestnet": false
    },
    {
      "id": 8453,
      "name": "Base",
      "symbol": "ETH",
      "rpcUrl": "https://...",
      "blockExplorer": "https://basescan.org",
      "isTestnet": false
    },
    {
      "id": 9000,
      "name": "Canton",
      "symbol": "CC",
      "rpcUrl": "https://...",
      "blockExplorer": "https://...",
      "isTestnet": false
    }
  ]
}
```

---

## Tokens

### List Tokens

Get supported tokens, optionally filtered by chain.

```http
GET /api/tokens?chainId=1
```

**Query Parameters:**
- `chainId` (optional): Filter by chain ID

**Response:**
```json
{
  "tokens": [
    {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "chainId": 1,
      "logoUrl": "https://..."
    },
    {
      "address": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "symbol": "USDT",
      "name": "Tether USD",
      "decimals": 6,
      "chainId": 1,
      "logoUrl": "https://..."
    }
  ]
}
```

---

## Error Responses

All endpoints return errors in the following format:

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "message": "Property ID is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "message": "No token provided"
}
```

**403 Forbidden:**
```json
{
  "error": "Permission denied",
  "message": "Owner role required"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found",
  "message": "Property not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Rate Limiting

API requests are rate limited:
- **Authenticated requests**: 100 requests per minute
- **Unauthenticated requests**: 20 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705075260
```

---

## Pagination

List endpoints support pagination using query parameters:

```http
GET /api/properties?page=2&limit=20
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## WebSocket Events

Real-time updates are available via WebSocket connection:

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle event
};
```

### Event Types

**New Investment:**
```json
{
  "type": "investment.new",
  "data": {
    "propertyId": "prop-1",
    "amount": "1000",
    "investor": "0x..."
  }
}
```

**Property Updated:**
```json
{
  "type": "property.updated",
  "data": {
    "propertyId": "prop-1",
    "currentFunding": "260000"
  }
}
```

**Campaign Finalized:**
```json
{
  "type": "campaign.finalized",
  "data": {
    "propertyId": "prop-1",
    "totalFunding": "500000"
  }
}
```

---

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get properties
const { data } = await api.get('/properties', {
  params: { chainId: 1 }
});

// Create investment
await api.post('/investments', {
  propertyId: 'prop-1',
  amount: '1000',
  tokenAddress: '0x...',
  chainId: 1,
  txHash: '0x...'
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get properties
response = requests.get(
    'http://localhost:3000/api/properties',
    params={'chainId': 1},
    headers=headers
)
properties = response.json()

# Create investment
response = requests.post(
    'http://localhost:3000/api/investments',
    json={
        'propertyId': 'prop-1',
        'amount': '1000',
        'tokenAddress': '0x...',
        'chainId': 1,
        'txHash': '0x...'
    },
    headers=headers
)
```
