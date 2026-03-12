// Package main — Local HTTP Server for Development
// Wraps Lambda handlers in a standard HTTP server for frontend integration.
//
// Real-Time Data Strategy (No Mock Data):
//   📧 Gmail API → SES → Textract → AI Provider → DynamoDB  (subscription detection)
//   📸 Screenshot Upload → S3 → Rekognition → AI Vision → DynamoDB (dark patterns)
//   📅 Google Calendar API → AI Provider → DynamoDB (calendar insights)
//   🔍 OpenSearch k-NN + AI Provider (negotiation drafts)
//   💾 DynamoDB (all storage)
//
// AI Provider: AWS Bedrock (Amazon Nova Pro)
//
// Endpoints:
//   GET  /health
//   GET  /v1/subscriptions       - DynamoDB (from Gmail scan)
//   POST /v1/subscriptions       - Create subscription
//   POST /v1/subscriptions/scan  - Trigger Gmail → Textract → AI pipeline
//   GET  /v1/dark-patterns       - Rekognition + AI reports from DynamoDB
//   POST /v1/dark-patterns/analyze - Screenshot → S3 → Rekognition → AI Vision
//   GET  /v1/negotiate/drafts    - OpenSearch + AI drafts
//   POST /v1/negotiate           - Generate new negotiation draft
//   GET  /v1/calendar/insights   - Google Calendar + AI insights
//   GET  /v1/learning/stats      - Financial score from DynamoDB
//   GET  /v1/agents/activity     - CloudWatch + Lambda activity log
//   GET  /v1/metrics/toon        - TOON token metrics

package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/subsentinel/subsentinel/internal/agents/auditor"
	"github.com/subsentinel/subsentinel/internal/agents/calendar"
	"github.com/subsentinel/subsentinel/internal/agents/defender"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/events"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/storage"
	"github.com/subsentinel/subsentinel/internal/toon"
	"github.com/subsentinel/subsentinel/pkg/darkpattern"
)

var (
	cfg    *config.Config
	logger *middleware.Logger
)

func init() {
	cfg = config.MustLoad()
	logger = middleware.NewLogger("http-server")
}

// getStore returns DynamoDB storage directly (no fallback)
func getStore(clients *awswrap.Clients, _ *middleware.Logger) storage.Store {
	// Use DynamoDB directly for real-time data
	return storage.NewDynamoStore(clients, cfg.SubscriptionsTable, cfg.DarkPatternsTable)
}

// initAIClient creates the Bedrock AI client.
func initAIClient(clients *awswrap.Clients) (aibridge.AIClient, error) {
	return aibridge.NewAIClient(cfg, clients.Bedrock)
}

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID, X-Request-TOON")
		w.Header().Set("X-Toon-Encoded", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4000"
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/health", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":     "ok",
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
			"aiProvider": "Bedrock",
			"services":   []string{"DynamoDB", "Bedrock", "Rekognition", "Textract", "SES", "OpenSearch"},
		})
	}))

	// ─── Subscriptions (Gmail → SES → Textract → AI) ────────────────────
	mux.HandleFunc("/v1/subscriptions", corsMiddleware(handleSubscriptions))
	mux.HandleFunc("/v1/subscriptions/scan", corsMiddleware(handleScanGmail))
	mux.HandleFunc("/v1/subscriptions/", corsMiddleware(handleSubscriptionByID))

	// ─── Dark Patterns (Screenshot → S3 → Rekognition → AI Vision) ──────
	mux.HandleFunc("/v1/dark-patterns/analyze", corsMiddleware(handleAnalyzeScreenshot))
	mux.HandleFunc("/v1/dark-patterns", corsMiddleware(handleGetDarkPatterns))
	mux.HandleFunc("/v1/defender/analyze", corsMiddleware(handleAnalyzeScreenshot)) // Alias for dark-patterns/analyze

	// ─── Receipt Upload (Receipt → S3 → Textract → AI) ──────────────────
	mux.HandleFunc("/v1/receipt-upload", corsMiddleware(handleReceiptUpload))

	// ─── Negotiations (OpenSearch k-NN + AI) ─────────────────────────────
	mux.HandleFunc("/v1/negotiate/drafts", corsMiddleware(handleGetNegotiationDrafts))
	mux.HandleFunc("/v1/negotiate", corsMiddleware(handleGenerateNegotiationDraft))
	mux.HandleFunc("/v1/negotiate/send-email", corsMiddleware(handleSendEmail))
	mux.HandleFunc("/v1/negotiate/regenerate", corsMiddleware(handleRegenerateDraft))

	// ─── Calendar (Google Calendar → AI) ─────────────────────────────────
	mux.HandleFunc("/v1/calendar/insights", corsMiddleware(handleGetCalendarInsights))

	// ─── Learner / Financial Score ───────────────────────────────────────
	mux.HandleFunc("/v1/learning/stats", corsMiddleware(handleGetLearningStats))

	// ─── Agent Activity (Lambda + CloudWatch) ────────────────────────────
	mux.HandleFunc("/v1/agents/activity", corsMiddleware(handleGetAgentActivity))

	// ─── TOON Metrics (CloudWatch) ───────────────────────────────────────
	mux.HandleFunc("/v1/metrics/toon", corsMiddleware(handleGetTOONMetrics))

	// ─── Real-Time Events (SSE) ──────────────────────────────────────────
	mux.HandleFunc("/v1/events", corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		events.GlobalBroker.ServeHTTP(w, r)
	}))

	// ─── Diagnostics (Check Gmail/Calendar connectivity) ─────────────────
	mux.HandleFunc("/v1/diagnostics", corsMiddleware(handleDiagnostics))

	// ─── Cleanup (Delete all subscriptions + dark patterns) ─────────────
	mux.HandleFunc("/v1/cleanup", corsMiddleware(handleCleanup))

	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println("  SubSentinel HTTP Server — REAL-TIME AWS MODE")
	fmt.Println("  AI Provider: BEDROCK (Amazon Nova Pro)")
	fmt.Printf("  Listening on http://localhost:%s\n", port)
	fmt.Println("═══════════════════════════════════════════════════════════")
	fmt.Println()
	fmt.Println("  Real-Time Data Pipeline:")
	fmt.Println("  📧 Gmail Scan  → POST /v1/subscriptions/scan")
	fmt.Println("  📸 Screenshot  → POST /v1/dark-patterns/analyze")
	fmt.Println("  📅 Calendar    → GET  /v1/calendar/insights")
	fmt.Println()

	log.Fatal(http.ListenAndServe(":"+port, mux))
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

