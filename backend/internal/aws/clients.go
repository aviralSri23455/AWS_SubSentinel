// Package aws provides thin wrappers around AWS SDK v2 clients
// used by SubSentinel agents. All clients are initialized once per
// Lambda cold start and reused across invocations.
package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	"github.com/aws/aws-sdk-go-v2/service/comprehend"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/kms"
	"github.com/aws/aws-sdk-go-v2/service/rekognition"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/ses"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/textract"
	"github.com/subsentinel/subsentinel/internal/config"
)

// Clients holds initialized AWS SDK v2 service clients.
// These are safe for concurrent use and should be reused across Lambda invocations.
type Clients struct {
	S3          *s3.Client
	DynamoDB    *dynamodb.Client
	Textract    *textract.Client
	Rekognition *rekognition.Client
	Bedrock     *bedrockruntime.Client
	Comprehend  *comprehend.Client
	KMS         *kms.Client
	SES         *ses.Client
	SNS         *sns.Client
	OpenSearch  *OpenSearchClient
	AWSConfig   aws.Config
	AppConfig   *config.Config
}

// NewClients initializes all AWS SDK v2 clients from the Lambda execution environment.
func NewClients(ctx context.Context, cfg *config.Config) (*Clients, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(ctx,
		awsconfig.WithRegion(cfg.AWSRegion),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	// Bedrock may be in a different region
	bedrockCfg := awsCfg.Copy()
	if cfg.BedrockRegion != "" && cfg.BedrockRegion != cfg.AWSRegion {
		bedrockCfg.Region = cfg.BedrockRegion
	}

	return &Clients{
		S3:          s3.NewFromConfig(awsCfg),
		DynamoDB:    dynamodb.NewFromConfig(awsCfg),
		Textract:    textract.NewFromConfig(awsCfg),
		Rekognition: rekognition.NewFromConfig(awsCfg),
		Bedrock:     bedrockruntime.NewFromConfig(bedrockCfg),
		Comprehend:  comprehend.NewFromConfig(awsCfg),
		KMS:         kms.NewFromConfig(awsCfg),
		SES:         ses.NewFromConfig(awsCfg),
		SNS:         sns.NewFromConfig(awsCfg),
		OpenSearch:  NewOpenSearchClient(awsCfg, cfg),
		AWSConfig:   awsCfg,
		AppConfig:   cfg,
	}, nil
}
