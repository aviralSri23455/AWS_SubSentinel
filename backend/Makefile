# =============================================
# SubSentinel Backend — Makefile
# Go 1.21 Lambda Agent Build System
# 100% REAL-TIME DATA — NO MOCK DATA
# =============================================

.PHONY: all build clean test lint deploy oauth

# Agent directories
AGENTS := auditor calendar negotiator defender learner receipt-upload
BIN_DIR := bin
GOFLAGS := -ldflags="-s -w" -tags lambda.norpc

# ─── Build ────────────────────────────────────

all: clean build

build: $(AGENTS)

$(AGENTS):
	@echo "🔨 Building $@ agent..."
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build $(GOFLAGS) \
		-o $(BIN_DIR)/$@/bootstrap \
		./cmd/$@/main.go
	@echo "✅ $@ built → $(BIN_DIR)/$@/bootstrap"

# ─── Package (ZIP for Lambda) ─────────────────

package: build
	@for agent in $(AGENTS); do \
		echo "📦 Packaging $$agent..."; \
		cd $(BIN_DIR)/$$agent && zip -j $$agent.zip bootstrap && cd ../..; \
	done
	@echo "✅ All agents packaged"

# ─── OAuth Setup (REAL DATA) ──────────────────

oauth:
	@echo "🔐 Starting Google OAuth setup..."
	@echo "This will connect YOUR Gmail + Calendar to SubSentinel"
	go run cmd/oauth/main.go

# ─── Test ──────────────────────────────────────

test:
	@echo "🧪 Running all tests..."
	go test -v -race -cover ./...

test-coverage:
	@echo "📊 Generating coverage report..."
	go test -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "✅ Coverage report → coverage.html"

test-agent:
	@echo "🧪 Testing $(AGENT) agent..."
	go test -v -race ./internal/agents/$(AGENT)/...

# ─── Lint ──────────────────────────────────────

lint:
	@echo "🔍 Linting..."
	golangci-lint run ./...

# ─── Clean ─────────────────────────────────────

clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf $(BIN_DIR)
	rm -f coverage.out coverage.html

# ─── Local Development ────────────────────────

run-local:
	@echo "🚀 Starting local development server..."
	sam local start-api --template ../infrastructure/template.yaml

run-server:
	@echo "🚀 Starting HTTP server for frontend development..."
	@echo "   Frontend can connect to http://localhost:4000/v1"
	go run cmd/server/main.go

# ─── Deploy ───────────────────────────────────

deploy: package
	@echo "🚀 Deploying via CDK..."
	cd ../infrastructure && npx cdk deploy --all --require-approval never

# ─── Status Check ─────────────────────────────

status:
	@echo "═══════════════════════════════════════════"
	@echo "  SubSentinel — Real-Time Data Status"
	@echo "═══════════════════════════════════════════"
	@echo ""
	@echo "Checking .env credentials..."
	@if [ -n "$$GOOGLE_CLIENT_ID" ]; then echo "✅ GOOGLE_CLIENT_ID: set"; else echo "❌ GOOGLE_CLIENT_ID: missing"; fi
	@if [ -n "$$GOOGLE_CLIENT_SECRET" ]; then echo "✅ GOOGLE_CLIENT_SECRET: set"; else echo "❌ GOOGLE_CLIENT_SECRET: missing"; fi
	@if [ -n "$$GMAIL_REFRESH_TOKEN" ]; then echo "✅ GMAIL_REFRESH_TOKEN: set"; else echo "❌ GMAIL_REFRESH_TOKEN: missing"; fi
	@if [ -n "$$CALENDAR_REFRESH_TOKEN" ]; then echo "✅ CALENDAR_REFRESH_TOKEN: set"; else echo "❌ CALENDAR_REFRESH_TOKEN: missing"; fi
	@if [ -n "$$AWS_REGION" ]; then echo "✅ AWS_REGION: $$AWS_REGION"; else echo "❌ AWS_REGION: missing"; fi
	@echo ""
	@echo "Run 'make oauth' to connect your Google account"
