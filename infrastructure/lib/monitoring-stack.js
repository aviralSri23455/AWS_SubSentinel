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
exports.MonitoringStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cloudwatch = __importStar(require("aws-cdk-lib/aws-cloudwatch"));
class MonitoringStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ─── CloudWatch Dashboard (No SNS - simpler setup) ────────────────────
        const dashboard = new cloudwatch.Dashboard(this, 'SubSentinelDashboard', {
            dashboardName: 'SubSentinel-Production',
        });
        // ─── Lambda Metrics ───────────────────────────────────────────────────
        const lambdaWidgets = [];
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
            lambdaWidgets.push(new cloudwatch.GraphWidget({
                title: `${fn.functionName} - Performance`,
                left: [invocations, errors],
                right: [duration],
                width: 12,
                height: 6,
            }));
            // Create alarms (visible in CloudWatch console)
            const errorAlarm = new cloudwatch.Alarm(this, `${fn.functionName}-ErrorAlarm`, {
                alarmName: `${fn.functionName}-HighErrors`,
                metric: errors,
                threshold: 10,
                evaluationPeriods: 2,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            // No SNS action - view alarms in CloudWatch console
            const durationAlarm = new cloudwatch.Alarm(this, `${fn.functionName}-DurationAlarm`, {
                alarmName: `${fn.functionName}-SlowExecution`,
                metric: duration,
                threshold: 5000, // 5 seconds
                evaluationPeriods: 3,
                comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
                treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
            });
            // No SNS action - view alarms in CloudWatch console
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
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'API Gateway - Requests & Errors',
            left: [apiRequests, api4xxErrors, api5xxErrors],
            right: [apiLatency],
            width: 24,
            height: 6,
        }));
        // API Gateway alarms (visible in CloudWatch console)
        const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
            alarmName: 'SubSentinel-API-5xxErrors',
            metric: api5xxErrors,
            threshold: 5,
            evaluationPeriods: 2,
            comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });
        // No SNS action - view alarms in CloudWatch console
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
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'DynamoDB - Subscriptions Table',
            left: [readCapacity, writeCapacity],
            right: [userErrors],
            width: 24,
            height: 6,
        }));
        // ─── TOON Savings Metrics (Custom) ────────────────────────────────────
        // Create custom metrics for TOON token savings
        const toonTokenSavingsMetric = new cloudwatch.Metric({
            namespace: 'SubSentinel/TOON',
            metricName: 'TokenSavingsPercent',
            statistic: 'Average',
            period: cdk.Duration.hours(1),
        });
        const toonStorageSavingsMetric = new cloudwatch.Metric({
            namespace: 'SubSentinel/TOON',
            metricName: 'StorageSavingsBytes',
            statistic: 'Sum',
            period: cdk.Duration.hours(1),
        });
        dashboard.addWidgets(new cloudwatch.GraphWidget({
            title: 'TOON Optimization - Token & Storage Savings',
            left: [toonTokenSavingsMetric],
            right: [toonStorageSavingsMetric],
            width: 24,
            height: 6,
        }));
        // ─── Cost Tracking Widget ─────────────────────────────────────────────
        dashboard.addWidgets(new cloudwatch.TextWidget({
            markdown: `
# SubSentinel Cost Tracking

## Monthly Costs (with TOON optimization)

| Service | Free Tier | Usage | Cost |
|---------|-----------|-------|------|
| **Lambda** | 1M requests | 50K | $0 |
| **Bedrock** | 3-month trial | 10K calls | $12 (60% savings) |
| **DynamoDB** | 25GB | 1.2GB | $0 |
| **S3** | 5GB | 1.5GB | $0 |
| **API Gateway** | 1M calls | 30K | $0 |
| **OpenSearch** | Demo tier | 0.8GB | $0 |

**Total: $12/month** (vs $55.50 without TOON)

**Annual Savings: $494**
        `,
            width: 24,
            height: 8,
        }));
        // ─── Outputs ──────────────────────────────────────────────────────────
        new cdk.CfnOutput(this, 'DashboardUrl', {
            value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
            description: 'CloudWatch Dashboard URL',
            exportName: 'SubSentinel-DashboardUrl',
        });
    }
}
exports.MonitoringStack = MonitoringStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9uaXRvcmluZy1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1vbml0b3Jpbmctc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHVFQUF5RDtBQVl6RCxNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUEyQjtRQUNuRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qix5RUFBeUU7UUFDekUsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxzQkFBc0IsRUFBRTtZQUN2RSxhQUFhLEVBQUUsd0JBQXdCO1NBQ3hDLENBQUMsQ0FBQztRQUVILHlFQUF5RTtRQUV6RSxNQUFNLGFBQWEsR0FBeUIsRUFBRSxDQUFDO1FBRS9DLEtBQUssQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUU7WUFDbkMsbUJBQW1CO1lBQ25CLE1BQU0sV0FBVyxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQztnQkFDdkMsU0FBUyxFQUFFLEtBQUs7Z0JBQ2hCLE1BQU0sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7YUFDaEMsQ0FBQyxDQUFDO1lBRUgsY0FBYztZQUNkLE1BQU0sTUFBTSxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUM7Z0JBQzdCLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixNQUFNLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQ2hDLENBQUMsQ0FBQztZQUVILFdBQVc7WUFDWCxNQUFNLFFBQVEsR0FBRyxFQUFFLENBQUMsY0FBYyxDQUFDO2dCQUNqQyxTQUFTLEVBQUUsU0FBUztnQkFDcEIsTUFB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QUFVLENBQUM7WUFDeEIsUUFBUSxFQUFFOzs7Ozs7Ozs7Ozs7Ozs7OztTQWlCVDtZQUNELEtBQUssRUFBRSxFQUFFO1lBQ1QsTUFBTSxFQUFFLENBQUM7U0FDVixDQUFDLENBQ0gsQ0FBQztRQUVGLHlFQUF5RTtRQUV6RSxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGNBQWMsRUFBRTtZQUN0QyxLQUFLLEVBQUUseURBQXlELElBQUksQ0FBQyxNQUFNLG9CQUFvQixTQUFTLENBQUMsYUFBYSxFQUFFO1lBQ3hILFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLDBCQUEwQjtTQUN2QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE5TUQsMENBOE1DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcclxuaW1wb3J0ICogYXMgY2xvdWR3YXRjaCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWR3YXRjaCc7XHJcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XHJcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XHJcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb25pdG9yaW5nU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcclxuICBsYW1iZGFGdW5jdGlvbnM6IGxhbWJkYS5GdW5jdGlvbltdO1xyXG4gIHJlc3RBcGk6IGFwaWdhdGV3YXkuUmVzdEFwaTtcclxuICBzdWJzY3JpcHRpb25zVGFibGU6IGR5bmFtb2RiLlRhYmxlO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgTW9uaXRvcmluZ1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTW9uaXRvcmluZ1N0YWNrUHJvcHMpIHtcclxuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBDbG91ZFdhdGNoIERhc2hib2FyZCAoTm8gU05TIC0gc2ltcGxlciBzZXR1cCkg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBjb25zdCBkYXNoYm9hcmQgPSBuZXcgY2xvdWR3YXRjaC5EYXNoYm9hcmQodGhpcywgJ1N1YlNlbnRpbmVsRGFzaGJvYXJkJywge1xyXG4gICAgICBkYXNoYm9hcmROYW1lOiAnU3ViU2VudGluZWwtUHJvZHVjdGlvbicsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgTGFtYmRhIE1ldHJpY3Mg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICBcclxuICAgIGNvbnN0IGxhbWJkYVdpZGdldHM6IGNsb3Vkd2F0Y2guSVdpZGdldFtdID0gW107XHJcblxyXG4gICAgcHJvcHMubGFtYmRhRnVuY3Rpb25zLmZvckVhY2goKGZuKSA9PiB7XHJcbiAgICAgIC8vIEludm9jYXRpb24gY291bnRcclxuICAgICAgY29uc3QgaW52b2NhdGlvbnMgPSBmbi5tZXRyaWNJbnZvY2F0aW9ucyh7XHJcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIEVycm9yIGNvdW50XHJcbiAgICAgIGNvbnN0IGVycm9ycyA9IGZuLm1ldHJpY0Vycm9ycyh7XHJcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIER1cmF0aW9uXHJcbiAgICAgIGNvbnN0IGR1cmF0aW9uID0gZm4ubWV0cmljRHVyYXRpb24oe1xyXG4gICAgICAgIHN0YXRpc3RpYzogJ0F2ZXJhZ2UnLFxyXG4gICAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgLy8gVGhyb3R0bGVzXHJcbiAgICAgIGNvbnN0IHRocm90dGxlcyA9IGZuLm1ldHJpY1Rocm90dGxlcyh7XHJcbiAgICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIC8vIENyZWF0ZSB3aWRnZXRcclxuICAgICAgbGFtYmRhV2lkZ2V0cy5wdXNoKFxyXG4gICAgICAgIG5ldyBjbG91ZHdhdGNoLkdyYXBoV2lkZ2V0KHtcclxuICAgICAgICAgIHRpdGxlOiBgJHtmbi5mdW5jdGlvbk5hbWV9IC0gUGVyZm9ybWFuY2VgLFxyXG4gICAgICAgICAgbGVmdDogW2ludm9jYXRpb25zLCBlcnJvcnNdLFxyXG4gICAgICAgICAgcmlnaHQ6IFtkdXJhdGlvbl0sXHJcbiAgICAgICAgICB3aWR0aDogMTIsXHJcbiAgICAgICAgICBoZWlnaHQ6IDYsXHJcbiAgICAgICAgfSlcclxuICAgICAgKTtcclxuXHJcbiAgICAgIC8vIENyZWF0ZSBhbGFybXMgKHZpc2libGUgaW4gQ2xvdWRXYXRjaCBjb25zb2xlKVxyXG4gICAgICBjb25zdCBlcnJvckFsYXJtID0gbmV3IGNsb3Vkd2F0Y2guQWxhcm0odGhpcywgYCR7Zm4uZnVuY3Rpb25OYW1lfS1FcnJvckFsYXJtYCwge1xyXG4gICAgICAgIGFsYXJtTmFtZTogYCR7Zm4uZnVuY3Rpb25OYW1lfS1IaWdoRXJyb3JzYCxcclxuICAgICAgICBtZXRyaWM6IGVycm9ycyxcclxuICAgICAgICB0aHJlc2hvbGQ6IDEwLFxyXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAyLFxyXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY2xvdWR3YXRjaC5Db21wYXJpc29uT3BlcmF0b3IuR1JFQVRFUl9USEFOX1RIUkVTSE9MRCxcclxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcclxuICAgICAgfSk7XHJcbiAgICAgIC8vIE5vIFNOUyBhY3Rpb24gLSB2aWV3IGFsYXJtcyBpbiBDbG91ZFdhdGNoIGNvbnNvbGVcclxuXHJcbiAgICAgIGNvbnN0IGR1cmF0aW9uQWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCBgJHtmbi5mdW5jdGlvbk5hbWV9LUR1cmF0aW9uQWxhcm1gLCB7XHJcbiAgICAgICAgYWxhcm1OYW1lOiBgJHtmbi5mdW5jdGlvbk5hbWV9LVNsb3dFeGVjdXRpb25gLFxyXG4gICAgICAgIG1ldHJpYzogZHVyYXRpb24sXHJcbiAgICAgICAgdGhyZXNob2xkOiA1MDAwLCAvLyA1IHNlY29uZHNcclxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMyxcclxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGNsb3Vkd2F0Y2guQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXHJcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY2xvdWR3YXRjaC5UcmVhdE1pc3NpbmdEYXRhLk5PVF9CUkVBQ0hJTkcsXHJcbiAgICAgIH0pO1xyXG4gICAgICAvLyBObyBTTlMgYWN0aW9uIC0gdmlldyBhbGFybXMgaW4gQ2xvdWRXYXRjaCBjb25zb2xlXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBBZGQgTGFtYmRhIHdpZGdldHMgdG8gZGFzaGJvYXJkXHJcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyguLi5sYW1iZGFXaWRnZXRzKTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgQVBJIEdhdGV3YXkgTWV0cmljcyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIFxyXG4gICAgY29uc3QgYXBpUmVxdWVzdHMgPSBwcm9wcy5yZXN0QXBpLm1ldHJpY0NvdW50KHtcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGFwaTR4eEVycm9ycyA9IHByb3BzLnJlc3RBcGkubWV0cmljQ2xpZW50RXJyb3Ioe1xyXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxyXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxyXG4gICAgfSk7XHJcblxyXG4gICAgY29uc3QgYXBpNXh4RXJyb3JzID0gcHJvcHMucmVzdEFwaS5tZXRyaWNTZXJ2ZXJFcnJvcih7XHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCBhcGlMYXRlbmN5ID0gcHJvcHMucmVzdEFwaS5tZXRyaWNMYXRlbmN5KHtcclxuICAgICAgc3RhdGlzdGljOiAnQXZlcmFnZScsXHJcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnQVBJIEdhdGV3YXkgLSBSZXF1ZXN0cyAmIEVycm9ycycsXHJcbiAgICAgICAgbGVmdDogW2FwaVJlcXVlc3RzLCBhcGk0eHhFcnJvcnMsIGFwaTV4eEVycm9yc10sXHJcbiAgICAgICAgcmlnaHQ6IFthcGlMYXRlbmN5XSxcclxuICAgICAgICB3aWR0aDogMjQsXHJcbiAgICAgICAgaGVpZ2h0OiA2LFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBBUEkgR2F0ZXdheSBhbGFybXMgKHZpc2libGUgaW4gQ2xvdWRXYXRjaCBjb25zb2xlKVxyXG4gICAgY29uc3QgYXBpNXh4QWxhcm0gPSBuZXcgY2xvdWR3YXRjaC5BbGFybSh0aGlzLCAnQXBpNXh4QWxhcm0nLCB7XHJcbiAgICAgIGFsYXJtTmFtZTogJ1N1YlNlbnRpbmVsLUFQSS01eHhFcnJvcnMnLFxyXG4gICAgICBtZXRyaWM6IGFwaTV4eEVycm9ycyxcclxuICAgICAgdGhyZXNob2xkOiA1LFxyXG4gICAgICBldmFsdWF0aW9uUGVyaW9kczogMixcclxuICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjbG91ZHdhdGNoLkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxyXG4gICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjbG91ZHdhdGNoLlRyZWF0TWlzc2luZ0RhdGEuTk9UX0JSRUFDSElORyxcclxuICAgIH0pO1xyXG4gICAgLy8gTm8gU05TIGFjdGlvbiAtIHZpZXcgYWxhcm1zIGluIENsb3VkV2F0Y2ggY29uc29sZVxyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBEeW5hbW9EQiBNZXRyaWNzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgXHJcbiAgICBjb25zdCByZWFkQ2FwYWNpdHkgPSBwcm9wcy5zdWJzY3JpcHRpb25zVGFibGUubWV0cmljQ29uc3VtZWRSZWFkQ2FwYWNpdHlVbml0cyh7XHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB3cml0ZUNhcGFjaXR5ID0gcHJvcHMuc3Vic2NyaXB0aW9uc1RhYmxlLm1ldHJpY0NvbnN1bWVkV3JpdGVDYXBhY2l0eVVuaXRzKHtcclxuICAgICAgc3RhdGlzdGljOiAnU3VtJyxcclxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IHVzZXJFcnJvcnMgPSBwcm9wcy5zdWJzY3JpcHRpb25zVGFibGUubWV0cmljVXNlckVycm9ycyh7XHJcbiAgICAgIHN0YXRpc3RpYzogJ1N1bScsXHJcbiAgICAgIHBlcmlvZDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBkYXNoYm9hcmQuYWRkV2lkZ2V0cyhcclxuICAgICAgbmV3IGNsb3Vkd2F0Y2guR3JhcGhXaWRnZXQoe1xyXG4gICAgICAgIHRpdGxlOiAnRHluYW1vREIgLSBTdWJzY3JpcHRpb25zIFRhYmxlJyxcclxuICAgICAgICBsZWZ0OiBbcmVhZENhcGFjaXR5LCB3cml0ZUNhcGFjaXR5XSxcclxuICAgICAgICByaWdodDogW3VzZXJFcnJvcnNdLFxyXG4gICAgICAgIHdpZHRoOiAyNCxcclxuICAgICAgICBoZWlnaHQ6IDYsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBUT09OIFNhdmluZ3MgTWV0cmljcyAoQ3VzdG9tKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBtZXRyaWNzIGZvciBUT09OIHRva2VuIHNhdmluZ3NcclxuICAgIGNvbnN0IHRvb25Ub2tlblNhdmluZ3NNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xyXG4gICAgICBuYW1lc3BhY2U6ICdTdWJTZW50aW5lbC9UT09OJyxcclxuICAgICAgbWV0cmljTmFtZTogJ1Rva2VuU2F2aW5nc1BlcmNlbnQnLFxyXG4gICAgICBzdGF0aXN0aWM6ICdBdmVyYWdlJyxcclxuICAgICAgcGVyaW9kOiBjZGsuRHVyYXRpb24uaG91cnMoMSksXHJcbiAgICB9KTtcclxuXHJcbiAgICBjb25zdCB0b29uU3RvcmFnZVNhdmluZ3NNZXRyaWMgPSBuZXcgY2xvdWR3YXRjaC5NZXRyaWMoe1xyXG4gICAgICBuYW1lc3BhY2U6ICdTdWJTZW50aW5lbC9UT09OJyxcclxuICAgICAgbWV0cmljTmFtZTogJ1N0b3JhZ2VTYXZpbmdzQnl0ZXMnLFxyXG4gICAgICBzdGF0aXN0aWM6ICdTdW0nLFxyXG4gICAgICBwZXJpb2Q6IGNkay5EdXJhdGlvbi5ob3VycygxKSxcclxuICAgIH0pO1xyXG5cclxuICAgIGRhc2hib2FyZC5hZGRXaWRnZXRzKFxyXG4gICAgICBuZXcgY2xvdWR3YXRjaC5HcmFwaFdpZGdldCh7XHJcbiAgICAgICAgdGl0bGU6ICdUT09OIE9wdGltaXphdGlvbiAtIFRva2VuICYgU3RvcmFnZSBTYXZpbmdzJyxcclxuICAgICAgICBsZWZ0OiBbdG9vblRva2VuU2F2aW5nc01ldHJpY10sXHJcbiAgICAgICAgcmlnaHQ6IFt0b29uU3RvcmFnZVNhdmluZ3NNZXRyaWNdLFxyXG4gICAgICAgIHdpZHRoOiAyNCxcclxuICAgICAgICBoZWlnaHQ6IDYsXHJcbiAgICAgIH0pXHJcbiAgICApO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBDb3N0IFRyYWNraW5nIFdpZGdldCDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIFxyXG4gICAgZGFzaGJvYXJkLmFkZFdpZGdldHMoXHJcbiAgICAgIG5ldyBjbG91ZHdhdGNoLlRleHRXaWRnZXQoe1xyXG4gICAgICAgIG1hcmtkb3duOiBgXHJcbiMgU3ViU2VudGluZWwgQ29zdCBUcmFja2luZ1xyXG5cclxuIyMgTW9udGhseSBDb3N0cyAod2l0aCBUT09OIG9wdGltaXphdGlvbilcclxuXHJcbnwgU2VydmljZSB8IEZyZWUgVGllciB8IFVzYWdlIHwgQ29zdCB8XHJcbnwtLS0tLS0tLS18LS0tLS0tLS0tLS18LS0tLS0tLXwtLS0tLS18XHJcbnwgKipMYW1iZGEqKiB8IDFNIHJlcXVlc3RzIHwgNTBLIHwgJDAgfFxyXG58ICoqQmVkcm9jayoqIHwgMy1tb250aCB0cmlhbCB8IDEwSyBjYWxscyB8ICQxMiAoNjAlIHNhdmluZ3MpIHxcclxufCAqKkR5bmFtb0RCKiogfCAyNUdCIHwgMS4yR0IgfCAkMCB8XHJcbnwgKipTMyoqIHwgNUdCIHwgMS41R0IgfCAkMCB8XHJcbnwgKipBUEkgR2F0ZXdheSoqIHwgMU0gY2FsbHMgfCAzMEsgfCAkMCB8XHJcbnwgKipPcGVuU2VhcmNoKiogfCBEZW1vIHRpZXIgfCAwLjhHQiB8ICQwIHxcclxuXHJcbioqVG90YWw6ICQxMi9tb250aCoqICh2cyAkNTUuNTAgd2l0aG91dCBUT09OKVxyXG5cclxuKipBbm51YWwgU2F2aW5nczogJDQ5NCoqXHJcbiAgICAgICAgYCxcclxuICAgICAgICB3aWR0aDogMjQsXHJcbiAgICAgICAgaGVpZ2h0OiA4LFxyXG4gICAgICB9KVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgT3V0cHV0cyDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuXHJcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGFzaGJvYXJkVXJsJywge1xyXG4gICAgICB2YWx1ZTogYGh0dHBzOi8vY29uc29sZS5hd3MuYW1hem9uLmNvbS9jbG91ZHdhdGNoL2hvbWU/cmVnaW9uPSR7dGhpcy5yZWdpb259I2Rhc2hib2FyZHM6bmFtZT0ke2Rhc2hib2FyZC5kYXNoYm9hcmROYW1lfWAsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRXYXRjaCBEYXNoYm9hcmQgVVJMJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLURhc2hib2FyZFVybCcsXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIl19