// Package config manages application configuration loaded from
// environment variables. ALL data comes from REAL sources only.
// No mock data. No hybrid mode. 100% real-time.
package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration values for SubSentinel agents.
// Every field connects to a REAL service — no mock fallbacks.
type Config struct {
	// AWS Region
	AWSRegion string

	// DynamoDB
	SubscriptionsTable string
	InsightsTable      string
	NegotiationsTable  string
	DarkPatternsTable  string
	OutcomesTable      string

	// S3
	ReceiptsBucket    string
	ScreenshotsBucket string

	// Bedrock — Amazon Nova Pro (Multimodal Vision Model)
	BedrockModelID   string
	EmbeddingModelID string
	BedrockRegion    string
	BedrockMaxTokens int
	BedrockTemp      float64
	BedrockTopP      float64

	// OpenSearch
	OpenSearchEndpoint string
	OpenSearchIndex    string

	// ─── Google OAuth (Real-Time Data from .env) ─────────────
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string

	// Gmail (Real-Time Receipts)
	GmailRefreshToken string
	GmailFetchQuery   string
	GmailFetchDays    int

	// Google Calendar (Real-Time Life Events)
	CalendarRefreshToken  string
	CalendarLookaheadDays int

	// KMS
	KMSKeyID string

	// SES (Email Sending)
	SESVerifiedEmail string
	SESVerifiedDomain string

	// SNS (Notifications)
	SNSNotificationsTopicARN string
	SNSAlertsTopicARN string
	SNSStepFunctionsTopicARN string

	// TOON
	TOONEnabled  bool
	TaxonomyPath string

	// Learning
	DecayHalfLifeDays int

	// Environment
	Environment string // dev, staging, prod
	LogLevel    string
}

