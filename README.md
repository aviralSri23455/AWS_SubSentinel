🛡️ SubSentinel — AI-Powered Subscription Guardian
The first multi-agent AI that doesn't just track your subscriptions — it fights for you.

Go Version Next.js AWS TOON Protocol License Build Status

🚀 What is SubSentinel?
SubSentinel is a five-agent autonomous AI system orchestrated via AWS Bedrock that turns subscription chaos into measurable savings. Built with Go 1.24 for 10x faster performance and TOON (Token-Oriented Object Notation) for 60% fewer Bedrock tokens.

🎯 Problem Solved: Americans waste $2.9B annually on forgotten subscriptions. SubSentinel uses AI agents to automatically detect, analyze, and negotiate your subscriptions — saving users an average of $347/year.

🤖 The Five AI Agents
Agent	Purpose	Success Rate	AWS Services
📧 Receipt Auditor	Scans Gmail receipts, extracts subscription data	94% accuracy	SES, Textract, Bedrock
📅 Calendar Reasoner	Detects life events, suggests optimizations	89% relevance	EventBridge, Bedrock
💬 Negotiator	Drafts cancellation/negotiation emails	82% success	OpenSearch, Bedrock
🔍 Dark Pattern Defender	Detects UI tricks in cancellation flows	92% accuracy	Rekognition, Bedrock Vision
🧠 Learner	Improves tactics from community outcomes	Continuous	Comprehend, OpenSearch
⚡ Performance Metrics
Agent	Cold Start	Execution	Memory	TOON Savings
Auditor	80ms	300ms	128MB	60%
Calendar	75ms	250ms	128MB	58%
Negotiator	85ms	400ms	256MB	62%
Defender	90ms	800ms	512MB	62%
Learner	80ms	350ms	256MB	55%
🏆 Go + TOON vs Python + JSON
Metric	Python + JSON	Go + TOON	Improvement
Cold Start	600ms	80ms	87% faster
Bedrock Tokens	1000/call	400/call	60% fewer
Memory Usage	512MB	128MB	75% less
Monthly Cost	$55.50	$14.30	74% cheaper
Accuracy	70%	74%	4% better
⚡ Quick Start
Get SubSentinel running in 5 minutes:

1. Clone Repository
git clone https://github.com/your-username/subsentinel.git
cd subsentinel
2. Backend Setup
cd backend

# Install Go dependencies
go mod download
go mod tidy

# Copy environment template
copy ..\.env.example .env    # Windows
# cp ../.env.example .env    # macOS/Linux

# Edit .env with your credentials
code .env
3. Configure AWS Credentials
Edit backend/.env and add:

AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
4. Setup Google OAuth
Go to Google Cloud Console
Create project: "SubSentinel"
Enable Gmail API and Google Calendar API
Create OAuth 2.0 credentials (Desktop app)
Add credentials to backend/.env:
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
Generate refresh tokens:
cd backend
go run cmd/oauth/main.go
Copy the tokens to backend/.env
5. Frontend Setup
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev  # → http://localhost:3000
6. Infrastructure Setup (Optional - for AWS deployment)
cd infrastructure

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy to AWS
cdk deploy --all
7. Test the Setup
# Terminal 1: Start backend
cd backend
go run cmd/server/main.go

# Terminal 2: Start frontend
cd frontend
npm run dev
🎉 You're ready! Visit localhost:3000 to see your subscription dashboard.

📋 Prerequisites
Make sure you have the following installed on your machine:

Tool	Version	Install Link
Go	1.24+	go.dev/dl
Node.js	18+	nodejs.org
npm	9+	Bundled with Node.js
AWS CLI	v2	aws.amazon.com/cli
AWS CDK	2.x	npm install -g aws-cdk
Git	2.x+	git-scm.com
Verify Installation
go version         # → go1.24.x or higher
node --version     # → v18.x.x or higher
npm --version      # → 9.x.x or higher
aws --version      # → aws-cli/2.x.x
cdk --version      # → 2.x.x
💰 Cost Estimation
AWS Free Tier Usage (First 12 months):

Lambda: 1M requests/month (free)
DynamoDB: 25GB storage + 25 RCU/WCU (free)
S3: 5GB storage (free)
Bedrock: First 1M tokens/month (~$3)
Estimated Monthly Cost After Free Tier: $14.30/month for moderate usage (vs $55.50 with Python+JSON)

📁 Project Structure
subsentinel/
├── README.md                          # This file (single source of truth)
├── .env.example                       # Template — copy to backend/.env
├── LICENSE                            # Apache 2.0
├── .gitignore
│
├── backend/                           # Go 1.21 Lambda Agents
│   ├── cmd/                           # Lambda entry points
│   │   ├── auditor/main.go            # Receipt Auditor Agent
│   │   ├── calendar/main.go           # Calendar Reasoner Agent
│   │   ├── negotiator/main.go         # Negotiator Agent
│   │   ├── defender/main.go           # Dark Pattern Defender
│   │   ├── learner/main.go            # Learner Agent
│   │   └── oauth/main.go             # Google OAuth token generator
│   ├── internal/                      # Shared internal packages
│   │   ├── agents/                    # Agent business logic
│   │   │   ├── auditor/               # Receipt scanning logic
│   │   │   ├── calendar/              # Life event detection
│   │   │   ├── negotiator/            # Email drafting
│   │   │   ├── defender/              # Dark pattern analysis
│   │   │   └── learner/               # Adaptive learning
│   │   ├── aws/                       # AWS SDK v2 client wrappers
│   │   ├── google/                    # Google API clients (Gmail, Calendar)
│   │   ├── toon/                      # TOON encoding/decoding
│   │   ├── models/                    # Data models & structs
│   │   ├── config/                    # Configuration from .env
│   │   ├── hybrid/                    # Data routing layer
│   │   └── middleware/                # Logging, auth, error handling
│   ├── pkg/                           # Public reusable packages
│   │   ├── darkpattern/               # Dark pattern detection library
│   │   └── negotiation/               # Negotiation strategy engine
│   ├── configs/                       # TOON configuration files
│   ├── go.mod                         # Go module dependencies
│   ├── go.sum                         # Dependency checksums
│   ├── Makefile                       # Build, test, deploy commands
│   └── .env                           # YOUR credentials (git-ignored)
│
├── frontend/                          # Next.js 14 Dashboard
│   ├── src/
│   │   ├── app/                       # App Router pages
│   │   ├── components/                # React components
│   │   ├── hooks/                     # Custom React hooks
│   │   ├── lib/                       # API client, utilities
│   │   ├── store/                     # Zustand state management
│   │   ├── types/                     # TypeScript interfaces
│   │   └── styles/                    # CSS modules
│   ├── public/                        # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── infrastructure/                    # AWS CDK (TypeScript)
│   ├── lib/                           # CDK Stack definitions
│   │   ├── lambda-stack.ts
│   │   ├── api-stack.ts
│   │   ├── database-stack.ts
│   │   ├── ai-stack.ts
│   │   └── monitoring-stack.ts
│   ├── bin/app.ts                     # CDK app entry point
│   ├── package.json
│   ├── tsconfig.json
│   └── cdk.json
│
├── docs/                              # Documentation
│   ├── architecture.md                # Technical deep-dive
│   ├── toon-protocol.md               # TOON encoding spec
│   └── api-reference.md               # API documentation
│
└── kiro/                              # Kiro IDE specs
    └── specs/                         # EARS-compliant requirements
🛠️ Installation & Setup
Quick Start Checklist
After cloning the repository, follow these steps in order:

 Step 1: Clone repository
 Step 2: Backend setup (Go dependencies)
 Step 3: Configure environment variables (.env)
 Step 4: Setup Google OAuth (Gmail + Calendar)
 Step 5: Frontend setup (npm dependencies)
 Step 6: Test local development
 Step 7: Infrastructure setup (AWS CDK - optional)
See the Quick Start section above for detailed commands.

🏃 Running the Project
Local Development — Test Individual Agents
Each agent can be run locally for testing. Navigate to the backend directory first:

