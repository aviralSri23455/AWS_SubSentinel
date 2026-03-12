# Project Context

## Project Overview
**SubSentinel** is a multi-agent AI system that manages and optimizes subscriptions using AWS Bedrock and Go 1.21.

## Architecture
- **Backend**: Go 1.21 Lambda agents (5 agents total)
- **Frontend**: Next.js 14 dashboard
- **Infrastructure**: AWS CDK (TypeScript)
- **AI**: Amazon Bedrock with TOON protocol for 60% token savings

## Key Technologies
- **Go 1.21+**: For high-performance Lambda agents
- **TOON Protocol**: Token-Oriented Object Notation for Bedrock efficiency
- **AWS Services**: 19 total services including Bedrock, Textract, Rekognition
- **Next.js 14**: App Router, React Server Components
- **AWS CDK**: Infrastructure as Code

## Project Structure
```
subsentinel/
├── backend/           # Go Lambda agents
├── frontend/         # Next.js dashboard  
├── infrastructure/   # AWS CDK
├── docs/            # Documentation
└── kiro/            # Kiro Autopilot specs
```

## Development Principles
1. **Spec-driven development**: All features start with EARS-compliant specs
2. **Agent-first architecture**: Each agent is independent and testable
3. **TOON optimization**: Use TOON instead of JSON for Bedrock calls
4. **AWS best practices**: Follow AWS Well-Architected Framework
5. **Real-time data**: Integrate with actual Gmail and Calendar data

## Agent Architecture
1. **Receipt Auditor**: Scans Gmail for subscription receipts
2. **Calendar Reasoner**: Detects life events from Google Calendar
3. **Negotiator**: Drafts cancellation/negotiation emails
4. **Dark Pattern Defender**: Detects UI tricks in cancellation flows
5. **Learner**: Improves from community outcomes

## Performance Targets
- **Cold Start**: < 100ms per agent
- **Bedrock Tokens**: 60% reduction with TOON
- **Memory**: 75% less than Python equivalent
- **Cost**: 74% cheaper monthly operation