// MustLoad loads configuration from environment variables.
// Automatically loads .env file for local development (non-Lambda).
func MustLoad() *Config {
	// Auto-load .env for local development
	// In Lambda, env vars are set by the runtime, so this is a no-op
	loaded := godotenv.Load() // Try current directory
	if loaded != nil {
		loaded = godotenv.Load(".env") // Explicit current dir
	}
	if loaded != nil {
		loaded = godotenv.Load("../.env") // Parent directory
	}
	if loaded != nil {
		loaded = godotenv.Load("../../.env") // Grandparent (for cmd/*/main.go)
	}

	// Debug: Print loaded values
	fmt.Printf("[DEBUG] .env loaded: %v\n", loaded == nil)
	fmt.Printf("[DEBUG] GOOGLE_CLIENT_ID: %s\n", os.Getenv("GOOGLE_CLIENT_ID"))
	fmt.Printf("[DEBUG] GMAIL_REFRESH_TOKEN: %s\n", os.Getenv("GMAIL_REFRESH_TOKEN"))

	cfg := &Config{
		// AWS
		AWSRegion:   getEnv("AWS_REGION", "us-east-1"),
		Environment: getEnv("ENVIRONMENT", "dev"),
		LogLevel:    getEnv("LOG_LEVEL", "info"),

		// DynamoDB Tables
		SubscriptionsTable: getEnv("SUBSCRIPTIONS_TABLE", "subsentinel-subscriptions"),
		InsightsTable:      getEnv("INSIGHTS_TABLE", "subsentinel-insights"),
		NegotiationsTable:  getEnv("NEGOTIATIONS_TABLE", "subsentinel-negotiations"),
		DarkPatternsTable:  getEnv("DARK_PATTERNS_TABLE", "subsentinel-dark-patterns"),
		OutcomesTable:      getEnv("OUTCOMES_TABLE", "subsentinel-outcomes"),

		// S3 Buckets
		ReceiptsBucket:    getEnv("RECEIPTS_BUCKET", "subsentinel-receipts"),
		ScreenshotsBucket: getEnv("SCREENSHOTS_BUCKET", "subsentinel-screenshots"),

		// Bedrock — Amazon Nova Pro (Multimodal Vision Model)
		BedrockModelID:   getEnv("BEDROCK_MODEL_ID", "amazon.nova-pro-v1:0"),
		EmbeddingModelID: getEnv("EMBEDDING_MODEL_ID", "amazon.titan-embed-text-v2:0"),
		BedrockRegion:    getEnv("BEDROCK_REGION", "us-east-1"),
		BedrockMaxTokens: getEnvInt("BEDROCK_MAX_TOKENS", 2048),
		BedrockTemp:      getEnvFloat("BEDROCK_TEMPERATURE", 0.3),
		BedrockTopP:      getEnvFloat("BEDROCK_TOP_P", 0.9),

		// OpenSearch
		OpenSearchEndpoint: getEnv("OPENSEARCH_ENDPOINT", ""),
		OpenSearchIndex:    getEnv("OPENSEARCH_INDEX", "subsentinel-outcomes"),

		// ─── Google OAuth — REAL credentials from .env ───────
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/auth/callback/google"),

		// Gmail — Real-time receipt fetching (broader search for all subscriptions)
		GmailRefreshToken: getEnv("GMAIL_REFRESH_TOKEN", ""),
		GmailFetchQuery:   getEnv("GMAIL_FETCH_QUERY", "subject:(receipt OR invoice OR payment OR billing OR subscription OR renewal OR charge)"),
		GmailFetchDays:    getEnvInt("GMAIL_FETCH_DAYS", 90),

		// Calendar — Real-time life event detection
		CalendarRefreshToken:  getEnv("CALENDAR_REFRESH_TOKEN", ""),
		CalendarLookaheadDays: getEnvInt("CALENDAR_LOOKAHEAD_DAYS", 90),

		// KMS
		KMSKeyID: getEnv("KMS_KEY_ID", ""),

		// SES (Email Sending)
		SESVerifiedEmail: getEnv("SES_VERIFIED_EMAIL", ""),
		SESVerifiedDomain: getEnv("SES_VERIFIED_DOMAIN", ""),

		// SNS (Notifications)
		SNSNotificationsTopicARN: getEnv("SNS_NOTIFICATIONS_TOPIC_ARN", ""),
		SNSAlertsTopicARN: getEnv("SNS_ALERTS_TOPIC_ARN", ""),
		SNSStepFunctionsTopicARN: getEnv("SNS_STEPFUNCTIONS_TOPIC_ARN", ""),

		// TOON
		TOONEnabled:  getEnvBool("TOON_ENABLED", true),
		TaxonomyPath: getEnv("TAXONOMY_PATH", "configs/taxonomy.toon"),

		// Learning
		DecayHalfLifeDays: getEnvInt("DECAY_HALF_LIFE_DAYS", 30),
	}

	return cfg
}

// Validate checks that all required configuration values are set for real-time operation.
func (c *Config) Validate() error {
	if c.AWSRegion == "" {
		return fmt.Errorf("AWS_REGION is required")
	}
	if c.SubscriptionsTable == "" {
		return fmt.Errorf("SUBSCRIPTIONS_TABLE is required")
	}
	if c.GoogleClientID == "" {
		return fmt.Errorf("GOOGLE_CLIENT_ID is required — set it in .env")
	}
	if c.GoogleClientSecret == "" {
		return fmt.Errorf("GOOGLE_CLIENT_SECRET is required — set it in .env")
	}
	if c.GmailRefreshToken == "" {
		return fmt.Errorf("GMAIL_REFRESH_TOKEN is required — run: go run cmd/oauth/main.go")
	}
	if c.CalendarRefreshToken == "" {
		return fmt.Errorf("CALENDAR_REFRESH_TOKEN is required — run: go run cmd/oauth/main.go")
	}
	return nil
}

// HasGmailCredentials returns true if Gmail OAuth credentials are configured in .env.
func (c *Config) HasGmailCredentials() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != "" && c.GmailRefreshToken != ""
}

// HasCalendarCredentials returns true if Calendar OAuth credentials are configured in .env.
func (c *Config) HasCalendarCredentials() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != "" && c.CalendarRefreshToken != ""
}

// getEnv returns the environment variable value or a default.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvBool returns the environment variable as a boolean.
func getEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	b, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}
	return b
}

// getEnvInt returns the environment variable as an integer.
func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	i, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return i
}

// getEnvFloat returns the environment variable as a float64.
func getEnvFloat(key string, defaultValue float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	f, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return defaultValue
	}
	return f
}