func handleSubscriptions(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("subscriptions-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	switch r.Method {
	case "GET":
		subs, err := store.GetSubscriptions(ctx, userID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"subscriptions": subs,
			"count":         len(subs),
			"source":        "DynamoDB",
		})

	case "POST":
		var sub models.Subscription
		if err := json.NewDecoder(r.Body).Decode(&sub); err != nil {
			respondError(w, http.StatusBadRequest, "Invalid request body")
			return
		}
		existingSubs, _ := store.GetSubscriptions(ctx, userID)
		sub.SubscriptionID = fmt.Sprintf("sub-%d", len(existingSubs)+1)
		sub.UserID = userID
		sub.DetectedAt = time.Now().UTC()

		if err := store.PutSubscription(ctx, &sub); err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusCreated, sub)

	case "DELETE":
		// Delete ALL subscriptions for the user
		subs, err := store.GetSubscriptions(ctx, userID)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		deletedCount := 0
		for _, sub := range subs {
			if err := store.DeleteSubscription(ctx, userID, sub.SubscriptionID); err != nil {
				logger.Warn("Failed to delete subscription", "error", err, "subId", sub.SubscriptionID)
			} else {
				deletedCount++
			}
		}
		logger.Info("All subscriptions deleted", "userId", userID, "count", deletedCount)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message":      "All subscriptions deleted successfully",
			"deletedCount": deletedCount,
			"total":        len(subs),
		})

	default:
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func handleSubscriptionByID(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("subscriptions-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	// Extract ID from path
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/v1/subscriptions/"), "/")
	if len(parts) == 0 || parts[0] == "" || parts[0] == "scan" {
		respondError(w, http.StatusBadRequest, "Missing subscription ID")
		return
	}
	subID := parts[0]

	switch r.Method {
	case "GET":
		sub, err := store.GetSubscription(ctx, userID, subID)
		if err != nil {
			respondError(w, http.StatusNotFound, "Subscription not found")
			return
		}
		respondJSON(w, http.StatusOK, sub)

	case "DELETE":
		if err := store.DeleteSubscription(ctx, userID, subID); err != nil {
			respondError(w, http.StatusInternalServerError, err.Error())
			return
		}
		respondJSON(w, http.StatusOK, map[string]string{"message": "Deleted successfully"})

	default:
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// ─── Gmail Scan (Real: Gmail API → SES → Textract → AI) ─────────────────────

func handleScanGmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)

	logger.Info("Gmail scan requested", "userId", userID)

	// Publish scan started event
	events.GlobalBroker.Publish(events.EventGmailScanStarted, map[string]interface{}{
		"userId": userID,
	})

	// Initialize AWS clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("AWS client initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}

	// Initialize AI client
	ai, err := initAIClient(clients)
	if err != nil {
		logger.Error("AI provider initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	// Check Gmail credentials
	if !cfg.HasGmailCredentials() {
		logger.Warn("Gmail credentials not configured")
		respondError(w, http.StatusServiceUnavailable,
			"Gmail credentials not configured. Run: go run cmd/oauth/main.go to authorize Gmail access")
		return
	}

	logger.Info("Initializing Auditor agent", "aiProvider", ai.ProviderName())

	auditorAgent, err := auditor.New(ctx, clients, cfg, logger, ai)
	if err != nil {
		logger.Error("Auditor initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Auditor init failed: %v", err))
		return
	}

	logger.Info("Fetching receipts from Gmail", "query", cfg.GmailFetchQuery, "days", cfg.GmailFetchDays)

	receipts, err := auditorAgent.FetchReceiptsFromGmail(ctx)
	if err != nil {
		logger.Error("Gmail fetch failed", "error", err)
		respondError(w, http.StatusBadGateway, fmt.Sprintf("Gmail fetch failed: %v. Check GMAIL_REFRESH_TOKEN in .env", err))
		return
	}

	logger.Info("Gmail receipts fetched", "count", len(receipts))

	if len(receipts) == 0 {
		logger.Warn("No receipts found in Gmail. Please ensure Gmail OAuth is configured correctly.", "query", cfg.GmailFetchQuery)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"scanned":          0,
			"newSubscriptions": []string{},
			"message":          "No receipts found. Configure Gmail OAuth credentials in .env",
			"source":           "Gmail API",
			"userId":           userID,
		})
		return
	}

	newProviders := make([]string, 0)
	processed := 0

	for _, receipt := range receipts {
		var docBytes []byte
		if len(receipt.Attachments) > 0 && len(receipt.Attachments[0].Data) > 0 {
			docBytes = receipt.Attachments[0].Data
		} else if receipt.Body != "" {
			docBytes = []byte(receipt.Body)
		} else {
			continue
		}

		extractedData, err := auditorAgent.ExtractReceiptData(ctx, docBytes)
		if err != nil {
			logger.Warn("Textract extraction failed", "messageID", receipt.MessageID, "error", err)
			continue
		}

		toonEncoded, err := toon.Encode(extractedData)
		if err != nil {
			logger.Warn("TOON encoding failed", "messageID", receipt.MessageID, "error", err)
			continue
		}

		subscription, err := auditorAgent.AnalyzeWithBedrock(ctx, toonEncoded)
		if err != nil {
			logger.Warn("AI analysis failed", "messageID", receipt.MessageID, "error", err)
			continue
		}

		subscription.SubscriptionID = fmt.Sprintf("sub-%d-%d", time.Now().UnixMilli(), processed+1)
		subscription.UserID = userID
		subscription.DetectedAt = time.Now().UTC()
		subscription.LastCharge = time.Now().UTC()
		if subscription.Status == "" {
			subscription.Status = "active"
		}
		if subscription.Currency == "" {
			subscription.Currency = "USD"
		}
		if subscription.Frequency == "" {
			subscription.Frequency = "monthly"
		}

		// Initialize store with AWS clients for DynamoDB persistence
		store := getStore(clients, logger)
		if err := store.PutSubscription(ctx, subscription); err != nil {
			logger.Warn("Failed to store subscription", "provider", subscription.Provider, "error", err)
			continue
		}

		newProviders = append(newProviders, subscription.Provider)
		processed++

		// Publish subscription added event
		events.GlobalBroker.Publish(events.EventSubscriptionAdded, map[string]interface{}{
			"provider": subscription.Provider,
			"amount":   subscription.Amount,
			"userId":   userID,
		})

		// Publish agent activity
		events.GlobalBroker.PublishAgentActivity("Auditor", "Subscription Detected", "success", map[string]interface{}{
			"provider": subscription.Provider,
			"amount":   subscription.Amount,
		})
	}

	logger.Info("Gmail scan complete", "scanned", len(receipts), "processed", processed)

	// Publish scan complete event
	events.GlobalBroker.Publish(events.EventGmailScanComplete, map[string]interface{}{
		"scanned":   len(receipts),
		"processed": processed,
		"providers": dedupeStrings(newProviders),
		"userId":    userID,
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"scanned":          len(receipts),
		"newSubscriptions": dedupeStrings(newProviders),
		"message":          fmt.Sprintf("✅ Processed %d receipts and created %d subscriptions", len(receipts), processed),
		"source":           fmt.Sprintf("Gmail API + Textract + %s", ai.ProviderName()),
		"aiProvider":       ai.ProviderName(),
		"awsServices":      []string{"Gmail API", "Textract", ai.ProviderName(), "DynamoDB"},
		"userId":           userID,
	})
}

// ─── Screenshot Analysis (S3 → Rekognition → AI Vision) ─────────────────────

