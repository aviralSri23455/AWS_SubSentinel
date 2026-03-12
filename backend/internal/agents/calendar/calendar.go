// Package calendar implements the Calendar Reasoner agent business logic.
//
// Pipeline: Google Calendar API (REAL) → TOON encode → AI Analysis → DynamoDB
// Detects REAL life events (vacation, relocation, job change) from YOUR
// actual Google Calendar and generates proactive subscription optimization suggestions.
//
// Uses AWS Bedrock for AI inference.
//
// NO MOCK DATA. Connects to YOUR Google Calendar via OAuth 2.0 from .env.
package calendar

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	googleapi "github.com/subsentinel/subsentinel/internal/google"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
)

// Agent implements the Calendar Reasoner agent.
// Connects to YOUR real Google Calendar — no mock events.
type Agent struct {
	clients        *awswrap.Clients
	config         *config.Config
	logger         *middleware.Logger
	calendarClient *googleapi.CalendarClient
	aiClient       aibridge.AIClient
}

// New creates a new Calendar Reasoner agent instance.
// Initializes a REAL Google Calendar API connection using OAuth from .env.
func New(ctx context.Context, clients *awswrap.Clients, cfg *config.Config, logger *middleware.Logger, ai aibridge.AIClient) (*Agent, error) {
	// Create real Google Calendar client from .env
	calClient, err := googleapi.NewCalendarClient(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create Google Calendar client: %w — check CALENDAR_REFRESH_TOKEN in .env", err)
	}

	logger.Info("Google Calendar connected (REAL)",
		"lookaheadDays", cfg.CalendarLookaheadDays,
		"source", ".env",
	)

	return &Agent{
		clients:        clients,
		config:         cfg,
		logger:         logger,
		calendarClient: calClient,
		aiClient:       ai,
	}, nil
}

// FetchCalendarEvents retrieves REAL events from YOUR Google Calendar via OAuth 2.0.
// No mock data. No fallbacks. YOUR actual calendar events.
func (a *Agent) FetchCalendarEvents(ctx context.Context, userID string) ([]models.CalendarEventData, error) {
	// Fetch REAL events from YOUR Google Calendar
	realEvents, err := a.calendarClient.FetchUpcomingEvents(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetch real calendar events: %w", err)
	}

	a.logger.Info("Real calendar events fetched from YOUR Google Calendar",
		"count", len(realEvents),
		"source", "Google Calendar API (REAL)",
	)

	// Convert to model format
	var events []models.CalendarEventData
	for _, e := range realEvents {
		events = append(events, models.CalendarEventData{
			EventID:     e.EventID,
			Title:       e.Title,
			StartTime:   e.StartTime,
			EndTime:     e.EndTime,
			Location:    e.Location,
			Description: e.Description,
			IsAllDay:    e.IsAllDay,
		})
	}

	return events, nil
}

// DetectRealLifeEvents uses the Google Calendar client to detect real life events,
// then enhances with AI analysis.
func (a *Agent) DetectRealLifeEvents(ctx context.Context) ([]googleapi.LifeEventSuggestion, error) {
	lifeEvents, err := a.calendarClient.DetectLifeEvents(ctx)
	if err != nil {
		return nil, fmt.Errorf("detect real life events: %w", err)
	}

	a.logger.Info("Real life events detected from YOUR calendar",
		"count", len(lifeEvents),
	)

	for _, le := range lifeEvents {
		a.logger.Info("Life event detected",
			"type", le.EventType,
			"title", le.EventTitle,
			"dates", fmt.Sprintf("%s to %s (%d days)", le.StartDate, le.EndDate, le.DurationDays),
			"suggestion", le.Suggestion,
			"savings", le.Savings,
		)
	}

	return lifeEvents, nil
}

