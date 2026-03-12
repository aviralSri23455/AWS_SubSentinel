import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface SnsStackProps extends cdk.StackProps {
  lambdaFunctions?: lambda.Function[];
}

export class SnsStack extends cdk.Stack {
  public readonly notificationsTopic: sns.Topic;
  public readonly alertsTopic: sns.Topic;
  public readonly stepFunctionsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: SnsStackProps) {
    super(scope, id, props);

    // ─── User Notifications Topic ─────────────────────────────────────────
    this.notificationsTopic = new sns.Topic(this, 'NotificationsTopic', {
      topicName: 'subsentinel-notifications',
      displayName: 'SubSentinel User Notifications',
    });

    // ─── Operational Alerts Topic ─────────────────────────────────────────
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: 'subsentinel-alerts',
      displayName: 'SubSentinel Operational Alerts',
    });

    // ─── Step Functions Notifications Topic ───────────────────────────────
    this.stepFunctionsTopic = new sns.Topic(this, 'StepFunctionsTopic', {
      topicName: 'subsentinel-stepfunctions-notifications',
      displayName: 'SubSentinel Step Functions Notifications',
    });

    // ─── Grant Lambda Functions Permission to Publish ─────────────────────
    if (props?.lambdaFunctions) {
      props.lambdaFunctions.forEach((fn) => {
        this.notificationsTopic.grantPublish(fn);
        this.alertsTopic.grantPublish(fn);
        this.stepFunctionsTopic.grantPublish(fn);
      });
    }

    // ─── Outputs ──────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'NotificationsTopicArn', {
      value: this.notificationsTopic.topicArn,
      description: 'SNS Topic ARN for user notifications',
      exportName: 'SubSentinel-SNS-Notifications',
    });

    new cdk.CfnOutput(this, 'AlertsTopicArn', {
      value: this.alertsTopic.topicArn,
      description: 'SNS Topic ARN for operational alerts',
      exportName: 'SubSentinel-SNS-Alerts',
    });

    new cdk.CfnOutput(this, 'StepFunctionsTopicArn', {
      value: this.stepFunctionsTopic.topicArn,
      description: 'SNS Topic ARN for Step Functions notifications',
      exportName: 'SubSentinel-SNS-StepFunctions',
    });
  }
}