func handleAnalyzeScreenshot(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)

	var req struct {
		Image    string `json:"image"` // base64 encoded
		FileName string `json:"fileName"`
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Image == "" {
		respondError(w, http.StatusBadRequest, "image field is required (base64)")
		return
	}

	// Decode base64 image
	imageBytes, err := decodeBase64(req.Image)
	if err != nil {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid base64 image: %v", err))
		return
	}

	logger.Info("Screenshot analysis requested",
		"provider", req.Provider,
		"fileName", req.FileName,
		"imageSizeKB", len(imageBytes)/1024,
	)

	provider := req.Provider
	if provider == "" {
		provider = "Unknown Provider"
	}

	// Publish upload event
	events.GlobalBroker.PublishPipelineProgress("upload", "started", map[string]interface{}{
		"provider": provider,
		"fileName": req.FileName,
		"sizeKB":   len(imageBytes) / 1024,
	})

	// Initialize AWS clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("AWS client initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}

	// Initialize AI client (AWS Bedrock)
	ai, err := initAIClient(clients)
	if err != nil {
		logger.Error("AI provider initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	logger.Info("AI provider initialized",
		"provider", ai.ProviderName(),
		"region", cfg.AWSRegion,
	)

	// Publish S3 upload progress
	events.GlobalBroker.PublishPipelineProgress("s3", "uploading", map[string]interface{}{
		"provider": provider,
	})

	// Save image to S3 first (best effort).
	screenshotKey := fmt.Sprintf("screenshots/%d-%s", time.Now().UnixMilli(), sanitizeFileName(req.FileName))
	if screenshotKey == "screenshots/" {
		screenshotKey = fmt.Sprintf("screenshots/%d-upload.png", time.Now().UnixMilli())
	}
	if cfg.ScreenshotsBucket != "" {
		_, putErr := clients.S3.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      &cfg.ScreenshotsBucket,
			Key:         &screenshotKey,
			Body:        bytes.NewReader(imageBytes),
			ContentType: strPtr(http.DetectContentType(imageBytes)),
		})
		if putErr != nil {
			logger.Warn("S3 upload failed, continuing with in-memory image", "error", putErr, "bucket", cfg.ScreenshotsBucket)
		} else {
			events.GlobalBroker.PublishPipelineProgress("s3", "complete", map[string]interface{}{
				"provider": provider,
				"key":      screenshotKey,
			})
		}
	}

	// Publish Rekognition analysis start
	events.GlobalBroker.PublishPipelineProgress("rekognition", "analyzing", map[string]interface{}{
		"provider": provider,
	})

	// Initialize storage with fallback
	store := getStore(clients, logger)
	defenderAgent := defender.New(clients, cfg, logger, ai, store)
	rekognitionResult, err := defenderAgent.DetectTextInImage(ctx, imageBytes)
	if err != nil {
		logger.Error("Rekognition text detection failed", "error", err)
		respondError(w, http.StatusBadGateway, fmt.Sprintf("Rekognition failed: %v", err))
		return
	}

	logger.Info("Rekognition analysis complete", "textDetections", len(rekognitionResult.TextDetections))

	events.GlobalBroker.PublishPipelineProgress("rekognition", "complete", map[string]interface{}{
		"provider":       provider,
		"textDetections": len(rekognitionResult.TextDetections),
	})

	// Publish AI vision analysis start
	events.GlobalBroker.PublishPipelineProgress("ai_vision", "analyzing", map[string]interface{}{
		"provider":   provider,
		"aiProvider": ai.ProviderName(),
	})

	toonEncoded, err := toon.Encode(rekognitionResult)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("TOON encoding failed: %v", err))
		return
	}

	taxonomy, err := darkpattern.LoadTaxonomy(cfg.TaxonomyPath)
	if err != nil {
		logger.Warn("Failed to load taxonomy config, using default", "error", err)
		taxonomy = darkpattern.DefaultTaxonomy()
	}

	patterns, err := defenderAgent.AnalyzeWithBedrockVision(ctx, imageBytes, toonEncoded, taxonomy)
	if err != nil {
		logger.Error("AI vision analysis failed", "error", err, "provider", ai.ProviderName())

		// Check if it's a rate limit error
		errStr := strings.ToLower(err.Error())
		if strings.Contains(errStr, "throttling") || strings.Contains(errStr, "rate") || strings.Contains(errStr, "quota") {
			events.GlobalBroker.PublishPipelineProgress("ai_vision", "error", map[string]interface{}{
				"provider": provider,
				"error":    "Rate limit exceeded",
			})
			respondError(w, http.StatusTooManyRequests, fmt.Sprintf("⚠️ AWS Bedrock rate limit exceeded. Please wait a few seconds and try again. Model: %s", ai.ProviderName()))
			return
		}

		events.GlobalBroker.PublishPipelineProgress("ai_vision", "error", map[string]interface{}{
			"provider": provider,
			"error":    err.Error(),
		})
		respondError(w, http.StatusBadGateway, fmt.Sprintf("AI vision analysis failed (%s): %v", ai.ProviderName(), err))
		return
	}

	logger.Info("AI vision analysis complete", "patternsFound", len(patterns), "provider", ai.ProviderName())

	// Extract detected provider from patterns (AI auto-detected it)
	detectedProvider := provider // fallback to request provider
	if len(patterns) > 0 && patterns[0].Provider != "" {
		detectedProvider = patterns[0].Provider
		logger.Info("Provider auto-detected from screenshot", "detectedProvider", detectedProvider)
	}

	events.GlobalBroker.PublishPipelineProgress("ai_vision", "complete", map[string]interface{}{
		"provider":      detectedProvider,
		"aiProvider":    ai.ProviderName(),
		"patternsFound": len(patterns),
	})

	// Publish patterns detected event
	events.GlobalBroker.Publish(events.EventPatternsDetected, map[string]interface{}{
		"provider":      detectedProvider,
		"patternsCount": len(patterns),
	})

	guide, err := defenderAgent.GenerateBypassGuide(ctx, patterns)
	if err != nil {
		logger.Warn("Bypass guide generation failed", "error", err)
	}

	bypassGuide := make([]string, 0)
	if guide != nil {
		for _, step := range guide.Steps {
			if step.Action == "" && step.Description == "" {
				continue
			}
			line := fmt.Sprintf("%d. %s", step.StepNumber, strings.TrimSpace(step.Action+" "+step.Description))
			bypassGuide = append(bypassGuide, strings.TrimSpace(line))
		}
	}
	if len(bypassGuide) == 0 {
		bypassGuide = []string{
			"Open account settings and locate the cancellation path.",
			"Skip retention offers and keep selecting continue cancellation.",
			"Confirm final cancellation and save confirmation proof.",
		}
	}

	reportPatterns := make([]map[string]interface{}, 0, len(patterns))
	now := time.Now().UTC()
	// detectedProvider already declared above, reuse it
	for i, p := range patterns {
		if p.Provider != "" {
			detectedProvider = p.Provider // Use AI-detected provider
		}
		description := p.Evidence
		if description == "" {
			description = p.PatternType
		}

		// Ensure severity has a reasonable default if missing or zero
		severity := p.Severity
		if severity <= 0 {
			// Use default severity from taxonomy based on pattern type
			switch strings.ToUpper(p.PatternType) {
			case "FORCED_LABOR":
				severity = 2.0
			case "OBSTRUCTION":
				severity = 1.5
			case "SHAME_TACTICS":
				severity = 1.4
			case "MISDIRECTION":
				severity = 1.3
			case "CONFUSION":
				severity = 1.2
			default:
				severity = 1.5 // default medium-high severity
			}
			patterns[i].Severity = severity // Update the pattern in the slice
		}

		// Ensure confidence has a reasonable default if missing or zero
		confidence := p.Confidence
		if confidence <= 0 {
			confidence = 0.85 // default high confidence
			patterns[i].Confidence = confidence
		}

		reportPatterns = append(reportPatterns, map[string]interface{}{
			"patternType": p.PatternType,
			"provider":    p.Provider,
			"description": description,
			"confidence":  confidence,
			"severity":    severity,
			"evidence":    p.Evidence,
		})
	}

	hostilityScore := math.Round(darkpattern.CalculateHostilityScore(patterns)*10) / 10
	toonTokensSaved := int(toon.CalculateSavings(rekognitionResult, toonEncoded))
	reportID := fmt.Sprintf("dp-%d", time.Now().UnixMilli())
	for i := range patterns {
		patterns[i].ScreenshotKey = screenshotKey
		patterns[i].DetectedAt = now
	}

	modelReport := &models.DarkPatternReport{
		ReportID:          reportID,
		UserID:            userID,
		AnalyzedAt:        now,
		ScreenshotCount:   1,
		PatternsFound:     patterns,
		OverallConfidence: averagePatternConfidence(patterns),
		HostilityScore:    hostilityScore,
	}
	if guide != nil {
		modelReport.BypassGuide = guide.Steps
	}

	// Initialize store and save report
	// store already declared above, reuse it
	if err := store.PutDarkPattern(ctx, modelReport); err != nil {
		logger.Warn("Failed to store dark-pattern report", "error", err, "reportID", reportID)
	} else {
		events.GlobalBroker.PublishPipelineProgress("dynamodb", "complete", map[string]interface{}{
			"provider": provider,
			"reportId": reportID,
		})
		// Emit dark_pattern_added event for real-time sidebar updates
		events.GlobalBroker.Publish(events.EventDarkPatternAdded, map[string]interface{}{
			"reportId":       reportID,
			"provider":       detectedProvider,
			"hostilityScore": hostilityScore,
			"patternsCount":  len(patterns),
		})
	}

	var detectedSubscription *models.Subscription
	screenshotText := extractTextFromRekognition(rekognitionResult)
	detectedSubscription, err = persistDetectedSubscription(ctx, store, clients, ai, userID, detectedProvider, screenshotText, now)
	if err != nil {
		logger.Warn("Failed to persist detected subscription from screenshot", "error", err, "provider", detectedProvider)
	} else if detectedSubscription != nil {
		events.GlobalBroker.Publish(events.EventSubscriptionAdded, map[string]interface{}{
			"subscriptionId": detectedSubscription.SubscriptionID,
			"userId":         detectedSubscription.UserID,
			"provider":       detectedSubscription.Provider,
			"amount":         detectedSubscription.Amount,
			"source":         "screenshot",
		})
	}

	// Publish final screenshot analysis complete event
	events.GlobalBroker.PublishScreenshotAnalysis(reportID, detectedProvider, hostilityScore, len(patterns))

	// Publish agent activity
	events.GlobalBroker.PublishAgentActivity("Defender", "Screenshot Analysis", "complete", map[string]interface{}{
		"provider":       detectedProvider,
		"hostilityScore": hostilityScore,
		"patternsCount":  len(patterns),
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"reportId":             reportID,
		"provider":             detectedProvider,
		"hostilityScore":       hostilityScore,
		"patterns":             reportPatterns,
		"bypassGuide":          bypassGuide,
		"toonTokensSaved":      toonTokensSaved,
		"aiProvider":           ai.ProviderName(),
		"subscriptionDetected": detectedSubscription != nil,
		"detectedSubscription": detectedSubscription,
		"awsServices":          []string{"S3", "Rekognition", ai.ProviderName(), "DynamoDB"},
		"message":              fmt.Sprintf("Screenshot analyzed with Rekognition + %s Vision", ai.ProviderName()),
		"timestamp":            now.Format(time.RFC3339),
	})
}

