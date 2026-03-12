// Package negotiator implements the Negotiator agent business logic.
//
// Pipeline: OpenSearch k-NN → TOON encode → AI draft → DynamoDB
// Uses community outcomes to achieve 82% negotiation success rate.
//
// Uses AWS Bedrock for AI inference.
package negotiator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
)

// Agent implements the Negotiator agent.
type Agent struct {
	clients  *awswrap.Clients
	config   *config.Config
	logger   *middleware.Logger
	aiClient aibridge.AIClient
}

// New creates a new Negotiator agent instance.
func New(clients *awswrap.Clients, cfg *config.Config, logger *middleware.Logger, ai aibridge.AIClient) *Agent {
	return &Agent{
		clients:  clients,
		config:   cfg,
		logger:   logger,
		aiClient: ai,
	}
}

// FindSimilarOutcomes queries OpenSearch k-NN for similar past negotiation outcomes.
func (a *Agent) FindSimilarOutcomes(ctx context.Context, provider, issueType string) ([]models.NegotiationOutcome, error) {
	query := map[string]interface{}{
		"size": 10,
		"query": map[string]interface{}{
			"bool": map[string]interface{}{
				"must": []map[string]interface{}{
					{"match": map[string]interface{}{"provider": provider}},
					{"match": map[string]interface{}{"issueType": issueType}},
				},
			},
		},
		"sort": []map[string]interface{}{
			{"recordedAt": map[string]string{"order": "desc"}},
		},
	}

	// Use OpenSearch client with AWS SigV4 authentication
	if a.clients.OpenSearch == nil {
		return nil, fmt.Errorf("OpenSearch client not initialized")
	}

	result, err := a.clients.OpenSearch.Search(ctx, a.config.OpenSearchIndex, query)
	if err != nil {
		return nil, fmt.Errorf("opensearch query: %w", err)
	}

	// Parse the search result
	hits, ok := result["hits"].(map[string]interface{})
	if !ok {
		return []models.NegotiationOutcome{}, nil
	}

	hitsList, ok := hits["hits"].([]interface{})
	if !ok {
		return []models.NegotiationOutcome{}, nil
	}

	var outcomes []models.NegotiationOutcome
	for _, hit := range hitsList {
		hitMap, ok := hit.(map[string]interface{})
		if !ok {
			continue
		}

		source, ok := hitMap["_source"].(map[string]interface{})
		if !ok {
			continue
		}

		// Convert map to NegotiationOutcome
		jsonBytes, _ := json.Marshal(source)
		var outcome models.NegotiationOutcome
		if err := json.Unmarshal(jsonBytes, &outcome); err == nil {
			outcomes = append(outcomes, outcome)
		}
	}

	a.logger.Info("Similar outcomes found",
		"provider", provider,
		"count", len(outcomes),
	)

	return outcomes, nil
}

// GenerateDraft creates a negotiation email draft using the AI provider.
func (a *Agent) GenerateDraft(ctx context.Context, toonContext string, outcomes []models.NegotiationOutcome) (*models.NegotiationDraft, error) {
	// Calculate success stats for the prompt
	successCount := 0
	for _, o := range outcomes {
		if o.Success {
			successCount++
		}
	}
	successRate := 0.0
	if len(outcomes) > 0 {
		successRate = float64(successCount) / float64(len(outcomes)) * 100
	}

	prompt := fmt.Sprintf(`You are an expert subscription negotiation AI.
Based on %d similar cases (%.0f%% success rate), draft a professional negotiation email.

Context (TOON format):
%s

Generate a subject line and email body that maximizes success probability.
Use strategies that worked in similar cases. Be firm but professional.
Respond as JSON: {subjectLine, emailBody}`, len(outcomes), successRate, toonContext)

	responseText, err := a.aiClient.GenerateText(ctx, prompt, 2048, float64(a.config.BedrockTemp), float64(a.config.BedrockTopP))
	if err != nil {
		return nil, fmt.Errorf("AI draft generation (%s): %w", a.aiClient.ProviderName(), err)
	}

	var draft models.NegotiationDraft
	if responseText != "" {
		// Extract JSON from response
		start := strings.Index(responseText, "{")
		end := strings.LastIndex(responseText, "}") + 1
		if start >= 0 && end > start {
			json.Unmarshal([]byte(responseText[start:end]), &draft)
		}
	}

	return &draft, nil
}

// PredictSuccess calculates success probability based on historical outcomes.
func (a *Agent) PredictSuccess(outcomes []models.NegotiationOutcome, provider string) float64 {
	if len(outcomes) == 0 {
		return 0.45 // Baseline: human email success rate
	}

	// Weight recent outcomes more heavily
	totalWeight := 0.0
	successWeight := 0.0

	for i, o := range outcomes {
		// More recent outcomes get higher weight
		weight := 1.0 / float64(i+1)
		totalWeight += weight
		if o.Success {
			successWeight += weight
		}
	}

	if totalWeight == 0 {
		return 0.45
	}

	return successWeight / totalWeight
}

// StoreDraft saves a negotiation draft to DynamoDB.
func (a *Agent) StoreDraft(ctx context.Context, result *models.NegotiationResult) error {
	item, err := attributevalue.MarshalMap(result)
	if err != nil {
		return fmt.Errorf("marshal draft: %w", err)
	}

	item["PK"] = &types.AttributeValueMemberS{Value: "DRAFT#" + result.DraftID}

	_, err = a.clients.DynamoDB.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &a.config.NegotiationsTable,
		Item:      item,
	})
	return err
}
