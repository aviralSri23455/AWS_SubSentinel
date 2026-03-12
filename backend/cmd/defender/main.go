// Package main implements the Dark Pattern Defender Lambda handler
// Pipeline: S3 → Rekognition → Bedrock Vision → Negotiation → DynamoDB
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
	"github.com/subsentinel/subsentinel/internal/agents/defender"
	"github.com/subsentinel/subsentinel/internal/agents/negotiator"
	"github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/storage"
	"github.com/subsentinel/subsentinel/internal/toon"
	"github.com/subsentinel/subsentinel/pkg/darkpattern"
)

var (
	cfg              *config.Config
	clients          *aws.Clients
	logger           *middleware.Logger
	ai               aibridge.AIClient
	defenderAgent    *defender.Agent
	negotiatorAgent  *negotiator.Agent
	taxonomy         *darkpattern.Taxonomy
)

func init() {
	cfg = config.MustLoad()

	ctx := context.Background()
	var err error
	clients, err = aws.NewClients(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to initialize AWS clients: %v", err)
	}

	ai, err = aibridge.NewAIClient(cfg, clients.Bedrock)
	if err != nil {
		log.Fatalf("Failed to initialize AI client: %v", err)
	}

	logger = middleware.NewLogger("defender")
	
	// Initialize storage - use DynamoDB directly for real-time data
	store := storage.NewDynamoStore(clients, cfg.SubscriptionsTable, cfg.DarkPatternsTable)
	
	defenderAgent = defender.New(clients, cfg, logger, ai, store)
	negotiatorAgent = negotiator.New(clients, cfg, logger, ai)

	// Load dark pattern taxonomy
	taxonomy, err = darkpattern.LoadTaxonomy("configs/taxonomy.toon")
	if err != nil {
		log.Fatalf("Failed to load taxonomy: %v", err)
	}

	logger.Info("Defender agent initialized", "provider", ai.ProviderName())
}

func main() {
	lambda.Start(handler)
}

// AnalyzeRequest represents the screenshot analysis request
type AnalyzeRequest struct {
	UserID      string `json:"userId"`
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	FileData    string `json:"fileData"` // base64 encoded
}

// AnalyzeResponse represents the complete analysis response
type AnalyzeResponse struct {
	ReportID          string                  `json:"reportId"`
	Patterns          []models.DetectedPattern `json:"patterns"`
	BypassGuide       *defender.BypassGuideResult `json:"bypassGuide"`
	NegotiationDraft  *NegotiationDraft       `json:"negotiationDraft,omitempty"`
	Message           string                  `json:"message"`
	AIProvider        string                  `json:"aiProvider"`
}

// NegotiationDraft represents the AI-generated negotiation email
type NegotiationDraft struct {
	EmailDraft  string   `json:"emailDraft"`
	Leverage    []string `json:"leverage"`
	SuccessRate int      `json:"successRate"`
}

