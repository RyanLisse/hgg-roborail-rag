# Makefile for Next.js AI Chatbot Project
# Comprehensive development workflow with port management

.DEFAULT_GOAL := help

# Colors for better output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
PURPLE := \033[0;35m
CYAN := \033[0;36m
WHITE := \033[0;37m
RESET := \033[0m

# Detect OS for cross-platform compatibility
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	OS := macOS
	KILL_PORT := lsof -ti:$(1) | xargs kill -9 2>/dev/null || echo "No process on port $(1)"
else ifeq ($(UNAME_S),Linux)
	OS := Linux
	KILL_PORT := fuser -k $(1)/tcp 2>/dev/null || echo "No process on port $(1)"
else
	OS := Unknown
	KILL_PORT := echo "Port killing not supported on $(OS)"
endif

# Common ports used by this project
DEV_PORTS := 3000 3001
DB_PORTS := 5432 6379
DRIZZLE_PORT := 4983

.PHONY: help install dev build start test test-fast test-debug test-routes test-reliability test-unit test-stagehand test-traditional test-coverage lint format clean clean-all clean-deps clean-cache kill-ports kill-dev kill-postgres kill-redis kill-drizzle db-migrate db-studio db-generate db-push db-pull db-check db-up db-reset setup verify status fresh production-build

# Help target (default) - shows all available commands with descriptions
help:
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(CYAN)                    📚 Next.js AI Chatbot - Development Commands                    $(RESET)"
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo ""
	@echo "$(YELLOW)🚀 Development:$(RESET)"
	@echo "  $(GREEN)dev$(RESET)             - Start development server (kills existing processes first)"
	@echo "  $(GREEN)build$(RESET)           - Build for production (runs migrations first)"
	@echo "  $(GREEN)start$(RESET)          - Start production server"
	@echo "  $(GREEN)install$(RESET)        - Install dependencies with pnpm"
	@echo "  $(GREEN)fresh$(RESET)          - Complete fresh start (clean + install + dev)"
	@echo ""
	@echo "$(YELLOW)🗄️ Database:$(RESET)"
	@echo "  $(GREEN)db-migrate$(RESET)     - Run database migrations"
	@echo "  $(GREEN)db-studio$(RESET)      - Open Drizzle Studio (kills existing first)"
	@echo "  $(GREEN)db-generate$(RESET)    - Generate new migration files"
	@echo "  $(GREEN)db-push$(RESET)        - Push schema changes to database"
	@echo "  $(GREEN)db-pull$(RESET)        - Pull schema from database"
	@echo "  $(GREEN)db-check$(RESET)       - Check migration files"
	@echo "  $(GREEN)db-up$(RESET)          - Apply pending migrations"
	@echo "  $(GREEN)db-reset$(RESET)       - ⚠️  Reset database (with confirmation)"
	@echo ""
	@echo "$(YELLOW)🧪 Testing & Quality:$(RESET)"
	@echo "  $(GREEN)test$(RESET)           - Run all E2E tests with Playwright"
	@echo "  $(GREEN)test-fast$(RESET)      - ⚡ Run optimized E2E tests (60s timeout)"
	@echo "  $(GREEN)test-reliability$(RESET) - 🎯 Run reliability suite (75s timeout)"
	@echo "  $(GREEN)test-debug$(RESET)     - 🐛 Run tests in debug mode (headed browser)"
	@echo "  $(GREEN)test-routes$(RESET)    - 🛣️ Run API route tests only"
	@echo "  $(GREEN)test-stagehand$(RESET) - Run AI-powered Stagehand tests"
	@echo "  $(GREEN)test-traditional$(RESET) - Run traditional E2E tests"
	@echo "  $(GREEN)test-unit$(RESET)      - Run unit tests with Vitest"
	@echo "  $(GREEN)test-coverage$(RESET)  - Run tests with coverage report"
	@echo "  $(GREEN)lint$(RESET)           - Run ESLint and Biome linting"
	@echo "  $(GREEN)format$(RESET)         - Format code with Biome"
	@echo ""
	@echo "$(YELLOW)🛠️ Process Management:$(RESET)"
	@echo "  $(GREEN)kill-ports$(RESET)     - Kill all common development ports"
	@echo "  $(GREEN)kill-dev$(RESET)       - Kill Next.js dev servers (3000, 3001)"
	@echo "  $(GREEN)kill-postgres$(RESET)  - Kill PostgreSQL (5432)"
	@echo "  $(GREEN)kill-redis$(RESET)     - Kill Redis (6379)"
	@echo "  $(GREEN)kill-drizzle$(RESET)   - Kill Drizzle Studio (4983)"
	@echo ""
	@echo "$(YELLOW)🧹 Cleanup:$(RESET)"
	@echo "  $(GREEN)clean$(RESET)          - Clean build artifacts"
	@echo "  $(GREEN)clean-all$(RESET)      - Clean everything (build + deps + cache)"
	@echo "  $(GREEN)clean-deps$(RESET)     - Remove node_modules"
	@echo "  $(GREEN)clean-cache$(RESET)    - Clear pnpm and Next.js caches"
	@echo ""
	@echo "$(YELLOW)🔧 Utilities:$(RESET)"
	@echo "  $(GREEN)setup$(RESET)          - Initial project setup"
	@echo "  $(GREEN)verify$(RESET)         - Check project health"
	@echo "  $(GREEN)status$(RESET)         - Show current project status"
	@echo "  $(GREEN)production-build$(RESET) - Full production build pipeline"
	@echo ""
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(PURPLE)Operating System: $(OS)$(RESET)"
	@echo "$(PURPLE)Package Manager: pnpm$(RESET)"
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"

# Dependency check
check-deps:
	@command -v node >/dev/null 2>&1 || { echo "$(RED)Error: Node.js is required but not installed.$(RESET)"; exit 1; }
	@command -v pnpm >/dev/null 2>&1 || { echo "$(RED)Error: pnpm is required but not installed.$(RESET)"; exit 1; }

# Install dependencies
install: check-deps
	@echo "$(BLUE)📦 Installing dependencies with pnpm...$(RESET)"
	pnpm install

# Port killing functions
kill-port-%:
	@echo "$(YELLOW)🔪 Killing processes on port $*...$(RESET)"
	@$(call KILL_PORT,$*)

kill-dev:
	@echo "$(YELLOW)🔪 Killing Next.js development servers...$(RESET)"
	@for port in $(DEV_PORTS); do \
		lsof -ti:$$port | xargs kill -9 2>/dev/null || echo "No process on port $$port"; \
	done

kill-postgres:
	@echo "$(YELLOW)🔪 Killing PostgreSQL processes...$(RESET)"
	@lsof -ti:5432 | xargs kill -9 2>/dev/null || echo "No process on port 5432"

kill-redis:
	@echo "$(YELLOW)🔪 Killing Redis processes...$(RESET)"
	@lsof -ti:6379 | xargs kill -9 2>/dev/null || echo "No process on port 6379"

kill-drizzle:
	@echo "$(YELLOW)🔪 Killing Drizzle Studio...$(RESET)"
	@lsof -ti:4983 | xargs kill -9 2>/dev/null || echo "No process on port 4983"

kill-ports: kill-dev kill-postgres kill-redis kill-drizzle
	@echo "$(GREEN)✅ All development ports cleared!$(RESET)"

# Development commands
dev: kill-dev check-deps
	@echo "$(BLUE)🚀 Starting development server...$(RESET)"
	pnpm dev

build: check-deps
	@echo "$(BLUE)🏗️  Building for production...$(RESET)"
	pnpm build

start: check-deps
	@echo "$(BLUE)▶️  Starting production server...$(RESET)"
	pnpm start

# Database commands
db-migrate: check-deps
	@echo "$(BLUE)🗄️ Running database migrations...$(RESET)"
	pnpm db:migrate

db-studio: kill-drizzle check-deps
	@echo "$(BLUE)🎨 Opening Drizzle Studio...$(RESET)"
	pnpm db:studio

db-generate: check-deps
	@echo "$(BLUE)⚡ Generating database migrations...$(RESET)"
	pnpm db:generate

db-push: check-deps
	@echo "$(BLUE)📤 Pushing schema changes to database...$(RESET)"
	pnpm db:push

db-pull: check-deps
	@echo "$(BLUE)📥 Pulling schema from database...$(RESET)"
	pnpm db:pull

db-check: check-deps
	@echo "$(BLUE)🔍 Checking migration files...$(RESET)"
	pnpm db:check

db-up: check-deps
	@echo "$(BLUE)⬆️  Applying pending migrations...$(RESET)"
	pnpm db:up

db-reset: check-deps
	@echo "$(RED)⚠️  This will reset your database! All data will be lost.$(RESET)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		echo "$(YELLOW)🗄️ Resetting database...$(RESET)"; \
		pnpm db:push --force; \
	else \
		echo "$(GREEN)✅ Database reset cancelled.$(RESET)"; \
	fi

# Testing commands
test: check-deps
	@echo "$(BLUE)🧪 Running E2E tests with Playwright...$(RESET)"
	@echo "$(YELLOW)⚠️  Starting test with 5-minute timeout...$(RESET)"
	@( \
		pnpm test & \
		TEST_PID=$$! ; \
		( sleep 300 ; echo "$(RED)❌ Tests timed out after 5 minutes, killing...$(RESET)" ; kill -9 $$TEST_PID 2>/dev/null ; $(MAKE) kill-ports ) & \
		TIMEOUT_PID=$$! ; \
		wait $$TEST_PID ; \
		TEST_EXIT=$$? ; \
		kill $$TIMEOUT_PID 2>/dev/null ; \
		if [ $$TEST_EXIT -ne 0 ]; then \
			echo "$(RED)❌ Tests failed, cleaning up...$(RESET)" ; \
			$(MAKE) kill-ports ; \
		fi ; \
		exit $$TEST_EXIT \
	)

test-unit: check-deps
	@echo "$(BLUE)🧪 Running unit tests with Vitest...$(RESET)"
	pnpm test:unit

test-stagehand: check-deps
	@echo "$(BLUE)🤖 Running Stagehand AI-powered tests...$(RESET)"
	@echo "$(YELLOW)⚠️  These tests use AI and may take longer...$(RESET)"
	pnpm test:stagehand

test-traditional: check-deps
	@echo "$(BLUE)🧪 Running traditional E2E tests...$(RESET)"
	pnpm test:traditional

test-coverage: check-deps
	@echo "$(BLUE)📊 Running tests with coverage...$(RESET)"
	pnpm test:coverage

# Optimized test commands for better reliability
test-fast: check-deps
	@echo "$(BLUE)⚡ Running fast E2E tests (optimized)...$(RESET)"
	@$(MAKE) kill-dev
	@sleep 1
	pnpm test --project=e2e --workers=1 --timeout=60000

test-debug: check-deps
	@echo "$(BLUE)🐛 Running tests in debug mode...$(RESET)"
	@$(MAKE) kill-dev
	@sleep 1
	pnpm test --project=e2e --workers=1 --headed --timeout=120000

test-routes: check-deps
	@echo "$(BLUE)🛣️ Running API route tests...$(RESET)"
	pnpm test --project=routes --workers=2 --timeout=30000

test-reliability: check-deps
	@echo "$(BLUE)🎯 Running reliability test suite (reduced timeouts)...$(RESET)"
	@$(MAKE) kill-dev
	@sleep 2
	NEXT_TELEMETRY_DISABLED=1 TURBO_CI=1 pnpm test --project=e2e --workers=1 --retries=1 --timeout=75000

# Code quality commands
lint: check-deps
	@echo "$(BLUE)🔍 Running linters...$(RESET)"
	pnpm lint

format: check-deps
	@echo "$(BLUE)✨ Formatting code...$(RESET)"
	pnpm format

# Cleanup commands
clean:
	@echo "$(YELLOW)🧹 Cleaning build artifacts...$(RESET)"
	rm -rf .next
	rm -rf .turbo
	rm -rf dist
	rm -rf build
	rm -rf out
	@echo "$(GREEN)✅ Build artifacts cleaned!$(RESET)"

clean-deps:
	@echo "$(YELLOW)🧹 Removing node_modules...$(RESET)"
	rm -rf node_modules
	@echo "$(GREEN)✅ Dependencies cleaned!$(RESET)"

clean-cache:
	@echo "$(YELLOW)🧹 Clearing caches...$(RESET)"
	pnpm store prune 2>/dev/null || true
	rm -rf ~/.npm/_cacache 2>/dev/null || true
	rm -rf .next/cache 2>/dev/null || true
	@echo "$(GREEN)✅ Caches cleaned!$(RESET)"

clean-all: clean clean-deps clean-cache
	@echo "$(GREEN)✅ Everything cleaned!$(RESET)"

# Utility commands
setup: clean-all install db-migrate
	@echo "$(GREEN)✅ Project setup complete!$(RESET)"

verify: check-deps
	@echo "$(BLUE)🔍 Verifying project health...$(RESET)"
	@echo "$(CYAN)Node.js version:$(RESET) $$(node --version)"
	@echo "$(CYAN)pnpm version:$(RESET) $$(pnpm --version)"
	@echo "$(CYAN)Next.js version:$(RESET) $$(pnpm list next --depth=0 2>/dev/null | grep next || echo 'Not found')"
	@echo "$(CYAN)TypeScript version:$(RESET) $$(pnpm list typescript --depth=0 2>/dev/null | grep typescript || echo 'Not found')"
	@if [ -f ".env.local" ]; then \
		echo "$(GREEN)✅ Environment file found$(RESET)"; \
	else \
		echo "$(YELLOW)⚠️  No .env.local file found$(RESET)"; \
	fi
	@if [ -f "package.json" ]; then \
		echo "$(GREEN)✅ Package.json found$(RESET)"; \
	else \
		echo "$(RED)❌ Package.json missing$(RESET)"; \
	fi

status:
	@echo "$(BLUE)📊 Current Project Status:$(RESET)"
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(PURPLE)Operating System:$(RESET) $(OS)"
	@echo "$(PURPLE)Working Directory:$(RESET) $$(pwd)"
	@echo "$(PURPLE)Git Branch:$(RESET) $$(git branch --show-current 2>/dev/null || echo 'Not a git repository')"
	@echo "$(PURPLE)Git Status:$(RESET) $$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ') files changed"
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"
	@echo "$(PURPLE)Port Status:$(RESET)"
	@for port in $(DEV_PORTS) $(DB_PORTS) $(DRIZZLE_PORT); do \
		if lsof -ti:$$port >/dev/null 2>&1; then \
			echo "  $(RED)Port $$port: IN USE$(RESET)"; \
		else \
			echo "  $(GREEN)Port $$port: FREE$(RESET)"; \
		fi; \
	done
	@echo "$(CYAN)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(RESET)"

fresh: clean-all install kill-ports
	@echo "$(GREEN)🎉 Fresh start complete! Starting development server...$(RESET)"
	@$(MAKE) dev

production-build: clean lint test build
	@echo "$(GREEN)🎉 Production build complete!$(RESET)"