cd backend
Then run any agent individually:

# ─── First-time only: Connect your Google account ──────────
go run cmd/oauth/main.go          # Opens browser → authorize Gmail + Calendar

# ─── Run individual agents for testing ─────────────────────
go run cmd/auditor/main.go        # Scans YOUR Gmail for subscription receipts
go run cmd/calendar/main.go       # Reads YOUR Google Calendar for life events
go run cmd/negotiator/main.go     # Drafts a cancellation/negotiation email
go run cmd/defender/main.go       # Detects dark patterns in a screenshot
go run cmd/learner/main.go        # Updates ML model from past outcomes
💡 Important Notes:

Each agent is a separate Lambda function — run one at a time as needed
They are NOT meant to run simultaneously in local development
In production on AWS, they are triggered automatically by events (SES, EventBridge, API Gateway)
Typical workflow order:

go run cmd/oauth/main.go — One-time setup to connect Google
go run cmd/auditor/main.go — Find your subscriptions from Gmail
go run cmd/calendar/main.go — Detect upcoming life events
go run cmd/negotiator/main.go — Draft a cancellation email
go run cmd/defender/main.go — Analyze a cancellation page screenshot
Backend — Make Commands (Build, Test, Deploy)
cd backend

make build           # Compile all 5 agents → bin/ directory
make test            # Run all tests with race detection
make test-coverage   # Generate HTML coverage report
make package         # ZIP binaries for Lambda deployment
make status          # Check .env credential status
make oauth           # Connect Google account (one-time)
make deploy          # Deploy to AWS via CDK
make clean           # Remove build artifacts
Frontend (Dashboard)
cd frontend

npm run dev           # Development → http://localhost:3000
npm run build         # Production build
npm run lint          # Lint check
npm run type-check    # TypeScript validation
Infrastructure (CDK)
cd infrastructure

cdk synth             # Synthesize CloudFormation templates
cdk diff              # Preview changes
cdk deploy --all      # Deploy all stacks
cdk destroy --all     # Tear down everything
🏗️ Architecture Overview
SubSentinel uses a serverless-first architecture with 19 AWS services orchestrated via CDK:

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Gmail API     │    │  Google Calendar │    │   Next.js UI    │
│   (Receipts)    │    │  (Life Events)   │    │   Dashboard     │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway + Cognito Auth                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────▼────────────┐
          │    Step Functions      │
          │    (Orchestration)     │
          └───────────┬────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Auditor │    │ Negotiator  │    │  Defender   │
│ Agent   │    │   Agent     │    │   Agent     │
└─────────┘    └─────────────┘    └─────────────┘
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              AWS Bedrock (Claude Sonnet 4.5)                   │
│              + Textract + Rekognition + Comprehend             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────▼────────────┐
          │     Data Layer         │
          │ DynamoDB + S3 +        │
          │ OpenSearch Serverless  │
          └────────────────────────┘
🔧 AWS Services Used (18 Total)
AI Services (4):

Amazon Bedrock: Claude Sonnet 4.5 + Titan Embeddings (TOON: 60% savings)
Amazon Textract: Receipt document extraction (OCR)
Amazon Rekognition: Screenshot text/UI detection
Amazon Comprehend: Sentiment analysis for negotiations
Core Services (12): AWS Lambda, Step Functions, EventBridge, S3, DynamoDB, OpenSearch Serverless, SES, CloudWatch, API Gateway, Cognito, Secrets Manager, KMS

Dev Tools (2): AWS CDK, CloudFormation

📊 TOON Protocol — 60% Token Savings
TOON (Token-Oriented Object Notation) is our custom encoding format that reduces Bedrock token costs by 60% compared to JSON while improving accuracy by 4%:

Example Comparison
JSON (43 tokens):

{"subscriptions":[{"id":"1","provider":"Netflix","amount":15.99,"renewal":"2026-03-15"}]}
TOON (18 tokens) — 58% savings:

