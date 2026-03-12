# Workflows Directory

This directory contains Kiro Autopilot workflows for automated development processes.

## Available Workflows

### 1. spec-development.yaml
- **Purpose**: End-to-end spec-driven development workflow
- **Triggers**: New spec file creation or modification
- **Steps**:
  1. Parse EARS spec file
  2. Generate code from templates
  3. Run tests
  4. Deploy to staging
  5. Run integration tests

### 2. ci-cd-pipeline.yaml
- **Purpose**: Continuous integration and deployment
- **Triggers**: On spec changes or code push
- **Steps**:
  1. Lint and format code
  2. Run unit tests
  3. Build artifacts
  4. Deploy to AWS
  5. Run integration tests

### 3. agent-development.yaml
- **Purpose**: AI agent development workflow
- **Triggers**: Agent spec changes
- **Steps**:
  1. Parse agent specification
  2. Generate agent code
  3. Test agent with sample data
  4. Deploy to AWS Lambda
  5. Run agent tests

## Using Workflows

Workflows are triggered automatically when:
- Spec files are modified
- Code is pushed to main branch
- Manual trigger via Kiro CLI

## Custom Workflows

Create custom workflows by adding YAML files to this directory. Each workflow should define:
- Trigger conditions
- Steps to execute
- Success/failure conditions
- Notifications