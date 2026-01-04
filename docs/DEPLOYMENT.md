# Deployment Guide

## Overview

This guide covers deploying the Homeshare v2 platform to production environments across multiple blockchain networks.

## Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Security audit completed
- [ ] Environment variables configured
- [ ] Database backup strategy in place
- [ ] Monitoring and alerting configured
- [ ] Domain and SSL certificates ready
- [ ] RPC endpoints configured for all chains

## Smart Contract Deployment

### 1. Prepare for Deployment

```bash
cd packages/contracts

# Install dependencies
pnpm install

# Compile contracts
pnpm compile

# Run tests
pnpm test
```

### 2. Configure Networks

Update `hardhat.config.ts` with production RPC URLs and ensure `.env.local` contains:

```env
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CANTON_RPC_URL=https://canton-rpc.example.com
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY
BASESCAN_API_KEY=YOUR_BASESCAN_KEY
```

⚠️ **Security Warning**: Never commit private keys. Use hardware wallets or secure key management for production.

### 3. Deploy to Networks

#### Ethereum Mainnet

```bash
pnpm deploy:ethereum
```

#### Base Network

```bash
pnpm deploy:base
```

#### Canton Network

```bash
pnpm deploy:canton
```

### 4. Verify Contracts

```bash
# Ethereum
npx hardhat verify --network ethereum CONTRACT_ADDRESS "Constructor" "Args"

# Base
npx hardhat verify --network base CONTRACT_ADDRESS "Constructor" "Args"
```

### 5. Save Contract Addresses

Record all deployed contract addresses and update:
- `packages/frontend/src/config/contracts.config.ts`
- `packages/backend/.env.production`

## Backend Deployment

### 1. Prepare Backend

```bash
cd packages/backend

# Build TypeScript
pnpm build

# Test build
node dist/server.js
```

### 2. Database Setup

```bash
# Production database
createdb homeshare_production

# Run migrations (when implemented)
pnpm migrate
```

### 3. Configure Environment

Create `.env.production`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:password@db-host:5432/homeshare_production

# Chain RPC URLs
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CANTON_RPC_URL=https://canton-rpc.example.com

# Contract addresses (from deployment)
ETHEREUM_PROPERTY_TOKEN=0x...
ETHEREUM_PROPERTY_CROWDFUND=0x...
BASE_PROPERTY_TOKEN=0x...
BASE_PROPERTY_CROWDFUND=0x...
CANTON_PROPERTY_TOKEN=0x...
CANTON_PROPERTY_CROWDFUND=0x...

# Security
JWT_SECRET=SECURE_RANDOM_STRING_HERE
JWT_EXPIRY=7d
```

### 4. Deploy Backend

#### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start dist/server.js --name homeshare-backend

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

#### Using Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

```bash
# Build and run
docker build -t homeshare-backend .
docker run -d -p 3000:3000 --env-file .env.production homeshare-backend
```

## Frontend Deployment

### 1. Build Frontend

```bash
cd packages/frontend

# Build for production
pnpm build
```

This creates optimized files in `dist/` directory.

### 2. Configure Environment

Create `.env.production`:

```env
VITE_APP_NAME=Homeshare
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_DEFAULT_CHAIN=ethereum
VITE_SUPPORTED_CHAINS=ethereum,base,canton
```

### 3. Deploy Frontend

#### Using Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

#### Using Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

#### Using Traditional Web Server (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    root /var/www/homeshare/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Post-Deployment

### 1. Verify Deployment

- [ ] Frontend loads correctly
- [ ] Backend health check responds: `https://api.yourdomain.com/health`
- [ ] Can connect wallet
- [ ] Can switch between chains
- [ ] Smart contracts respond correctly

### 2. Initialize Data

```bash
# Add supported chains to ChainRegistry
# Add supported tokens
# Create initial test properties (optional)
```

### 3. Monitoring

Setup monitoring for:
- Backend uptime and response times
- Database performance
- Blockchain node connectivity
- Error rates and exceptions
- Transaction success rates

### 4. Backup Strategy

```bash
# Database backups
pg_dump homeshare_production > backup_$(date +%Y%m%d).sql

# Setup automated backups
crontab -e
# Add: 0 2 * * * pg_dump homeshare_production > /backups/backup_$(date +\%Y\%m\%d).sql
```

## Maintenance

### Updating Smart Contracts

Smart contracts are immutable once deployed. To update:
1. Deploy new version
2. Migrate data if needed
3. Update contract addresses in backend/frontend
4. Communicate changes to users

### Updating Backend

```bash
cd packages/backend
git pull
pnpm install
pnpm build
pm2 restart homeshare-backend
```

### Updating Frontend

```bash
cd packages/frontend
git pull
pnpm install
pnpm build
# Upload new dist/ to hosting provider
```

## Rollback Procedures

### Backend Rollback

```bash
# Using PM2
pm2 stop homeshare-backend
# Deploy previous version
pm2 start dist/server.js
```

### Frontend Rollback

- Vercel/Netlify: Use their dashboard to rollback
- Nginx: Replace dist/ with previous version

### Database Rollback

```bash
# Restore from backup
psql homeshare_production < backup_YYYYMMDD.sql
```

## Security Checklist

- [ ] Private keys stored securely (never in code)
- [ ] Environment variables not exposed to frontend
- [ ] HTTPS enabled everywhere
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Database credentials rotated
- [ ] Smart contracts audited
- [ ] Dependencies updated and scanned

## Support & Troubleshooting

### Common Issues

**Contract deployment fails:**
- Check gas price and limits
- Verify RPC endpoint is working
- Ensure sufficient funds in deployer account

**Backend won't start:**
- Check database connection
- Verify all environment variables set
- Check logs for specific errors

**Frontend can't connect to contracts:**
- Verify contract addresses in config
- Check user is on correct network
- Ensure RPC endpoints accessible

## Cost Estimates

### Initial Deployment
- Contract deployment (per chain): ~$50-200 in gas fees
- Domain name: ~$10-20/year
- SSL certificate: Free (Let's Encrypt)

### Monthly Operating Costs
- Backend hosting: ~$20-50/month
- Frontend hosting: ~$0-20/month (depends on traffic)
- RPC services: ~$0-100/month (depends on usage)
- Database: ~$10-30/month
