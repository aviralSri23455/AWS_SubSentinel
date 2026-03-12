// Package main — Subscriptions REST API
//
// Provides CRUD operations for subscription management
// Endpoints:
//
//	GET    /api/subscriptions       - List all subscriptions
//	POST   /api/subscriptions       - Create new subscription
//	GET    /api/subscriptions/:id   - Get subscription by ID
//	PUT    /api/subscriptions/:id   - Update subscription
//	DELETE /api/subscriptions/:id   - Delete subscription
// 🤖 Autopilot Test: This comment was added automatically by Kiro
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/subsentinel/subsentinel/internal/agents/auditor"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/storage"
	"github.com/subsentinel/subsentinel/internal/toon"
)

// handler routes API Gateway requests to appropriate subscription handlers
func handler(ctx context.Context, request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	logger := middleware.NewLogger("subscriptions-api")
	cfg := config.MustLoad()

	logger.Info("API request received",
		"method", request.HTTPMethod,
		"path", request.Path,
		"timestamp", time.Now().UTC().Format(time.RFC3339),
	)

	// Initialize AWS clients (for Lambda mode)
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("Failed to initialize AWS clients", "error", err)
		return middleware.ErrorResponse(500, "Internal server error"), nil
	}

	// Initialize storage - use DynamoDB directly for real-time data
	store := storage.NewDynamoStore(clients, cfg.SubscriptionsTable, cfg.DarkPatternsTable)

	// Route based on HTTP method and path
	userID := request.QueryStringParameters["userId"]
	if userID == "" {
		userID = request.Headers["X-User-ID"]
	}
	if userID == "" {
		userID = "test-user-123" // Default for testing
	}

	switch request.HTTPMethod {
	case "GET":
		if request.PathParameters["id"] != "" {
			return getSubscription(ctx, store, logger, userID, request.PathParameters["id"])
		}
		return listSubscriptions(ctx, store, logger, userID)
	case "POST":
		return createSubscription(ctx, store, logger, userID, request.Body)
	case "PUT":
		return updateSubscription(ctx, store, logger, userID, request.PathParameters["id"], request.Body)
	case "DELETE":
		return deleteSubscription(ctx, store, logger, userID, request.PathParameters["id"])
	default:
		return middleware.ErrorResponse(405, "Method not allowed"), nil
	}
}

// listSubscriptions retrieves all subscriptions for a user
func listSubscriptions(ctx context.Context, store storage.Store, logger *middleware.Logger, userID string) (events.APIGatewayProxyResponse, error) {
	if userID == "" {
		userID = "local-user" // Default for local testing
	}

	subscriptions, err := store.GetSubscriptions(ctx, userID)
	if err != nil {
		logger.Error("Failed to fetch subscriptions", "error", err, "errorMsg", err.Error(), "userId", userID)
		return middleware.ErrorResponse(500, fmt.Sprintf("Failed to fetch subscriptions: %v", err)), nil
	}

	logger.Info("Subscriptions retrieved", "count", len(subscriptions), "userId", userID)
	return middleware.SuccessResponse(map[string]interface{}{
		"subscriptions": subscriptions,
		"count":         len(subscriptions),
		"userId":        userID,
	}), nil
}

// getSubscription retrieves a single subscription by ID
func getSubscription(ctx context.Context, store storage.Store, logger *middleware.Logger, userID, subscriptionID string) (events.APIGatewayProxyResponse, error) {
	subscription, err := store.GetSubscription(ctx, userID, subscriptionID)
	if err != nil {
		logger.Error("Failed to fetch subscription", "error", err, "id", subscriptionID, "userId", userID)
		return middleware.ErrorResponse(404, "Subscription not found"), nil
	}

	logger.Info("Subscription retrieved", "id", subscriptionID, "userId", userID)
	return middleware.SuccessResponse(subscription), nil
}

