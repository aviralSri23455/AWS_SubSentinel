// Package google provides real-time Google API clients for SubSentinel.
// This file contains the Google Calendar API client for detecting
// real life events from YOUR actual Google Calendar.
package google

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/option"

	"github.com/subsentinel/subsentinel/internal/config"
)

// CalendarClient wraps the real Google Calendar API client.
// Connects to YOUR actual Google Calendar — detects vacations,
// relocations, job changes, and other life events.
type CalendarClient struct {
	service *calendar.Service
	config  *config.Config
}

// NewCalendarClient creates a real Google Calendar API client using OAuth.
// Connects to YOUR actual Google Calendar — no Secrets Manager, just .env config.
func NewCalendarClient(ctx context.Context, cfg *config.Config) (*CalendarClient, error) {
	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" {
		return nil, fmt.Errorf("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required in .env")
	}

	oauthConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		Endpoint:     google.Endpoint,
		RedirectURL:  cfg.GoogleRedirectURI,
		Scopes:       []string{calendar.CalendarReadonlyScope},
	}

	if cfg.CalendarRefreshToken == "" {
		return nil, fmt.Errorf("CALENDAR_REFRESH_TOKEN required in .env — run: go run cmd/oauth/main.go")
	}

	token := &oauth2.Token{
		RefreshToken: cfg.CalendarRefreshToken,
	}

	httpClient := oauthConfig.Client(ctx, token)
	service, err := calendar.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("failed to create Calendar service: %w", err)
	}

	return &CalendarClient{
		service: service,
		config:  cfg,
	}, nil
}

// CalendarEvent represents a parsed event from YOUR Google Calendar.
type CalendarEvent struct {
	EventID     string
	Title       string
	StartTime   time.Time
	EndTime     time.Time
	Location    string
	Description string
	IsAllDay    bool
	Duration    float64 // Duration in days
}

// LifeEventSuggestion represents a detected life event with optimization suggestion.
type LifeEventSuggestion struct {
	EventType    string // vacation, relocation, job_change, family
	EventTitle   string
	StartDate    string
	EndDate      string
	DurationDays int
	Location     string
	Suggestion   string
	Savings      float64
}

// FetchUpcomingEvents fetches real events from YOUR Google Calendar.
// Uses CALENDAR_LOOKAHEAD_DAYS from .env to determine the time range.
func (c *CalendarClient) FetchUpcomingEvents(ctx context.Context) ([]CalendarEvent, error) {
	now := time.Now()
	future := now.AddDate(0, 0, c.config.CalendarLookaheadDays)

	events, err := c.service.Events.List("primary").
		TimeMin(now.Format(time.RFC3339)).
		TimeMax(future.Format(time.RFC3339)).
		SingleEvents(true).
		OrderBy("startTime").
		MaxResults(250).
		Do()
	if err != nil {
		return nil, fmt.Errorf("Calendar API list events: %w", err)
	}

	var results []CalendarEvent
	for _, item := range events.Items {
		event := CalendarEvent{
			EventID:     item.Id,
			Title:       item.Summary,
			Location:    item.Location,
			Description: item.Description,
		}

		// Parse start/end times
		if item.Start.DateTime != "" {
			event.StartTime, _ = time.Parse(time.RFC3339, item.Start.DateTime)
			event.IsAllDay = false
		} else if item.Start.Date != "" {
			event.StartTime, _ = time.Parse("2006-01-02", item.Start.Date)
			event.IsAllDay = true
		}

		if item.End.DateTime != "" {
			event.EndTime, _ = time.Parse(time.RFC3339, item.End.DateTime)
		} else if item.End.Date != "" {
			event.EndTime, _ = time.Parse("2006-01-02", item.End.Date)
		}

		// Calculate duration in days
		event.Duration = event.EndTime.Sub(event.StartTime).Hours() / 24

		results = append(results, event)
	}

	return results, nil
}

// DetectLifeEvents identifies significant life events from YOUR calendar.
// Returns vacation (7+ days), relocation, job changes, and family events.
func (c *CalendarClient) DetectLifeEvents(ctx context.Context) ([]LifeEventSuggestion, error) {
	events, err := c.FetchUpcomingEvents(ctx)
	if err != nil {
		return nil, err
	}

	var lifeEvents []LifeEventSuggestion

	for _, event := range events {
		// Detect vacations (7+ day events)
		if event.Duration >= 7.0 {
			lifeEvents = append(lifeEvents, LifeEventSuggestion{
				EventType:    "vacation",
				EventTitle:   event.Title,
				StartDate:    event.StartTime.Format("2006-01-02"),
				EndDate:      event.EndTime.Format("2006-01-02"),
				DurationDays: int(event.Duration),
				Location:     event.Location,
				Suggestion:   fmt.Sprintf("Pause gym/streaming during %d-day vacation. Estimated savings: $44+", int(event.Duration)),
				Savings:      44.0,
			})
		}

		// Detect relocations (look for keywords in title/description)
		if containsAny(event.Title+event.Description, []string{
			"moving", "relocation", "new apartment", "new house",
			"move out", "move in", "packing", "movers",
		}) {
			lifeEvents = append(lifeEvents, LifeEventSuggestion{
				EventType:    "relocation",
				EventTitle:   event.Title,
				StartDate:    event.StartTime.Format("2006-01-02"),
				EndDate:      event.EndTime.Format("2006-01-02"),
				DurationDays: int(event.Duration),
				Location:     event.Location,
				Suggestion:   "Review location-based subscriptions. Cancel gym if changing cities. Update streaming region.",
				Savings:      120.0,
			})
		}

		// Detect job changes
		if containsAny(event.Title+event.Description, []string{
			"first day", "new job", "start date", "onboarding",
			"interview", "orientation", "resignation",
		}) {
			lifeEvents = append(lifeEvents, LifeEventSuggestion{
				EventType:    "job_change",
				EventTitle:   event.Title,
				StartDate:    event.StartTime.Format("2006-01-02"),
				EndDate:      event.EndTime.Format("2006-01-02"),
				DurationDays: int(event.Duration),
				Location:     event.Location,
				Suggestion:   "Check if new employer provides subscriptions (LinkedIn Premium, Adobe, etc). Cancel duplicates.",
				Savings:      200.0,
			})
		}

		// Detect family events
		if containsAny(event.Title+event.Description, []string{
			"wedding", "baby", "birth", "family reunion",
			"graduation", "anniversary",
		}) {
			lifeEvents = append(lifeEvents, LifeEventSuggestion{
				EventType:    "family",
				EventTitle:   event.Title,
				StartDate:    event.StartTime.Format("2006-01-02"),
				EndDate:      event.EndTime.Format("2006-01-02"),
				DurationDays: int(event.Duration),
				Location:     event.Location,
				Suggestion:   "Consider family plans for streaming services. Review insurance subscriptions.",
				Savings:      60.0,
			})
		}
	}

	return lifeEvents, nil
}

// containsAny checks if the text contains any of the keywords (case-insensitive).
func containsAny(text string, keywords []string) bool {
	lowerText := toLower(text)
	for _, kw := range keywords {
		if contains(lowerText, toLower(kw)) {
			return true
		}
	}
	return false
}

// toLower converts a string to lowercase.
func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result[i] = c + ('a' - 'A')
		} else {
			result[i] = c
		}
	}
	return string(result)
}

// contains checks if s contains substr.
func contains(s, substr string) bool {
	if len(substr) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
