import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SecretsStackProps extends cdk.StackProps {
  lambdaFunctions?: lambda.Function[];
}

export class SecretsStack extends cdk.Stack {
  public readonly gmailOAuthSecret: secretsmanager.Secret;
  public readonly calendarOAuthSecret: secretsmanager.Secret;
  public readonly bedrockConfigSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: SecretsStackProps) {
    super(scope, id, props);

    // ─── Gmail OAuth Credentials ──────────────────────────────────────────
    this.gmailOAuthSecret = new secretsmanager.Secret(this, 'GmailOAuthSecret', {
      secretName: 'SubSentinel/GmailOAuth',
      description: 'Gmail OAuth 2.0 credentials for email scanning',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: 'PLACEHOLDER',
          client_secret: 'PLACEHOLDER',
          refresh_token: 'PLACEHOLDER',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ─── Google Calendar OAuth Credentials ────────────────────────────────
    this.calendarOAuthSecret = new secretsmanager.Secret(this, 'CalendarOAuthSecret', {
      secretName: 'SubSentinel/CalendarOAuth',
      description: 'Google Calendar OAuth 2.0 credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: 'PLACEHOLDER',
          client_secret: 'PLACEHOLDER',
          refresh_token: 'PLACEHOLDER',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ─── Bedrock Configuration ────────────────────────────────────────────
    this.bedrockConfigSecret = new secretsmanager.Secret(this, 'BedrockConfigSecret', {
      secretName: 'SubSentinel/BedrockAPI',
      description: 'Bedrock API configuration and settings',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          model_id: 'amazon.nova-pro-v1:0',
          region: 'us-east-1',
          max_tokens: 4096,
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ─── Grant Lambda Functions Read Access ───────────────────────────────
    if (props?.lambdaFunctions) {
      props.lambdaFunctions.forEach((fn) => {
        this.gmailOAuthSecret.grantRead(fn);
        this.calendarOAuthSecret.grantRead(fn);
        this.bedrockConfigSecret.grantRead(fn);
      });
    }

    // ─── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'GmailOAuthSecretArn', {
      value: this.gmailOAuthSecret.secretArn,
      description: 'Secrets Manager ARN for Gmail OAuth',
      exportName: 'SubSentinel-Secret-GmailOAuth',
    });

    new cdk.CfnOutput(this, 'CalendarOAuthSecretArn', {
      value: this.calendarOAuthSecret.secretArn,
      description: 'Secrets Manager ARN for Calendar OAuth',
      exportName: 'SubSentinel-Secret-CalendarOAuth',
    });

    new cdk.CfnOutput(this, 'BedrockConfigSecretArn', {
      value: this.bedrockConfigSecret.secretArn,
      description: 'Secrets Manager ARN for Bedrock Config',
      exportName: 'SubSentinel-Secret-BedrockConfig',
    });
  }
}
