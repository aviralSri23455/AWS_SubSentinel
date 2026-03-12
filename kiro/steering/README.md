# Kiro Steering Files

Steering files provide context and instructions for Kiro Autopilot to understand the project structure, coding standards, and development workflows.

## Available Steering Files

### Core Steering
- `project-context.md` - Project overview and architecture
- `coding-standards.md` - Language-specific coding standards
- `testing-guidelines.md` - Testing strategy and patterns

### Workflow Steering
- `spec-driven-development.md` - How to create and use specs
- `agent-development.md` - Guidelines for AI agent development
- `aws-integration.md` - AWS service integration patterns

### Technology Steering
- `go-standards.md` - Go 1.21+ coding standards
- `nextjs-standards.md` - Next.js 14+ standards
- `aws-cdk-standards.md` - AWS CDK TypeScript standards

## Usage

Steering files are automatically included when Kiro Autopilot processes specs. They provide the necessary context for generating appropriate code, tests, and infrastructure.

## Creating New Steering Files

1. Add file to `steering/` directory
2. Use markdown format with clear sections
3. Include practical examples and patterns
4. Reference existing code when possible