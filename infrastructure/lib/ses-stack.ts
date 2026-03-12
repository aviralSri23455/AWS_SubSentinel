import * as cdk from 'aws-cdk-lib';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface SesStackProps extends cdk.StackProps {
  receiptsBucket: s3.Bucket;
  auditorFunction: lambda.Function;
}

export class SesStack extends cdk.Stack {
  public readonly ruleSet: ses.ReceiptRuleSet;
  public readonly configurationSet: ses.ConfigurationSet;

  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    // ─── SES Configuration Set ────────────────────────────────────────────
    this.configurationSet = new ses.ConfigurationSet(this, 'ConfigSet', {
      configurationSetName: 'subsentinel-email-tracking',
    });

    // ─── SES Receipt Rule Set ─────────────────────────────────────────────
    this.ruleSet = new ses.ReceiptRuleSet(this, 'ReceiptRuleSet', {
      receiptRuleSetName: 'subsentinel-receipt-rules',
    });

    // Grant SES permission to write to S3
    props.receiptsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [`${props.receiptsBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            'AWS:SourceAccount': this.account,
          },
        },
      })
    );

    // Grant SES permission to invoke Lambda
    props.auditorFunction.addPermission('SESInvokePermission', {
      principal: new iam.ServicePrincipal('ses.amazonaws.com'),
      action: 'lambda:InvokeFunction',
      sourceAccount: this.account,
    });

    // ─── Receipt Rule: S3 → Lambda ────────────────────────────────────────
    this.ruleSet.addRule('EmailToS3AndLambda', {
      recipients: ['receipts@subsentinel.com'], // Update with your verified domain
      actions: [
        new ses.actions.S3({
          bucket: props.receiptsBucket,
          objectKeyPrefix: 'incoming/',
        }),
        new ses.actions.Lambda({
          function: props.auditorFunction,
          invocationType: ses.LambdaInvocationType.EVENT,
        }),
      ],
      enabled: true,
      scanEnabled: true,
      tlsPolicy: ses.TlsPolicy.REQUIRE,
    });

    // ─── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'RuleSetName', {
      value: this.ruleSet.receiptRuleSetName,
      description: 'SES Receipt Rule Set Name',
      exportName: 'SubSentinel-SES-RuleSet',
    });

    new cdk.CfnOutput(this, 'ConfigSetName', {
      value: this.configurationSet.configurationSetName,
      description: 'SES Configuration Set Name',
      exportName: 'SubSentinel-SES-ConfigSet',
    });
  }
}
