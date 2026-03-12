import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  auditorFunction: lambda.Function;
  calendarFunction: lambda.Function;
  negotiatorFunction: lambda.Function;
  defenderFunction: lambda.Function;
  learnerFunction: lambda.Function;
  apiFunction: lambda.Function;
}

export class ApiStack extends cdk.Stack {
  public readonly restApi: apigateway.RestApi;
  public readonly httpApi: apigatewayv2.HttpApi;
  public readonly webSocketApi: apigatewayv2.WebSocketApi;
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
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
      value: this.httpApi.url!,
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
