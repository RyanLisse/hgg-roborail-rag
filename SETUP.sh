#!/bin/bash

# Setup script for AI Chatbot RAG System
# Idempotent setup with error handling for cloud agents

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🤖 Setting up AI Chatbot RAG System...${NC}"

# Check if running in CI/cloud environment
if [ "$CI" = "true" ] || [ -n "$CODESPACE_NAME" ] || [ -n "$GITPOD_WORKSPACE_ID" ]; then
    echo -e "${YELLOW}📦 Detected cloud/CI environment${NC}"
    CLOUD_ENV=true
else
    CLOUD_ENV=false
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
if ! command_exists node; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"

# Check/Install pnpm
if ! command_exists pnpm; then
    echo -e "${YELLOW}📦 Installing pnpm...${NC}"
    npm install -g pnpm
else
    echo -e "${GREEN}✅ pnpm $(pnpm --version) detected${NC}"
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile || pnpm install

# Check for .env.local file
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}⚠️  Copying .env.example to .env.local${NC}"
        cp .env.example .env.local
        echo -e "${YELLOW}⚠️  Please update .env.local with your actual values${NC}"
    else
        echo -e "${RED}❌ No .env.example found. Environment setup required.${NC}"
    fi
else
    echo -e "${GREEN}✅ Environment file found${NC}"
fi

# Database setup (if not in cloud environment)
if [ "$CLOUD_ENV" = false ]; then
    echo -e "${BLUE}🗄️  Setting up database...${NC}"
    
    # Only run migrations if POSTGRES_URL is set
    if grep -q "POSTGRES_URL=" .env.local && ! grep -q "POSTGRES_URL=\*\*\*\*" .env.local; then
        pnpm db:migrate || echo -e "${YELLOW}⚠️  Database migration failed - please check your POSTGRES_URL${NC}"
    else
        echo -e "${YELLOW}⚠️  POSTGRES_URL not configured - skipping database setup${NC}"
    fi
fi

# Verify TypeScript
echo -e "${BLUE}🔧 Checking TypeScript...${NC}"
pnpm exec tsc --noEmit || echo -e "${YELLOW}⚠️  TypeScript check had issues${NC}"

# Run linting
echo -e "${BLUE}🔍 Running linters...${NC}"
pnpm lint || echo -e "${YELLOW}⚠️  Linting had issues${NC}"

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}📝 Next steps:${NC}"
echo -e "   1. Update .env.local with your API keys and database URL"
echo -e "   2. Run 'pnpm dev' to start development server"
echo -e "   3. Visit http://localhost:3000 to see your app"

if [ "$CLOUD_ENV" = false ]; then
    echo -e "${BLUE}💡 Pro tip: Use 'make dev' for enhanced development experience${NC}"
fi