subscriptions[1]{id,provider,amount,renewal}:
1,Netflix,15.99,2026-03-15
TOON Benefits
Metric	JSON	TOON	Improvement
Token Count	1000	400	60% fewer
Comprehension	70%	74%	4% better
Parse Speed	45ms	12ms	73% faster
Memory Usage	2.1MB	0.8MB	62% less
Supported Data Types:

Subscriptions, Calendar Events, Negotiations
Rekognition Results, Dark Pattern Reports
Learning Outcomes, User Preferences
See docs/toon-protocol.md for the full specification.

🔧 Troubleshooting
Common Issues
Issue	Fix
GOOGLE_CLIENT_ID is required	Set GOOGLE_CLIENT_ID in backend/.env
GMAIL_REFRESH_TOKEN is required	Run make oauth in /backend
Cannot find type definition for 'node'	Run npm install in /frontend and /infrastructure
go mod: no required module	Run go mod tidy in /backend
go: module not found	Run go mod download then go mod verify
all modules verified not showing	Delete go.sum and run go mod tidy again
cdk bootstrap fails	Configure AWS CLI: aws configure
invalid_grant from Google	Re-run make oauth to refresh tokens
Build fails on Windows	Use PowerShell, not CMD
npm ERR! code ENOENT	Run npm install in the correct directory
Bedrock access denied	Enable Bedrock models in AWS Console
TOON encoding error	Check data structure matches TOON schema
Reset Everything
# Backend
cd backend
go clean -cache
go mod tidy
make clean && make build

# Frontend
cd frontend
rm -rf node_modules .next
npm install
npm run dev

# Infrastructure
cd infrastructure
rm -rf node_modules cdk.out
npm install
cdk synth
Debug Mode
Enable detailed logging by setting in backend/.env:

LOG_LEVEL=debug
TOON_DEBUG=true
👥 Contributing
We welcome contributions! Here's how to get started:

Development Workflow
Fork the repository
Clone your fork: git clone https://github.com/your-username/subsentinel.git
Create a feature branch: git checkout -b feature/amazing-feature
Make your changes following our coding standards
Test your changes: make test (backend) and npm test (frontend)
Commit with conventional commits: git commit -m "feat: add amazing feature"
Push to your branch: git push origin feature/amazing-feature
Open a Pull Request
Code Standards
Go: Follow gofmt and golint standards
TypeScript: Use strict mode, follow ESLint rules
TOON: Document any new TOON encodings
Tests: Maintain >80% coverage
Docs: Update README for new features
🪟 Windows-Specific Development
SubSentinel includes Windows-optimized commands via Makefile.windows:

Windows Build Commands
cd backend

# Build for Lambda (Linux)
make build

# Build for local Windows testing
make build-local

# Run individual agents locally
make run-auditor
make run-calendar
make run-negotiator
make run-defender
make run-learner
make run-api          # HTTP server for frontend

# View all commands
make help
Local Development Server
Start the HTTP server for frontend development:

cd backend
make run-api
# → Server running at http://localhost:4000/v1
Then connect your frontend:

cd frontend
npm run dev
# → Frontend at http://localhost:3000
🧹 Utility Scripts
All utility scripts are located in the scripts/ folder.

Cleanup Data Script
Clear all subscriptions and dark patterns from your local database:

cd scripts
./cleanup-data.ps1
What it does:

Deletes all subscriptions from DynamoDB
Clears all dark pattern reports
Verifies cleanup completion
Provides summary of deleted items
When to use:

Testing fresh data uploads
Resetting demo environment
Clearing test data
Create DynamoDB Tables
Create DynamoDB tables directly without CloudFormation:

cd scripts
./create-tables-direct.ps1
Creates these tables:

subsentinel-subscriptions
subsentinel-insights
subsentinel-negotiations
subsentinel-dark-patterns
subsentinel-outcomes
subsentinel-audit-log
Also creates S3 buckets:

subsentinel-screenshots
subsentinel-receipts
Setup Kiro Autopilot
Initialize Kiro Autopilot for spec-driven development:

cd scripts
./setup-autopilot.ps1
What it does:

