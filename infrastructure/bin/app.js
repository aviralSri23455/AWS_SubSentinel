#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/database-stack");
const lambda_stack_1 = require("../lib/lambda-stack");
const api_stack_1 = require("../lib/api-stack");
const ai_stack_1 = require("../lib/ai-stack");
const monitoring_stack_1 = require("../lib/monitoring-stack");
const app = new cdk.App();
// Environment configuration
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
// Stack 1: Database Layer (DynamoDB, S3, OpenSearch)
const databaseStack = new database_stack_1.DatabaseStack(app, 'SubSentinel-Database', {
    env,
    description: 'SubSentinel Database Layer - DynamoDB, S3, OpenSearch with TOON optimization',
});
// Stack 2: AI Services (Bedrock permissions, KMS encryption)
const aiStack = new ai_stack_1.AiStack(app, 'SubSentinel-AI', {
    env,
    description: 'SubSentinel AI Services - Bedrock, Textract, Rekognition, Comprehend',
    kmsKey: databaseStack.kmsKey,
});
// Stack 3: Lambda Functions (5 Go agents)
const lambdaStack = new lambda_stack_1.LambdaStack(app, 'SubSentinel-Lambda', {
    env,
    description: 'SubSentinel Lambda Agents - Go 1.21 with TOON encoding',
    subscriptionsTable: databaseStack.subscriptionsTable,
    negotiationsTable: databaseStack.negotiationsTable,
    darkPatternsTable: databaseStack.darkPatternsTable,
    receiptsBucket: databaseStack.receiptsBucket,
    screenshotsBucket: databaseStack.screenshotsBucket,
    kmsKey: databaseStack.kmsKey,
    openSearchEndpoint: databaseStack.openSearchEndpoint,
});
// Stack 4: API Gateway (REST + WebSocket)
const apiStack = new api_stack_1.ApiStack(app, 'SubSentinel-API', {
    env,
    description: 'SubSentinel API Gateway - REST + WebSocket with Cognito auth',
    auditorFunction: lambdaStack.auditorFunction,
    calendarFunction: lambdaStack.calendarFunction,
    negotiatorFunction: lambdaStack.negotiatorFunction,
    defenderFunction: lambdaStack.defenderFunction,
    learnerFunction: lambdaStack.learnerFunction,
    apiFunction: lambdaStack.apiFunction,
});
// Stack 5: Monitoring (CloudWatch, Alarms)
const monitoringStack = new monitoring_stack_1.MonitoringStack(app, 'SubSentinel-Monitoring', {
    env,
    description: 'SubSentinel Monitoring - CloudWatch Dashboards and Alarms',
    lambdaFunctions: [
        lambdaStack.auditorFunction,
        lambdaStack.calendarFunction,
        lambdaStack.negotiatorFunction,
        lambdaStack.defenderFunction,
        lambdaStack.learnerFunction,
    ],
    restApi: apiStack.restApi,
    subscriptionsTable: databaseStack.subscriptionsTable,
});
// Add tags to all stacks
cdk.Tags.of(app).add('Project', 'SubSentinel');
cdk.Tags.of(app).add('Environment', 'Production');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('CostCenter', 'AI-Challenge-2026');
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsMERBQXNEO0FBQ3RELHNEQUFrRDtBQUNsRCxnREFBNEM7QUFDNUMsOENBQTBDO0FBQzFDLDhEQUEwRDtBQUUxRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQiw0QkFBNEI7QUFDNUIsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYscURBQXFEO0FBQ3JELE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsc0JBQXNCLEVBQUU7SUFDbkUsR0FBRztJQUNILFdBQVcsRUFBRSw4RUFBOEU7Q0FDNUYsQ0FBQyxDQUFDO0FBRUgsNkRBQTZEO0FBQzdELE1BQU0sT0FBTyxHQUFHLElBQUksa0JBQU8sQ0FBQyxHQUFHLEVBQUUsZ0JBQWdCLEVBQUU7SUFDakQsR0FBRztJQUNILFdBQVcsRUFBRSxzRUFBc0U7SUFDbkYsTUFBTSxFQUFFLGFBQWEsQ0FBQyxNQUFNO0NBQzdCLENBQUMsQ0FBQztBQUVILDBDQUEwQztBQUMxQyxNQUFNLFdBQVcsR0FBRyxJQUFJLDBCQUFXLENBQUMsR0FBRyxFQUFFLG9CQUFvQixFQUFFO0lBQzdELEdBQUc7SUFDSCxXQUFXLEVBQUUsd0RBQXdEO0lBQ3JFLGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxrQkFBa0I7SUFDcEQsaUJBQWlCLEVBQUUsYUFBYSxDQUFDLGlCQUFpQjtJQUNsRCxpQkFBaUIsRUFBRSxhQUFhLENBQUMsaUJBQWlCO0lBQ2xELGNBQWMsRUFBRSxhQUFhLENBQUMsY0FBYztJQUM1QyxpQkFBaUIsRUFBRSxhQUFhLENBQUMsaUJBQWlCO0lBQ2xELE1BQU0sRUFBRSxhQUFhLENBQUMsTUFBTTtJQUM1QixrQkFBa0IsRUFBRSxhQUFhLENBQUMsa0JBQWtCO0NBQ3JELENBQUMsQ0FBQztBQUVILDBDQUEwQztBQUMxQyxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLGlCQUFpQixFQUFFO0lBQ3BELEdBQUc7SUFDSCxXQUFXLEVBQUUsOERBQThEO0lBQzNFLGVBQWUsRUFBRSxXQUFXLENBQUMsZUFBZTtJQUM1QyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsZ0JBQWdCO0lBQzlDLGtCQUFrQixFQUFFLFdBQVcsQ0FBQyxrQkFBa0I7SUFDbEQsZ0JBQWdCLEVBQUUsV0FBVyxDQUFDLGdCQUFnQjtJQUM5QyxlQUFlLEVBQUUsV0FBVyxDQUFDLGVBQWU7SUFDNUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxXQUFXO0NBQ3JDLENBQUMsQ0FBQztBQUVILDJDQUEyQztBQUMzQyxNQUFNLGVBQWUsR0FBRyxJQUFJLGtDQUFlLENBQUMsR0FBRyxFQUFFLHdCQUF3QixFQUFFO0lBQ3pFLEdBQUc7SUFDSCxXQUFXLEVBQUUsMkRBQTJEO0lBQ3hFLGVBQWUsRUFBRTtRQUNmLFdBQVcsQ0FBQyxlQUFlO1FBQzNCLFdBQVcsQ0FBQyxnQkFBZ0I7UUFDNUIsV0FBVyxDQUFDLGtCQUFrQjtRQUM5QixXQUFXLENBQUMsZ0JBQWdCO1FBQzVCLFdBQVcsQ0FBQyxlQUFlO0tBQzVCO0lBQ0QsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPO0lBQ3pCLGtCQUFrQixFQUFFLGFBQWEsQ0FBQyxrQkFBa0I7Q0FDckQsQ0FBQyxDQUFDO0FBRUgseUJBQXlCO0FBQ3pCLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7QUFDL0MsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNsRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLEVBQUUsbUJBQW1CLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcclxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xyXG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgeyBEYXRhYmFzZVN0YWNrIH0gZnJvbSAnLi4vbGliL2RhdGFiYXNlLXN0YWNrJztcclxuaW1wb3J0IHsgTGFtYmRhU3RhY2sgfSBmcm9tICcuLi9saWIvbGFtYmRhLXN0YWNrJztcclxuaW1wb3J0IHsgQXBpU3RhY2sgfSBmcm9tICcuLi9saWIvYXBpLXN0YWNrJztcclxuaW1wb3J0IHsgQWlTdGFjayB9IGZyb20gJy4uL2xpYi9haS1zdGFjayc7XHJcbmltcG9ydCB7IE1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9tb25pdG9yaW5nLXN0YWNrJztcclxuXHJcbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XHJcblxyXG4vLyBFbnZpcm9ubWVudCBjb25maWd1cmF0aW9uXHJcbmNvbnN0IGVudiA9IHtcclxuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxyXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnLFxyXG59O1xyXG5cclxuLy8gU3RhY2sgMTogRGF0YWJhc2UgTGF5ZXIgKER5bmFtb0RCLCBTMywgT3BlblNlYXJjaClcclxuY29uc3QgZGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgJ1N1YlNlbnRpbmVsLURhdGFiYXNlJywge1xyXG4gIGVudixcclxuICBkZXNjcmlwdGlvbjogJ1N1YlNlbnRpbmVsIERhdGFiYXNlIExheWVyIC0gRHluYW1vREIsIFMzLCBPcGVuU2VhcmNoIHdpdGggVE9PTiBvcHRpbWl6YXRpb24nLFxyXG59KTtcclxuXHJcbi8vIFN0YWNrIDI6IEFJIFNlcnZpY2VzIChCZWRyb2NrIHBlcm1pc3Npb25zLCBLTVMgZW5jcnlwdGlvbilcclxuY29uc3QgYWlTdGFjayA9IG5ldyBBaVN0YWNrKGFwcCwgJ1N1YlNlbnRpbmVsLUFJJywge1xyXG4gIGVudixcclxuICBkZXNjcmlwdGlvbjogJ1N1YlNlbnRpbmVsIEFJIFNlcnZpY2VzIC0gQmVkcm9jaywgVGV4dHJhY3QsIFJla29nbml0aW9uLCBDb21wcmVoZW5kJyxcclxuICBrbXNLZXk6IGRhdGFiYXNlU3RhY2sua21zS2V5LFxyXG59KTtcclxuXHJcbi8vIFN0YWNrIDM6IExhbWJkYSBGdW5jdGlvbnMgKDUgR28gYWdlbnRzKVxyXG5jb25zdCBsYW1iZGFTdGFjayA9IG5ldyBMYW1iZGFTdGFjayhhcHAsICdTdWJTZW50aW5lbC1MYW1iZGEnLCB7XHJcbiAgZW52LFxyXG4gIGRlc2NyaXB0aW9uOiAnU3ViU2VudGluZWwgTGFtYmRhIEFnZW50cyAtIEdvIDEuMjEgd2l0aCBUT09OIGVuY29kaW5nJyxcclxuICBzdWJzY3JpcHRpb25zVGFibGU6IGRhdGFiYXNlU3RhY2suc3Vic2NyaXB0aW9uc1RhYmxlLFxyXG4gIG5lZ290aWF0aW9uc1RhYmxlOiBkYXRhYmFzZVN0YWNrLm5lZ290aWF0aW9uc1RhYmxlLFxyXG4gIGRhcmtQYXR0ZXJuc1RhYmxlOiBkYXRhYmFzZVN0YWNrLmRhcmtQYXR0ZXJuc1RhYmxlLFxyXG4gIHJlY2VpcHRzQnVja2V0OiBkYXRhYmFzZVN0YWNrLnJlY2VpcHRzQnVja2V0LFxyXG4gIHNjcmVlbnNob3RzQnVja2V0OiBkYXRhYmFzZVN0YWNrLnNjcmVlbnNob3RzQnVja2V0LFxyXG4gIGttc0tleTogZGF0YWJhc2VTdGFjay5rbXNLZXksXHJcbiAgb3BlblNlYXJjaEVuZHBvaW50OiBkYXRhYmFzZVN0YWNrLm9wZW5TZWFyY2hFbmRwb2ludCxcclxufSk7XHJcblxyXG4vLyBTdGFjayA0OiBBUEkgR2F0ZXdheSAoUkVTVCArIFdlYlNvY2tldClcclxuY29uc3QgYXBpU3RhY2sgPSBuZXcgQXBpU3RhY2soYXBwLCAnU3ViU2VudGluZWwtQVBJJywge1xyXG4gIGVudixcclxuICBkZXNjcmlwdGlvbjogJ1N1YlNlbnRpbmVsIEFQSSBHYXRld2F5IC0gUkVTVCArIFdlYlNvY2tldCB3aXRoIENvZ25pdG8gYXV0aCcsXHJcbiAgYXVkaXRvckZ1bmN0aW9uOiBsYW1iZGFTdGFjay5hdWRpdG9yRnVuY3Rpb24sXHJcbiAgY2FsZW5kYXJGdW5jdGlvbjogbGFtYmRhU3RhY2suY2FsZW5kYXJGdW5jdGlvbixcclxuICBuZWdvdGlhdG9yRnVuY3Rpb246IGxhbWJkYVN0YWNrLm5lZ290aWF0b3JGdW5jdGlvbixcclxuICBkZWZlbmRlckZ1bmN0aW9uOiBsYW1iZGFTdGFjay5kZWZlbmRlckZ1bmN0aW9uLFxyXG4gIGxlYXJuZXJGdW5jdGlvbjogbGFtYmRhU3RhY2subGVhcm5lckZ1bmN0aW9uLFxyXG4gIGFwaUZ1bmN0aW9uOiBsYW1iZGFTdGFjay5hcGlGdW5jdGlvbixcclxufSk7XHJcblxyXG4vLyBTdGFjayA1OiBNb25pdG9yaW5nIChDbG91ZFdhdGNoLCBBbGFybXMpXHJcbmNvbnN0IG1vbml0b3JpbmdTdGFjayA9IG5ldyBNb25pdG9yaW5nU3RhY2soYXBwLCAnU3ViU2VudGluZWwtTW9uaXRvcmluZycsIHtcclxuICBlbnYsXHJcbiAgZGVzY3JpcHRpb246ICdTdWJTZW50aW5lbCBNb25pdG9yaW5nIC0gQ2xvdWRXYXRjaCBEYXNoYm9hcmRzIGFuZCBBbGFybXMnLFxyXG4gIGxhbWJkYUZ1bmN0aW9uczogW1xyXG4gICAgbGFtYmRhU3RhY2suYXVkaXRvckZ1bmN0aW9uLFxyXG4gICAgbGFtYmRhU3RhY2suY2FsZW5kYXJGdW5jdGlvbixcclxuICAgIGxhbWJkYVN0YWNrLm5lZ290aWF0b3JGdW5jdGlvbixcclxuICAgIGxhbWJkYVN0YWNrLmRlZmVuZGVyRnVuY3Rpb24sXHJcbiAgICBsYW1iZGFTdGFjay5sZWFybmVyRnVuY3Rpb24sXHJcbiAgXSxcclxuICByZXN0QXBpOiBhcGlTdGFjay5yZXN0QXBpLFxyXG4gIHN1YnNjcmlwdGlvbnNUYWJsZTogZGF0YWJhc2VTdGFjay5zdWJzY3JpcHRpb25zVGFibGUsXHJcbn0pO1xyXG5cclxuLy8gQWRkIHRhZ3MgdG8gYWxsIHN0YWNrc1xyXG5jZGsuVGFncy5vZihhcHApLmFkZCgnUHJvamVjdCcsICdTdWJTZW50aW5lbCcpO1xyXG5jZGsuVGFncy5vZihhcHApLmFkZCgnRW52aXJvbm1lbnQnLCAnUHJvZHVjdGlvbicpO1xyXG5jZGsuVGFncy5vZihhcHApLmFkZCgnTWFuYWdlZEJ5JywgJ0NESycpO1xyXG5jZGsuVGFncy5vZihhcHApLmFkZCgnQ29zdENlbnRlcicsICdBSS1DaGFsbGVuZ2UtMjAyNicpO1xyXG4iXX0=