# Spec-Driven Development

## Overview
All SubSentinel development follows EARS (Easy Approach to Requirements Specification) methodology. Specs drive code generation, testing, and deployment.

## EARS Format
Each spec must include:

### 1. Title
Clear, concise title describing the feature.

### 2. Description
What the feature does, why it's needed, and business value.

### 3. Triggers
Events that initiate the feature execution:
- User actions
- System events
- Scheduled triggers
- External API calls

### 4. Preconditions
System state before execution:
- Required data
- User permissions
- System availability
- Dependencies

### 5. Postconditions
Expected state after successful execution:
- Data changes
- System state
- User notifications
- Log entries

### 6. Exceptions
Error conditions and handling:
- Validation errors
- Network failures
- Permission denied
- Resource limits

### 7. Acceptance Criteria
How to verify the feature works:
- Functional tests
- Performance tests
- Security tests
- Integration tests

## Spec File Structure
```
specs/
├── agents/           # AI agent specifications
├── api/             # API endpoint specifications  
├── components/      # UI component specifications
├── infrastructure/  # Infrastructure specifications
└── workflows/       # Business workflow specifications
```

## Example Spec
```yaml
title: "Receipt Auditor Agent"
description: "Scans Gmail for subscription receipts and extracts data"
triggers:
  - "Scheduled every 6 hours"
  - "Manual trigger from dashboard"
preconditions:
  - "Google OAuth tokens available"
  - "AWS Bedrock access configured"
  - "DynamoDB tables exist"
postconditions:
  - "Subscription data stored in DynamoDB"
  - "New receipts logged in CloudWatch"
  - "User notified of found subscriptions"
exceptions:
  - "Gmail API unavailable → retry with exponential backoff"
  - "No new receipts → log and exit cleanly"
  - "Bedrock quota exceeded → queue for later processing"
acceptance_criteria:
  - "Extracts subscription data from 95% of receipts"
  - "Processes 100 receipts in under 5 minutes"
  - "Handles 10 concurrent users"
```

## Kiro Autopilot Integration
1. **Spec Creation**: Write EARS-compliant spec
2. **Code Generation**: Kiro generates code from templates
3. **Test Generation**: Unit and integration tests created
4. **Deployment**: Infrastructure and code deployed
5. **Validation**: Acceptance criteria verified

## Best Practices
1. **Atomic Specs**: One spec per feature/component
2. **Clear Language**: Avoid ambiguity in requirements
3. **Testable Criteria**: Acceptance criteria must be verifiable
4. **Realistic Scenarios**: Include edge cases and error handling
5. **Version Control**: Track spec changes in git