// createSubscription creates a new subscription
func createSubscription(ctx context.Context, store storage.Store, logger *middleware.Logger, userID, body string) (events.APIGatewayProxyResponse, error) {
	var sub models.Subscription
	if err := json.Unmarshal([]byte(body), &sub); err != nil {
		logger.Error("Invalid request body", "error", err)
		return middleware.ErrorResponse(400, "Invalid request body"), nil
	}

	// Generate ID and timestamps
	sub.SubscriptionID = fmt.Sprintf("sub-%d", time.Now().UnixMilli())
	sub.DetectedAt = time.Now().UTC()
	sub.LastCharge = time.Now().UTC()
	sub.UserID = userID

	// Store in storage
	if err := store.PutSubscription(ctx, &sub); err != nil {
		logger.Error("Failed to create subscription", "error", err)
		return middleware.ErrorResponse(500, "Failed to create subscription"), nil
	}

	logger.Info("Subscription created", "id", sub.SubscriptionID, "provider", sub.Provider, "userId", userID)
	return middleware.SuccessResponse(sub), nil
}

// updateSubscription updates an existing subscription
func updateSubscription(ctx context.Context, store storage.Store, logger *middleware.Logger, userID, subscriptionID, body string) (events.APIGatewayProxyResponse, error) {
	var updates models.Subscription
	if err := json.Unmarshal([]byte(body), &updates); err != nil {
		logger.Error("Invalid request body", "error", err)
		return middleware.ErrorResponse(400, "Invalid request body"), nil
	}

	// Fetch existing subscription
	existing, err := store.GetSubscription(ctx, userID, subscriptionID)
	if err != nil {
		logger.Error("Subscription not found", "error", err, "id", subscriptionID, "userId", userID)
		return middleware.ErrorResponse(404, "Subscription not found"), nil
	}

	// Update fields
	if updates.Amount > 0 {
		existing.Amount = updates.Amount
	}
	if updates.Currency != "" {
		existing.Currency = updates.Currency
	}
	if updates.RenewalDate != "" {
		existing.RenewalDate = updates.RenewalDate
	}
	if updates.Status != "" {
		existing.Status = updates.Status
	}
	if updates.Frequency != "" {
		existing.Frequency = updates.Frequency
	}

	// Store updated subscription
	if err := store.PutSubscription(ctx, existing); err != nil {
		logger.Error("Failed to update subscription", "error", err)
		return middleware.ErrorResponse(500, "Failed to update subscription"), nil
	}

	logger.Info("Subscription updated", "id", subscriptionID, "userId", userID)
	return middleware.SuccessResponse(existing), nil
}

// deleteSubscription deletes a subscription
func deleteSubscription(ctx context.Context, store storage.Store, logger *middleware.Logger, userID, subscriptionID string) (events.APIGatewayProxyResponse, error) {
	if err := store.DeleteSubscription(ctx, userID, subscriptionID); err != nil {
		logger.Error("Failed to delete subscription", "error", err, "id", subscriptionID, "userId", userID)
		return middleware.ErrorResponse(500, "Failed to delete subscription"), nil
	}

	logger.Info("Subscription deleted", "id", subscriptionID, "userId", userID)
	return middleware.SuccessResponse(map[string]interface{}{
		"message": "Subscription deleted successfully",
		"id":      subscriptionID,
	}), nil
}

// isRunningInLambda checks if running in AWS Lambda
func isRunningInLambda() bool {
	return os.Getenv("AWS_LAMBDA_RUNTIME_API") != "" ||
		os.Getenv("_LAMBDA_SERVER_PORT") != "" ||
		os.Getenv("LAMBDA_TASK_ROOT") != ""
}

