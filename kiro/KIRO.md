# Kiro Autopilot Integration for SubSentinel

## Overview
Kiro Autopilot integration enables spec-driven development for the SubSentinel project. This system allows you to write EARS-compliant specifications and automatically generate code, tests, and infrastructure.

## Features
- **Spec-Driven Development**: Write requirements in EARS format, generate code automatically
- **Multi-Language Support**: Generate Go, TypeScript, and AWS CDK code
- **Automated Testing**: Unit, integration, and performance tests generated from specs
- **CI/CD Integration**: Automated deployment pipelines
- **Real-time Data Integration**: Works with actual Gmail and Calendar data
- **TOON Protocol Support**: 60% token savings for Bedrock calls

## Quick Start

### 1. Install Kiro Autopilot
```bash
# Install Kiro CLI
npm install -g @kirohq/cli

# Verify installation
kiro --version
```

### 2. Initialize Autopilot
```bash
cd subsentinel/kiro
kiro autopilot init
```

### 3. Create Your First Spec
```bash
# Create a new agent spec
kiro spec create agents/my-new-agent.yaml

# Edit the spec with your requirements
code specs/agents/my-new-agent.yaml
```

### 4. Generate Code from Spec
```bash
# Generate code from spec
kiro autopilot generate specs/agents/my-new-agent.yaml

# Or run the full workflow
kiro autopilot run spec-development --spec specs/agents/my-new-agent.yaml
```

## Directory Structure
```
kiro/
├── README.md                 # This file
├── kiro-config.yaml         # Autopilot configuration
├── specs/                   # EARS-compliant specifications
│   ├── agents/             # AI agent specifications
│   ├── api/               # API specifications
│   ├── components/        # UI component specifications
│   └── infrastructure/    # Infrastructure specifications
├── steering/               # Context and guidance files
│   ├── project-context.md
│   ├── spec-driven-development.md
│   ├── go-standards.md
│   └── nextjs-standards.md
├── templates/              # Code generation templates
│   ├── go-agent.tmpl
│   ├── go-test.tmpl
│   ├── ts-component.tmpl
│   └── ts-cdk.tmpl
└── workflows/              # Development workflows
    ├── spec-development.yaml
    ├── ci-cd-pipeline.yaml
    └── agent-development.yaml
```

## EARS Specification Format
All specs must follow the EARS (Easy Approach to Requirements Specification) format:

```yaml
title: "Feature Name"
description: "What the feature does"
triggers:
  - "Event that initiates the feature"
preconditions:
  - "System state before execution"
postconditions:
  - "Expected state after execution"
exceptions:
  - "Error conditions and handling"
acceptance_criteria:
  functional:
    - "Functional requirements"
  performance:
    - "Performance requirements"
  reliability:
    - "Reliability requirements"
  security:
    - "Security requirements"
```

## Example Workflow

### 1. Create Specification
```yaml
# specs/agents/calendar-reasoner.yaml
title: "Calendar Reasoner Agent"
description: "Analyzes Google Calendar for life events"
triggers:
  - "Scheduled every 24 hours"
  - "Manual trigger from dashboard"
acceptance_criteria:
  functional:
    - "Detects travel events from calendar"
    - "Suggests subscription pauses for travel"
    - "Integrates with Negotiator agent"
```

### 2. Generate Code
```bash
kiro autopilot generate specs/agents/calendar-reasoner.yaml
```

### 3. Review Generated Code
- Go agent code in `../backend/cmd/calendar-reasoner/`
- Tests in `../backend/cmd/calendar-reasoner/*_test.go`
- Infrastructure in `../infrastructure/lib/calendar-reasoner-stack.ts`

### 4. Run Tests
```bash
cd ../backend
go test ./cmd/calendar-reasoner/...
```

### 5. Deploy
```bash
cd ../infrastructure
cdk deploy CalendarReasonerStack
```

## Configuration

### kiro-config.yaml
Main configuration file for Autopilot behavior:
- Code generation settings
- Testing configuration
- Deployment environments
- Notification channels
- Security scanning

### Environment Variables
```bash
# Required for AWS integration
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret

# Google OAuth (for agent development)
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-secret
```

## Commands

### Spec Management
```bash
# Create new spec
kiro spec create <path>

# Validate spec
kiro spec validate <path>

# List all specs
kiro spec list
```

### Code Generation
```bash
# Generate from spec
kiro autopilot generate <spec-path>

# Generate with custom template
kiro autopilot generate <spec-path> --template custom.tmpl

# Dry run (preview changes)
kiro autopilot generate <spec-path> --dry-run
```

### Workflow Execution
```bash
# Run full workflow
kiro autopilot run spec-development --spec <spec-path>

# Run specific steps
kiro autopilot run --steps validate,generate,test

# Monitor workflow
kiro autopilot status <workflow-id>
```

### Testing
```bash
# Run generated tests
kiro test run --spec <spec-path>

# Run with coverage
kiro test run --spec <spec-path> --coverage

# Run integration tests
kiro test run --spec <spec-path> --type integration
```

## Integration with Existing Codebase

### Backend (Go)
- Generated agents integrate with existing `internal/` packages
- Uses shared `toon/` package for Bedrock optimization
- Follows existing middleware and logging patterns

### Frontend (Next.js)
- Generated components use existing design system
- Integrates with Zustand state management
- Follows App Router conventions

### Infrastructure (AWS CDK)
- Generated stacks follow existing patterns
- Integrates with monitoring and security stacks
- Uses shared configuration and constants

## Best Practices

### 1. Atomic Specs
- One spec per feature/component
- Clear boundaries and responsibilities
- Independent testability

### 2. Clear Requirements
- Use specific, measurable acceptance criteria
- Include error handling scenarios
- Define performance expectations

### 3. Iterative Development
- Start with minimal viable spec
- Generate and test incrementally
- Refine based on feedback

### 4. Version Control
- Track spec changes in git
- Use semantic versioning for specs
- Document breaking changes

## Troubleshooting

### Common Issues

**Spec Validation Fails**
```bash
# Check spec syntax
kiro spec validate --verbose <spec-path>

# View validation rules
cat steering/spec-driven-development.md
```

**Code Generation Errors**
```bash
# Check template compatibility
kiro autopilot generate --debug <spec-path>

# Verify template variables
cat templates/go-agent.tmpl | head -20
```

**Test Failures**
```bash
# Run tests with verbose output
go test -v ./cmd/agent-name/...

# Check test coverage
go test -cover ./cmd/agent-name/...
```

**Deployment Issues**
```bash
# Preview CloudFormation changes
cdk diff

# Check IAM permissions
aws iam simulate-principal-policy ...
```

## Advanced Features

### Custom Templates
Create custom templates in `templates/` directory:
```go
// templates/custom-agent.tmpl
package {{.PackageName}}

// Custom template for {{.AgentName}}
```

### Workflow Extensions
Extend workflows in `workflows/` directory:
```yaml
# workflows/custom-workflow.yaml
name: "custom-workflow"
steps:
  - name: "custom-step"
    action: "custom-action"
```

### Plugin System
Integrate with external tools:
```bash
# Add plugin
kiro plugin add <plugin-name>

# List plugins
kiro plugin list
```

## Support

### Documentation
- [EARS Specification Guide](steering/spec-driven-development.md)
- [Go Coding Standards](steering/go-standards.md)
- [Next.js Standards](steering/nextjs-standards.md)

### Examples
- [Receipt Auditor Spec](specs/agents/receipt-auditor-agent.yaml)
- [Subscription API Spec](specs/api/subscription-api.yaml)

### Community
- GitHub Issues for bug reports
- Discord for community support
- Documentation contributions welcome