import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface AiStackProps extends cdk.StackProps {
  kmsKey: kms.Key;
}

export class AiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiStackProps) {
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
