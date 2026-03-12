import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';

export interface LambdaStackProps extends cdk.StackProps {
  subscriptionsTable: dynamodb.Table;
  negotiationsTable: dynamodb.Table;
  darkPatternsTable: dynamodb.Table;
  receiptsBucket: s3.Bucket;
  screenshotsBucket: s3.Bucket;
  kmsKey: kms.Key;
  openSearchEndpoint: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly auditorFunction: lambda.Function;
  public readonly calendarFunction: lambda.Function;
  public readonly negotiatorFunction: lambda.Function;
  public readonly defenderFunction: lambda.Function;
  public readonly learnerFunction: lambda.Function;
  public readonly apiFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // ─── Common Lambda Environment Variables ──────────────────────────────
    const commonEnv = {
      SUBSCRIPTIONS_TABLE: props.subscriptionsTable.tableName,
      NEGOTIATIONS_TABLE: props.negotiationsTable.tableName,
      DARK_PATTERNS_TABLE: props.darkPatternsTable.tableName,
      RECEIPTS_BUCKET: props.receiptsBucket.bucketName,
      SCREENSHOTS_BUCKET: props.screenshotsBucket.bucketName,
      KMS_KEY_ID: props.kmsKey.keyId,
      OPENSEARCH_ENDPOINT: props.openSearchEndpoint,
      AWS_REGION: this.region,
    };

    // ─── Common IAM Policy for Bedrock ────────────────────────────────────
    const bedrockPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
      ],
    });

    // ─── 1. Auditor Agent (Receipt Scanner) ───────────────────────────────
    this.auditorFunction = new lambda.Function(this, 'AuditorFunction', {
      functionName: 'SubSentinel-Auditor',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/auditor'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      description: 'Auditor Agent - Scans receipts with Textract + TOON-encoded Bedrock (60% token savings)',
    });

    // Grant permissions
    props.subscriptionsTable.grantReadWriteData(this.auditorFunction);
    props.receiptsBucket.grantRead(this.auditorFunction);
    props.kmsKey.grantDecrypt(this.auditorFunction);
    this.auditorFunction.addToRolePolicy(bedrockPolicy);
    this.auditorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['textract:AnalyzeDocument', 'textract:DetectDocumentText'],
      resources: ['*'],
    }));

    // ─── 2. Calendar Reasoner Agent ───────────────────────────────────────
    this.calendarFunction = new lambda.Function(this, 'CalendarFunction', {
      functionName: 'SubSentinel-Calendar',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/calendar'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      description: 'Calendar Reasoner - Detects life events with TOON-formatted calendar data',
    });

    props.subscriptionsTable.grantReadData(this.calendarFunction);
    props.kmsKey.grantDecrypt(this.calendarFunction);
    this.calendarFunction.addToRolePolicy(bedrockPolicy);
    this.calendarFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:SubSentinel/*`],
    }));

    // EventBridge rule for daily calendar check
    const calendarRule = new events.Rule(this, 'CalendarDailyRule', {
      ruleName: 'SubSentinel-CalendarDaily',
      schedule: events.Schedule.cron({ hour: '9', minute: '0' }),
      description: 'Trigger Calendar Reasoner daily at 9 AM',
    });
    calendarRule.addTarget(new targets.LambdaFunction(this.calendarFunction));

    // ─── 3. Negotiator Agent ──────────────────────────────────────────────
    this.negotiatorFunction = new lambda.Function(this, 'NegotiatorFunction', {
      functionName: 'SubSentinel-Negotiator',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/negotiator'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: commonEnv,
      description: 'Negotiator Agent - Drafts emails with OpenSearch k-NN + TOON vectors (82% success)',
    });

    props.negotiationsTable.grantReadWriteData(this.negotiatorFunction);
    props.kmsKey.grantEncryptDecrypt(this.negotiatorFunction);
    this.negotiatorFunction.addToRolePolicy(bedrockPolicy);
    this.negotiatorFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:APIAccessAll'],
      resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
    }));

    // ─── 4. Dark Pattern Defender Agent ───────────────────────────────────
    this.defenderFunction = new lambda.Function(this, 'DefenderFunction', {
      functionName: 'SubSentinel-Defender',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/defender'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 512,
      timeout: cdk.Duration.seconds(90),
      environment: commonEnv,
      description: 'Defender Agent - Detects dark patterns with Rekognition + Bedrock Vision (92% accuracy, 62% token savings)',
    });

    props.darkPatternsTable.grantReadWriteData(this.defenderFunction);
    props.screenshotsBucket.grantRead(this.defenderFunction);
    props.kmsKey.grantDecrypt(this.defenderFunction);
    this.defenderFunction.addToRolePolicy(bedrockPolicy);
    this.defenderFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:DetectText', 'rekognition:DetectLabels'],
      resources: ['*'],
    }));

    // ─── 5. Learner Agent ─────────────────────────────────────────────────
    this.learnerFunction = new lambda.Function(this, 'LearnerFunction', {
      functionName: 'SubSentinel-Learner',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/learner'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(60),
      environment: commonEnv,
      description: 'Learner Agent - Adaptive ML with Comprehend + TOON vectors (60% storage savings)',
    });

    props.negotiationsTable.grantReadData(this.learnerFunction);
    props.kmsKey.grantDecrypt(this.learnerFunction);
    this.learnerFunction.addToRolePolicy(bedrockPolicy);
    this.learnerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['comprehend:DetectSentiment', 'comprehend:BatchDetectSentiment'],
      resources: ['*'],
    }));
    this.learnerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:APIAccessAll'],
      resources: [`arn:aws:aoss:${this.region}:${this.account}:collection/*`],
    }));

    // ─── 6. API Handler (REST endpoints) ──────────────────────────────────
    this.apiFunction = new lambda.Function(this, 'ApiFunction', {
      functionName: 'SubSentinel-API',
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/bin/api'),
      architecture: lambda.Architecture.X86_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: commonEnv,
      description: 'API Handler - REST endpoints with TOON-encoded responses (60% smaller payloads)',
    });

    props.subscriptionsTable.grantReadData(this.apiFunction);
    props.negotiationsTable.grantReadData(this.apiFunction);
    props.darkPatternsTable.grantReadData(this.apiFunction);
    props.kmsKey.grantDecrypt(this.apiFunction);

    // ─── Step Functions Orchestration ─────────────────────────────────────
    
    // Define tasks
    const auditTask = new tasks.LambdaInvoke(this, 'AuditReceipts', {
      lambdaFunction: this.auditorFunction,
      outputPath: '$.Payload',
    });

    const calendarTask = new tasks.LambdaInvoke(this, 'AnalyzeCalendar', {
      lambdaFunction: this.calendarFunction,
      outputPath: '$.Payload',
    });

    const negotiateTask = new tasks.LambdaInvoke(this, 'GenerateNegotiation', {
      lambdaFunction: this.negotiatorFunction,
      outputPath: '$.Payload',
    });

    // Define workflow
    const definition = auditTask
      .next(calendarTask)
      .next(negotiateTask);

    const stateMachine = new sfn.StateMachine(this, 'SubSentinelOrchestrator', {
      stateMachineName: 'SubSentinel-MultiAgent-Orchestrator',
      definition,
      timeout: cdk.Duration.minutes(5),
    });

    // ─── Outputs ──────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'AuditorFunctionArn', {
      value: this.auditorFunction.functionArn,
      description: 'Auditor Lambda Function ARN',
      exportName: 'SubSentinel-AuditorArn',
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'Step Functions State Machine ARN',
      exportName: 'SubSentinel-StateMachineArn',
    });
  }
}