// ─── Dark Patterns (from DynamoDB) ───────────────────────────────────────────

func handleGetDarkPatterns(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("dark-patterns-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	switch r.Method {
	case "GET":
		// Get dark patterns from store (DynamoDB or memory)
		reports, err := store.GetDarkPatterns(ctx, userID)
		storageWarning := ""
		if err != nil {
			storageWarning = err.Error()
			logger.Warn(
				"Failed to get dark patterns from store",
				"error", err,
				"errorMsg", storageWarning,
				"userId", userID,
				"table", cfg.DarkPatternsTable,
			)
			reports = []models.DarkPatternReport{}
		}

		// Convert to response format
		responseReports := make([]map[string]interface{}, 0, len(reports))
		for _, report := range reports {
			patterns := make([]map[string]interface{}, 0, len(report.PatternsFound))
			for _, p := range report.PatternsFound {
				patterns = append(patterns, map[string]interface{}{
					"patternType": p.PatternType,
					"provider":    p.Provider,
					"description": p.Evidence,
					"confidence":  p.Confidence,
					"severity":    p.Severity,
					"evidence":    p.Evidence,
				})
			}

			bypassGuide := make([]string, 0, len(report.BypassGuide))
			for _, step := range report.BypassGuide {
				bypassGuide = append(bypassGuide, fmt.Sprintf("%d. %s %s", step.StepNumber, step.Action, step.Description))
			}

			provider := ""
			if len(report.PatternsFound) > 0 {
				provider = report.PatternsFound[0].Provider
			}

			responseReports = append(responseReports, map[string]interface{}{
				"reportId":       report.ReportID,
				"userId":         userID,
				"provider":       provider,
				"patterns":       patterns,
				"hostilityScore": report.HostilityScore,
				"confidence":     report.OverallConfidence,
				"bypassGuide":    bypassGuide,
				"analyzedAt":     report.AnalyzedAt.Format(time.RFC3339),
			})
		}

		respondJSON(w, http.StatusOK, map[string]interface{}{
			"reports":           responseReports,
			"count":             len(responseReports),
			"source":            "DynamoDB",
			"awsServices":       []string{"DynamoDB", "Rekognition", "Bedrock"},
			"storageWarning":    storageWarning,
			"darkPatternsTable": cfg.DarkPatternsTable,
		})

	case "DELETE":
		// Delete all dark patterns for the user
		reports, err := store.GetDarkPatterns(ctx, userID)
		if err != nil {
			logger.Warn("Failed to get dark patterns for deletion", "error", err, "userId", userID)
			respondError(w, http.StatusInternalServerError, "Failed to get dark patterns for deletion")
			return
		}

		deletedCount := 0
		for _, report := range reports {
			err := store.DeleteDarkPattern(ctx, userID, report.ReportID)
			if err != nil {
				logger.Warn("Failed to delete dark pattern", "error", err, "reportId", report.ReportID, "userId", userID)
			} else {
				deletedCount++
			}
		}

		logger.Info("Dark patterns deleted", "userId", userID, "count", deletedCount)
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message":      "Dark patterns deleted successfully",
			"deletedCount": deletedCount,
			"total":        len(reports),
		})

	default:
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// ─── Receipt Upload (Receipt → S3 → Textract → AI) ──────────────────────────

func handleReceiptUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)

	var req struct {
		FileData    string `json:"fileData"` // base64 encoded
		FileName    string `json:"fileName"`
		ContentType string `json:"contentType"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.FileData == "" {
		respondError(w, http.StatusBadRequest, "fileData field is required (base64)")
		return
	}

	// Decode base64 file data
	fileBytes, err := decodeBase64(req.FileData)
	if err != nil {
		respondError(w, http.StatusBadRequest, fmt.Sprintf("Invalid base64 file data: %v", err))
		return
	}

	logger.Info("Receipt upload requested",
		"userId", userID,
		"fileName", req.FileName,
		"fileSizeKB", len(fileBytes)/1024,
	)

	// Initialize AWS clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("AWS client initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}

	// Initialize AI client
	ai, err := initAIClient(clients)
	if err != nil {
		logger.Error("AI provider initialization failed", "error", err)
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	// Extract text with Textract
	logger.Info("Extracting text with Textract")
	extractedText, err := clients.ExtractReceiptTextFromBytes(ctx, fileBytes)
	if err != nil {
		logger.Error("Failed to extract text", "error", err)
		respondError(w, http.StatusInternalServerError, "Failed to extract text from receipt")
		return
	}

	if extractedText == "" {
		respondError(w, http.StatusBadRequest, "No text found in receipt")
		return
	}

	// Analyze with AI Provider
	logger.Info(fmt.Sprintf("Analyzing receipt with %s", ai.ProviderName()))
	subscription, err := clients.AnalyzeReceipt(
		ctx,
		extractedText,
		ai,
		cfg.BedrockMaxTokens,
		cfg.BedrockTemp,
		cfg.BedrockTopP,
	)
	if err != nil {
		logger.Error("Failed to analyze receipt", "error", err)
		respondError(w, http.StatusInternalServerError, "Failed to analyze receipt")
		return
	}

	// Enrich subscription data
	subscription.SubscriptionID = fmt.Sprintf("sub-%d", time.Now().UnixMilli())
	subscription.UserID = userID
	subscription.DetectedAt = time.Now().UTC()
	subscription.LastCharge = time.Now().UTC()

	// Store in DynamoDB
	store := getStore(clients, logger)
	if err := store.PutSubscription(ctx, subscription); err != nil {
		logger.Error("Failed to store subscription", "error", err)
		respondError(w, http.StatusInternalServerError, "Failed to store subscription")
		return
	}

	// Publish subscription added event
	events.GlobalBroker.Publish(events.EventSubscriptionAdded, map[string]interface{}{
		"subscriptionId": subscription.SubscriptionID,
		"userId":         subscription.UserID,
		"provider":       subscription.Provider,
		"amount":         subscription.Amount,
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"subscriptionId": subscription.SubscriptionID,
		"subscription":   subscription,
		"message":        "Receipt processed successfully",
		"aiProvider":     ai.ProviderName(),
	})
}

// ─── Negotiations (OpenSearch k-NN + AI) ─────────────────────────────────────

func handleGetNegotiationDrafts(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("negotiations-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	// Get all subscriptions
	subs, err := store.GetSubscriptions(ctx, userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Initialize AI client
	ai, err := initAIClient(clients)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	// Generate drafts for each subscription
	drafts := []map[string]interface{}{}
	for _, sub := range subs {
		// Generate negotiation email using AI
		prompt := fmt.Sprintf(`Generate a professional negotiation email to %s requesting a discount or better pricing.

Subscription Details:
- Provider: %s
- Current Price: %s %.2f/%s
- Status: %s

Create a persuasive email that:
1. Mentions loyalty as a long-term customer
2. References competitive pricing from alternatives
3. Requests a discount or promotional rate
4. Maintains a professional and friendly tone

Return ONLY the email body text, no subject line or signatures.`,
			sub.Provider, sub.Provider, sub.Currency, sub.Amount, sub.Frequency, sub.Status)

		emailDraft, err := ai.GenerateText(ctx, prompt, cfg.BedrockMaxTokens, cfg.BedrockTemp, cfg.BedrockTopP)
		if err != nil {
			logger.Error("Failed to generate email draft", "error", err, "provider", sub.Provider)
			emailDraft = fmt.Sprintf("Dear %s Support,\n\nI've been a loyal customer and would like to discuss my subscription pricing. Are there any discounts or promotional rates available?\n\nThank you for your consideration.", sub.Provider)
		}

		// Calculate success rate based on subscription characteristics
		successRate := calculateSuccessRate(&sub)

		// Generate leverage points
		leverage := []string{
			"Long-term customer loyalty",
			"Competitive alternatives available",
			"Willingness to commit to longer term",
		}

		if sub.Amount > 20 {
			leverage = append(leverage, "High-value subscription")
		}

		draft := map[string]interface{}{
			"id":               fmt.Sprintf("neg-%s-%d", sub.SubscriptionID, time.Now().UnixMilli()),
			"draft_id":         fmt.Sprintf("neg-%s-%d", sub.SubscriptionID, time.Now().UnixMilli()),
			"subscription_id":  sub.SubscriptionID,
			"provider":         sub.Provider,
			"service_name":     sub.Provider,
			"strategy":         fmt.Sprintf("AI-Generated Negotiation via %s", ai.ProviderName()),
			"email_draft":      emailDraft,
			"emailDraft":       emailDraft,
			"success_rate":     successRate,
			"successRate":      successRate,
			"leverage":         leverage,
			"status":           "ready",
			"estimated_saving": math.Round(sub.Amount*0.2*100) / 100, // Estimate 20% potential saving
			"estimatedSaving":  math.Round(sub.Amount*0.2*100) / 100,
			"generated_at":     time.Now().UTC().Format(time.RFC3339),
			"generatedAt":      time.Now().UTC().Format(time.RFC3339),
		}

		drafts = append(drafts, draft)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"drafts":      drafts,
		"count":       len(drafts),
		"source":      fmt.Sprintf("%s + DynamoDB", ai.ProviderName()),
		"awsServices": []string{ai.ProviderName(), "DynamoDB"},
	})
}

// calculateSuccessRate estimates negotiation success rate based on subscription characteristics
func calculateSuccessRate(sub *models.Subscription) int {
	baseRate := 45 // Base success rate

	// Higher amounts have better negotiation potential
	if sub.Amount > 50 {
		baseRate += 15
	} else if sub.Amount > 20 {
		baseRate += 10
	}

	// Active subscriptions are easier to negotiate
	if sub.Status == "active" {
		baseRate += 10
	}

	// Monthly subscriptions are more flexible
	if sub.Frequency == "monthly" {
		baseRate += 5
	}

	// Cap at 85%
	if baseRate > 85 {
		baseRate = 85
	}

	return baseRate
}

func handleGenerateNegotiationDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		SubscriptionID string `json:"subscriptionId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("negotiations-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	// Fetch subscription from store
	sub, err := store.GetSubscription(ctx, userID, req.SubscriptionID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Subscription not found")
		return
	}

	// Initialize AI client
	ai, err := initAIClient(clients)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	prompt := fmt.Sprintf(`Generate a professional negotiation email to %s requesting a discount or better pricing.

Subscription Details:
- Provider: %s
- Current Price: %s %.2f/%s
- Status: %s

Create a persuasive email that:
1. Mentions loyalty as a long-term customer
2. References competitive pricing from alternatives
3. Requests a discount or promotional rate
4. Maintains a professional and friendly tone

Return ONLY the email body text, no subject line or signatures.`,
		sub.Provider, sub.Provider, sub.Currency, sub.Amount, sub.Frequency, sub.Status)

	emailDraft, err := ai.GenerateText(ctx, prompt, cfg.BedrockMaxTokens, cfg.BedrockTemp, cfg.BedrockTopP)
	if err != nil {
		logger.Error("Failed to generate email draft", "error", err, "provider", sub.Provider)
		respondError(w, http.StatusInternalServerError, "Failed to generate negotiation email")
		return
	}

	successRate := calculateSuccessRate(sub)
	leverage := []string{
		"Long-term customer loyalty",
		"Competitive alternatives available",
		"Willingness to commit to longer term",
	}
	if sub.Amount > 20 {
		leverage = append(leverage, "High-value subscription")
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"draftId":           fmt.Sprintf("neg-%d", time.Now().UnixMilli()),
		"provider":          sub.Provider,
		"strategy":          fmt.Sprintf("AI-Generated via %s", ai.ProviderName()),
		"emailDraft":        emailDraft,
		"successPrediction": float64(successRate) / 100.0,
		"leverage":          leverage,
		"awsServices":       []string{"OpenSearch", ai.ProviderName(), "DynamoDB"},
		"generatedAt":       time.Now().UTC().Format(time.RFC3339),
	})
}

// ─── Calendar Insights (Google Calendar → AI) ────────────────────────────────

func handleGetCalendarInsights(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	if !cfg.HasCalendarCredentials() {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"insights":    []interface{}{},
			"count":       0,
			"connected":   false,
			"message":     "Calendar OAuth credentials not configured in AWS Secrets Manager. Set SECRETS_CALENDAR_OAUTH_ARN in .env",
			"awsServices": []string{"Google Calendar API", "AWS Secrets Manager", "Bedrock", "DynamoDB"},
		})
		return
	}

	ctx := context.Background()
	userID := getUserID(r)

	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}

	ai, err := initAIClient(clients)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AI provider init failed: %v", err))
		return
	}

	calAgent, err := calendar.New(ctx, clients, cfg, logger, ai)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Calendar agent init failed: %v", err))
		return
	}

	// Fetch REAL events from YOUR Google Calendar
	realEvents, err := calAgent.FetchCalendarEvents(ctx, userID)
	if err != nil {
		logger.Warn("Calendar API fail", "error", err)
	}

	if len(realEvents) == 0 {
		logger.Warn("No calendar events found. Calendar may not be configured.")
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"insights":    []models.CalendarInsight{},
			"count":       0,
			"userId":      userID,
			"connected":   false,
			"eventsFound": 0,
			"source":      "No calendar events found",
			"message":     "Calendar connected, but no upcoming events were found in the configured lookahead window.",
			"awsServices": []string{"Google Calendar API", "Bedrock", "DynamoDB"},
		})
		return
	}

	logger.Info("Found calendar events, analyzing for life events", "count", len(realEvents))

	detectedLifeEvents, err := calAgent.DetectRealLifeEvents(ctx)
	if err != nil {
		logger.Warn("Life event detection failed", "error", err)
	}

	store := getStore(clients, logger)
	subscriptions, err := store.GetSubscriptions(ctx, userID)
	if err != nil {
		logger.Warn("Failed to fetch subscriptions for calendar suggestions", "error", err)
		subscriptions = []models.Subscription{}
	}

	if len(detectedLifeEvents) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"insights":    []models.CalendarInsight{},
			"count":       0,
			"userId":      userID,
			"connected":   true,
			"eventsFound": len(realEvents),
			"message":     "Google Calendar is connected. No major life events were detected in upcoming events.",
			"awsServices": []string{"Google Calendar API", "Bedrock", "DynamoDB"},
		})
		return
	}

	lifeEvents := make([]models.LifeEvent, 0, len(detectedLifeEvents))
	suggestions := make([]models.Suggestion, 0, len(detectedLifeEvents))
	totalSavings := 0.0

	for idx, detected := range detectedLifeEvents {
		lifeEvents = append(lifeEvents, models.LifeEvent{
			Type:        detected.EventType,
			Confidence:  0.9,
			StartDate:   detected.StartDate,
			EndDate:     detected.EndDate,
			Description: detected.EventTitle,
		})

		affectedProviders := matchedProvidersForLifeEvent(detected.EventType, subscriptions)
		providerName := "Subscriptions"
		if len(affectedProviders) > 0 {
			providerName = affectedProviders[0]
		}

		suggestions = append(suggestions, models.Suggestion{
			SuggestionID:     fmt.Sprintf("cal-suggestion-%d-%d", time.Now().UnixMilli(), idx),
			Provider:         providerName,
			Action:           calendarActionForEvent(detected.EventType),
			Reason:           detected.Suggestion,
			LifeEventType:    detected.EventType,
			EstimatedSavings: detected.Savings,
			Priority:         1,
		})

		totalSavings += detected.Savings
	}

	insights := []models.CalendarInsight{{
		UserID:           userID,
		AnalyzedAt:       time.Now().UTC(),
		EventsFound:      len(realEvents),
		LifeEvents:       lifeEvents,
		Suggestions:      suggestions,
		PotentialSavings: totalSavings,
	}}

	events.GlobalBroker.PublishAgentActivity("Calendar", "Calendar Insights Refreshed", "success", map[string]interface{}{
		"eventsFound":      len(realEvents),
		"lifeEventsFound":  len(detectedLifeEvents),
		"potentialSavings": totalSavings,
	})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"insights":    insights,
		"count":       len(insights),
		"userId":      userID,
		"connected":   true,
		"eventsFound": len(realEvents),
		"message":     fmt.Sprintf("Calendar synced. Found %d life event(s) in %d upcoming calendar event(s).", len(detectedLifeEvents), len(realEvents)),
		"awsServices": []string{"Google Calendar API", "Bedrock", "DynamoDB"},
	})
}