func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger.Info("Defender analysis request received")

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
	var analyzeReq AnalyzeRequest
	if err := json.Unmarshal([]byte(request.Body), &analyzeReq); err != nil {
		logger.Error("Failed to parse request", err)
		return errorResponse(400, "Invalid request body")
	}

	// Validate required fields
	if analyzeReq.UserID == "" || analyzeReq.FileData == "" {
		return errorResponse(400, "Missing required fields: userId, fileData")
	}

	// Decode base64 file data
	fileBytes, err := base64.StdEncoding.DecodeString(analyzeReq.FileData)
	if err != nil {
		logger.Error("Failed to decode file data", err)
		return errorResponse(400, "Invalid base64 file data")
	}

	// Generate unique key for S3
	screenshotID := uuid.New().String()
	s3Key := fmt.Sprintf("screenshots/%s/%s", analyzeReq.UserID, screenshotID)

	// Step 1: Upload to S3
	logger.Info(fmt.Sprintf("Uploading screenshot to S3: %s", s3Key))
	if err := clients.UploadScreenshot(ctx, cfg.ScreenshotsBucket, s3Key, strings.NewReader(string(fileBytes)), analyzeReq.ContentType); err != nil {
		logger.Error("Failed to upload to S3", err)
		return errorResponse(500, "Failed to upload screenshot")
	}

	// Step 2: Detect text with Rekognition
	logger.Info("Detecting text with Rekognition")
	rekResult, err := defenderAgent.DetectTextInImage(ctx, fileBytes)
	if err != nil {
		logger.Error("Failed to detect text", err)
		return errorResponse(500, "Failed to detect text in screenshot")
	}

	// Step 3: Encode to TOON format (62% token reduction)
	logger.Info("Encoding to TOON format")
	toonResult, err := toon.EncodeRekognitionResult(rekResult)
	if err != nil {
		logger.Error("Failed to encode to TOON", err)
		return errorResponse(500, "Failed to encode recognition result")
	}

	// Step 4: Analyze with Bedrock Vision
	logger.Info(fmt.Sprintf("Analyzing with %s Vision", ai.ProviderName()))
	patterns, err := defenderAgent.AnalyzeWithBedrockVision(ctx, fileBytes, toonResult, taxonomy)
	if err != nil {
		logger.Error("Failed to analyze with vision", err)
		return errorResponse(500, "Failed to analyze dark patterns")
	}

	// Step 5: Generate bypass guide
	logger.Info("Generating bypass guide")
	bypassGuide, err := defenderAgent.GenerateBypassGuide(ctx, patterns)
	if err != nil {
		logger.Error("Failed to generate bypass guide", err)
		// Non-fatal, continue
		bypassGuide = &defender.BypassGuideResult{Steps: []models.BypassStep{}}
	}

	// Step 6: Generate negotiation draft if high-severity patterns detected
	var negotiationDraft *NegotiationDraft
	if hasHighSeverityPatterns(patterns) {
		logger.Info("High-severity patterns detected, generating negotiation draft")
		draft, err := generateNegotiationDraft(ctx, patterns)
		if err != nil {
			logger.Error("Failed to generate negotiation draft", err)
			// Non-fatal, continue
		} else {
			negotiationDraft = draft
		}
	}

	// Step 7: Store report in DynamoDB
	report := &models.DarkPatternReport{
		ReportID:          uuid.New().String(),
		UserID:            analyzeReq.UserID,
		AnalyzedAt:        time.Now(),
		ScreenshotCount:   1,
		PatternsFound:     patterns,
		OverallConfidence: calculateOverallConfidence(patterns),
		HostilityScore:    calculateHostilityScore(patterns),
		BypassGuide:       bypassGuide.Steps,
	}

	logger.Info(fmt.Sprintf("Storing report in DynamoDB: %s", report.ReportID))
	if err := defenderAgent.StoreReport(ctx, report); err != nil {
		logger.Error("Failed to store report", err)
		return errorResponse(500, "Failed to store analysis report")
	}

	// Return success response
	response := AnalyzeResponse{
		ReportID:         report.ReportID,
		Patterns:         patterns,
		BypassGuide:      bypassGuide,
		NegotiationDraft: negotiationDraft,
		Message:          "Screenshot analyzed successfully",
		AIProvider:       ai.ProviderName(),
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

// hasHighSeverityPatterns checks if any patterns have high severity
func hasHighSeverityPatterns(patterns []models.DetectedPattern) bool {
	for _, p := range patterns {
		if p.Severity >= 1.5 || p.Confidence >= 0.85 {
			return true
		}
	}
	return false
}

// generateNegotiationDraft creates a negotiation email based on detected patterns
func generateNegotiationDraft(ctx context.Context, patterns []models.DetectedPattern) (*NegotiationDraft, error) {
	// Build leverage points from patterns
	leverage := []string{}
	for _, p := range patterns {
		if p.Confidence >= 0.80 {
			leverage = append(leverage, fmt.Sprintf("%s detected (%.0f%% confidence)", 
				strings.ReplaceAll(p.PatternType, "_", " "), p.Confidence*100))
		}
	}

	// Generate email using negotiator agent
	patternsJSON, _ := json.Marshal(patterns)
	prompt := fmt.Sprintf(`You are a consumer advocate AI helping users negotiate with companies that use dark patterns.

Detected dark patterns in their cancellation flow:
%s

Generate a professional but firm email to the company's customer service requesting:
1. Immediate cancellation without obstacles
2. Acknowledgment of the dark patterns used
3. A partial refund as compensation for the manipulative UX

Keep it concise (200 words max), professional, and reference specific patterns detected.
Respond with ONLY the email text, no JSON.`, string(patternsJSON))

	emailText, err := ai.GenerateText(ctx, prompt, 512, 0.4, 0.9)
	if err != nil {
		return nil, fmt.Errorf("failed to generate email: %w", err)
	}

	// Calculate success rate based on pattern severity
	successRate := calculateSuccessRate(patterns)

	return &NegotiationDraft{
		EmailDraft:  emailText,
		Leverage:    leverage,
		SuccessRate: successRate,
	}, nil
}

// calculateSuccessRate estimates negotiation success based on pattern severity
func calculateSuccessRate(patterns []models.DetectedPattern) int {
	if len(patterns) == 0 {
		return 50
	}

	totalSeverity := 0.0
	for _, p := range patterns {
		totalSeverity += p.Severity * p.Confidence
	}

	avgSeverity := totalSeverity / float64(len(patterns))
	
	// Higher severity = higher success rate (more leverage)
	// Scale from 60% to 95%
	rate := 60 + int(avgSeverity*35)
	if rate > 95 {
		rate = 95
	}
	return rate
}

// calculateOverallConfidence computes average confidence across all patterns
func calculateOverallConfidence(patterns []models.DetectedPattern) float64 {
	if len(patterns) == 0 {
		return 0.0
	}
	total := 0.0
	for _, p := range patterns {
		total += p.Confidence
	}
	return total / float64(len(patterns))
}

// calculateHostilityScore computes a weighted score based on severity and confidence
func calculateHostilityScore(patterns []models.DetectedPattern) float64 {
	if len(patterns) == 0 {
		return 0.0
	}
	total := 0.0
	for _, p := range patterns {
		total += p.Severity * p.Confidence
	}
	return total / float64(len(patterns))
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
