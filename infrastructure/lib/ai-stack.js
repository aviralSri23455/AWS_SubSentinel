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
exports.AiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
class AiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ─── Bedrock Model Access Policy ──────────────────────────────────────
        // This stack primarily documents the AI services used
        // Actual permissions are granted in lambda-stack.ts per function
        // Create a managed policy for Bedrock access (reusable)
        const bedrockAccessPolicy = new iam.ManagedPolicy(this, 'BedrockAccessPolicy', {
            managedPolicyName: 'SubSentinel-BedrockAccess',
            description: 'Allows access to Bedrock models with TOON optimization (60% token savings)',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'bedrock:InvokeModel',
                        'bedrock:InvokeModelWithResponseStream',
                        'bedrock:GetFoundationModel',
                        'bedrock:ListFoundationModels',
                    ],
                    resources: [
                        // Claude 3.5 Sonnet (primary model for TOON-encoded prompts)
                        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0`,
                        // Titan Embeddings (for OpenSearch vectors)
                        `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`,
                    ],
                }),
            ],
        });
        // ─── Textract Access Policy ───────────────────────────────────────────
        const textractAccessPolicy = new iam.ManagedPolicy(this, 'TextractAccessPolicy', {
            managedPolicyName: 'SubSentinel-TextractAccess',
            description: 'Allows access to Textract for receipt OCR',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'textract:AnalyzeDocument',
                        'textract:DetectDocumentText',
                        'textract:GetDocumentAnalysis',
                        'textract:GetDocumentTextDetection',
                    ],
                    resources: ['*'],
                }),
            ],
        });
        // ─── Rekognition Access Policy ────────────────────────────────────────
        const rekognitionAccessPolicy = new iam.ManagedPolicy(this, 'RekognitionAccessPolicy', {
            managedPolicyName: 'SubSentinel-RekognitionAccess',
            description: 'Allows access to Rekognition for dark pattern detection',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'rekognition:DetectText',
                        'rekognition:DetectLabels',
                        'rekognition:DetectModerationLabels',
                    ],
                    resources: ['*'],
                }),
            ],
        });
        // ─── Comprehend Access Policy ─────────────────────────────────────────
        const comprehendAccessPolicy = new iam.ManagedPolicy(this, 'ComprehendAccessPolicy', {
            managedPolicyName: 'SubSentinel-ComprehendAccess',
            description: 'Allows access to Comprehend for sentiment analysis',
            statements: [
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'comprehend:DetectSentiment',
                        'comprehend:BatchDetectSentiment',
                        'comprehend:DetectEntities',
                    ],
                    resources: ['*'],
                }),
            ],
        });
        // ─── AI Services Usage Tracking ───────────────────────────────────────
        // Document the AI services and their usage for cost tracking
        const aiServicesMetadata = {
            bedrock: {
                models: [
                    'anthropic.claude-3-5-sonnet-20240620-v1:0',
                    'amazon.titan-embed-text-v1',
                ],
                freeTier: '3-month trial',
                expectedUsage: '10K API calls, 4M tokens (TOON-optimized)',
                tokenSavings: '60% vs JSON',
                monthlyCost: '$12 (vs $30 without TOON)',
            },
            textract: {
                freeTier: '1000 pages (3 months)',
                expectedUsage: '600 pages',
                monthlyCost: '$0 (within free tier)',
            },
            rekognition: {
                freeTier: '1000 images (3 months)',
                expectedUsage: '200 screenshots',
                monthlyCost: '$0 (within free tier)',
            },
            comprehend: {
                freeTier: '50K units (3 months)',
                expectedUsage: '5K units',
                monthlyCost: '$0 (within free tier)',
            },
        };
        // ─── Outputs ──────────────────────────────────────────────────────────
        new cdk.CfnOutput(this, 'BedrockPolicyArn', {
            value: bedrockAccessPolicy.managedPolicyArn,
            description: 'Bedrock Access Policy ARN (TOON-optimized)',
            exportName: 'SubSentinel-BedrockPolicyArn',
        });
        new cdk.CfnOutput(this, 'TextractPolicyArn', {
            value: textractAccessPolicy.managedPolicyArn,
            description: 'Textract Access Policy ARN',
            exportName: 'SubSentinel-TextractPolicyArn',
        });
        new cdk.CfnOutput(this, 'RekognitionPolicyArn', {
            value: rekognitionAccessPolicy.managedPolicyArn,
            description: 'Rekognition Access Policy ARN',
            exportName: 'SubSentinel-RekognitionPolicyArn',
        });
        new cdk.CfnOutput(this, 'ComprehendPolicyArn', {
            value: comprehendAccessPolicy.managedPolicyArn,
            description: 'Comprehend Access Policy ARN',
            exportName: 'SubSentinel-ComprehendPolicyArn',
        });
        // Output AI services metadata as JSON
        new cdk.CfnOutput(this, 'AiServicesMetadata', {
            value: JSON.stringify(aiServicesMetadata),
            description: 'AI Services usage and cost metadata',
        });
    }
}
exports.AiStack = AiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhaS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMseURBQTJDO0FBUTNDLE1BQWEsT0FBUSxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3BDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBbUI7UUFDM0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIseUVBQXlFO1FBRXpFLHNEQUFzRDtRQUN0RCxpRUFBaUU7UUFFakUsd0RBQXdEO1FBQ3hELE1BQU0sbUJBQW1CLEdBQUcsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUM3RSxpQkFBaUIsRUFBRSwyQkFBMkI7WUFDOUMsV0FBVyxFQUFFLDRFQUE0RTtZQUN6RixVQUFVLEVBQUU7Z0JBQ1YsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO29CQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO29CQUN4QixPQUFPLEVBQUU7d0JBQ1AscUJBQXFCO3dCQUNyQix1Q0FBdUM7d0JBQ3ZDLDRCQUE0Qjt3QkFDNUIsOEJBQThCO3FCQUMvQjtvQkFDRCxTQUFTLEVBQUU7d0JBQ1QsNkRBQTZEO3dCQUM3RCxtQkFBbUIsSUFBSSxDQUFDLE1BQU0sOERBQThEO3dCQUM1Riw0Q0FBNEM7d0JBQzVDLG1CQUFtQixJQUFJLENBQUMsTUFBTSwrQ0FBK0M7cUJBQzlFO2lCQUNGLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILHlFQUF5RTtRQUN6RSxNQUFNLG9CQUFvQixHQUFHLElBQUksR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLEVBQUU7WUFDL0UsaUJBQWlCLEVBQUUsNEJBQTRCO1lBQy9DLFdBQVcsRUFBRSwy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QUUsdUJBQXVCLENBQUMsZ0JBQWdCO1lBQy9DLFdBQVcsRUFBRSwrQkFBK0I7WUFDNUMsVUFBVSxFQUFFLGtDQUFrQztTQUMvQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzdDLEtBQUssRUFBRSxzQkFBc0IsQ0FBQyxnQkFBZ0I7WUFDOUMsV0FBVyxFQUFFLDhCQUE4QjtZQUMzQyxVQUFVLEVBQUUsaUNBQWlDO1NBQzlDLENBQUMsQ0FBQztRQUVILHNDQUFzQztRQUN0QyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzVDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDO1lBQ3pDLFdBQVcsRUFBRSxxQ0FBcUM7U0FDbkQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBbkpELDBCQW1KQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XHJcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcclxuaW1wb3J0ICogYXMga21zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1rbXMnO1xyXG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQWlTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xyXG4gIGttc0tleToga21zLktleTtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEFpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBBaVN0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBCZWRyb2NrIE1vZGVsIEFjY2VzcyBQb2xpY3kg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBcclxuICAgIC8vIFRoaXMgc3RhY2sgcHJpbWFyaWx5IGRvY3VtZW50cyB0aGUgQUkgc2VydmljZXMgdXNlZFxyXG4gICAgLy8gQWN0dWFsIHBlcm1pc3Npb25zIGFyZSBncmFudGVkIGluIGxhbWJkYS1zdGFjay50cyBwZXIgZnVuY3Rpb25cclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIGEgbWFuYWdlZCBwb2xpY3kgZm9yIEJlZHJvY2sgYWNjZXNzIChyZXVzYWJsZSlcclxuICAgIGNvbnN0IGJlZHJvY2tBY2Nlc3NQb2xpY3kgPSBuZXcgaWFtLk1hbmFnZWRQb2xpY3kodGhpcywgJ0JlZHJvY2tBY2Nlc3NQb2xpY3knLCB7XHJcbiAgICAgIG1hbmFnZWRQb2xpY3lOYW1lOiAnU3ViU2VudGluZWwtQmVkcm9ja0FjY2VzcycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWxsb3dzIGFjY2VzcyB0byBCZWRyb2NrIG1vZGVscyB3aXRoIFRPT04gb3B0aW1pemF0aW9uICg2MCUgdG9rZW4gc2F2aW5ncyknLFxyXG4gICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAnYmVkcm9jazpJbnZva2VNb2RlbCcsXHJcbiAgICAgICAgICAgICdiZWRyb2NrOkludm9rZU1vZGVsV2l0aFJlc3BvbnNlU3RyZWFtJyxcclxuICAgICAgICAgICAgJ2JlZHJvY2s6R2V0Rm91bmRhdGlvbk1vZGVsJyxcclxuICAgICAgICAgICAgJ2JlZHJvY2s6TGlzdEZvdW5kYXRpb25Nb2RlbHMnLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIHJlc291cmNlczogW1xyXG4gICAgICAgICAgICAvLyBDbGF1ZGUgMy41IFNvbm5ldCAocHJpbWFyeSBtb2RlbCBmb3IgVE9PTi1lbmNvZGVkIHByb21wdHMpXHJcbiAgICAgICAgICAgIGBhcm46YXdzOmJlZHJvY2s6JHt0aGlzLnJlZ2lvbn06OmZvdW5kYXRpb24tbW9kZWwvYW50aHJvcGljLmNsYXVkZS0zLTUtc29ubmV0LTIwMjQwNjIwLXYxOjBgLFxyXG4gICAgICAgICAgICAvLyBUaXRhbiBFbWJlZGRpbmdzIChmb3IgT3BlblNlYXJjaCB2ZWN0b3JzKVxyXG4gICAgICAgICAgICBgYXJuOmF3czpiZWRyb2NrOiR7dGhpcy5yZWdpb259Ojpmb3VuZGF0aW9uLW1vZGVsL2FtYXpvbi50aXRhbi1lbWJlZC10ZXh0LXYxYCxcclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgVGV4dHJhY3QgQWNjZXNzIFBvbGljeSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIGNvbnN0IHRleHRyYWN0QWNjZXNzUG9saWN5ID0gbmV3IGlhbS5NYW5hZ2VkUG9saWN5KHRoaXMsICdUZXh0cmFjdEFjY2Vzc1BvbGljeScsIHtcclxuICAgICAgbWFuYWdlZFBvbGljeU5hbWU6ICdTdWJTZW50aW5lbC1UZXh0cmFjdEFjY2VzcycsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWxsb3dzIGFjY2VzcyB0byBUZXh0cmFjdCBmb3IgcmVjZWlwdCBPQ1InLFxyXG4gICAgICBzdGF0ZW1lbnRzOiBbXHJcbiAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xyXG4gICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxyXG4gICAgICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgICAgICAndGV4dHJhY3Q6QW5hbHl6ZURvY3VtZW50JyxcclxuICAgICAgICAgICAgJ3RleHRyYWN0OkRldGVjdERvY3VtZW50VGV4dCcsXHJcbiAgICAgICAgICAgICd0ZXh0cmFjdDpHZXREb2N1bWVudEFuYWx5c2lzJyxcclxuICAgICAgICAgICAgJ3RleHRyYWN0OkdldERvY3VtZW50VGV4dERldGVjdGlvbicsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcclxuICAgICAgICB9KSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBSZWtvZ25pdGlvbiBBY2Nlc3MgUG9saWN5IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgcmVrb2duaXRpb25BY2Nlc3NQb2xpY3kgPSBuZXcgaWFtLk1hbmFnZWRQb2xpY3kodGhpcywgJ1Jla29nbml0aW9uQWNjZXNzUG9saWN5Jywge1xyXG4gICAgICBtYW5hZ2VkUG9saWN5TmFtZTogJ1N1YlNlbnRpbmVsLVJla29nbml0aW9uQWNjZXNzJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdBbGxvd3MgYWNjZXNzIHRvIFJla29nbml0aW9uIGZvciBkYXJrIHBhdHRlcm4gZGV0ZWN0aW9uJyxcclxuICAgICAgc3RhdGVtZW50czogW1xyXG4gICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcclxuICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcclxuICAgICAgICAgIGFjdGlvbnM6IFtcclxuICAgICAgICAgICAgJ3Jla29nbml0aW9uOkRldGVjdFRleHQnLFxyXG4gICAgICAgICAgICAncmVrb2duaXRpb246RGV0ZWN0TGFiZWxzJyxcclxuICAgICAgICAgICAgJ3Jla29nbml0aW9uOkRldGVjdE1vZGVyYXRpb25MYWJlbHMnLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgQ29tcHJlaGVuZCBBY2Nlc3MgUG9saWN5IOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgY29uc3QgY29tcHJlaGVuZEFjY2Vzc1BvbGljeSA9IG5ldyBpYW0uTWFuYWdlZFBvbGljeSh0aGlzLCAnQ29tcHJlaGVuZEFjY2Vzc1BvbGljeScsIHtcclxuICAgICAgbWFuYWdlZFBvbGljeU5hbWU6ICdTdWJTZW50aW5lbC1Db21wcmVoZW5kQWNjZXNzJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdBbGxvd3MgYWNjZXNzIHRvIENvbXByZWhlbmQgZm9yIHNlbnRpbWVudCBhbmFseXNpcycsXHJcbiAgICAgIHN0YXRlbWVudHM6IFtcclxuICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XHJcbiAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXHJcbiAgICAgICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgICAgICdjb21wcmVoZW5kOkRldGVjdFNlbnRpbWVudCcsXHJcbiAgICAgICAgICAgICdjb21wcmVoZW5kOkJhdGNoRGV0ZWN0U2VudGltZW50JyxcclxuICAgICAgICAgICAgJ2NvbXByZWhlbmQ6RGV0ZWN0RW50aXRpZXMnLFxyXG4gICAgICAgICAgXSxcclxuICAgICAgICAgIHJlc291cmNlczogWycqJ10sXHJcbiAgICAgICAgfSksXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgQUkgU2VydmljZXMgVXNhZ2UgVHJhY2tpbmcg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBcclxuICAgIC8vIERvY3VtZW50IHRoZSBBSSBzZXJ2aWNlcyBhbmQgdGhlaXIgdXNhZ2UgZm9yIGNvc3QgdHJhY2tpbmdcclxuICAgIGNvbnN0IGFpU2VydmljZXNNZXRhZGF0YSA9IHtcclxuICAgICAgYmVkcm9jazoge1xyXG4gICAgICAgIG1vZGVsczogW1xyXG4gICAgICAgICAgJ2FudGhyb3BpYy5jbGF1ZGUtMy01LXNvbm5ldC0yMDI0MDYyMC12MTowJyxcclxuICAgICAgICAgICdhbWF6b24udGl0YW4tZW1iZWQtdGV4dC12MScsXHJcbiAgICAgICAgXSxcclxuICAgICAgICBmcmVlVGllcjogJzMtbW9udGggdHJpYWwnLFxyXG4gICAgICAgIGV4cGVjdGVkVXNhZ2U6ICcxMEsgQVBJIGNhbGxzLCA0TSB0b2tlbnMgKFRPT04tb3B0aW1pemVkKScsXHJcbiAgICAgICAgdG9rZW5TYXZpbmdzOiAnNjAlIHZzIEpTT04nLFxyXG4gICAgICAgIG1vbnRobHlDb3N0OiAnJDEyICh2cyAkMzAgd2l0aG91dCBUT09OKScsXHJcbiAgICAgIH0sXHJcbiAgICAgIHRleHRyYWN0OiB7XHJcbiAgICAgICAgZnJlZVRpZXI6ICcxMDAwIHBhZ2VzICgzIG1vbnRocyknLFxyXG4gICAgICAgIGV4cGVjdGVkVXNhZ2U6ICc2MDAgcGFnZXMnLFxyXG4gICAgICAgIG1vbnRobHlDb3N0OiAnJDAgKHdpdGhpbiBmcmVlIHRpZXIpJyxcclxuICAgICAgfSxcclxuICAgICAgcmVrb2duaXRpb246IHtcclxuICAgICAgICBmcmVlVGllcjogJzEwMDAgaW1hZ2VzICgzIG1vbnRocyknLFxyXG4gICAgICAgIGV4cGVjdGVkVXNhZ2U6ICcyMDAgc2NyZWVuc2hvdHMnLFxyXG4gICAgICAgIG1vbnRobHlDb3N0OiAnJDAgKHdpdGhpbiBmcmVlIHRpZXIpJyxcclxuICAgICAgfSxcclxuICAgICAgY29tcHJlaGVuZDoge1xyXG4gICAgICAgIGZyZWVUaWVyOiAnNTBLIHVuaXRzICgzIG1vbnRocyknLFxyXG4gICAgICAgIGV4cGVjdGVkVXNhZ2U6ICc1SyB1bml0cycsXHJcbiAgICAgICAgbW9udGhseUNvc3Q6ICckMCAod2l0aGluIGZyZWUgdGllciknLFxyXG4gICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgT3V0cHV0cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQmVkcm9ja1BvbGljeUFybicsIHtcclxuICAgICAgdmFsdWU6IGJlZHJvY2tBY2Nlc3NQb2xpY3kubWFuYWdlZFBvbGljeUFybixcclxuICAgICAgZGVzY3JpcHRpb246ICdCZWRyb2NrIEFjY2VzcyBQb2xpY3kgQVJOIChUT09OLW9wdGltaXplZCknLFxyXG4gICAgICBleHBvcnROYW1lOiAnU3ViU2VudGluZWwtQmVkcm9ja1BvbGljeUFybicsXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVGV4dHJhY3RQb2xpY3lBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiB0ZXh0cmFjdEFjY2Vzc1BvbGljeS5tYW5hZ2VkUG9saWN5QXJuLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1RleHRyYWN0IEFjY2VzcyBQb2xpY3kgQVJOJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLVRleHRyYWN0UG9saWN5QXJuJyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSZWtvZ25pdGlvblBvbGljeUFybicsIHtcclxuICAgICAgdmFsdWU6IHJla29nbml0aW9uQWNjZXNzUG9saWN5Lm1hbmFnZWRQb2xpY3lBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUmVrb2duaXRpb24gQWNjZXNzIFBvbGljeSBBUk4nLFxyXG4gICAgICBleHBvcnROYW1lOiAnU3ViU2VudGluZWwtUmVrb2duaXRpb25Qb2xpY3lBcm4nLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NvbXByZWhlbmRQb2xpY3lBcm4nLCB7XHJcbiAgICAgIHZhbHVlOiBjb21wcmVoZW5kQWNjZXNzUG9saWN5Lm1hbmFnZWRQb2xpY3lBcm4sXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ29tcHJlaGVuZCBBY2Nlc3MgUG9saWN5IEFSTicsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdTdWJTZW50aW5lbC1Db21wcmVoZW5kUG9saWN5QXJuJyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIE91dHB1dCBBSSBzZXJ2aWNlcyBtZXRhZGF0YSBhcyBKU09OXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWlTZXJ2aWNlc01ldGFkYXRhJywge1xyXG4gICAgICB2YWx1ZTogSlNPTi5zdHJpbmdpZnkoYWlTZXJ2aWNlc01ldGFkYXRhKSxcclxuICAgICAgZGVzY3JpcHRpb246ICdBSSBTZXJ2aWNlcyB1c2FnZSBhbmQgY29zdCBtZXRhZGF0YScsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19