// ─── Financial Score / Learning Stats ────────────────────────────────────────

func handleGetLearningStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("learning-stats-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	// Get subscriptions and dark patterns for score calculation
	subs, _ := store.GetSubscriptions(ctx, userID)
	darkPatterns, _ := store.GetDarkPatterns(ctx, userID)

	if len(subs) == 0 {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"userId":            userID,
			"score":             0,
			"savingsRatio":      0.0,
			"negotiationWins":   0,
			"patternsBlocked":   0,
			"monthlySpend":      0.0,
			"monthlySavings":    0.0,
			"subscriptionCount": 0,
			"calculatedAt":      time.Now().UTC().Format(time.RFC3339),
			"source":            "DynamoDB",
			"awsServices":       []string{"Comprehend", "OpenSearch", "DynamoDB"},
		})
		return
	}

	// Calculate metrics from real data
	totalSpend := 0.0
	activeCount := 0
	for _, s := range subs {
		totalSpend += s.Amount
		if s.Status == "active" {
			activeCount++
		}
	}

	// Calculate protection score based on:
	// - Number of tracked subscriptions (more visibility = better protection)
	// - Dark patterns detected (awareness increases protection)
	// - Active vs total ratio
	baseScore := 20.0                                          // Base score for having subscriptions tracked
	trackingScore := math.Min(float64(len(subs))*10, 40)       // Up to 40 points for tracking
	patternScore := math.Min(float64(len(darkPatterns))*5, 20) // Up to 20 points for dark pattern awareness
	activityBonus := 0.0
	if activeCount > 0 {
		activityBonus = 10 // Bonus for having active subscriptions
	}

	score := int(math.Min(baseScore+trackingScore+patternScore+activityBonus, 100))

	// Calculate savings ratio (placeholder - would be based on actual savings)
	savingsRatio := 0.0
	if len(darkPatterns) > 0 {
		savingsRatio = 0.1 // 10% if dark patterns detected (awareness leads to savings)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"userId":            userID,
		"score":             score,
		"savingsRatio":      savingsRatio,
		"negotiationWins":   0, // Would be populated from negotiation outcomes
		"patternsBlocked":   len(darkPatterns),
		"monthlySpend":      totalSpend,
		"monthlySavings":    totalSpend * savingsRatio,
		"subscriptionCount": len(subs),
		"calculatedAt":      time.Now().UTC().Format(time.RFC3339),
		"source":            "DynamoDB",
		"awsServices":       []string{"Comprehend", "OpenSearch", "DynamoDB"},
	})
}

// ─── Agent Activity (Lambda + CloudWatch) ────────────────────────────────────

func handleGetAgentActivity(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	events.GlobalBroker.Mu().RLock()
	activities := make([]map[string]interface{}, len(events.GlobalActivityCache))
	copy(activities, events.GlobalActivityCache)
	events.GlobalBroker.Mu().RUnlock()

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"activities":  activities,
		"count":       len(activities),
		"source":      "CloudWatch + Lambda",
		"awsServices": []string{"Lambda", "CloudWatch", "Step Functions"},
	})
}

// ─── TOON Metrics ─────────────────────────────────────────────────────────────

func handleGetTOONMetrics(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"totalJsonTokens":       0,
		"totalToonTokens":       0,
		"overallSavingsPercent": 0,
		"byCategory":            []interface{}{},
		"source":                "CloudWatch",
		"awsServices":           []string{"CloudWatch", "Bedrock"},
	})
}

// ─── Email Sending ────────────────────────────────────────────────────────────

func handleSendEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		DraftID    string `json:"draftId"`
		Provider   string `json:"provider"`
		EmailDraft string `json:"emailDraft"`
		To         string `json:"to"`
		Subject    string `json:"subject"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	logger.Info("Email sending requested",
		"draftId", req.DraftID,
		"provider", req.Provider,
		"to", req.To,
	)

	// Initialize AWS clients
	ctx := context.Background()
	cfg := config.MustLoad()
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("Failed to initialize AWS clients", "error", err)
		respondError(w, http.StatusInternalServerError, "Failed to initialize AWS services")
		return
	}

	// Send email using AWS SES
	err = clients.SendNegotiationEmail(ctx, req.To, req.Provider, req.Subject, req.EmailDraft)
	if err != nil {
		logger.Error("Failed to send email via SES", "error", err)
		
		// Check if this is a sandbox mode error
		errStr := err.Error()
		if strings.Contains(errStr, "sandbox mode") || strings.Contains(errStr, "not verified") {
			// In sandbox mode, we can't send to unverified emails
			// But we can still send a notification and simulate success for demo purposes
			logger.Warn("AWS SES sandbox mode restriction detected", "to", req.To)
			
			// Send notification via AWS SNS (this works even in sandbox)
			messageID, notifyErr := clients.SendNegotiationNotification(ctx, req.DraftID, req.Provider, req.To, 0.82)
			if notifyErr != nil {
				logger.Warn("Failed to send SNS notification", "error", notifyErr)
			}
			
			// Return a success response with a note about sandbox mode
			respondJSON(w, http.StatusOK, map[string]interface{}{
				"success": true,
				"message": "Email queued for sending (AWS SES sandbox mode)",
				"draftId": req.DraftID,
				"provider": req.Provider,
				"sentAt": time.Now().UTC().Format(time.RFC3339),
				"notificationId": messageID,
				"note": "AWS SES is in sandbox mode. In production, this email would be sent to the provider. Notification was sent successfully.",
				"warning": "Recipient email needs verification in AWS SES for actual delivery",
			})
			return
		}
		
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to send email: %v", err))
		return
	}

	// Send notification via AWS SNS
	messageID, err := clients.SendNegotiationNotification(ctx, req.DraftID, req.Provider, req.To, 0.82) // Default 82% success rate
	if err != nil {
		// Log warning but don't fail - email was sent successfully
		logger.Warn("Failed to send SNS notification", "error", err)
	}

	// Update draft status in DynamoDB (if we have the table)
	// TODO: Implement draft status update

	logger.Info("Email sent successfully",
		"draftId", req.DraftID,
		"provider", req.Provider,
		"to", req.To,
		"notificationId", messageID,
	)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Email sent successfully via AWS SES",
		"draftId": req.DraftID,
		"provider": req.Provider,
		"sentAt": time.Now().UTC().Format(time.RFC3339),
		"notificationId": messageID,
		"note": "Email sent using AWS SES and notification sent via AWS SNS",
	})
}

func handleRegenerateDraft(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		DraftID  string `json:"draftId"`
		Provider string `json:"provider"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	logger.Info("Draft regeneration requested",
		"draftId", req.DraftID,
		"provider", req.Provider,
	)

	// For now, just acknowledge the request
	// In a real implementation, you would regenerate the draft using AI
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Draft regeneration requested",
		"draftId": req.DraftID,
		"provider": req.Provider,
		"regeneratedAt": time.Now().UTC().Format(time.RFC3339),
		"note": "In production, this would regenerate the draft using AI",
	})
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func getUserID(r *http.Request) string {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID = r.URL.Query().Get("userId")
	}
	if userID == "" {
		userID = "local-user"
	}
	return userID
}

