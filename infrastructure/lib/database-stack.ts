import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export class DatabaseStack extends cdk.Stack {
  public readonly subscriptionsTable: dynamodb.Table;
  public readonly negotiationsTable: dynamodb.Table;
  public readonly darkPatternsTable: dynamodb.Table;
  public readonly receiptsBucket: s3.Bucket;
  public readonly screenshotsBucket: s3.Bucket;
  public readonly kmsKey: kms.Key;
  public readonly openSearchEndpoint: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── KMS Key for Encryption ───────────────────────────────────────────
    this.kmsKey = new kms.Key(this, 'SubSentinelKMSKey', {
      description: 'SubSentinel KMS key for encrypting PII data (TOON-optimized)',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.kmsKey.addAlias('alias/subsentinel-encryption');

    // ─── DynamoDB Tables (matching PowerShell script schema) ──────────────

    // Subscriptions Table - user_id + subscription_id keys
    this.subscriptionsTable = new dynamodb.Table(this, 'SubscriptionsTable', {
      tableName: 'subsentinel-subscriptions',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'subscription_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by provider
    this.subscriptionsTable.addGlobalSecondaryIndex({
      indexName: 'provider-index',
      partitionKey: { name: 'provider', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'subscription_id', type: dynamodb.AttributeType.STRING },
    });

    // Negotiations Table
    this.negotiationsTable = new dynamodb.Table(this, 'NegotiationsTable', {
      tableName: 'subsentinel-negotiations',
      partitionKey: { name: 'negotiation_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying by user and status
    this.negotiationsTable.addGlobalSecondaryIndex({
      indexName: 'user-status-index',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    // Dark Patterns Table - user_id + pattern_id keys
    this.darkPatternsTable = new dynamodb.Table(this, 'DarkPatternsTable', {
      tableName: 'subsentinel-dark-patterns',
      partitionKey: { name: 'user_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pattern_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: this.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying by provider and detected_at
    this.darkPatternsTable.addGlobalSecondaryIndex({
      indexName: 'provider-detected-index',
      partitionKey: { name: 'provider', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'detected_at', type: dynamodb.AttributeType.NUMBER },
    });

    // ─── S3 Buckets (Encrypted with KMS) ──────────────────────────────────

    // Receipts Bucket
    this.receiptsBucket = new s3.Bucket(this, 'ReceiptsBucket', {
      bucketName: `subsentinel-receipts-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldReceipts',
          enabled: true,
          expiration: cdk.Duration.days(90),
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Screenshots Bucket
    this.screenshotsBucket = new s3.Bucket(this, 'ScreenshotsBucket', {
      bucketName: `subsentinel-screenshots-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldScreenshots',
          enabled: true,
          expiration: cdk.Duration.days(180),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── OpenSearch Serverless (Vector Search) ────────────────────────────

    // Encryption policy
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'subsentinel-encryption',
      type: 'encryption',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: ['collection/subsentinel-vectors'],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    // Network policy
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'subsentinel-network',
      type: 'network',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/subsentinel-vectors'],
            },
            {
              ResourceType: 'dashboard',
              Resource: ['collection/subsentinel-vectors'],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    // Data access policy
    const dataAccessPolicy = new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: 'subsentinel-access',
      type: 'data',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: ['collection/subsentinel-vectors'],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: ['index/subsentinel-vectors/*'],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
            },
          ],
          Principal: [`arn:aws:iam::${this.account}:root`],
        },
      ]),
    });

    // Vector search collection
    const vectorCollection = new opensearchserverless.CfnCollection(this, 'VectorCollection', {
      name: 'subsentinel-vectors',
      type: 'VECTORSEARCH',
      description: 'Vector search collection for subscription embeddings',
    });

    vectorCollection.addDependency(encryptionPolicy);
    vectorCollection.addDependency(networkPolicy);
    vectorCollection.node.addDependency(dataAccessPolicy);

    this.openSearchEndpoint = vectorCollection.attrCollectionEndpoint;

    // ─── Outputs ───────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'OpenSearchEndpoint', {
      value: this.openSearchEndpoint,
      description: 'OpenSearch Serverless Collection Endpoint',
      exportName: 'SubSentinel-OpenSearch-Endpoint',
    });

    new cdk.CfnOutput(this, 'SubscriptionsTableName', {
      value: this.subscriptionsTable.tableName,
      description: 'DynamoDB Subscriptions Table (TOON-optimized)',
      exportName: 'SubSentinel-SubscriptionsTable',
    });

    new cdk.CfnOutput(this, 'NegotiationsTableName', {
      value: this.negotiationsTable.tableName,
      description: 'DynamoDB Negotiations Table',
      exportName: 'SubSentinel-NegotiationsTable',
    });

    new cdk.CfnOutput(this, 'DarkPatternsTableName', {
      value: this.darkPatternsTable.tableName,
      description: 'DynamoDB Dark Patterns Table',
      exportName: 'SubSentinel-DarkPatternsTable',
    });

    new cdk.CfnOutput(this, 'ReceiptsBucketName', {
      value: this.receiptsBucket.bucketName,
      description: 'S3 Receipts Bucket',
      exportName: 'SubSentinel-ReceiptsBucket',
    });

    new cdk.CfnOutput(this, 'ScreenshotsBucketName', {
      value: this.screenshotsBucket.bucketName,
      description: 'S3 Screenshots Bucket',
      exportName: 'SubSentinel-ScreenshotsBucket',
    });

    new cdk.CfnOutput(this, 'KMSKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS Key for encryption',
      exportName: 'SubSentinel-KMSKey',
    });
  }
}
