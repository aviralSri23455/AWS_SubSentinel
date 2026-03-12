"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const sfn = __importStar(require("aws-cdk-lib/aws-stepfunctions"));
const tasks = __importStar(require("aws-cdk-lib/aws-stepfunctions-tasks"));
class LambdaStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywrREFBaUQ7QUFJakQseURBQTJDO0FBQzNDLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsbUVBQXFEO0FBQ3JELDJFQUE2RDtBQWE3RCxNQUFhLFdBQVksU0FBUSxHQUFHLENBQUMsS0FBSztJQVF4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLHlFQUF5RTtRQUN6RSxNQUFNLFNBQVMsR0FBRztZQUNoQixtQkFBbUIsRUFBRSxLQUFLLENBQUMsa0JBQWtCLENBQUMsU0FBUztZQUN2RCxrQkFBa0IsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNyRCxtQkFBbUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUN0RCxlQUFlLEVBQUUsS0FBSyxDQUFDLGNBQWMsQ0FBQyxVQUFVO1lBQ2hELGtCQUFrQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVO1lBQ3RELFVBQVUsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUs7WUFDOUIsbUJBQW1CLEVBQUUsS0FBSyxDQUFDLGtCQUFrQjtZQUM3QyxVQUFVLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDeEIsQ0FBQztRQUVGLHlFQUF5RTtRQUN6RSxNQUFNLGFBQWEsR0FBRyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDNUMsTUFBTSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSztZQUN4QixPQUFPLEVBQUU7Z0JBQ1AscUJBQXFCO2dCQUNyQix1Q0FBdUM7YUFDeEM7WUFDRCxTQUFTLEVBQUU7Z0JBQ1Qs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Q0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxZQUFZLENBQUMsZUFBZTtZQUNuQyxXQUFXLEVBQUUsa0NBQWtDO1lBQy9DLFVBQVUsRUFBRSw2QkFBNkI7U0FDMUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL05ELGtDQStOQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcclxuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcclxuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xyXG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XHJcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcclxuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xyXG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xyXG5pbXBvcnQgKiBhcyB0YXNrcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc3RlcGZ1bmN0aW9ucy10YXNrcyc7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBMYW1iZGFTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIHN1YnNjcmlwdGlvbnNUYWJsZTogZHluYW1vZGIuVGFibGU7XHJcbiAgbmVnb3RpYXRpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG4gIGRhcmtQYXR0ZXJuc1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcclxuICByZWNlaXB0c0J1Y2tldDogczMuQnVja2V0O1xyXG4gIHNjcmVlbnNob3RzQnVja2V0OiBzMy5CdWNrZXQ7XHJcbiAga21zS2V5OiBrbXMuS2V5O1xyXG4gIG9wZW5TZWFyY2hFbmRwb2ludDogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSBhdWRpdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgY2FsZW5kYXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBuZWdvdGlhdG9yRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGVmZW5kZXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIHB1YmxpYyByZWFkb25seSBsZWFybmVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgYXBpRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuXHJcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IExhbWJkYVN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBDb21tb24gTGFtYmRhIEVudmlyb25tZW50IFZhcmlhYmxlcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcclxuICAgICAgU1VCU0NSSVBUSU9OU19UQUJMRTogcHJvcHMuc3Vic2NyaXB0aW9uc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgTkVHT1RJQVRJT05TX1RBQkxFOiBwcm9wcy5uZWdvdGlhdGlvbnNUYWJsZS50YWJsZU5hbWUsXHJcbiAgICAgIERBUktfUEFUVEVSTlNfVEFCTEU6IHByb3BzLmRhcmtQYXR0ZXJuc1RhYmxlLnRhYmxlTmFtZSxcclxuICAgICAgUkVDRUlQVFNfQlVDS0VUOiBwcm9wcy5yZWNlaXB0c0J1Y2tldC5idWNrZXROYW1lLFxyXG4gICAgICBTQ1JFRU5TSE9UU19CVUNLRVQ6IHByb3BzLnNjcmVlbnNob3RzQnVja2V0LmJ1Y2tldE5hbWUsXHJcbiAgICAgIEtNU19LRVlfSUQ6IHByb3BzLmttc0tleS5rZXlJZCxcclxuICAgICAgT1BFTlNFQVJDSF9FTkRQT0lOVDogcHJvcHMub3BlblNlYXJjaEVuZHBvaW50LFxyXG4gICAgICBBV1NfUkVHSU9OOiB0aGlzLnJlZ2lvbixcclxuICAgIH07XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIENvbW1vbiBJQU0gUG9saWN5IGZvciBCZWRyb2NrIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgYmVkcm9ja1BvbGljeSA9IG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgJ2JlZHJvY2s6SW52b2tlTW9kZWwnLFxyXG4gICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcclxuICAgICAgXSxcclxuICAgICAgcmVzb3VyY2VzOiBbXHJcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbnRocm9waWMuY2xhdWRlLTMtNS1zb25uZXQtMjAyNDA2MjAtdjE6MGAsXHJcbiAgICAgICAgYGFybjphd3M6YmVkcm9jazoke3RoaXMucmVnaW9ufTo6Zm91bmRhdGlvbi1tb2RlbC9hbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MWAsXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgMS4gQXVkaXRvciBBZ2VudCAoUmVjZWlwdCBTY2FubmVyKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMuYXVkaXRvckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXVkaXRvckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdTdWJTZW50aW5lbC1BdWRpdG9yJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxyXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Jpbi9hdWRpdG9yJyksXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQsXHJcbiAgICAgIG1lbW9yeVNpemU6IDEyOCxcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1ZGl0b3IgQWdlbnQgLSBTY2FucyByZWNlaXB0cyB3aXRoIFRleHRyYWN0ICsgVE9PTi1lbmNvZGVkIEJlZHJvY2sgKDYwJSB0b2tlbiBzYXZpbmdzKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBHcmFudCBwZXJtaXNzaW9uc1xyXG4gICAgcHJvcHMuc3Vic2NyaXB0aW9uc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmF1ZGl0b3JGdW5jdGlvbik7XHJcbiAgICBwcm9wcy5yZWNlaXB0c0J1Y2tldC5ncmFudFJlYWQodGhpcy5hdWRpdG9yRnVuY3Rpb24pO1xyXG4gICAgcHJvcHMua21zS2V5LmdyYW50RGVjcnlwdCh0aGlzLmF1ZGl0b3JGdW5jdGlvbik7XHJcbiAgICB0aGlzLmF1ZGl0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koYmVkcm9ja1BvbGljeSk7XHJcbiAgICB0aGlzLmF1ZGl0b3JGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgIGFjdGlvbnM6IFsndGV4dHJhY3Q6QW5hbHl6ZURvY3VtZW50JywgJ3RleHRyYWN0OkRldGVjdERvY3VtZW50VGV4dCddLFxyXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCAyLiBDYWxlbmRhciBSZWFzb25lciBBZ2VudCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMuY2FsZW5kYXJGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0NhbGVuZGFyRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ1N1YlNlbnRpbmVsLUNhbGVuZGFyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxyXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Jpbi9jYWxlbmRhcicpLFxyXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuWDg2XzY0LFxyXG4gICAgICBtZW1vcnlTaXplOiAxMjgsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudixcclxuICAgICAgZGVzY3JpcHRpb246ICdDYWxlbmRhciBSZWFzb25lciAtIERldGVjdHMgbGlmZSBldmVudHMgd2l0aCBUT09OLWZvcm1hdHRlZCBjYWxlbmRhciBkYXRhJyxcclxuICAgIH0pO1xyXG5cclxuICAgIHByb3BzLnN1YnNjcmlwdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKHRoaXMuY2FsZW5kYXJGdW5jdGlvbik7XHJcbiAgICBwcm9wcy5rbXNLZXkuZ3JhbnREZWNyeXB0KHRoaXMuY2FsZW5kYXJGdW5jdGlvbik7XHJcbiAgICB0aGlzLmNhbGVuZGFyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGJlZHJvY2tQb2xpY3kpO1xyXG4gICAgdGhpcy5jYWxlbmRhckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgYWN0aW9uczogWydzZWNyZXRzbWFuYWdlcjpHZXRTZWNyZXRWYWx1ZSddLFxyXG4gICAgICByZXNvdXJjZXM6IFtgYXJuOmF3czpzZWNyZXRzbWFuYWdlcjoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06c2VjcmV0OlN1YlNlbnRpbmVsLypgXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyBFdmVudEJyaWRnZSBydWxlIGZvciBkYWlseSBjYWxlbmRhciBjaGVja1xyXG4gICAgY29uc3QgY2FsZW5kYXJSdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdDYWxlbmRhckRhaWx5UnVsZScsIHtcclxuICAgICAgcnVsZU5hbWU6ICdTdWJTZW50aW5lbC1DYWxlbmRhckRhaWx5JyxcclxuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5jcm9uKHsgaG91cjogJzknLCBtaW51dGU6ICcwJyB9KSxcclxuICAgICAgZGVzY3JpcHRpb246ICdUcmlnZ2VyIENhbGVuZGFyIFJlYXNvbmVyIGRhaWx5IGF0IDkgQU0nLFxyXG4gICAgfSk7XHJcbiAgICBjYWxlbmRhclJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHRoaXMuY2FsZW5kYXJGdW5jdGlvbikpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCAzLiBOZWdvdGlhdG9yIEFnZW50IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy5uZWdvdGlhdG9yRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdOZWdvdGlhdG9yRnVuY3Rpb24nLCB7XHJcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ1N1YlNlbnRpbmVsLU5lZ290aWF0b3InLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXHJcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvYmluL25lZ290aWF0b3InKSxcclxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLlg4Nl82NCxcclxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnYsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnTmVnb3RpYXRvciBBZ2VudCAtIERyYWZ0cyBlbWFpbHMgd2l0aCBPcGVuU2VhcmNoIGstTk4gKyBUT09OIHZlY3RvcnMgKDgyJSBzdWNjZXNzKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBwcm9wcy5uZWdvdGlhdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5uZWdvdGlhdG9yRnVuY3Rpb24pO1xyXG4gICAgcHJvcHMua21zS2V5LmdyYW50RW5jcnlwdERlY3J5cHQodGhpcy5uZWdvdGlhdG9yRnVuY3Rpb24pO1xyXG4gICAgdGhpcy5uZWdvdGlhdG9yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KGJlZHJvY2tQb2xpY3kpO1xyXG4gICAgdGhpcy5uZWdvdGlhdG9yRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICBhY3Rpb25zOiBbJ2Fvc3M6QVBJQWNjZXNzQWxsJ10sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmFvc3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmNvbGxlY3Rpb24vKmBdLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCA0LiBEYXJrIFBhdHRlcm4gRGVmZW5kZXIgQWdlbnQg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICB0aGlzLmRlZmVuZGVyRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdEZWZlbmRlckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdTdWJTZW50aW5lbC1EZWZlbmRlcicsXHJcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBST1ZJREVEX0FMMixcclxuICAgICAgaGFuZGxlcjogJ2Jvb3RzdHJhcCcsXHJcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9iaW4vZGVmZW5kZXInKSxcclxuICAgICAgYXJjaGl0ZWN0dXJlOiBsYW1iZGEuQXJjaGl0ZWN0dXJlLlg4Nl82NCxcclxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxyXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg5MCksXHJcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnYsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVmZW5kZXIgQWdlbnQgLSBEZXRlY3RzIGRhcmsgcGF0dGVybnMgd2l0aCBSZWtvZ25pdGlvbiArIEJlZHJvY2sgVmlzaW9uICg5MiUgYWNjdXJhY3ksIDYyJSB0b2tlbiBzYXZpbmdzKScsXHJcbiAgICB9KTtcclxuXHJcbiAgICBwcm9wcy5kYXJrUGF0dGVybnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5kZWZlbmRlckZ1bmN0aW9uKTtcclxuICAgIHByb3BzLnNjcmVlbnNob3RzQnVja2V0LmdyYW50UmVhZCh0aGlzLmRlZmVuZGVyRnVuY3Rpb24pO1xyXG4gICAgcHJvcHMua21zS2V5LmdyYW50RGVjcnlwdCh0aGlzLmRlZmVuZGVyRnVuY3Rpb24pO1xyXG4gICAgdGhpcy5kZWZlbmRlckZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeShiZWRyb2NrUG9saWN5KTtcclxuICAgIHRoaXMuZGVmZW5kZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgIGFjdGlvbnM6IFsncmVrb2duaXRpb246RGV0ZWN0VGV4dCcsICdyZWtvZ25pdGlvbjpEZXRlY3RMYWJlbHMnXSxcclxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgIH0pKTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgNS4gTGVhcm5lciBBZ2VudCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIHRoaXMubGVhcm5lckZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnTGVhcm5lckZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdTdWJTZW50aW5lbC1MZWFybmVyJyxcclxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFJPVklERURfQUwyLFxyXG4gICAgICBoYW5kbGVyOiAnYm9vdHN0cmFwJyxcclxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL2Jpbi9sZWFybmVyJyksXHJcbiAgICAgIGFyY2hpdGVjdHVyZTogbGFtYmRhLkFyY2hpdGVjdHVyZS5YODZfNjQsXHJcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcclxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxyXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0xlYXJuZXIgQWdlbnQgLSBBZGFwdGl2ZSBNTCB3aXRoIENvbXByZWhlbmQgKyBUT09OIHZlY3RvcnMgKDYwJSBzdG9yYWdlIHNhdmluZ3MpJyxcclxuICAgIH0pO1xyXG5cclxuICAgIHByb3BzLm5lZ290aWF0aW9uc1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5sZWFybmVyRnVuY3Rpb24pO1xyXG4gICAgcHJvcHMua21zS2V5LmdyYW50RGVjcnlwdCh0aGlzLmxlYXJuZXJGdW5jdGlvbik7XHJcbiAgICB0aGlzLmxlYXJuZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3koYmVkcm9ja1BvbGljeSk7XHJcbiAgICB0aGlzLmxlYXJuZXJGdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgIGFjdGlvbnM6IFsnY29tcHJlaGVuZDpEZXRlY3RTZW50aW1lbnQnLCAnY29tcHJlaGVuZDpCYXRjaERldGVjdFNlbnRpbWVudCddLFxyXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxyXG4gICAgfSkpO1xyXG4gICAgdGhpcy5sZWFybmVyRnVuY3Rpb24uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICBhY3Rpb25zOiBbJ2Fvc3M6QVBJQWNjZXNzQWxsJ10sXHJcbiAgICAgIHJlc291cmNlczogW2Bhcm46YXdzOmFvc3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmNvbGxlY3Rpb24vKmBdLFxyXG4gICAgfSkpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCA2LiBBUEkgSGFuZGxlciAoUkVTVCBlbmRwb2ludHMpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgdGhpcy5hcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FwaUZ1bmN0aW9uJywge1xyXG4gICAgICBmdW5jdGlvbk5hbWU6ICdTdWJTZW50aW5lbC1BUEknLFxyXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QUk9WSURFRF9BTDIsXHJcbiAgICAgIGhhbmRsZXI6ICdib290c3RyYXAnLFxyXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvYmluL2FwaScpLFxyXG4gICAgICBhcmNoaXRlY3R1cmU6IGxhbWJkYS5BcmNoaXRlY3R1cmUuWDg2XzY0LFxyXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcclxuICAgICAgZW52aXJvbm1lbnQ6IGNvbW1vbkVudixcclxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgSGFuZGxlciAtIFJFU1QgZW5kcG9pbnRzIHdpdGggVE9PTi1lbmNvZGVkIHJlc3BvbnNlcyAoNjAlIHNtYWxsZXIgcGF5bG9hZHMpJyxcclxuICAgIH0pO1xyXG5cclxuICAgIHByb3BzLnN1YnNjcmlwdGlvbnNUYWJsZS5ncmFudFJlYWREYXRhKHRoaXMuYXBpRnVuY3Rpb24pO1xyXG4gICAgcHJvcHMubmVnb3RpYXRpb25zVGFibGUuZ3JhbnRSZWFkRGF0YSh0aGlzLmFwaUZ1bmN0aW9uKTtcclxuICAgIHByb3BzLmRhcmtQYXR0ZXJuc1RhYmxlLmdyYW50UmVhZERhdGEodGhpcy5hcGlGdW5jdGlvbik7XHJcbiAgICBwcm9wcy5rbXNLZXkuZ3JhbnREZWNyeXB0KHRoaXMuYXBpRnVuY3Rpb24pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBTdGVwIEZ1bmN0aW9ucyBPcmNoZXN0cmF0aW9uIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgXHJcbiAgICAvLyBEZWZpbmUgdGFza3NcclxuICAgIGNvbnN0IGF1ZGl0VGFzayA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0F1ZGl0UmVjZWlwdHMnLCB7XHJcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiB0aGlzLmF1ZGl0b3JGdW5jdGlvbixcclxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBjYWxlbmRhclRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdBbmFseXplQ2FsZW5kYXInLCB7XHJcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiB0aGlzLmNhbGVuZGFyRnVuY3Rpb24sXHJcbiAgICAgIG91dHB1dFBhdGg6ICckLlBheWxvYWQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgbmVnb3RpYXRlVGFzayA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ0dlbmVyYXRlTmVnb3RpYXRpb24nLCB7XHJcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiB0aGlzLm5lZ290aWF0b3JGdW5jdGlvbixcclxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBEZWZpbmUgd29ya2Zsb3dcclxuICAgIGNvbnN0IGRlZmluaXRpb24gPSBhdWRpdFRhc2tcclxuICAgICAgLm5leHQoY2FsZW5kYXJUYXNrKVxyXG4gICAgICAubmV4dChuZWdvdGlhdGVUYXNrKTtcclxuXHJcbiAgICBjb25zdCBzdGF0ZU1hY2hpbmUgPSBuZXcgc2ZuLlN0YXRlTWFjaGluZSh0aGlzLCAnU3ViU2VudGluZWxPcmNoZXN0cmF0b3InLCB7XHJcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdTdWJTZW50aW5lbC1NdWx0aUFnZW50LU9yY2hlc3RyYXRvcicsXHJcbiAgICAgIGRlZmluaXRpb24sXHJcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIE91dHB1dHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0F1ZGl0b3JGdW5jdGlvbkFybicsIHtcclxuICAgICAgdmFsdWU6IHRoaXMuYXVkaXRvckZ1bmN0aW9uLmZ1bmN0aW9uQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1ZGl0b3IgTGFtYmRhIEZ1bmN0aW9uIEFSTicsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdTdWJTZW50aW5lbC1BdWRpdG9yQXJuJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdTdGF0ZU1hY2hpbmVBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAgRnVuY3Rpb25zIFN0YXRlIE1hY2hpbmUgQVJOJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLVN0YXRlTWFjaGluZUFybicsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19