import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  lambdaFunctions: lambda.Function[];
  restApi: apigateway.RestApi;
  subscriptionsTable: dynamodb.Table;
  snsAlertsTopic: sns.Topic;
}

export class MonitoringStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // ─── CloudWatch Dashboard (No SNS - simpler setup) ────────────────────
    const dashboard = new cloudwatch.Dashboard(this, 'SubSentinelDashboard', {
      dashboardName: 'SubSentinel-Production',
    });

    // ─── Lambda Metrics ───────────────────────────────────────────────────
    
    const lambdaWidgets: cloudwatch.IWidget[] = [];

    props.lambdaFunctions.forEach((fn) => {
      // Invocation count
      const invocations = fn.metricInvocations({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Error count
      const errors = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Duration
      const duration = fn.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      });

      // Throttles
      const throttles = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      });

      // Create widget
      lambdaWidgets.push(
        new cloudwatch.GraphWidget({
          title: `${fn.functionName} - Performance`,
          left: [invocations, errors],
          right: [duration],
          width: 12,
          height: 6,
        })
      );

      // Create alarms with SNS notifications
      const errorAlarm = new cloudwatch.Alarm(this, `${fn.functionName}-ErrorAlarm`, {
        alarmName: `${fn.functionName}-HighErrors`,
        metric: errors,
        threshold: 10,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));

      const durationAlarm = new cloudwatch.Alarm(this, `${fn.functionName}-DurationAlarm`, {
        alarmName: `${fn.functionName}-SlowExecution`,
        metric: duration,
        threshold: 5000, // 5 seconds
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));
    });

    // Add Lambda widgets to dashboard
    dashboard.addWidgets(...lambdaWidgets);

    // ─── API Gateway Metrics ──────────────────────────────────────────────
    
    const apiRequests = props.restApi.metricCount({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api4xxErrors = props.restApi.metricClientError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const api5xxErrors = props.restApi.metricServerError({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const apiLatency = props.restApi.metricLatency({
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway - Requests & Errors',
        left: [apiRequests, api4xxErrors, api5xxErrors],
        right: [apiLatency],
        width: 24,
        height: 6,
      })
    );

    // API Gateway alarms with SNS notifications
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: 'SubSentinel-API-5xxErrors',
      metric: api5xxErrors,
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    api5xxAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));

    // ─── DynamoDB Metrics ─────────────────────────────────────────────────
    
    const readCapacity = props.subscriptionsTable.metricConsumedReadCapacityUnits({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const writeCapacity = props.subscriptionsTable.metricConsumedWriteCapacityUnits({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const userErrors = props.subscriptionsTable.metricUserErrors({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB - Subscriptions Table',
        left: [readCapacity, writeCapacity],
        right: [userErrors],
        width: 24,
        height: 6,
      })
    );

    // ─── Step Functions Metrics ───────────────────────────────────────────
    
    const sfnExecutionsStarted = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsStarted',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const sfnExecutionsFailed = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsFailed',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const sfnExecutionsSucceeded = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionsSucceeded',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    const sfnExecutionTime = new cloudwatch.Metric({
      namespace: 'AWS/States',
      metricName: 'ExecutionTime',
      statistic: 'Average',
      period: cdk.Duration.minutes(5),
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Step Functions - Executions',
        left: [sfnExecutionsStarted, sfnExecutionsFailed, sfnExecutionsSucceeded],
        right: [sfnExecutionTime],
        width: 24,
        height: 6,
      })
    );

    // Step Functions alarms
    const sfnFailureAlarm = new cloudwatch.Alarm(this, 'StepFunctionsFailureAlarm', {
      alarmName: 'SubSentinel-StepFunctions-HighFailures',
      metric: sfnExecutionsFailed,
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    sfnFailureAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));

    const sfnSlowAlarm = new cloudwatch.Alarm(this, 'StepFunctionsSlowAlarm', {
      alarmName: 'SubSentinel-StepFunctions-SlowExecution',
      metric: sfnExecutionTime,
      threshold: 30000, // 30 seconds
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    sfnSlowAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));

    // ─── Bedrock Metrics ──────────────────────────────────────────────────
    
    const bedrockInvocations = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'Invocations',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      dimensionsMap: {
        ModelId: 'amazon.nova-pro-v1:0',
      },
    });

    const bedrockInputTokens = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'InputTokens',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      dimensionsMap: {
        ModelId: 'amazon.nova-pro-v1:0',
      },
    });

    const bedrockOutputTokens = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'OutputTokens',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      dimensionsMap: {
        ModelId: 'amazon.nova-pro-v1:0',
      },
    });

    const bedrockErrors = new cloudwatch.Metric({
      namespace: 'AWS/Bedrock',
      metricName: 'ModelInvocationClientErrors',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
      dimensionsMap: {
        ModelId: 'amazon.nova-pro-v1:0',
      },
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Bedrock - Token Usage & Invocations',
        left: [bedrockInvocations, bedrockErrors],
        right: [bedrockInputTokens, bedrockOutputTokens],
        width: 24,
        height: 6,
      })
    );

    // Bedrock error alarm
    const bedrockErrorAlarm = new cloudwatch.Alarm(this, 'BedrockErrorAlarm', {
      alarmName: 'SubSentinel-Bedrock-HighErrors',
      metric: bedrockErrors,
      threshold: 10,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    bedrockErrorAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(props.snsAlertsTopic));

    // ─── TOON Savings Dashboard Widget ───────────────────────────────────
    
    // Custom metric for TOON token savings (published by Lambda functions)
    const toonSavings = new cloudwatch.Metric({
      namespace: 'SubSentinel/TOON',
      metricName: 'TokensSaved',
      statistic: 'Sum',
      period: cdk.Duration.hours(1),
    });

    dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'TOON Token Savings (Last Hour)',
        metrics: [toonSavings],
        width: 12,
        height: 6,
      })
    );

    // ─── Outputs ──────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
      exportName: 'SubSentinel-DashboardUrl',
    });
  }
}
