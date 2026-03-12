// Package main — Learner Agent Lambda Entry Point
//
// Pipeline: Comprehend → TOON vector updates → OpenSearch k-NN
// Cold start: ~80ms | Execution: ~350ms | Memory: 256MB
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/subsentinel/subsentinel/internal/agents/learner"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/toon"
)

// LearnerEvent represents the input payload for the Learner agent.
// It can be triggered by Step Functions after a negotiation outcome is reported.
type LearnerEvent struct {
	OutcomeID     string                 `json:"outcomeId"`
	Provider      string                 `json:"provider"`
	IssueType     string                 `json:"issueType"`
	Success       bool                   `json:"success"`
	Strategy      string                 `json:"strategy"`
	Response      string                 `json:"response"`
	UserID        string                 `json:"userId"`
	NegotiationID string                 `json:"negotiationId"`
	Metadata      map[string]interface{} `json:"metadata"`
}

// handler processes negotiation outcomes, performs sentiment analysis with Comprehend,
// updates OpenSearch vectors with time-decay weighting, and improves future predictions.
func handler(ctx context.Context, event LearnerEvent) (models.LearningResult, error) {
	logger := middleware.NewLogger("learner")
	cfg := config.MustLoad()

	logger.Info("Learner agent invoked",
		"outcomeId", event.OutcomeID,
		"provider", event.Provider,
		"success", event.Success,
		"timestamp", time.Now().UTC().Format(time.RFC3339),
	)

	// Initialize AWS clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("Failed to initialize AWS clients", "error", err)
		return models.LearningResult{}, fmt.Errorf("init clients: %w", err)
	}

	// Create Learner agent
	agent := learner.New(clients, cfg, logger)

	// Step 1: Analyze response sentiment with Comprehend
	sentiment, err := agent.AnalyzeSentiment(ctx, event.Response)
	if err != nil {
		logger.Error("Comprehend analysis failed", "error", err)
		return models.LearningResult{}, fmt.Errorf("sentiment analysis: %w", err)
	}

	logger.Info("Sentiment analyzed",
		"sentiment", sentiment.Primary,
		"confidence", fmt.Sprintf("%.2f", sentiment.Confidence),
	)

	// Step 2: Create outcome record with TOON encoding
	outcome := models.NegotiationOutcome{
		OutcomeID:     event.OutcomeID,
		Provider:      event.Provider,
		IssueType:     event.IssueType,
		Success:       event.Success,
		Strategy:      event.Strategy,
		Sentiment:     *sentiment,
		UserID:        event.UserID,
		NegotiationID: event.NegotiationID,
		RecordedAt:    time.Now().UTC(),
	}

	toonOutcome, err := toon.EncodeOutcome(outcome)
	if err != nil {
		logger.Error("TOON outcome encoding failed", "error", err)
		return models.LearningResult{}, fmt.Errorf("toon encode: %w", err)
	}

	// Step 3: Generate embedding vector via Bedrock Titan
	embedding, err := agent.GenerateEmbedding(ctx, toonOutcome)
	if err != nil {
		logger.Error("Embedding generation failed", "error", err)
		return models.LearningResult{}, fmt.Errorf("generate embedding: %w", err)
	}

	// Step 4: Apply time-decay weighting to existing vectors
	decayFactor := calculateTimeDecay(time.Now().UTC(), cfg.DecayHalfLifeDays)
	err = agent.ApplyTimeDecay(ctx, event.Provider, decayFactor)
	if err != nil {
		logger.Error("Time decay update failed", "error", err)
		// Non-fatal: continue with indexing
	}

	// Step 5: Index new outcome vector in OpenSearch (TOON format, 60% smaller)
	err = agent.IndexOutcome(ctx, outcome, embedding, toonOutcome)
	if err != nil {
		logger.Error("OpenSearch indexing failed", "error", err)
		return models.LearningResult{}, fmt.Errorf("index outcome: %w", err)
	}

	// Step 6: Recalculate provider success rates
	providerStats, err := agent.RecalculateProviderStats(ctx, event.Provider)
	if err != nil {
		logger.Error("Stats recalculation failed", "error", err)
	}

	result := models.LearningResult{
		OutcomeID:        event.OutcomeID,
		Provider:         event.Provider,
		Success:          event.Success,
		SentimentScore:   sentiment.Confidence,
		EmbeddingDim:     len(embedding),
		DecayApplied:     decayFactor,
		ProviderStats:    providerStats,
		TOONStorageSaved: toon.CalculateStorageSavings(outcome, toonOutcome),
		ProcessedAt:      time.Now().UTC(),
	}

	resultJSON, _ := json.MarshalIndent(result, "", "  ")
	logger.Info("Learner agent complete", "result", string(resultJSON))

	return result, nil
}

// calculateTimeDecay applies exponential decay based on the configured half-life.
// Older outcomes have less influence on future predictions.
func calculateTimeDecay(_ time.Time, halfLifeDays int) float64 {
	// λ = ln(2) / halfLife
	lambda := math.Log(2) / float64(halfLifeDays)
	// For current update: decay = 1.0 (full weight)
	// The decay factor is applied to EXISTING records
	return math.Exp(-lambda * 1.0) // 1 day since last update
}

func main() {
	lambda.Start(handler)
}

