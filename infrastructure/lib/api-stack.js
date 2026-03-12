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
exports.ApiStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class ApiStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ─── Cognito User Pool (Authentication) ───────────────────────────────
        this.userPool = new cognito.UserPool(this, 'SubSentinelUserPool', {
            userPoolName: 'SubSentinel-Users',
            selfSignUpEnabled: true,
            signInAliases: {
                email: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: false,
                },
                givenName: {
                    required: false,
                    mutable: true,
                },
                familyName: {
                    required: false,
                    mutable: true,
                },
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        // User Pool Client
        const userPoolClient = this.userPool.addClient('SubSentinelWebClient', {
            userPoolClientName: 'SubSentinel-Web',
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                },
                scopes: [
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callbackUrls: [
                    'http://localhost:3000/auth/callback',
                    'https://subsentinel.amplifyapp.com/auth/callback',
                ],
                logoutUrls: [
                    'http://localhost:3000',
                    'https://subsentinel.amplifyapp.com',
                ],
            },
        });
        // ─── HTTP API (Faster & Cheaper than REST API) ───────────────────────
        this.httpApi = new apigatewayv2.HttpApi(this, 'SubSentinelHttpApi', {
            apiName: 'SubSentinel-HTTP-API',
            description: 'SubSentinel HTTP API with TOON-encoded responses (60% smaller, 70% cheaper than REST)',
            corsPreflight: {
                allowOrigins: ['http://localhost:3000', 'https://subsentinel.amplifyapp.com'],
                allowMethods: [
                    apigatewayv2.CorsHttpMethod.GET,
                    apigatewayv2.CorsHttpMethod.POST,
                    apigatewayv2.CorsHttpMethod.PUT,
                    apigatewayv2.CorsHttpMethod.DELETE,
                ],
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        // Add Lambda integrations to HTTP API
        const apiIntegration = new integrations.HttpLambdaIntegration('ApiIntegration', props.apiFunction);
        const auditorIntegration = new integrations.HttpLambdaIntegration('AuditorIntegration', props.auditorFunction);
        const calendarIntegration = new integrations.HttpLambdaIntegration('CalendarIntegration', props.calendarFunction);
        const negotiatorIntegration = new integrations.HttpLambdaIntegration('NegotiatorIntegration', props.negotiatorFunction);
        const defenderIntegration = new integrations.HttpLambdaIntegration('DefenderIntegration', props.defenderFunction);
        const learnerIntegration = new integrations.HttpLambdaIntegration('LearnerIntegration', props.learnerFunction);
        // Add routes
        this.httpApi.addRoutes({
            path: '/subscriptions',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: apiIntegration,
        });
        this.httpApi.addRoutes({
            path: '/audit',
            methods: [apigatewayv2.HttpMethod.POST],
            integration: auditorIntegration,
        });
        this.httpApi.addRoutes({
            path: '/calendar/insights',
            methods: [apigatewayv2.HttpMethod.GET],
            integration: calendarIntegration,
        });
        this.httpApi.addRoutes({
            path: '/negotiate',
            methods: [apigatewayv2.HttpMethod.POST],
            integration: negotiatorIntegration,
        });
        this.httpApi.addRoutes({
            path: '/dark-patterns/analyze',
            methods: [apigatewayv2.HttpMethod.POST],
            integration: defenderIntegration,
        });
        this.httpApi.addRoutes({
            path: '/learn',
            methods: [apigatewayv2.HttpMethod.POST],
            integration: learnerIntegration,
        });
        // ─── WebSocket API (Real-Time Agent Updates) ─────────────────────────
        this.webSocketApi = new apigatewayv2.WebSocketApi(this, 'SubSentinelWebSocketApi', {
            apiName: 'SubSentinel-WebSocket-API',
            description: 'SubSentinel WebSocket API for real-time agent activity feed (TOON-encoded)',
            connectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration('ConnectIntegration', props.apiFunction),
            },
            disconnectRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration('DisconnectIntegration', props.apiFunction),
            },
            defaultRouteOptions: {
                integration: new integrations.WebSocketLambdaIntegration('DefaultIntegration', props.apiFunction),
            },
        });
        new apigatewayv2.WebSocketStage(this, 'WebSocketProdStage', {
            webSocketApi: this.webSocketApi,
            stageName: 'prod',
            autoDeploy: true,
        });
        // ─── API Gateway REST API (Legacy - keeping for compatibility) ───────
        // CloudWatch Log Group for API Gateway
        const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
            logGroupName: '/aws/apigateway/subsentinel',
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        this.restApi = new apigateway.RestApi(this, 'SubSentinelApi', {
            restApiName: 'SubSentinel-API',
            description: 'SubSentinel REST API with TOON-encoded responses (60% smaller payloads)',
            deployOptions: {
                stageName: 'prod',
                throttlingRateLimit: 100,
                throttlingBurstLimit: 200,
                loggingLevel: apigateway.MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields(),
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: [
                    'Content-Type',
                    'X-Amz-Date',
                    'Authorization',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                ],
            },
        });
        // Cognito Authorizer
        const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
            cognitoUserPools: [this.userPool],
            authorizerName: 'SubSentinel-Cognito',
        });
        // ─── API Resources & Methods ──────────────────────────────────────────
        // /subscriptions
        const subscriptions = this.restApi.root.addResource('subscriptions');
        subscriptions.addMethod('GET', new apigateway.LambdaIntegration(props.apiFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /subscriptions/{id}
        const subscription = subscriptions.addResource('{id}');
        subscription.addMethod('GET', new apigateway.LambdaIntegration(props.apiFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /audit (trigger manual audit)
        const audit = this.restApi.root.addResource('audit');
        audit.addMethod('POST', new apigateway.LambdaIntegration(props.auditorFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /calendar/insights
        const calendar = this.restApi.root.addResource('calendar');
        const insights = calendar.addResource('insights');
        insights.addMethod('GET', new apigateway.LambdaIntegration(props.calendarFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /negotiate
        const negotiate = this.restApi.root.addResource('negotiate');
        negotiate.addMethod('POST', new apigateway.LambdaIntegration(props.negotiatorFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /negotiate/history
        const negotiateHistory = negotiate.addResource('history');
        negotiateHistory.addMethod('GET', new apigateway.LambdaIntegration(props.apiFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /dark-patterns
        const darkPatterns = this.restApi.root.addResource('dark-patterns');
        darkPatterns.addMethod('GET', new apigateway.LambdaIntegration(props.apiFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /dark-patterns/analyze
        const analyze = darkPatterns.addResource('analyze');
        analyze.addMethod('POST', new apigateway.LambdaIntegration(props.defenderFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /learn (trigger learning from outcome)
        const learn = this.restApi.root.addResource('learn');
        learn.addMethod('POST', new apigateway.LambdaIntegration(props.learnerFunction), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
        });
        // /health (public endpoint)
        const health = this.restApi.root.addResource('health');
        health.addMethod('GET', new apigateway.MockIntegration({
            integrationResponses: [{
                    statusCode: '200',
                    responseTemplates: {
                        'application/json': '{"status": "healthy", "service": "SubSentinel", "toon_enabled": true}',
                    },
                }],
            requestTemplates: {
                'application/json': '{"statusCode": 200}',
            },
        }), {
            methodResponses: [{ statusCode: '200' }],
        });
        // ─── Outputs ──────────────────────────────────────────────────────────
        new cdk.CfnOutput(this, 'HttpApiEndpoint', {
            value: this.httpApi.url,
            description: 'HTTP API endpoint URL (use this for standard requests)',
            exportName: 'SubSentinel-HttpApiEndpoint',
        });
        new cdk.CfnOutput(this, 'WebSocketApiEndpoint', {
            value: this.webSocketApi.apiEndpoint,
            description: 'WebSocket API endpoint URL (use this for real-time updates)',
            exportName: 'SubSentinel-WebSocketApiEndpoint',
        });
        new cdk.CfnOutput(this, 'ApiEndpoint', {
            value: this.restApi.url,
            description: 'REST API endpoint URL (legacy)',
            exportName: 'SubSentinel-ApiEndpoint',
        });
        new cdk.CfnOutput(this, 'UserPoolId', {
            value: this.userPool.userPoolId,
            description: 'Cognito User Pool ID',
            exportName: 'SubSentinel-UserPoolId',
        });
        new cdk.CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
            description: 'Cognito User Pool Client ID',
            exportName: 'SubSentinel-UserPoolClientId',
        });
    }
}
exports.ApiStack = ApiStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBpLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1RUFBeUQ7QUFDekQsMkVBQTZEO0FBQzdELHdGQUEwRTtBQUUxRSxpRUFBbUQ7QUFDbkQsMkRBQTZDO0FBWTdDLE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBTXJDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIseUVBQXlFO1FBQ3pFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxxQkFBcUIsRUFBRTtZQUNoRSxZQUFZLEVBQUUsbUJBQW1CO1lBQ2pDLGlCQUFpQixFQUFFLElBQUk7WUFDdkIsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2FBQ1o7WUFDRCxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7YUFDWjtZQUNELGtCQUFrQixFQUFFO2dCQUNsQixLQUFLLEVBQUU7b0JBQ0wsUUFBUSxFQUFFLElBQUk7b0JBQ2QsT0FBTyxFQUFFLEtBQUs7aUJBQ2Y7Z0JBQ0QsU0FBUyxFQUFFO29CQUNULFFBQVEsRUFBRSxLQUFLO29CQUNmLE9BQU8sRUFBRSxJQUFJO2lCQUNkO2dCQUNELFVBQVUsRUFBRTtvQkFDVixRQUFRLEVBQUUsS0FBSztvQkFDZixPQUFPLEVBQUUsSUFBSTtpQkFDZDthQUNGO1lBQ0QsY0FBYyxFQUFFO2dCQUNkLFNBQVMsRUFBRSxDQUFDO2dCQUNaLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGdCQUFnQixFQUFFLElBQUk7Z0JBQ3RCLGFBQWEsRUFBRSxJQUFJO2dCQUNuQixjQUFjLEVBQUUsS0FBSzthQUN0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LElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxnQkFBZ0I7WUFDdEMsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxVQUFVLEVBQUUsOEJBQThCO1NBQzNDLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXJURCw0QkFxVEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xyXG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcclxuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheXYyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xyXG5pbXBvcnQgKiBhcyBpbnRlZ3JhdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mi1pbnRlZ3JhdGlvbnMnO1xyXG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XHJcbmltcG9ydCAqIGFzIGNvZ25pdG8gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZ25pdG8nO1xyXG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcclxuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFwaVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XHJcbiAgYXVkaXRvckZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XHJcbiAgY2FsZW5kYXJGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIG5lZ290aWF0b3JGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG4gIGRlZmVuZGVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBsZWFybmVyRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcclxuICBhcGlGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgQXBpU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xyXG4gIHB1YmxpYyByZWFkb25seSByZXN0QXBpOiBhcGlnYXRld2F5LlJlc3RBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IGh0dHBBcGk6IGFwaWdhdGV3YXl2Mi5IdHRwQXBpO1xyXG4gIHB1YmxpYyByZWFkb25seSB3ZWJTb2NrZXRBcGk6IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGk7XHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJQb29sOiBjb2duaXRvLlVzZXJQb29sO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpU3RhY2tQcm9wcykge1xyXG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIENvZ25pdG8gVXNlciBQb29sIChBdXRoZW50aWNhdGlvbikg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcbiAgICB0aGlzLnVzZXJQb29sID0gbmV3IGNvZ25pdG8uVXNlclBvb2wodGhpcywgJ1N1YlNlbnRpbmVsVXNlclBvb2wnLCB7XHJcbiAgICAgIHVzZXJQb29sTmFtZTogJ1N1YlNlbnRpbmVsLVVzZXJzJyxcclxuICAgICAgc2VsZlNpZ25VcEVuYWJsZWQ6IHRydWUsXHJcbiAgICAgIHNpZ25JbkFsaWFzZXM6IHtcclxuICAgICAgICBlbWFpbDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgYXV0b1ZlcmlmeToge1xyXG4gICAgICAgIGVtYWlsOiB0cnVlLFxyXG4gICAgICB9LFxyXG4gICAgICBzdGFuZGFyZEF0dHJpYnV0ZXM6IHtcclxuICAgICAgICBlbWFpbDoge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IHRydWUsXHJcbiAgICAgICAgICBtdXRhYmxlOiBmYWxzZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdpdmVuTmFtZToge1xyXG4gICAgICAgICAgcmVxdWlyZWQ6IGZhbHNlLFxyXG4gICAgICAgICAgbXV0YWJsZTogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIGZhbWlseU5hbWU6IHtcclxuICAgICAgICAgIHJlcXVpcmVkOiBmYWxzZSxcclxuICAgICAgICAgIG11dGFibGU6IHRydWUsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgICAgcGFzc3dvcmRQb2xpY3k6IHtcclxuICAgICAgICBtaW5MZW5ndGg6IDgsXHJcbiAgICAgICAgcmVxdWlyZUxvd2VyY2FzZTogdHJ1ZSxcclxuICAgICAgICByZXF1aXJlVXBwZXJjYXNlOiB0cnVlLFxyXG4gICAgICAgIHJlcXVpcmVEaWdpdHM6IHRydWUsXHJcbiAgICAgICAgcmVxdWlyZVN5bWJvbHM6IGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgICBhY2NvdW50UmVjb3Zlcnk6IGNvZ25pdG8uQWNjb3VudFJlY292ZXJ5LkVNQUlMX09OTFksXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTixcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFVzZXIgUG9vbCBDbGllbnRcclxuICAgIGNvbnN0IHVzZXJQb29sQ2xpZW50ID0gdGhpcy51c2VyUG9vbC5hZGRDbGllbnQoJ1N1YlNlbnRpbmVsV2ViQ2xpZW50Jywge1xyXG4gICAgICB1c2VyUG9vbENsaWVudE5hbWU6ICdTdWJTZW50aW5lbC1XZWInLFxyXG4gICAgICBhdXRoRmxvd3M6IHtcclxuICAgICAgICB1c2VyUGFzc3dvcmQ6IHRydWUsXHJcbiAgICAgICAgdXNlclNycDogdHJ1ZSxcclxuICAgICAgfSxcclxuICAgICAgb0F1dGg6IHtcclxuICAgICAgICBmbG93czoge1xyXG4gICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGVHcmFudDogdHJ1ZSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNjb3BlczogW1xyXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLkVNQUlMLFxyXG4gICAgICAgICAgY29nbml0by5PQXV0aFNjb3BlLk9QRU5JRCxcclxuICAgICAgICAgIGNvZ25pdG8uT0F1dGhTY29wZS5QUk9GSUxFLFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgY2FsbGJhY2tVcmxzOiBbXHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwL2F1dGgvY2FsbGJhY2snLFxyXG4gICAgICAgICAgJ2h0dHBzOi8vc3Vic2VudGluZWwuYW1wbGlmeWFwcC5jb20vYXV0aC9jYWxsYmFjaycsXHJcbiAgICAgICAgXSxcclxuICAgICAgICBsb2dvdXRVcmxzOiBbXHJcbiAgICAgICAgICAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICAgICdodHRwczovL3N1YnNlbnRpbmVsLmFtcGxpZnlhcHAuY29tJyxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIEhUVFAgQVBJIChGYXN0ZXIgJiBDaGVhcGVyIHRoYW4gUkVTVCBBUEkpIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG4gICAgXHJcbiAgICB0aGlzLmh0dHBBcGkgPSBuZXcgYXBpZ2F0ZXdheXYyLkh0dHBBcGkodGhpcywgJ1N1YlNlbnRpbmVsSHR0cEFwaScsIHtcclxuICAgICAgYXBpTmFtZTogJ1N1YlNlbnRpbmVsLUhUVFAtQVBJJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTdWJTZW50aW5lbCBIVFRQIEFQSSB3aXRoIFRPT04tZW5jb2RlZCByZXNwb25zZXMgKDYwJSBzbWFsbGVyLCA3MCUgY2hlYXBlciB0aGFuIFJFU1QpJyxcclxuICAgICAgY29yc1ByZWZsaWdodDoge1xyXG4gICAgICAgIGFsbG93T3JpZ2luczogWydodHRwOi8vbG9jYWxob3N0OjMwMDAnLCAnaHR0cHM6Ly9zdWJzZW50aW5lbC5hbXBsaWZ5YXBwLmNvbSddLFxyXG4gICAgICAgIGFsbG93TWV0aG9kczogW1xyXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLkdFVCxcclxuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5QT1NULFxyXG4gICAgICAgICAgYXBpZ2F0ZXdheXYyLkNvcnNIdHRwTWV0aG9kLlBVVCxcclxuICAgICAgICAgIGFwaWdhdGV3YXl2Mi5Db3JzSHR0cE1ldGhvZC5ERUxFVEUsXHJcbiAgICAgICAgXSxcclxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcclxuICAgICAgfSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIEFkZCBMYW1iZGEgaW50ZWdyYXRpb25zIHRvIEhUVFAgQVBJXHJcbiAgICBjb25zdCBhcGlJbnRlZ3JhdGlvbiA9IG5ldyBpbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKCdBcGlJbnRlZ3JhdGlvbicsIHByb3BzLmFwaUZ1bmN0aW9uKTtcclxuICAgIGNvbnN0IGF1ZGl0b3JJbnRlZ3JhdGlvbiA9IG5ldyBpbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKCdBdWRpdG9ySW50ZWdyYXRpb24nLCBwcm9wcy5hdWRpdG9yRnVuY3Rpb24pO1xyXG4gICAgY29uc3QgY2FsZW5kYXJJbnRlZ3JhdGlvbiA9IG5ldyBpbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKCdDYWxlbmRhckludGVncmF0aW9uJywgcHJvcHMuY2FsZW5kYXJGdW5jdGlvbik7XHJcbiAgICBjb25zdCBuZWdvdGlhdG9ySW50ZWdyYXRpb24gPSBuZXcgaW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbignTmVnb3RpYXRvckludGVncmF0aW9uJywgcHJvcHMubmVnb3RpYXRvckZ1bmN0aW9uKTtcclxuICAgIGNvbnN0IGRlZmVuZGVySW50ZWdyYXRpb24gPSBuZXcgaW50ZWdyYXRpb25zLkh0dHBMYW1iZGFJbnRlZ3JhdGlvbignRGVmZW5kZXJJbnRlZ3JhdGlvbicsIHByb3BzLmRlZmVuZGVyRnVuY3Rpb24pO1xyXG4gICAgY29uc3QgbGVhcm5lckludGVncmF0aW9uID0gbmV3IGludGVncmF0aW9ucy5IdHRwTGFtYmRhSW50ZWdyYXRpb24oJ0xlYXJuZXJJbnRlZ3JhdGlvbicsIHByb3BzLmxlYXJuZXJGdW5jdGlvbik7XHJcblxyXG4gICAgLy8gQWRkIHJvdXRlc1xyXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XHJcbiAgICAgIHBhdGg6ICcvc3Vic2NyaXB0aW9ucycsXHJcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5HRVRdLFxyXG4gICAgICBpbnRlZ3JhdGlvbjogYXBpSW50ZWdyYXRpb24sXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmh0dHBBcGkuYWRkUm91dGVzKHtcclxuICAgICAgcGF0aDogJy9hdWRpdCcsXHJcbiAgICAgIG1ldGhvZHM6IFthcGlnYXRld2F5djIuSHR0cE1ldGhvZC5QT1NUXSxcclxuICAgICAgaW50ZWdyYXRpb246IGF1ZGl0b3JJbnRlZ3JhdGlvbixcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xyXG4gICAgICBwYXRoOiAnL2NhbGVuZGFyL2luc2lnaHRzJyxcclxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLkdFVF0sXHJcbiAgICAgIGludGVncmF0aW9uOiBjYWxlbmRhckludGVncmF0aW9uLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XHJcbiAgICAgIHBhdGg6ICcvbmVnb3RpYXRlJyxcclxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxyXG4gICAgICBpbnRlZ3JhdGlvbjogbmVnb3RpYXRvckludGVncmF0aW9uLFxyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5odHRwQXBpLmFkZFJvdXRlcyh7XHJcbiAgICAgIHBhdGg6ICcvZGFyay1wYXR0ZXJucy9hbmFseXplJyxcclxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxyXG4gICAgICBpbnRlZ3JhdGlvbjogZGVmZW5kZXJJbnRlZ3JhdGlvbixcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuaHR0cEFwaS5hZGRSb3V0ZXMoe1xyXG4gICAgICBwYXRoOiAnL2xlYXJuJyxcclxuICAgICAgbWV0aG9kczogW2FwaWdhdGV3YXl2Mi5IdHRwTWV0aG9kLlBPU1RdLFxyXG4gICAgICBpbnRlZ3JhdGlvbjogbGVhcm5lckludGVncmF0aW9uLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIFdlYlNvY2tldCBBUEkgKFJlYWwtVGltZSBBZ2VudCBVcGRhdGVzKSDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIFxyXG4gICAgdGhpcy53ZWJTb2NrZXRBcGkgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaSh0aGlzLCAnU3ViU2VudGluZWxXZWJTb2NrZXRBcGknLCB7XHJcbiAgICAgIGFwaU5hbWU6ICdTdWJTZW50aW5lbC1XZWJTb2NrZXQtQVBJJyxcclxuICAgICAgZGVzY3JpcHRpb246ICdTdWJTZW50aW5lbCBXZWJTb2NrZXQgQVBJIGZvciByZWFsLXRpbWUgYWdlbnQgYWN0aXZpdHkgZmVlZCAoVE9PTi1lbmNvZGVkKScsXHJcbiAgICAgIGNvbm5lY3RSb3V0ZU9wdGlvbnM6IHtcclxuICAgICAgICBpbnRlZ3JhdGlvbjogbmV3IGludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbignQ29ubmVjdEludGVncmF0aW9uJywgcHJvcHMuYXBpRnVuY3Rpb24pLFxyXG4gICAgICB9LFxyXG4gICAgICBkaXNjb25uZWN0Um91dGVPcHRpb25zOiB7XHJcbiAgICAgICAgaW50ZWdyYXRpb246IG5ldyBpbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oJ0Rpc2Nvbm5lY3RJbnRlZ3JhdGlvbicsIHByb3BzLmFwaUZ1bmN0aW9uKSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdFJvdXRlT3B0aW9uczoge1xyXG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgaW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKCdEZWZhdWx0SW50ZWdyYXRpb24nLCBwcm9wcy5hcGlGdW5jdGlvbiksXHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuXHJcbiAgICBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldFN0YWdlKHRoaXMsICdXZWJTb2NrZXRQcm9kU3RhZ2UnLCB7XHJcbiAgICAgIHdlYlNvY2tldEFwaTogdGhpcy53ZWJTb2NrZXRBcGksXHJcbiAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxyXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g4pSA4pSA4pSAIEFQSSBHYXRld2F5IFJFU1QgQVBJIChMZWdhY3kgLSBrZWVwaW5nIGZvciBjb21wYXRpYmlsaXR5KSDilIDilIDilIDilIDilIDilIDilIBcclxuICAgIFxyXG4gICAgLy8gQ2xvdWRXYXRjaCBMb2cgR3JvdXAgZm9yIEFQSSBHYXRld2F5XHJcbiAgICBjb25zdCBhcGlMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBcGlHYXRld2F5TG9ncycsIHtcclxuICAgICAgbG9nR3JvdXBOYW1lOiAnL2F3cy9hcGlnYXRld2F5L3N1YnNlbnRpbmVsJyxcclxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXHJcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnJlc3RBcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdTdWJTZW50aW5lbEFwaScsIHtcclxuICAgICAgcmVzdEFwaU5hbWU6ICdTdWJTZW50aW5lbC1BUEknLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1N1YlNlbnRpbmVsIFJFU1QgQVBJIHdpdGggVE9PTi1lbmNvZGVkIHJlc3BvbnNlcyAoNjAlIHNtYWxsZXIgcGF5bG9hZHMpJyxcclxuICAgICAgZGVwbG95T3B0aW9uczoge1xyXG4gICAgICAgIHN0YWdlTmFtZTogJ3Byb2QnLFxyXG4gICAgICAgIHRocm90dGxpbmdSYXRlTGltaXQ6IDEwMCxcclxuICAgICAgICB0aHJvdHRsaW5nQnVyc3RMaW1pdDogMjAwLFxyXG4gICAgICAgIGxvZ2dpbmdMZXZlbDogYXBpZ2F0ZXdheS5NZXRob2RMb2dnaW5nTGV2ZWwuSU5GTyxcclxuICAgICAgICBkYXRhVHJhY2VFbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIGFjY2Vzc0xvZ0Rlc3RpbmF0aW9uOiBuZXcgYXBpZ2F0ZXdheS5Mb2dHcm91cExvZ0Rlc3RpbmF0aW9uKGFwaUxvZ0dyb3VwKSxcclxuICAgICAgICBhY2Nlc3NMb2dGb3JtYXQ6IGFwaWdhdGV3YXkuQWNjZXNzTG9nRm9ybWF0Lmpzb25XaXRoU3RhbmRhcmRGaWVsZHMoKSxcclxuICAgICAgfSxcclxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XHJcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXHJcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXHJcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbXHJcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcclxuICAgICAgICAgICdYLUFtei1EYXRlJyxcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJyxcclxuICAgICAgICAgICdYLUFwaS1LZXknLFxyXG4gICAgICAgICAgJ1gtQW16LVNlY3VyaXR5LVRva2VuJyxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gQ29nbml0byBBdXRob3JpemVyXHJcbiAgICBjb25zdCBhdXRob3JpemVyID0gbmV3IGFwaWdhdGV3YXkuQ29nbml0b1VzZXJQb29sc0F1dGhvcml6ZXIodGhpcywgJ0NvZ25pdG9BdXRob3JpemVyJywge1xyXG4gICAgICBjb2duaXRvVXNlclBvb2xzOiBbdGhpcy51c2VyUG9vbF0sXHJcbiAgICAgIGF1dGhvcml6ZXJOYW1lOiAnU3ViU2VudGluZWwtQ29nbml0bycsXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDilIDilIDilIAgQVBJIFJlc291cmNlcyAmIE1ldGhvZHMg4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSAXHJcblxyXG4gICAgLy8gL3N1YnNjcmlwdGlvbnNcclxuICAgIGNvbnN0IHN1YnNjcmlwdGlvbnMgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnc3Vic2NyaXB0aW9ucycpO1xyXG4gICAgc3Vic2NyaXB0aW9ucy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByb3BzLmFwaUZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL3N1YnNjcmlwdGlvbnMve2lkfVxyXG4gICAgY29uc3Qgc3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9ucy5hZGRSZXNvdXJjZSgne2lkfScpO1xyXG4gICAgc3Vic2NyaXB0aW9uLmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMuYXBpRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvYXVkaXQgKHRyaWdnZXIgbWFudWFsIGF1ZGl0KVxyXG4gICAgY29uc3QgYXVkaXQgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnYXVkaXQnKTtcclxuICAgIGF1ZGl0LmFkZE1ldGhvZCgnUE9TVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByb3BzLmF1ZGl0b3JGdW5jdGlvbiksIHtcclxuICAgICAgYXV0aG9yaXplcixcclxuICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWdhdGV3YXkuQXV0aG9yaXphdGlvblR5cGUuQ09HTklUTyxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIC9jYWxlbmRhci9pbnNpZ2h0c1xyXG4gICAgY29uc3QgY2FsZW5kYXIgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnY2FsZW5kYXInKTtcclxuICAgIGNvbnN0IGluc2lnaHRzID0gY2FsZW5kYXIuYWRkUmVzb3VyY2UoJ2luc2lnaHRzJyk7XHJcbiAgICBpbnNpZ2h0cy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByb3BzLmNhbGVuZGFyRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvbmVnb3RpYXRlXHJcbiAgICBjb25zdCBuZWdvdGlhdGUgPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnbmVnb3RpYXRlJyk7XHJcbiAgICBuZWdvdGlhdGUuYWRkTWV0aG9kKCdQT1NUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMubmVnb3RpYXRvckZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL25lZ290aWF0ZS9oaXN0b3J5XHJcbiAgICBjb25zdCBuZWdvdGlhdGVIaXN0b3J5ID0gbmVnb3RpYXRlLmFkZFJlc291cmNlKCdoaXN0b3J5Jyk7XHJcbiAgICBuZWdvdGlhdGVIaXN0b3J5LmFkZE1ldGhvZCgnR0VUJywgbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24ocHJvcHMuYXBpRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvZGFyay1wYXR0ZXJuc1xyXG4gICAgY29uc3QgZGFya1BhdHRlcm5zID0gdGhpcy5yZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2RhcmstcGF0dGVybnMnKTtcclxuICAgIGRhcmtQYXR0ZXJucy5hZGRNZXRob2QoJ0dFVCcsIG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHByb3BzLmFwaUZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL2RhcmstcGF0dGVybnMvYW5hbHl6ZVxyXG4gICAgY29uc3QgYW5hbHl6ZSA9IGRhcmtQYXR0ZXJucy5hZGRSZXNvdXJjZSgnYW5hbHl6ZScpO1xyXG4gICAgYW5hbHl6ZS5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcm9wcy5kZWZlbmRlckZ1bmN0aW9uKSwge1xyXG4gICAgICBhdXRob3JpemVyLFxyXG4gICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ2F0ZXdheS5BdXRob3JpemF0aW9uVHlwZS5DT0dOSVRPLFxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gL2xlYXJuICh0cmlnZ2VyIGxlYXJuaW5nIGZyb20gb3V0Y29tZSlcclxuICAgIGNvbnN0IGxlYXJuID0gdGhpcy5yZXN0QXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2xlYXJuJyk7XHJcbiAgICBsZWFybi5hZGRNZXRob2QoJ1BPU1QnLCBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihwcm9wcy5sZWFybmVyRnVuY3Rpb24pLCB7XHJcbiAgICAgIGF1dGhvcml6ZXIsXHJcbiAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlnYXRld2F5LkF1dGhvcml6YXRpb25UeXBlLkNPR05JVE8sXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyAvaGVhbHRoIChwdWJsaWMgZW5kcG9pbnQpXHJcbiAgICBjb25zdCBoZWFsdGggPSB0aGlzLnJlc3RBcGkucm9vdC5hZGRSZXNvdXJjZSgnaGVhbHRoJyk7XHJcbiAgICBoZWFsdGguYWRkTWV0aG9kKCdHRVQnLCBuZXcgYXBpZ2F0ZXdheS5Nb2NrSW50ZWdyYXRpb24oe1xyXG4gICAgICBpbnRlZ3JhdGlvblJlc3BvbnNlczogW3tcclxuICAgICAgICBzdGF0dXNDb2RlOiAnMjAwJyxcclxuICAgICAgICByZXNwb25zZVRlbXBsYXRlczoge1xyXG4gICAgICAgICAgJ2FwcGxpY2F0aW9uL2pzb24nOiAne1wic3RhdHVzXCI6IFwiaGVhbHRoeVwiLCBcInNlcnZpY2VcIjogXCJTdWJTZW50aW5lbFwiLCBcInRvb25fZW5hYmxlZFwiOiB0cnVlfScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfV0sXHJcbiAgICAgIHJlcXVlc3RUZW1wbGF0ZXM6IHtcclxuICAgICAgICAnYXBwbGljYXRpb24vanNvbic6ICd7XCJzdGF0dXNDb2RlXCI6IDIwMH0nLFxyXG4gICAgICB9LFxyXG4gICAgfSksIHtcclxuICAgICAgbWV0aG9kUmVzcG9uc2VzOiBbeyBzdGF0dXNDb2RlOiAnMjAwJyB9XSxcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOKUgOKUgOKUgCBPdXRwdXRzIOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgFxyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdIdHRwQXBpRW5kcG9pbnQnLCB7XHJcbiAgICAgIHZhbHVlOiB0aGlzLmh0dHBBcGkudXJsISxcclxuICAgICAgZGVzY3JpcHRpb246ICdIVFRQIEFQSSBlbmRwb2ludCBVUkwgKHVzZSB0aGlzIGZvciBzdGFuZGFyZCByZXF1ZXN0cyknLFxyXG4gICAgICBleHBvcnROYW1lOiAnU3ViU2VudGluZWwtSHR0cEFwaUVuZHBvaW50JyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlFbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMud2ViU29ja2V0QXBpLmFwaUVuZHBvaW50LFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ1dlYlNvY2tldCBBUEkgZW5kcG9pbnQgVVJMICh1c2UgdGhpcyBmb3IgcmVhbC10aW1lIHVwZGF0ZXMpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLVdlYlNvY2tldEFwaUVuZHBvaW50JyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlFbmRwb2ludCcsIHtcclxuICAgICAgdmFsdWU6IHRoaXMucmVzdEFwaS51cmwsXHJcbiAgICAgIGRlc2NyaXB0aW9uOiAnUkVTVCBBUEkgZW5kcG9pbnQgVVJMIChsZWdhY3kpJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLUFwaUVuZHBvaW50JyxcclxuICAgIH0pO1xyXG5cclxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdVc2VyUG9vbElkJywge1xyXG4gICAgICB2YWx1ZTogdGhpcy51c2VyUG9vbC51c2VyUG9vbElkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIElEJyxcclxuICAgICAgZXhwb3J0TmFtZTogJ1N1YlNlbnRpbmVsLVVzZXJQb29sSWQnLFxyXG4gICAgfSk7XHJcblxyXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VzZXJQb29sQ2xpZW50SWQnLCB7XHJcbiAgICAgIHZhbHVlOiB1c2VyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxyXG4gICAgICBkZXNjcmlwdGlvbjogJ0NvZ25pdG8gVXNlciBQb29sIENsaWVudCBJRCcsXHJcbiAgICAgIGV4cG9ydE5hbWU6ICdTdWJTZW50aW5lbC1Vc2VyUG9vbENsaWVudElkJyxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=