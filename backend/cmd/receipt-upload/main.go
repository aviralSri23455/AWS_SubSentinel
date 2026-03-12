// Package main implements the receipt upload Lambda handler
// Pipeline: Receipt Upload → S3 → Textract → AI Provider → DynamoDB
package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/google/uuid"
	"github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	ssevents "github.com/subsentinel/subsentinel/internal/events"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
)

var (
	cfg     *config.Config
	clients *aws.Clients
	logger  *middleware.Logger
	ai      aibridge.AIClient
)

func init() {
	cfg = config.MustLoad()

	ctx := context.Background()
	var err error
	clients, err = aws.NewClients(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to initialize AWS clients: %v", err)
	}

	// Initialize AI client (AWS Bedrock)
	ai, err = aibridge.NewAIClient(cfg, clients.Bedrock)
	if err != nil {
		log.Fatalf("Failed to initialize AI client: %v", err)
	}

	logger = middleware.NewLogger("receipt-upload")
	logger.Info("AI provider initialized", "provider", ai.ProviderName())
}

func main() {
	lambda.Start(handler)
}

// UploadRequest represents the receipt upload request
type UploadRequest struct {
	UserID      string `json:"userId"`
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	FileData    string `json:"fileData"` // base64 encoded
}

// UploadResponse represents the receipt upload response
type UploadResponse struct {
	SubscriptionID string              `json:"subscriptionId"`
	Subscription   models.Subscription `json:"subscription"`
	Message        string              `json:"message"`
	AIProvider     string              `json:"aiProvider"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger.Info("Receipt upload request received")

	// Handle CORS preflight
	if request.HTTPMethod == "OPTIONS" {
		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Access-Control-Allow-Origin":  "*",
				"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type,Authorization,X-User-ID",
			},
			Body: "",
		}, nil
	}

	// Parse request body
	var uploadReq UploadRequest
	if err := json.Unmarshal([]byte(request.Body), &uploadReq); err != nil {
		logger.Error("Failed to parse request", err)
		return errorResponse(400, "Invalid request body")
	}

	// Validate required fields
	if uploadReq.UserID == "" || uploadReq.FileData == "" {
		return errorResponse(400, "Missing required fields: userId, fileData")
	}

	// Decode base64 file data
	fileBytes, err := base64.StdEncoding.DecodeString(uploadReq.FileData)
	if err != nil {
		logger.Error("Failed to decode file data", err)
		return errorResponse(400, "Invalid base64 file data")
	}

	// Generate unique key for S3
	receiptID := uuid.New().String()
	s3Key := fmt.Sprintf("receipts/%s/%s", uploadReq.UserID, receiptID)

	// Step 1: Upload to S3
	logger.Info(fmt.Sprintf("Uploading receipt to S3: %s", s3Key))
	ssevents.GlobalBroker.PublishPipelineProgress("upload", "processing", map[string]interface{}{
		"receiptId": receiptID,
		"userId":    uploadReq.UserID,
		"stage":     "s3_upload",
	})
	
	if err := clients.UploadReceipt(ctx, cfg.ReceiptsBucket, s3Key, strings.NewReader(string(fileBytes)), uploadReq.ContentType); err != nil {
		logger.Error("Failed to upload to S3", err)
		ssevents.GlobalBroker.PublishPipelineProgress("upload", "failed", map[string]interface{}{
			"receiptId": receiptID,
			"error":     err.Error(),
		})
		return errorResponse(500, "Failed to upload receipt")
	}

	// Step 2: Extract text with Textract
	logger.Info("Extracting text with Textract")
	ssevents.GlobalBroker.PublishPipelineProgress("textract", "processing", map[string]interface{}{
		"receiptId": receiptID,
		"stage":     "text_extraction",
	})
	
	extractedText, err := clients.ExtractReceiptText(ctx, cfg.ReceiptsBucket, s3Key)
	if err != nil {
		logger.Error("Failed to extract text", err)
		ssevents.GlobalBroker.PublishPipelineProgress("textract", "failed", map[string]interface{}{
			"receiptId": receiptID,
			"error":     err.Error(),
		})
		return errorResponse(500, "Failed to extract text from receipt")
	}

	if extractedText == "" {
		ssevents.GlobalBroker.PublishPipelineProgress("textract", "failed", map[string]interface{}{
			"receiptId": receiptID,
			"error":     "No text found",
		})
		return errorResponse(400, "No text found in receipt")
	}

	// Step 3: Analyze with AWS Bedrock
	logger.Info(fmt.Sprintf("Analyzing receipt with %s", ai.ProviderName()))
	ssevents.GlobalBroker.PublishPipelineProgress("ai_analysis", "processing", map[string]interface{}{
		"receiptId": receiptID,
		"provider":  ai.ProviderName(),
		"stage":     "ai_analysis",
	})
	
	subscription, err := clients.AnalyzeReceipt(
		ctx,
		extractedText,
		ai,
		cfg.BedrockMaxTokens,
		cfg.BedrockTemp,
		cfg.BedrockTopP,
	)
	if err != nil {
		logger.Error("Failed to analyze receipt", err)
		ssevents.GlobalBroker.PublishPipelineProgress("ai_analysis", "failed", map[string]interface{}{
			"receiptId": receiptID,
			"error":     err.Error(),
		})
		return errorResponse(500, "Failed to analyze receipt")
	}

	// Enrich subscription data
	subscription.SubscriptionID = uuid.New().String()
	subscription.UserID = uploadReq.UserID
	subscription.DetectedAt = time.Now()
	subscription.LastCharge = time.Now()

	// Step 4: Store in DynamoDB
	logger.Info(fmt.Sprintf("Storing subscription in DynamoDB: %s", subscription.SubscriptionID))
	ssevents.GlobalBroker.PublishPipelineProgress("storage", "processing", map[string]interface{}{
		"receiptId":      receiptID,
		"subscriptionId": subscription.SubscriptionID,
		"stage":          "dynamodb_storage",
	})
	
	if err := clients.PutSubscription(ctx, subscription); err != nil {
		logger.Error("Failed to store subscription", err)
		ssevents.GlobalBroker.PublishPipelineProgress("storage", "failed", map[string]interface{}{
			"receiptId": receiptID,
			"error":     err.Error(),
		})
		return errorResponse(500, "Failed to store subscription")
	}

	// Publish subscription added event for real-time updates
	ssevents.GlobalBroker.Publish(ssevents.EventSubscriptionAdded, map[string]interface{}{
		"subscriptionId": subscription.SubscriptionID,
		"userId":         subscription.UserID,
		"provider":       subscription.Provider,
		"amount":         subscription.Amount,
		"currency":       subscription.Currency,
		"frequency":      subscription.Frequency,
		"status":         subscription.Status,
		"renewalDate":    subscription.RenewalDate,
		"category":       subscription.Category,
		"detectedVia":    "receipt_upload",
	})
	
	ssevents.GlobalBroker.PublishPipelineProgress("complete", "success", map[string]interface{}{
		"receiptId":      receiptID,
		"subscriptionId": subscription.SubscriptionID,
		"provider":       subscription.Provider,
	})

	// Return success response
	response := UploadResponse{
		SubscriptionID: subscription.SubscriptionID,
		Subscription:   *subscription,
		Message:        "Receipt processed successfully",
		AIProvider:     ai.ProviderName(),
	}

	responseBody, _ := json.Marshal(response)
	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(responseBody),
	}, nil
}

func errorResponse(statusCode int, message string) (events.APIGatewayProxyResponse, error) {
	body, _ := json.Marshal(map[string]string{"error": message})
	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                "application/json",
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}
