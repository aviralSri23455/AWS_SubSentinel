# Create DynamoDB tables directly using AWS CLI (no CloudFormation needed)
# Make sure you have AWS CLI configured with: aws configure

# Set your AWS credentials (or use aws configure)
# $env:AWS_ACCESS_KEY_ID="your-access-key"
# $env:AWS_SECRET_ACCESS_KEY="your-secret-key"
# $env:AWS_REGION="us-east-1"

$REGION = "us-east-1"

Write-Host "Creating SubSentinel DynamoDB Tables..." -ForegroundColor Cyan
Write-Host ""

# Table 1: Subscriptions
Write-Host "Creating subsentinel-subscriptions table..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-subscriptions `
  --attribute-definitions `
    AttributeName=user_id,AttributeType=S `
    AttributeName=subscription_id,AttributeType=S `
    AttributeName=provider,AttributeType=S `
  --key-schema `
    AttributeName=user_id,KeyType=HASH `
    AttributeName=subscription_id,KeyType=RANGE `
  --global-secondary-indexes `
    "IndexName=provider-index,KeySchema=[{AttributeName=provider,KeyType=HASH},{AttributeName=subscription_id,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES `
  --region $REGION

# Table 2: Insights
Write-Host "Creating subsentinel-insights table..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-insights `
  --attribute-definitions `
    AttributeName=user_id,AttributeType=S `
    AttributeName=insight_id,AttributeType=S `
    AttributeName=created_at,AttributeType=N `
  --key-schema `
    AttributeName=user_id,KeyType=HASH `
    AttributeName=insight_id,KeyType=RANGE `
  --global-secondary-indexes `
    "IndexName=created-at-index,KeySchema=[{AttributeName=user_id,KeyType=HASH},{AttributeName=created_at,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --region $REGION

# Table 3: Negotiations
Write-Host "Creating subsentinel-negotiations table..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-negotiations `
  --attribute-definitions `
    AttributeName=negotiation_id,AttributeType=S `
    AttributeName=user_id,AttributeType=S `
    AttributeName=status,AttributeType=S `
  --key-schema `
    AttributeName=negotiation_id,KeyType=HASH `
  --global-secondary-indexes `
    "IndexName=user-status-index,KeySchema=[{AttributeName=user_id,KeyType=HASH},{AttributeName=status,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --region $REGION

# Table 4: Dark Patterns
Write-Host "Creating subsentinel-dark-patterns table..."
# First delete if exists (for development)
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb delete-table `
  --table-name subsentinel-dark-patterns `
  --region $REGION 2>$null
Start-Sleep -Seconds 2

& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-dark-patterns `
  --attribute-definitions `
    AttributeName=user_id,AttributeType=S `
    AttributeName=pattern_id,AttributeType=S `
    AttributeName=provider,AttributeType=S `
    AttributeName=detected_at,AttributeType=N `
  --key-schema `
    AttributeName=user_id,KeyType=HASH `
    AttributeName=pattern_id,KeyType=RANGE `
  --global-secondary-indexes `
    "IndexName=provider-detected-index,KeySchema=[{AttributeName=provider,KeyType=HASH},{AttributeName=detected_at,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --region $REGION

# Table 5: Outcomes
Write-Host "Creating subsentinel-outcomes table..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-outcomes `
  --attribute-definitions `
    AttributeName=outcome_id,AttributeType=S `
    AttributeName=negotiation_id,AttributeType=S `
    AttributeName=provider,AttributeType=S `
  --key-schema `
    AttributeName=outcome_id,KeyType=HASH `
  --global-secondary-indexes `
    "IndexName=negotiation-index,KeySchema=[{AttributeName=negotiation_id,KeyType=HASH}],Projection={ProjectionType=ALL}" `
    "IndexName=provider-index,KeySchema=[{AttributeName=provider,KeyType=HASH},{AttributeName=outcome_id,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --region $REGION

# Table 6: Audit Log
Write-Host "Creating subsentinel-audit-log table..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb create-table `
  --table-name subsentinel-audit-log `
  --attribute-definitions `
    AttributeName=audit_id,AttributeType=S `
    AttributeName=user_id,AttributeType=S `
    AttributeName=timestamp,AttributeType=N `
  --key-schema `
    AttributeName=audit_id,KeyType=HASH `
  --global-secondary-indexes `
    "IndexName=user-timestamp-index,KeySchema=[{AttributeName=user_id,KeyType=HASH},{AttributeName=timestamp,KeyType=RANGE}],Projection={ProjectionType=ALL}" `
  --billing-mode PAY_PER_REQUEST `
  --region $REGION

Write-Host ""
Write-Host "All tables created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Creating S3 buckets..."
# Create screenshots bucket
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' s3api create-bucket `
  --bucket subsentinel-screenshots `
  --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION 2>$null
Write-Host "Created subsentinel-screenshots bucket"

# Create receipts bucket  
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' s3api create-bucket `
  --bucket subsentinel-receipts `
  --region $REGION `
  --create-bucket-configuration LocationConstraint=$REGION 2>$null
Write-Host "Created subsentinel-receipts bucket"

Write-Host ""
Write-Host "Listing tables..."
& 'C:\Program Files\Amazon\AWSCLIV2\aws.exe' dynamodb list-tables --region $REGION
