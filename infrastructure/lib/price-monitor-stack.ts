import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class PriceMonitorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Price history table
    const priceHistoryTable = new dynamodb.Table(this, 'PriceHistoryTable', {
      partitionKey: { name: 'subscriptionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // SNS topic for price alerts
    const alertTopic = new sns.Topic(this, 'PriceAlertTopic', {
      displayName: 'Subscription Price Alerts',
    });

    // Lambda function
    const priceMonitorFn = new lambda.Function(this, 'PriceMonitorFunction', {
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: 'bootstrap',
      code: lambda.Code.fromAsset('../backend/cmd/agents/price-monitor'),
      timeout: cdk.Duration.minutes(3),
      memorySize: 256,
      environment: {
        SUBSCRIPTIONS_TABLE: 'subscriptions',
        PRICE_HISTORY_TABLE: priceHistoryTable.tableName,
        SNS_TOPIC_ARN: alertTopic.topicArn,
      },
    });

    // Grant permissions
    priceHistoryTable.grantReadWriteData(priceMonitorFn);
    alertTopic.grantPublish(priceMonitorFn);
    
    // Grant Bedrock access
    priceMonitorFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // EventBridge rule - daily at 2 AM UTC
    const rule = new events.Rule(this, 'PriceMonitorSchedule', {
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
    });
    
    rule.addTarget(new targets.LambdaFunction(priceMonitorFn));

    // Outputs
    new cdk.CfnOutput(this, 'PriceHistoryTableName', {
      value: priceHistoryTable.tableName,
    });
    
    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
    });
    
    new cdk.CfnOutput(this, 'FunctionName', {
      value: priceMonitorFn.functionName,
    });
  }
}
