#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# SETUP.sh - Automated Environment Setup for AI Chatbot RAG System
# Usage: ./SETUP.sh [--test-env] [--workspace <dir>] [--quiet]
# -----------------------------------------------------------------------------
set -euo pipefail
trap 'echo -e "${RED}✖ Error on line $LINENO - setup stopped${NC}"' ERR

# ────────────────────────── Colors & Logging ────────────────────────────────
declare -r RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m'
declare -r BLUE='\033[0;34m' NC='\033[0m'

log() { echo -e "${BLUE}ℹ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
error() {
    echo -e "${RED}✖ $*${NC}"
    exit 1
}
ok() { echo -e "${GREEN}✔ $*${NC}"; }

# ────────────────────────────── Helpers ──────────────────────────────────────
require_cmd() {
    command -v "$1" &>/dev/null || error "$1 not found - please install it first."
}

semver_ge() { # semver_ge 18 20.10.2  → true | false
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]
}

install_pnpm() {
    if ! command -v pnpm &>/dev/null; then
        log "pnpm not found - installing..."
        npm install -g pnpm@9.12.3 ${QUIET:+--silent}
    fi
    ok "pnpm $(pnpm --version) available"
}

copy_env() {
    local tpl=".env.example" out=".env.local"
    if [[ ! -f $out ]]; then
        [[ -f $tpl ]] || {
            warn "No $tpl found"
            return
        }
        cp "$tpl" "$out" && warn "$tpl → $out copied - fill in your real secrets."
    else
        ok "$out exists"
    fi
}

write_test_env() {
    cat >.env.local <<'EOF'
NODE_ENV=test
AUTH_SECRET=test-auth-secret-for-unit-tests-only
POSTGRES_URL=postgresql://test:test@localhost:5432/test
OPENAI_API_KEY=sk-test1234567890abcdef1234567890abcdef1234567890abcdef
ANTHROPIC_API_KEY=sk-ant-test1234567890abcdef1234567890abcdef1234567890abcdef
GOOGLE_GENERATIVE_AI_API_KEY=AIzaSyTest1234567890abcdef1234567890abcdef
COHERE_API_KEY=test-cohere-key-1234567890abcdef
GROQ_API_KEY=gsk_test1234567890abcdef1234567890abcdef1234567890abcdef
XAI_API_KEY=xai-test1234567890abcdef1234567890abcdef1234567890abcdef
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_test1234567890abcdef_1234567890abcdef
REDIS_URL=redis://localhost:6379
LANGSMITH_API_KEY=lsv2_pt_test1234567890abcdef1234567890abcdef
LANGSMITH_PROJECT=test-project
LANGSMITH_TRACING=false
NEON_DATABASE_URL=postgresql://test:test@localhost:5432/test
EOF
    ok "Test .env.local created"
}

install_deps() {
    log "Installing dependencies..."
    pnpm install --frozen-lockfile ${QUIET:+--silent} ||
        pnpm install ${QUIET:+--silent}
}

run_quality_checks() {
    log "TypeScript check..."
    pnpm exec tsc --noEmit || warn "TypeScript errors found"

    log "Linting..."
    pnpm lint || warn "Lint issues found"
}

db_setup() {
    [[ $CLOUD_ENV == true ]] && return
    grep -q "^POSTGRES_URL=" .env.local 2>/dev/null || {
        warn "POSTGRES_URL missing - database migrations skipped"
        return
    }
    log "Running database migrations..."
    pnpm db:migrate || warn "Database migration failed"
}

# ─────────────────────── Argument‑parsing ────────────────────────────────────
TEST_ENV=false
WORKSPACE="$(pwd)"
QUIET=""
while [[ $# -gt 0 ]]; do
    case $1 in
    --test-env) TEST_ENV=true ;;
    --workspace)
        WORKSPACE="$2"
        shift
        ;;
    --quiet) QUIET=true ;;
    -h | --help)
        echo "Usage: $0 [--test-env] [--workspace <dir>] [--quiet]"
        exit 0
        ;;
    *) error "Unknown flag: $1" ;;
    esac
    shift
done

# ─────────────────────── Start Installation Flow ──────────────────────────────
echo -e "${BLUE}🤖 Setup AI Chatbot / RAG System…${NC}"

# Detecteer cloud/CI‑omgeving
if [[ ${CI:-} == "true" || -n ${CODESPACE_NAME:-} || -n ${GITPOD_WORKSPACE_ID:-} ]]; then
    CLOUD_ENV=true
    warn "Cloud/CI‑omgeving gedetecteerd"
else
    CLOUD_ENV=false
fi

require_cmd node
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
semver_ge 18 "$NODE_MAJOR" ||
    error "Node.js $NODE_MAJOR te oud – versie ≥18 vereist"
ok "Node.js $(node --version) gedetecteerd"

install_pnpm

# Ga naar workspace
cd "$WORKSPACE" || error "Workspace $WORKSPACE bestaat niet"
ok "Workspace: $WORKSPACE"

# Env‑bestanden
if [[ $TEST_ENV == true ]]; then
    write_test_env
else
    copy_env
fi

install_deps
db_setup
run_quality_checks

ok "Setup afgerond 🎉"
echo -e "${BLUE}Volgende stappen:${NC}
  1. Vul .env.local met echte API‑sleutels / DB‑url
  2. pnpm dev            # start lokale server
  3. http://localhost:3000 bezoeken
${CLOUD_ENV:+(Tip: maak gebruik van 'make dev' voor extra tooling)}"
