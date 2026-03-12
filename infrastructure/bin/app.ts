#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { ApiStack } from '../lib/api-stack';
import { AiStack } from '../lib/ai-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { SesStack } from '../lib/ses-stack';
import { SnsStack } from '../lib/sns-stack';
import { SecretsStack } from '../lib/secrets-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Stack 1: Database Layer (DynamoDB, S3, OpenSearch)
const databaseStack = new DatabaseStack(app, 'SubSentinel-Database', {
  env,
  description: 'SubSentinel Database Layer - DynamoDB, S3, OpenSearch with TOON optimization',
});

// Stack 2: AI Services (Bedrock permissions, KMS encryption)
const aiStack = new AiStack(app, 'SubSentinel-AI', {
  env,
  description: 'SubSentinel AI Services - Bedrock, Textract, Rekognition, Comprehend',
  kmsKey: databaseStack.kmsKey,
});

// Stack 3: Lambda Functions (5 Go agents)
const lambdaStack = new LambdaStack(app, 'SubSentinel-Lambda', {
  env,
  description: 'SubSentinel Lambda Agents - Go 1.21 with TOON encoding',
  subscriptionsTable: databaseStack.subscriptionsTable,
  negotiationsTable: databaseStack.negotiationsTable,
  darkPatternsTable: databaseStack.darkPatternsTable,
  receiptsBucket: databaseStack.receiptsBucket,
  screenshotsBucket: databaseStack.screenshotsBucket,
  kmsKey: databaseStack.kmsKey,
  openSearchEndpoint: databaseStack.openSearchEndpoint,
});

// Stack 4: Secrets Manager (OAuth credentials)
const secretsStack = new SecretsStack(app, 'SubSentinel-Secrets', {
  env,
  description: 'SubSentinel Secrets - OAuth credentials and API keys',
  lambdaFunctions: [
    lambdaStack.auditorFunction,
    lambdaStack.calendarFunction,
    lambdaStack.negotiatorFunction,
    lambdaStack.defenderFunction,
    lambdaStack.learnerFunction,
  ],
});

// Stack 5: SNS Topics (Notifications)
const snsStack = new SnsStack(app, 'SubSentinel-SNS', {
  env,
  description: 'SubSentinel SNS Topics - Notifications and alerts',
  lambdaFunctions: [
    lambdaStack.auditorFunction,
    lambdaStack.calendarFunction,
    lambdaStack.negotiatorFunction,
    lambdaStack.defenderFunction,
    lambdaStack.learnerFunction,
  ],
});

// Stack 6: SES (Email ingestion)
const sesStack = new SesStack(app, 'SubSentinel-SES', {
  env,
  description: 'SubSentinel SES - Email receipt ingestion',
  receiptsBucket: databaseStack.receiptsBucket,
  auditorFunction: lambdaStack.auditorFunction,
});

// Stack 7: API Gateway (REST + WebSocket)
const apiStack = new ApiStack(app, 'SubSentinel-API', {
  env,
  description: 'SubSentinel API Gateway - REST + WebSocket with Cognito auth',
  auditorFunction: lambdaStack.auditorFunction,
  calendarFunction: lambdaStack.calendarFunction,
  negotiatorFunction: lambdaStack.negotiatorFunction,
  defenderFunction: lambdaStack.defenderFunction,
  learnerFunction: lambdaStack.learnerFunction,
  apiFunction: lambdaStack.apiFunction,
});

// Stack 8: Monitoring (CloudWatch, Alarms)
const monitoringStack = new MonitoringStack(app, 'SubSentinel-Monitoring', {
  env,
  description: 'SubSentinel Monitoring - CloudWatch Dashboards and Alarms',
  lambdaFunctions: [
    lambdaStack.auditorFunction,
    lambdaStack.calendarFunction,
    lambdaStack.negotiatorFunction,
    lambdaStack.defenderFunction,
    lambdaStack.learnerFunction,
  ],
  restApi: apiStack.restApi,
  subscriptionsTable: databaseStack.subscriptionsTable,
  snsAlertsTopic: snsStack.alertsTopic,
});

// Add tags to all stacks
cdk.Tags.of(app).add('Project', 'SubSentinel');
cdk.Tags.of(app).add('Environment', 'Production');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('CostCenter', 'AI-Challenge-2026');
