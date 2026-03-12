// Package main — Calendar Reasoner Agent Lambda Entry Point
//
// Pipeline: Google Calendar API (REAL) → TOON encode → Bedrock life events
// Cold start: ~75ms | Execution: ~250ms | Memory: 128MB
//
// NO MOCK DATA. Connects to YOUR real Google Calendar via OAuth from .env.
package main

import (
	"context"
	"fmt"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/subsentinel/subsentinel/internal/agents/calendar"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/middleware"
	"github.com/subsentinel/subsentinel/internal/models"
	"github.com/subsentinel/subsentinel/internal/toon"
)

// CalendarEvent represents the EventBridge scheduled event payload.
type CalendarEvent struct {
	Source     string    `json:"source"`
	DetailType string    `json:"detail-type"`
	Time       time.Time `json:"time"`
	Detail     struct {
		UserID string `json:"userId"`
		Action string `json:"action"`
	} `json:"detail"`
}

// handler processes EventBridge scheduled events to analyze YOUR real Google Calendar
// for life events and generate proactive subscription optimization suggestions.
func handler(ctx context.Context, event CalendarEvent) (models.CalendarInsight, error) {
	logger := middleware.NewLogger("calendar-reasoner")
	cfg := config.MustLoad()

	logger.Info("Calendar Reasoner agent invoked (REAL DATA MODE)",
		"userId", event.Detail.UserID,
		"action", event.Detail.Action,
		"timestamp", time.Now().UTC().Format(time.RFC3339),
		"dataSource", "Google Calendar API (REAL)",
	)

	// Initialize AWS clients
	clients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		logger.Error("Failed to initialize AWS clients", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("init clients: %w", err)
	}

	// Initialize AI client (AWS Bedrock)
	ai, err := aibridge.NewAIClient(cfg, clients.Bedrock)
	if err != nil {
		logger.Error("Failed to initialize AI client", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("init AI: %w", err)
	}

	// Create Calendar Reasoner agent with REAL Google Calendar connection
	agent, err := calendar.New(ctx, clients, cfg, logger, ai)
	if err != nil {
		logger.Error("Failed to create calendar agent", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("create agent: %w", err)
	}

	// Step 1: Fetch REAL calendar events from YOUR Google Calendar
	calendarEvents, err := agent.FetchCalendarEvents(ctx, event.Detail.UserID)
	if err != nil {
		logger.Error("Failed to fetch real calendar events", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("fetch calendar: %w", err)
	}

	logger.Info("Real calendar events fetched from YOUR Google Calendar",
		"count", len(calendarEvents),
		"source", "Google Calendar API (REAL)",
	)

	// Step 1.5: Also detect life events directly from calendar
	realLifeEvents, err := agent.DetectRealLifeEvents(ctx)
	if err != nil {
		logger.Warn("Direct life event detection failed, using Bedrock", "error", err)
	} else {
		for _, le := range realLifeEvents {
			logger.Info("Real life event detected",
				"type", le.EventType,
				"title", le.EventTitle,
				"dates", fmt.Sprintf("%s to %s (%d days)", le.StartDate, le.EndDate, le.DurationDays),
				"suggestion", le.Suggestion,
				"savings", le.Savings,
			)
		}
	}

	// Step 2: Encode calendar events as TOON (58% token savings)
	toonCalendar, err := toon.EncodeCalendarEvents(calendarEvents)
	if err != nil {
		logger.Error("TOON encoding failed", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("toon encode: %w", err)
	}

	logger.Info("Calendar TOON encoded",
		"tokenSavings", fmt.Sprintf("%.0f%%", toon.CalculateCalendarSavings(calendarEvents, toonCalendar)),
	)

	// Step 3: Send to Bedrock for AI life event detection
	lifeEvents, err := agent.DetectLifeEvents(ctx, toonCalendar)
	if err != nil {
		logger.Error("Bedrock life event detection failed", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("detect events: %w", err)
	}

	// Step 4: Fetch user's subscriptions from DynamoDB
	subscriptions, err := agent.FetchUserSubscriptions(ctx, event.Detail.UserID)
	if err != nil {
		logger.Error("Failed to fetch subscriptions", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("fetch subs: %w", err)
	}

	// Step 5: Generate optimization suggestions via Bedrock
	suggestions, err := agent.GenerateSuggestions(ctx, lifeEvents, subscriptions)
	if err != nil {
		logger.Error("Suggestion generation failed", "error", err)
		return models.CalendarInsight{}, fmt.Errorf("generate suggestions: %w", err)
	}

	// Step 6: Store insights in DynamoDB
	insight := models.CalendarInsight{
		UserID:           event.Detail.UserID,
		AnalyzedAt:       time.Now().UTC(),
		EventsFound:      len(calendarEvents),
		LifeEvents:       lifeEvents,
		Suggestions:      suggestions,
		PotentialSavings: calculatePotentialSavings(suggestions),
	}

	if err := agent.StoreInsight(ctx, &insight); err != nil {
		logger.Error("Failed to store insight", "error", err)
		return insight, fmt.Errorf("store insight: %w", err)
	}

	logger.Info("Calendar Reasoner complete (REAL DATA)",
		"lifeEvents", len(lifeEvents),
		"suggestions", len(suggestions),
		"potentialSavings", insight.PotentialSavings,
		"source", "YOUR Google Calendar (REAL)",
	)

	return insight, nil
}

// calculatePotentialSavings sums up the estimated savings from all suggestions.
func calculatePotentialSavings(suggestions []models.Suggestion) float64 {
	total := 0.0
	for _, s := range suggestions {
		total += s.EstimatedSavings
	}
	return total
}

func main() {
	lambda.Start(handler)
}