func main() {
	if isRunningInLambda() {
		lambda.Start(handler)
	} else {
		fmt.Println("═══════════════════════════════════════════════════")
		fmt.Println("  SubSentinel Subscriptions API — LOCAL MODE")
		fmt.Println("  Fetching REAL data from Gmail via Auditor Agent")
		fmt.Println("═══════════════════════════════════════════════════")

		ctx := context.Background()
		cfg := config.MustLoad()
		logger := middleware.NewLogger("subscriptions-api")

		// Use in-memory storage for local development
		store := storage.NewMemoryStore()

		fmt.Println("\n🔍 Initializing Auditor Agent to fetch Gmail receipts...")

		// Initialize AWS clients (needed for Auditor agent)
		clients, err := awswrap.NewClients(ctx, cfg)
		if err != nil {
			fmt.Printf("⚠️  AWS clients init failed: %v\n", err)
			fmt.Println("   Falling back to configured providers from .env")
			clients = nil
		}

		var subscriptions []models.Subscription

		// Try to fetch real data from Gmail using Auditor agent
		if clients != nil && cfg.HasGmailCredentials() {
			// Initialize AI client
			ai, aiErr := aibridge.NewAIClient(cfg, clients.Bedrock)
			if aiErr != nil {
				fmt.Printf("⚠️  AI client init failed: %v\n", aiErr)
			} else {
				auditorAgent, err := auditor.New(ctx, clients, cfg, logger, ai)
				if err != nil {
					fmt.Printf("⚠️  Auditor agent init failed: %v\n", err)
				} else {
					fmt.Println("📧 Fetching receipts from YOUR Gmail inbox...")
					gmailReceipts, err := auditorAgent.FetchReceiptsFromGmail(ctx)
					if err != nil {
						fmt.Printf("⚠️  Gmail fetch failed: %v\n", err)
					} else {
						fmt.Printf("✅ Found %d receipts in Gmail\n\n", len(gmailReceipts))

						// Process each Gmail receipt
						for _, receipt := range gmailReceipts {
							fmt.Printf("   📨 Processing: %s - %s\n", receipt.From, receipt.Subject)

							// Extract receipt data using Textract
							var docBytes []byte
							if len(receipt.Attachments) > 0 {
								docBytes = receipt.Attachments[0].Data
							} else {
								docBytes = []byte(receipt.Body)
							}

							if len(docBytes) == 0 {
								continue
							}

							extractedData, err := auditorAgent.ExtractReceiptData(ctx, docBytes)
							if err != nil {
								fmt.Printf("      ⚠️  Textract failed: %v\n", err)
								continue
							}

							// TOON encode
							toonEncoded, err := toon.Encode(extractedData)
							if err != nil {
								fmt.Printf("      ⚠️  TOON encoding failed: %v\n", err)
								continue
							}

							// Analyze with Bedrock
							subscription, err := auditorAgent.AnalyzeWithBedrock(ctx, toonEncoded)
							if err != nil {
								fmt.Printf("      ⚠️  Bedrock analysis failed: %v\n", err)
								continue
							}

							// Set metadata
							subscription.SubscriptionID = fmt.Sprintf("sub-%d", time.Now().UnixMilli())
							subscription.UserID = "local-user"
							subscription.DetectedAt = time.Now().UTC()
							subscription.LastCharge = time.Now().UTC()

							subscriptions = append(subscriptions, *subscription)
							fmt.Printf("      ✅ %s - $%.2f %s/%s\n", subscription.Provider, subscription.Amount, subscription.Currency, subscription.Frequency)
						}
					}
				}
			}
		}

		// If no Gmail data, show empty
		if len(subscriptions) == 0 {
			fmt.Println("⚠️  No subscriptions found.")
			fmt.Println("   Make sure Gmail credentials are configured in .env:")
			fmt.Println("   - GOOGLE_CLIENT_ID")
			fmt.Println("   - GOOGLE_CLIENT_SECRET")
			fmt.Println("   - GMAIL_REFRESH_TOKEN")
			fmt.Println("\n   Run: go run cmd/oauth/main.go to set up Gmail OAuth")
		}

		// Store subscriptions in memory
		fmt.Println("\n💾 Storing subscriptions in memory...")
		for _, sub := range subscriptions {
			body, _ := json.Marshal(sub)
			_, err := createSubscription(ctx, store, logger, "local-user", string(body))
			if err == nil {
				fmt.Printf("   ✅ %s - $%.2f %s/%s (renews: %s)\n",
					sub.Provider, sub.Amount, sub.Currency, sub.Frequency, sub.RenewalDate)
			} else {
				fmt.Printf("   ⚠️  %s: %v\n", sub.Provider, err)
			}
		}

		// List all subscriptions
		fmt.Println("\n📊 Fetching all subscriptions from memory...")
		response, _ := listSubscriptions(ctx, store, logger, "local-user")

		// Pretty print JSON response
		var result map[string]interface{}
		json.Unmarshal([]byte(response.Body), &result)
		prettyJSON, _ := json.MarshalIndent(result, "", "  ")

		fmt.Println("✅ API Response (JSON):")
		fmt.Println(string(prettyJSON))

		fmt.Println("\n✅ Backend API ready! Subscriptions stored in memory.")
		fmt.Println("   Run frontend to interact with the API.")
	}
}
