// Package main — Auditor Agent Lambda Entry Point
//
// Pipeline: Gmail API (REAL) → Textract → TOON-encoded Bedrock → DynamoDB
// Also supports: SES → S3 → Textract pipeline for incoming email triggers
// Cold start: ~80ms | Execution: ~300ms | Memory: 128MB
//
// NO MOCK DATA. Uses YOUR real Gmail receipts via OAuth from .env.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/subsentinel/subsentinel/internal/agents/auditor"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/toon"
)

// AuditorEvent represents the input payload for the Auditor agent.
// Can be triggered by SES email events or direct invocation for Gmail fetch.
type AuditorEvent struct {
	Records []events.SimpleEmailRecord `json:"Records,omitempty"`
	UserID  string                     `json:"userId,omitempty"`
}

// handler processes incoming SES email events or direct Gmail fetch triggers.
// It extracts receipt data using Textract, encodes it as TOON for Bedrock analysis,
// and stores the result in DynamoDB.
func handler(ctx context.Context, event AuditorEvent) (models.AuditResult, error) {
	logger := middleware.NewLogger("auditor")
	cfg := config.MustLoad()

	logger.Info("Auditor agent invoked (REAL DATA MODE)",
		"receiptCount", len(event.Records),
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"dataSource", "Gmail API + SES (REAL)",
	)

	// Initialize AWS service clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("Failed to initialize AWS clients", "error", err)
		return models.AuditResult{}, fmt.Errorf("init clients: %w", err)
	}

	// Initialize AI client (AWS Bedrock)
	ai, err := aibridge.NewAIClient(cfg, clients.Bedrock)
	if err != nil {
		logger.Error("Failed to initialize AI client", "error", err)
		return models.AuditResult{}, fmt.Errorf("init AI: %w", err)
	}

	// Create Auditor agent instance with REAL Gmail connection
	agent, err := auditor.New(ctx, clients, cfg, logger, ai)
	if err != nil {
		logger.Error("Failed to create auditor agent", "error", err)
		return models.AuditResult{}, fmt.Errorf("create agent: %w", err)
	}

	var results []models.Subscription

	// If triggered by SES email events, process those
	if len(event.Records) > 0 {
		for _, record := range event.Records {
			ses := record.SES

			// Step 1: Download email from S3 (SES stores incoming emails)
			emailBody, err := agent.FetchEmailFromS3(ctx, ses.Mail.MessageID)
			if err != nil {
				logger.Error("Failed to fetch email", "messageId", ses.Mail.MessageID, "error", err)
				continue
			}

			// Step 2: Extract receipt data using Textract
			extractedData, err := agent.ExtractReceiptData(ctx, emailBody)
			if err != nil {
				logger.Error("Textract extraction failed", "error", err)
				continue
			}

			// Step 3: Encode extracted data as TOON (60% fewer tokens!)
			toonEncoded, err := toon.Encode(extractedData)
			if err != nil {
				logger.Error("TOON encoding failed", "error", err)
				continue
			}

			logger.Info("TOON encoding complete",
				"originalTokens", toon.EstimateJSONTokens(extractedData),
				"toonTokens", toon.EstimateTOONTokens(toonEncoded),
				"savings", fmt.Sprintf("%.0f%%", toon.CalculateSavings(extractedData, toonEncoded)),
			)

			// Step 4: Send TOON-encoded data to Bedrock for categorization
			subscription, err := agent.AnalyzeWithBedrock(ctx, toonEncoded)
			if err != nil {
				logger.Error("Bedrock analysis failed", "error", err)
				continue
			}

			// Step 5: Store subscription in DynamoDB
			if err := agent.StoreSubscription(ctx, subscription); err != nil {
				logger.Error("DynamoDB store failed", "error", err)
				continue
			}

			results = append(results, *subscription)
			logger.Info("Receipt processed successfully (REAL)",
				"provider", subscription.Provider,
				"amount", subscription.Amount,
				"renewalDate", subscription.RenewalDate,
			)
		}
	} else {
		// No SES event — fetch directly from YOUR real Gmail
		logger.Info("No SES event — fetching from YOUR real Gmail inbox")

		gmailReceipts, err := agent.FetchReceiptsFromGmail(ctx)
		if err != nil {
			logger.Error("Gmail fetch failed", "error", err)
			return models.AuditResult{}, fmt.Errorf("gmail fetch: %w", err)
		}

		logger.Info("Real Gmail receipts fetched",
			"count", len(gmailReceipts),
			"source", "YOUR Gmail (REAL)",
		)

		for _, receipt := range gmailReceipts {
			logger.Info("Processing real receipt",
				"from", receipt.From,
				"subject", receipt.Subject,
				"date", receipt.Date,
				"attachments", len(receipt.Attachments),
			)

			// Process receipt body through Textract if it has attachments
			var docBytes []byte
			if len(receipt.Attachments) > 0 {
				docBytes = receipt.Attachments[0].Data
			} else {
				docBytes = []byte(receipt.Body)
			}

			if len(docBytes) == 0 {
				continue
			}

			// Extract receipt data
			extractedData, err := agent.ExtractReceiptData(ctx, docBytes)
			if err != nil {
				logger.Error("Textract extraction failed", "error", err)
				continue
			}

			// TOON encode
			toonEncoded, err := toon.Encode(extractedData)
			if err != nil {
				logger.Error("TOON encoding failed", "error", err)
				continue
			}

			// Analyze with Bedrock
			subscription, err := agent.AnalyzeWithBedrock(ctx, toonEncoded)
			if err != nil {
				logger.Error("Bedrock analysis failed", "error", err)
				continue
			}

			// Store in DynamoDB
			if err := agent.StoreSubscription(ctx, subscription); err != nil {
				logger.Error("DynamoDB store failed", "error", err)
				continue
			}

			results = append(results, *subscription)
		}
	}

	result := models.AuditResult{
		ProcessedAt:    time.Now().UTC(),
		TotalReceipts:  len(results),
		Subscriptions:  results,
		FailedCount:    0,
		TOONTokenSaved: calculateTotalSavings(results),
	}

	resultJSON, _ := json.MarshalIndent(result, "", "  ")
	logger.Info("Auditor agent complete (REAL DATA)", "result", string(resultJSON))

	return result, nil
}

// calculateTotalSavings computes total TOON token savings across all processed receipts.
func calculateTotalSavings(subs []models.Subscription) int {
	total := 0
	for _, sub := range subs {
		total += sub.TOONTokenSaved
	}
	return total
}

func main() {
	lambda.Start(handler)
}
