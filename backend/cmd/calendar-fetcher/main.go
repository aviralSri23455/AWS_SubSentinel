// Calendar Fetcher Lambda
// Scheduled Lambda that detects life events from YOUR Google Calendar
//
// Trigger: EventBridge (daily at 9 AM)
// Output: Stores life events in DynamoDB, invokes Calendar Reasoner
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"

	awsclients "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/google"
)

type CalendarFetcherEvent struct {
	// EventBridge scheduled event (empty payload)
	UserID string `json:"user_id,omitempty"` // Optional: specific user
}

type CalendarFetcherResponse struct {
	EventsFetched      int      `json:"events_fetched"`
	LifeEventsDetected int      `json:"life_events_detected"`
	LifeEvents         []string `json:"life_events"`
	Error              string   `json:"error,omitempty"`
}

// LifeEventRecord represents a life event stored in DynamoDB
type LifeEventRecord struct {
	PK           string  `dynamodbav:"PK"`         // USER#<user_id>
	SK           string  `dynamodbav:"SK"`         // LIFEEVENT#<event_id>
	EventType    string  `dynamodbav:"event_type"` // vacation, relocation, job_change, family
	EventTitle   string  `dynamodbav:"event_title"`
	StartDate    string  `dynamodbav:"start_date"`
	EndDate      string  `dynamodbav:"end_date"`
	DurationDays int     `dynamodbav:"duration_days"`
	Location     string  `dynamodbav:"location,omitempty"`
	Suggestion   string  `dynamodbav:"suggestion"`
	Savings      float64 `dynamodbav:"savings"`
	DetectedAt   string  `dynamodbav:"detected_at"`
	Status       string  `dynamodbav:"status"` // pending, accepted, rejected
}

func handler(ctx context.Context, event CalendarFetcherEvent) (CalendarFetcherResponse, error) {
	log.Println("🚀 Calendar Fetcher Lambda started")

	// Load config
	cfg := config.MustLoad()

	// Validate Calendar credentials
	if !cfg.HasCalendarCredentials() {
		return CalendarFetcherResponse{
			Error: "Calendar credentials not configured in AWS Secrets Manager",
		}, fmt.Errorf("missing Calendar OAuth credentials in AWS Secrets Manager")
	}

	// Create AWS clients
	awsClients, err := awsclients.NewClients(ctx, cfg)
	if err != nil {
		return CalendarFetcherResponse{
			Error: fmt.Sprintf("Failed to create AWS clients: %v", err),
		}, err
	}

	// Create Calendar client
	client, err := google.NewCalendarClient(ctx, cfg)
	if err != nil {
		return CalendarFetcherResponse{
			Error: fmt.Sprintf("Failed to create Calendar client: %v", err),
		}, err
	}

	log.Println("✅ Calendar client created")

	// Fetch upcoming events
	events, err := client.FetchUpcomingEvents(ctx)
	if err != nil {
		return CalendarFetcherResponse{
			Error: fmt.Sprintf("Failed to fetch events: %v", err),
		}, err
	}

	log.Printf("✅ Fetched %d events from Google Calendar", len(events))

	// Detect life events
	lifeEvents, err := client.DetectLifeEvents(ctx)
	if err != nil {
		return CalendarFetcherResponse{
			Error: fmt.Sprintf("Failed to detect life events: %v", err),
		}, err
	}

	log.Printf("✅ Detected %d life events", len(lifeEvents))

	if len(lifeEvents) == 0 {
		return CalendarFetcherResponse{
			EventsFetched:      len(events),
			LifeEventsDetected: 0,
		}, nil
	}

	// Store life events in DynamoDB (awsClients already created above)
	userID := event.UserID
	if userID == "" {
		userID = "demo-user" // Default for testing
	}

	var lifeEventSummaries []string

	for _, le := range lifeEvents {
		eventID := fmt.Sprintf("%s-%s", le.EventType, le.StartDate)

		record := LifeEventRecord{
			PK:           fmt.Sprintf("USER#%s", userID),
			SK:           fmt.Sprintf("LIFEEVENT#%s", eventID),
			EventType:    le.EventType,
			EventTitle:   le.EventTitle,
			StartDate:    le.StartDate,
			EndDate:      le.EndDate,
			DurationDays: le.DurationDays,
			Location:     le.Location,
			Suggestion:   le.Suggestion,
			Savings:      le.Savings,
			DetectedAt:   time.Now().Format(time.RFC3339),
			Status:       "pending",
		}

		item, err := attributevalue.MarshalMap(record)
		if err != nil {
			log.Printf("⚠️  Failed to marshal life event: %v", err)
			continue
		}

		_, err = awsClients.DynamoDB.PutItem(ctx, &dynamodb.PutItemInput{
			TableName: aws.String(cfg.InsightsTable),
			Item:      item,
		})
		if err != nil {
			log.Printf("⚠️  Failed to store life event: %v", err)
			continue
		}

		summary := fmt.Sprintf("%s: %s (%s to %s)", le.EventType, le.EventTitle, le.StartDate, le.EndDate)
		lifeEventSummaries = append(lifeEventSummaries, summary)

		log.Printf("✅ Stored life event: %s", summary)
	}

	// TODO: Invoke Calendar Reasoner Lambda to generate detailed suggestions
	// This will use Bedrock to analyze life events and create personalized recommendations

	response := CalendarFetcherResponse{
		EventsFetched:      len(events),
		LifeEventsDetected: len(lifeEvents),
		LifeEvents:         lifeEventSummaries,
	}

	responseJSON, _ := json.MarshalIndent(response, "", "  ")
	log.Printf("✅ Response: %s", responseJSON)

	return response, nil
}

func main() {
	lambda.Start(handler)
}