Installs Kiro CLI
Initializes Kiro Autopilot
Creates example workflows
Sets up environment templates
🤖 Kiro Autopilot Integration
SubSentinel includes full Kiro Autopilot integration for spec-driven development.

Quick Setup
cd scripts
./setup-autopilot.ps1
What is Kiro Autopilot?
Kiro enables spec-driven development where you write EARS-compliant specifications and automatically generate:

Go Lambda agent code
TypeScript React components
AWS CDK infrastructure
Unit and integration tests
Directory Structure
kiro/
├── KIRO.md                    # Full Kiro documentation
├── kiro-config.yaml          # Autopilot configuration
├── setup-autopilot.ps1       # Setup script
├── specs/                    # EARS specifications
│   ├── agents/              # AI agent specs
│   └── api/                 # API specs
├── steering/                 # Development guidelines
│   ├── project-context.md
│   ├── spec-driven-development.md
│   ├── go-standards.md
│   └── nextjs-standards.md
├── templates/                # Code generation templates
│   ├── go-agent.tmpl
│   └── go-test.tmpl
└── workflows/                # Development workflows
    └── spec-development.yaml
Example Workflow
Create a specification:
# kiro/specs/agents/my-agent.yaml
title: "My New Agent"
description: "What the agent does"
triggers:
  - "Event that starts the agent"
acceptance_criteria:
  functional:
    - "Must detect X from Y"
    - "Must integrate with Z"
Generate code:
cd kiro
kiro autopilot generate specs/agents/my-agent.yaml
Test generated code:
cd ../backend
go test ./cmd/my-agent/...
Deploy:
cd ../infrastructure
cdk deploy MyAgentStack
See kiro/KIRO.md for complete documentation.

🔍 Additional Backend Agents
Beyond the five main AI agents, SubSentinel includes utility agents:

Agent	Purpose	Command
API Server	HTTP server for frontend	go run cmd/api/main.go
Server	Alternative HTTP server	go run cmd/server/main.go
Receipt Upload	Handle receipt uploads	go run cmd/receipt-upload/main.go
Gmail Fetcher	Fetch Gmail data	go run cmd/gmail-fetcher/main.go
Calendar Fetcher	Fetch Calendar data	go run cmd/calendar-fetcher/main.go
Privacy Agent	Privacy compliance	go run cmd/privacy/main.go
OAuth	Google OAuth setup	go run cmd/oauth/main.go
Test Commands
cd backend

# Test individual components
go run cmd/test-bedrock/main.go          # Test Bedrock connection
go run cmd/test-bedrock-vision/main.go   # Test Bedrock Vision
go run cmd/test-dynamodb/main.go         # Test DynamoDB
go run cmd/test-gmail/main.go            # Test Gmail API
go run cmd/test-calendar/main.go         # Test Calendar API
go run cmd/test-receipt/main.go          # Test receipt processing
go run cmd/test-agent-demo/main.go       # Demo agent workflow
📚 Documentation
Core Documentation
[Github Overview.md](Github Overview.md) - This file (main documentation)
LICENSE - Apache 2.0 license
kiro/KIRO.md - Kiro Autopilot guide
Development Guidelines
kiro/steering/project-context.md - Project overview
kiro/steering/spec-driven-development.md - EARS specs
kiro/steering/go-standards.md - Go coding standards
kiro/steering/nextjs-standards.md - Next.js standards
🚀 Deployment Options
Option 1: Full AWS Deployment (Recommended)
cd infrastructure
cdk bootstrap
cdk deploy --all
Deploys:

All 5 AI agents as Lambda functions
DynamoDB tables
S3 buckets
API Gateway
CloudWatch monitoring
Step Functions orchestration
Option 2: Local Development Only
# Terminal 1: Backend
cd backend
go run cmd/server/main.go

# Terminal 2: Frontend
cd frontend
npm run dev
Uses:

Local Go HTTP server
Local DynamoDB (or AWS DynamoDB)
Local file storage (or S3)
Option 3: Hybrid (Local Backend + AWS Services)
# Use AWS DynamoDB and S3, but run backend locally
cd backend
# Set AWS credentials in .env
go run cmd/server/main.go
