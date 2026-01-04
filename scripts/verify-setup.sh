#!/bin/bash

# Verify Homeshare v2 Project Setup

echo "🏠 Homeshare v2 Project Verification"
echo "===================================="
echo ""

# Check Node.js version
echo "📦 Node.js version:"
node --version
echo ""

# Check pnpm version
echo "📦 pnpm version:"
pnpm --version
echo ""

# Check project structure
echo "📁 Project structure:"
if [ -f "package.json" ] && [ -f "pnpm-workspace.yaml" ]; then
    echo "✅ Root configuration files present"
else
    echo "❌ Missing root configuration files"
fi

if [ -d "packages/frontend" ] && [ -d "packages/backend" ] && [ -d "packages/contracts" ]; then
    echo "✅ All packages exist"
else
    echo "❌ Missing packages"
fi

if [ -d "docs" ]; then
    echo "✅ Documentation directory exists"
    echo "   - $(ls docs/*.md | wc -l) documentation files"
else
    echo "❌ Missing documentation"
fi
echo ""

# Check package installations
echo "📦 Package installations:"
if [ -d "node_modules" ]; then
    echo "✅ Root dependencies installed"
else
    echo "⚠️  Root dependencies not installed (run 'pnpm install')"
fi

if [ -d "packages/frontend/node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Frontend dependencies not installed"
fi

if [ -d "packages/backend/node_modules" ]; then
    echo "✅ Backend dependencies installed"
else
    echo "⚠️  Backend dependencies not installed"
fi

if [ -d "packages/contracts/node_modules" ]; then
    echo "✅ Contracts dependencies installed"
else
    echo "⚠️  Contracts dependencies not installed"
fi
echo ""

# Check key files
echo "🔍 Key files check:"
FILES=(
    "packages/frontend/src/App.tsx"
    "packages/frontend/src/store/index.ts"
    "packages/frontend/src/config/chains.config.ts"
    "packages/backend/src/app.ts"
    "packages/backend/src/server.ts"
    "packages/contracts/contracts/PropertyToken.sol"
    "packages/contracts/contracts/PropertyCrowdfund.sol"
    "packages/contracts/hardhat.config.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file"
    fi
done
echo ""

# Check environment files
echo "📋 Environment templates:"
if [ -f "packages/frontend/.env.example" ]; then
    echo "✅ Frontend .env.example"
else
    echo "❌ Frontend .env.example"
fi

if [ -f "packages/backend/.env.example" ]; then
    echo "✅ Backend .env.example"
else
    echo "❌ Backend .env.example"
fi

if [ -f "packages/contracts/.env.example" ]; then
    echo "✅ Contracts .env.example"
else
    echo "❌ Contracts .env.example"
fi
echo ""

# Summary
echo "===================================="
echo "✨ Project initialization complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example files to .env.local in each package"
echo "2. Configure environment variables"
echo "3. Run 'pnpm dev' to start development servers"
echo "4. Deploy contracts with 'cd packages/contracts && pnpm compile'"
echo ""
echo "For more information, see docs/SETUP.md"