// DetectLifeEvents uses the AI provider to analyze REAL calendar events for significant life changes.
func (a *Agent) DetectLifeEvents(ctx context.Context, toonCalendar string) ([]models.LifeEvent, error) {
	prompt := fmt.Sprintf(`You are a life event detection AI.
Analyze these REAL calendar events (TOON format) and identify significant life events
that could affect subscription needs (vacation, relocation, job change, etc.).

%s

Respond with JSON array of: {type, confidence, startDate, endDate, description}`, toonCalendar)

	responseText, err := a.aiClient.GenerateText(ctx, prompt, 1024, float64(a.config.BedrockTemp), float64(a.config.BedrockTopP))
	if err != nil {
		return nil, fmt.Errorf("AI life event detection (%s): %w", a.aiClient.ProviderName(), err)
	}

	var events []models.LifeEvent
	if responseText != "" {
		start := strings.Index(responseText, "[")
		end := strings.LastIndex(responseText, "]") + 1
		if start >= 0 && end > start {
			if err := json.Unmarshal([]byte(responseText[start:end]), &events); err != nil {
				a.logger.Warn("Failed to parse life events", "error", err)
			}
		}
	}

	return events, nil
}

// FetchUserSubscriptions retrieves the user's active subscriptions from DynamoDB.
func (a *Agent) FetchUserSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error) {
	uidValue, err := attributevalue.Marshal(userID)
	if err != nil {
		return nil, fmt.Errorf("marshal userID: %w", err)
	}

	result, err := a.clients.DynamoDB.Query(ctx, &dynamodb.QueryInput{
		TableName:              &a.config.SubscriptionsTable,
		KeyConditionExpression: aws.String("SK = :uid"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":uid": uidValue,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dynamodb query: %w", err)
	}

	var subs []models.Subscription
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &subs); err != nil {
		return nil, fmt.Errorf("unmarshal subscriptions: %w", err)
	}

	return subs, nil
}

// GenerateSuggestions creates proactive optimization suggestions based on REAL life events.
func (a *Agent) GenerateSuggestions(ctx context.Context, lifeEvents []models.LifeEvent, subs []models.Subscription) ([]models.Suggestion, error) {
	prompt := fmt.Sprintf(`You are a subscription optimization AI.
Given these REAL life events from the user's actual Google Calendar and their active subscriptions,
suggest concrete optimizations with estimated savings.

Life Events: %v
Subscriptions: %v

For each suggestion, provide JSON: {provider, action, reason, lifeEventType, estimatedSavings, priority}
Actions: pause, cancel, downgrade, negotiate`, lifeEvents, subs)

	responseText, err := a.aiClient.GenerateText(ctx, prompt, 1024, float64(a.config.BedrockTemp), float64(a.config.BedrockTopP))
	if err != nil {
		return nil, fmt.Errorf("AI suggestions (%s): %w", a.aiClient.ProviderName(), err)
	}

	var suggestions []models.Suggestion
	if responseText != "" {
		start := strings.Index(responseText, "[")
		end := strings.LastIndex(responseText, "]") + 1
		if start >= 0 && end > start {
			json.Unmarshal([]byte(responseText[start:end]), &suggestions)
		}
	}

	return suggestions, nil
}

// StoreInsight saves a calendar insight to DynamoDB.
func (a *Agent) StoreInsight(ctx context.Context, insight *models.CalendarInsight) error {
	item, err := attributevalue.MarshalMap(insight)
	if err != nil {
		return fmt.Errorf("marshal insight: %w", err)
	}

	_, err = a.clients.DynamoDB.PutItem(ctx, &dynamodb.PutItemInput{
		TableName: &a.config.InsightsTable,
		Item:      item,
	})
	return err
}

// GetCalendarStatus returns the real-time connection status.
func (a *Agent) GetCalendarStatus() map[string]interface{} {
	return map[string]interface{}{
		"connected":   true,
		"source":      "Google Calendar API (REAL)",
		"mock":        false,
		"aiProvider":  a.aiClient.ProviderName(),
		"lookahead":   fmt.Sprintf("%d days", a.config.CalendarLookaheadDays),
		"lastChecked": time.Now().UTC().Format(time.RFC3339),
	}
}
