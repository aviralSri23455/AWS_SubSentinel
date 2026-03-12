// Test Google Calendar Integration
// Verifies that SubSentinel can detect life events from YOUR real calendar
//
// Usage:
//
//	go run cmd/test-calendar/main.go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/google"
)

func main() {
	fmt.Println("📅 SubSentinel Calendar Integration Test")
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()

	// Load config
	cfg := config.MustLoad()

	// Validate Calendar credentials
	if !cfg.HasCalendarCredentials() {
		log.Fatal("❌ Calendar credentials not configured\n" +
			"   Calendar OAuth is now loaded from .env\n" +
			"   Check CALENDAR_REFRESH_TOKEN in .env")
	}

	fmt.Println("✅ Calendar credentials configured (.env)")
	fmt.Printf("   Lookahead: %d days\n", cfg.CalendarLookaheadDays)
	fmt.Println()

	ctx := context.Background()

	// Create real Google Calendar client
	calClient, err := google.NewCalendarClient(ctx, cfg)
	if err != nil {
		log.Fatalf("❌ Failed to create Calendar client: %v", err)
	}

	fmt.Println("✅ Calendar client created successfully")
	fmt.Println()
	fmt.Println("🔍 Fetching events from YOUR Google Calendar...")
	fmt.Println()

	// Fetch upcoming events
	events, err := calClient.FetchUpcomingEvents(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to fetch events: %v", err)
	}

	fmt.Printf("✅ Found %d events in the next %d days\n", len(events), cfg.CalendarLookaheadDays)
	fmt.Println()

	if len(events) == 0 {
		fmt.Println("💡 No events found. This could mean:")
		fmt.Println("   - No events scheduled in the next 90 days")
		fmt.Println("   - Calendar is empty")
		fmt.Println("   - Try adding a test event to your calendar")
		return
	}

	// Detect life events
	fmt.Println("🔍 Analyzing events for life event patterns...")
	fmt.Println()

	lifeEvents, err := calClient.DetectLifeEvents(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to detect life events: %v", err)
	}

	if len(lifeEvents) == 0 {
		fmt.Println("💡 No significant life events detected")
		fmt.Println("   Life events include:")
		fmt.Println("   - Vacations (7+ days)")
		fmt.Println("   - Relocations (moving, new apartment)")
		fmt.Println("   - Job changes (first day, new job)")
		fmt.Println("   - Family events (wedding, baby, graduation)")
		fmt.Println()
		fmt.Println("📋 Showing all events:")
		fmt.Println()

		displayCount := len(events)
		if displayCount > 10 {
			displayCount = 10
		}

		for i := 0; i < displayCount; i++ {
			event := events[i]
			fmt.Printf("%d. %s\n", i+1, event.Title)
			fmt.Printf("   Date: %s to %s (%.1f days)\n",
				event.StartTime.Format("Jan 2, 2006"),
				event.EndTime.Format("Jan 2, 2006"),
				event.Duration)
			if event.Location != "" {
				fmt.Printf("   Location: %s\n", event.Location)
			}
			fmt.Println()
		}

		if len(events) > 10 {
			fmt.Printf("... and %d more events\n", len(events)-10)
		}
		return
	}

	// Display detected life events
	fmt.Println("=" + repeat("=", 49))
	fmt.Printf("🎯 Detected %d Life Events:\n", len(lifeEvents))
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()

	for i, event := range lifeEvents {
		icon := getEventIcon(event.EventType)
		fmt.Printf("%d. %s %s: %s\n", i+1, icon, event.EventType, event.EventTitle)
		fmt.Printf("   Dates: %s to %s (%d days)\n", event.StartDate, event.EndDate, event.DurationDays)
		if event.Location != "" {
			fmt.Printf("   Location: %s\n", event.Location)
		}
		fmt.Printf("   💡 Suggestion: %s\n", event.Suggestion)
		fmt.Printf("   💰 Estimated Savings: $%.2f\n", event.Savings)
		fmt.Println()
	}

	fmt.Println("=" + repeat("=", 49))
	fmt.Println("✅ Calendar integration working!")
	fmt.Println()
	fmt.Println("📋 Next steps:")
	fmt.Println("   1. These events will be processed by Calendar Reasoner Agent")
	fmt.Println("   2. Bedrock generates personalized optimization suggestions")
	fmt.Println("   3. Suggestions stored in DynamoDB for user review")
	fmt.Println()
}

func getEventIcon(eventType string) string {
	switch eventType {
	case "vacation":
		return "🏖️"
	case "relocation":
		return "🏠"
	case "job_change":
		return "💼"
	case "family":
		return "👨‍👩‍👧‍👦"
	default:
		return "📅"
	}
}

func repeat(s string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += s
	}
	return result
}
