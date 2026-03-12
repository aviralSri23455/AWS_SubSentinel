# Kiro Templates

This directory contains code and test templates for Kiro Autopilot to use when generating code from specs.

## Template Structure

### Go Templates
- `go-agent.tmpl` - Go Lambda agent template
- `go-service.tmpl` - Go service template
- `go-test.tmpl` - Go test template
- `go-toon.tmpl` - TOON encoding/decoding template

### TypeScript Templates
- `ts-component.tmpl` - React component template
- `ts-api.tmpl` - API client template
- `ts-test.tmpl` - TypeScript test template
- `ts-cdk.tmpl` - AWS CDK stack template

### Infrastructure Templates
- `lambda-stack.tmpl` - Lambda CDK stack template
- `api-stack.tmpl` - API Gateway stack template
- `database-stack.tmpl` - Database stack template

## Usage

Templates are used by Kiro Autopilot when generating code from specs. They ensure consistent code structure and follow project standards.

## Template Variables

Templates support the following variables:
- `{{.SpecName}}` - Name of the spec
- `{{.Description}}` - Description from spec
- `{{.PackageName}}` - Go package name
- `{{.FunctionName}}` - Function/component name
- `{{.AWSRegion}}` - AWS region
- `{{.Environment}}` - Environment (dev/staging/prod)