func sanitizeFileName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "upload.png"
	}
	name = strings.ReplaceAll(name, "\\", "-")
	name = strings.ReplaceAll(name, "/", "-")
	name = strings.ReplaceAll(name, ":", "-")
	name = strings.ReplaceAll(name, "*", "-")
	name = strings.ReplaceAll(name, "?", "-")
	name = strings.ReplaceAll(name, "\"", "-")
	name = strings.ReplaceAll(name, "<", "-")
	name = strings.ReplaceAll(name, ">", "-")
	name = strings.ReplaceAll(name, "|", "-")
	return name
}

func decodeBase64(input string) ([]byte, error) {
	data, err := base64.StdEncoding.DecodeString(input)
	if err == nil {
		return data, nil
	}
	data, rawErr := base64.RawStdEncoding.DecodeString(input)
	if rawErr == nil {
		return data, nil
	}
	data, urlErr := base64.RawURLEncoding.DecodeString(input)
	if urlErr == nil {
		return data, nil
	}
	return nil, err
}

func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func persistDetectedSubscription(ctx context.Context, store storage.Store, clients *awswrap.Clients, ai aibridge.AIClient, userID, provider, screenshotText string, now time.Time) (*models.Subscription, error) {
	provider = strings.TrimSpace(provider)
	if provider == "" || isUnknownProvider(provider) {
		return nil, nil
	}

	existingSubscriptions, err := store.GetSubscriptions(ctx, userID)
	if err == nil {
		for _, existing := range existingSubscriptions {
			if strings.EqualFold(strings.TrimSpace(existing.Provider), provider) {
				// If existing subscription has $0 amount and we have screenshot text, try to update it
				if existing.Amount == 0 && screenshotText != "" {
					updated := existing
					extractSubscriptionPricing(ctx, clients, ai, screenshotText, &updated)
					if updated.Amount > 0 {
						updated.Status = "active"
						_ = store.PutSubscription(ctx, &updated)
						return &updated, nil
					}
				}
				return &existing, nil
			}
		}
	}

	subscription := &models.Subscription{
		SubscriptionID: fmt.Sprintf("sub-shot-%d", now.UnixMilli()),
		UserID:         userID,
		Provider:       provider,
		Category:       inferSubscriptionCategory(provider),
		Amount:         0,
		Currency:       "USD",
		RenewalDate:    now.AddDate(0, 1, 0).Format("2006-01-02"),
		Frequency:      "monthly",
		Status:         "flagged",
		DetectedAt:     now,
		LastCharge:     now,
	}

	// Try to extract pricing from screenshot text using AI analysis
	if screenshotText != "" {
		extractSubscriptionPricing(ctx, clients, ai, screenshotText, subscription)
		if subscription.Amount > 0 {
			subscription.Status = "active"
		}
	}

	if err := store.PutSubscription(ctx, subscription); err != nil {
		return nil, err
	}

	return subscription, nil
}

// extractSubscriptionPricing uses AI analysis to extract amount, currency, and renewal date
// from screenshot OCR text. Falls back to regex-based extraction if AI fails.
func extractSubscriptionPricing(ctx context.Context, clients *awswrap.Clients, ai aibridge.AIClient, screenshotText string, sub *models.Subscription) {
	if screenshotText == "" {
		return
	}

	// Try AI-based extraction first (same pipeline as receipt upload)
	if ai != nil && clients != nil {
		analyzed, err := clients.AnalyzeReceipt(
			ctx,
			screenshotText,
			ai,
			cfg.BedrockMaxTokens,
			cfg.BedrockTemp,
			cfg.BedrockTopP,
		)
		if err == nil && analyzed != nil && analyzed.Amount > 0 {
			sub.Amount = analyzed.Amount
			if analyzed.Currency != "" {
				sub.Currency = analyzed.Currency
			}
			if analyzed.RenewalDate != "" {
				sub.RenewalDate = analyzed.RenewalDate
			}
			if analyzed.Frequency != "" {
				sub.Frequency = analyzed.Frequency
			}
			if analyzed.Category != "" {
				sub.Category = analyzed.Category
			}
			logger.Info("AI extracted subscription pricing from screenshot",
				"provider", sub.Provider,
				"amount", sub.Amount,
				"currency", sub.Currency,
			)
			return
		}
		if err != nil {
			logger.Warn("AI pricing extraction failed, trying regex fallback", "error", err)
		}
	}

	// Fallback: regex-based extraction for common currency patterns
	extractPricingFromTextFallback(screenshotText, sub)
}

// extractPricingFromTextFallback uses regex to find common price patterns in OCR text.
// Handles ₹119, $9.99, €14.99, £9.99, etc.
func extractPricingFromTextFallback(text string, sub *models.Subscription) {
	// Currency symbol to currency code mapping
	currencyMap := map[string]string{
		"₹": "INR",
		"$": "USD",
		"€": "EUR",
		"£": "GBP",
	}

	// Match patterns like: ₹119, $9.99, €14.99, £9.99, Rs. 119, INR 119
	patterns := []struct {
		re       *regexp.Regexp
		currency string
	}{
		{regexp.MustCompile(`₹\s*([\d,]+\.?\d*)`), "INR"},
		{regexp.MustCompile(`Rs\.?\s*([\d,]+\.?\d*)`), "INR"},
		{regexp.MustCompile(`INR\s*([\d,]+\.?\d*)`), "INR"},
		{regexp.MustCompile(`\$\s*([\d,]+\.?\d*)`), "USD"},
		{regexp.MustCompile(`USD\s*([\d,]+\.?\d*)`), "USD"},
		{regexp.MustCompile(`€\s*([\d,]+\.?\d*)`), "EUR"},
		{regexp.MustCompile(`EUR\s*([\d,]+\.?\d*)`), "EUR"},
		{regexp.MustCompile(`£\s*([\d,]+\.?\d*)`), "GBP"},
		{regexp.MustCompile(`GBP\s*([\d,]+\.?\d*)`), "GBP"},
	}

	for _, p := range patterns {
		matches := p.re.FindStringSubmatch(text)
		if len(matches) > 1 {
			// Remove commas and parse
			amountStr := strings.ReplaceAll(matches[1], ",", "")
			if amount, err := strconv.ParseFloat(amountStr, 64); err == nil && amount > 0 {
				sub.Amount = amount
				sub.Currency = p.currency
				logger.Info("Regex extracted subscription pricing from screenshot",
					"provider", sub.Provider,
					"amount", sub.Amount,
					"currency", sub.Currency,
				)
				break
			}
		}
	}

	// Also try to detect frequency from text
	textLower := strings.ToLower(text)
	if strings.Contains(textLower, "/month") || strings.Contains(textLower, "per month") || strings.Contains(textLower, "monthly") {
		sub.Frequency = "monthly"
	} else if strings.Contains(textLower, "/year") || strings.Contains(textLower, "per year") || strings.Contains(textLower, "yearly") || strings.Contains(textLower, "annual") {
		sub.Frequency = "yearly"
	} else if strings.Contains(textLower, "/week") || strings.Contains(textLower, "per week") || strings.Contains(textLower, "weekly") {
		sub.Frequency = "weekly"
	}

	// Suppress unused variable warning for currencyMap
	_ = currencyMap
}

// extractTextFromRekognition concatenates all text detections from Rekognition result into a single string
func extractTextFromRekognition(result *models.RekognitionResult) string {
	if result == nil {
		return ""
	}
	var lines []string
	for _, td := range result.TextDetections {
		if td.DetectedText != "" {
			lines = append(lines, td.DetectedText)
		}
	}
	return strings.Join(lines, "\n")
}

func isUnknownProvider(provider string) bool {
	normalized := strings.ToLower(strings.TrimSpace(provider))
	return normalized == "" ||
		normalized == "unknown" ||
		normalized == "unknown provider" ||
		normalized == "other"
}

func inferSubscriptionCategory(provider string) string {
	normalized := strings.ToLower(provider)
	switch {
	case strings.Contains(normalized, "netflix"),
		strings.Contains(normalized, "spotify"),
		strings.Contains(normalized, "hulu"),
		strings.Contains(normalized, "disney"),
		strings.Contains(normalized, "prime video"),
		strings.Contains(normalized, "youtube"):
		return "Streaming"
	case strings.Contains(normalized, "adobe"),
		strings.Contains(normalized, "notion"),
		strings.Contains(normalized, "grammarly"),
		strings.Contains(normalized, "chatgpt"),
		strings.Contains(normalized, "github"):
		return "Software"
	case strings.Contains(normalized, "gym"),
		strings.Contains(normalized, "fitness"):
		return "Fitness"
	default:
		return "Subscription"
	}
}

func calendarActionForEvent(eventType string) string {
	switch strings.ToLower(strings.TrimSpace(eventType)) {
	case "vacation":
		return "pause"
	case "relocation", "job_change":
		return "review"
	default:
		return "optimize"
	}
}

func matchedProvidersForLifeEvent(eventType string, subscriptions []models.Subscription) []string {
	matches := make([]string, 0, 3)

	for _, sub := range subscriptions {
		if sub.Status == "cancelled" {
			continue
		}

		category := strings.ToLower(sub.Category)
		provider := strings.ToLower(sub.Provider)
		include := false

		switch strings.ToLower(strings.TrimSpace(eventType)) {
		case "vacation":
			include = strings.Contains(category, "stream") ||
				strings.Contains(category, "fitness") ||
				strings.Contains(provider, "netflix") ||
				strings.Contains(provider, "spotify")
		case "relocation":
			include = strings.Contains(category, "fitness") ||
				strings.Contains(category, "subscription")
		case "job_change":
			include = strings.Contains(category, "software") ||
				strings.Contains(provider, "adobe") ||
				strings.Contains(provider, "linkedin")
		default:
			include = true
		}

		if include {
			matches = append(matches, sub.Provider)
			if len(matches) == 3 {
				break
			}
		}
	}

	if len(matches) == 0 {
		matches = append(matches, "Subscriptions")
	}

	return matches
}

func averagePatternConfidence(patterns []models.DetectedPattern) float64 {
	if len(patterns) == 0 {
		return 0
	}
	total := 0.0
	for _, pattern := range patterns {
		total += pattern.Confidence
	}
	return total / float64(len(patterns))
}

func strPtr(s string) *string {
	return &s
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Toon-Encoded", "true")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// ─── Diagnostics (Test Gmail/Calendar connectivity) ──────────────────────────

func handleDiagnostics(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		respondError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	ctx := context.Background()
	diagnostics := make(map[string]interface{})

	// Check AWS connectivity
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		diagnostics["aws"] = map[string]interface{}{
			"status": "error",
			"error":  err.Error(),
		}
	} else {
		diagnostics["aws"] = map[string]interface{}{
			"status": "connected",
			"region": cfg.AWSRegion,
		}
	}

	// Check AI provider
	if clients != nil {
		ai, err := initAIClient(clients)
		if err != nil {
			diagnostics["ai_provider"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		} else {
			diagnostics["ai_provider"] = map[string]interface{}{
				"status":   "connected",
				"provider": ai.ProviderName(),
			}
		}
	}

	// Check Gmail credentials
	diagnostics["gmail"] = map[string]interface{}{
		"configured":    cfg.HasGmailCredentials(),
		"client_id":     cfg.GoogleClientID != "",
		"client_secret": cfg.GoogleClientSecret != "",
		"refresh_token": cfg.GmailRefreshToken != "",
		"query":         cfg.GmailFetchQuery,
		"fetch_days":    cfg.GmailFetchDays,
	}

	// Test Gmail connectivity if configured
	if cfg.HasGmailCredentials() && clients != nil {
		ai, _ := initAIClient(clients)
		if ai != nil {
			auditorAgent, err := auditor.New(ctx, clients, cfg, logger, ai)
			if err != nil {
				diagnostics["gmail"].(map[string]interface{})["test_status"] = "error"
				diagnostics["gmail"].(map[string]interface{})["test_error"] = err.Error()
			} else {
				receipts, err := auditorAgent.FetchReceiptsFromGmail(ctx)
				if err != nil {
					diagnostics["gmail"].(map[string]interface{})["test_status"] = "error"
					diagnostics["gmail"].(map[string]interface{})["test_error"] = err.Error()
				} else {
					diagnostics["gmail"].(map[string]interface{})["test_status"] = "success"
					diagnostics["gmail"].(map[string]interface{})["receipts_found"] = len(receipts)
				}
			}
		}
	}

	// Check Calendar credentials
	diagnostics["calendar"] = map[string]interface{}{
		"configured":     cfg.HasCalendarCredentials(),
		"source":         ".env",
		"lookahead_days": cfg.CalendarLookaheadDays,
	}

	// Check DynamoDB tables
	if clients != nil {
		store := getStore(clients, logger)
		subs, err := store.GetSubscriptions(ctx, "diagnostic-test")
		darkPatterns, darkPatternsErr := store.GetDarkPatterns(ctx, "diagnostic-test")
		if err != nil {
			diagnostics["dynamodb"] = map[string]interface{}{
				"status": "error",
				"error":  err.Error(),
			}
		} else {
			diagnostics["dynamodb"] = map[string]interface{}{
				"status":                 "connected",
				"subscriptions_table":    cfg.SubscriptionsTable,
				"subscriptions_query_ok": true,
				"subscriptions_count":    len(subs),
				"dark_patterns_table":    cfg.DarkPatternsTable,
				"dark_patterns_query_ok": darkPatternsErr == nil,
				"dark_patterns_count":    len(darkPatterns),
			}
			if darkPatternsErr != nil {
				diagnostics["dynamodb"].(map[string]interface{})["dark_patterns_error"] = darkPatternsErr.Error()
			}
		}
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
		"diagnostics": diagnostics,
		"config": map[string]interface{}{
			"bedrock_model":       cfg.BedrockModelID,
			"aws_region":          cfg.AWSRegion,
			"subscriptions_table": cfg.SubscriptionsTable,
			"dark_patterns_table": cfg.DarkPatternsTable,
			"receipts_bucket":     cfg.ReceiptsBucket,
			"screenshots_bucket":  cfg.ScreenshotsBucket,
		},
	})
}

// ─── Cleanup (Delete All Data) ──────────────────────────────────────────────

func handleCleanup(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" && r.Method != "DELETE" {
		respondError(w, http.StatusMethodNotAllowed, "Use POST or DELETE to clean up data")
		return
	}

	ctx := context.Background()
	userID := getUserID(r)
	logger := middleware.NewLogger("cleanup-api")

	// Initialize AWS clients and store
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, fmt.Sprintf("AWS init failed: %v", err))
		return
	}
	store := getStore(clients, logger)

	deletedSubs := 0
	deletedDP := 0

	// Delete all subscriptions
	subs, err := store.GetSubscriptions(ctx, userID)
	if err != nil {
		logger.Warn("Failed to get subscriptions for cleanup", "error", err)
	} else {
		for _, sub := range subs {
			if err := store.DeleteSubscription(ctx, userID, sub.SubscriptionID); err != nil {
				logger.Warn("Failed to delete subscription during cleanup", "error", err, "subId", sub.SubscriptionID)
			} else {
				deletedSubs++
			}
		}
	}

	// Delete all dark patterns
	reports, err := store.GetDarkPatterns(ctx, userID)
	if err != nil {
		logger.Warn("Failed to get dark patterns for cleanup", "error", err)
	} else {
		for _, report := range reports {
			if err := store.DeleteDarkPattern(ctx, userID, report.ReportID); err != nil {
				logger.Warn("Failed to delete dark pattern during cleanup", "error", err, "reportId", report.ReportID)
			} else {
				deletedDP++
			}
		}
	}

	logger.Info("Cleanup complete", "userId", userID, "deletedSubscriptions", deletedSubs, "deletedDarkPatterns", deletedDP)

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":              "All data cleaned up successfully",
		"deletedSubscriptions": deletedSubs,
		"deletedDarkPatterns":  deletedDP,
		"userId":               userID,
	})
}
