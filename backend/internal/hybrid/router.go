// Package hybrid provides the data layer for real-time AWS services.
// ALL data flows through real AWS services — no mock data, no fallbacks.
//
// Mode: 100% Real-Time
//   - Gmail receipts via OAuth 2.0
//   - Google Calendar events via OAuth 2.0
//   - Screenshots from S3
//   - All AWS services are LIVE
package hybrid

import (
	"context"
	"log/slog"
	"time"

	"github.com/subsentinel/subsentinel/internal/config"
)

// DataProvider is the interface for all data operations.
// Every method connects to a REAL AWS service — no mocks.
type DataProvider interface {
	// Subscriptions
	GetSubscriptions(ctx context.Context, userID string) ([]Subscription, error)
	PutSubscription(ctx context.Context, sub Subscription) error

	// Dark Patterns
	GetDarkPatterns(ctx context.Context, userID string) ([]DarkPatternReport, error)
	PutDarkPattern(ctx context.Context, report DarkPatternReport) error

	// Negotiations
	GetNegotiations(ctx context.Context, userID string) ([]NegotiationDraft, error)
	PutNegotiation(ctx context.Context, draft NegotiationDraft) error

	// Calendar Insights
	GetCalendarInsights(ctx context.Context, userID string) ([]CalendarInsight, error)
	PutCalendarInsight(ctx context.Context, insight CalendarInsight) error

	// Learning Outcomes
	GetOutcomes(ctx context.Context, provider string) ([]NegotiationOutcome, error)
	PutOutcome(ctx context.Context, outcome NegotiationOutcome) error

	// Health check
	Ping(ctx context.Context) error
}

// AIProvider is the interface for AI model interactions.
// Connects to real AWS Bedrock, Rekognition, Textract, Comprehend.
type AIProvider interface {
	// Bedrock — Claude 3.5 Sonnet
	InvokeModel(ctx context.Context, prompt string, maxTokens int) (string, error)
	GenerateEmbedding(ctx context.Context, text string) ([]float64, error)

	// Vision (Rekognition / Bedrock Vision)
	AnalyzeImage(ctx context.Context, imageData []byte) (*ImageAnalysis, error)

	// OCR (Textract)
	ExtractText(ctx context.Context, documentData []byte) (*TextExtraction, error)

	// Sentiment (Comprehend)
	AnalyzeSentiment(ctx context.Context, text string) (*SentimentResult, error)
}

// ─── Real-Time Data Types ──────────────────────────────────────

type Subscription struct {
	SubscriptionID string    `json:"subscriptionId" dynamodbav:"SubscriptionID"`
	UserID         string    `json:"userId"         dynamodbav:"UserID"`
	Provider       string    `json:"provider"       dynamodbav:"Provider"`
	Amount         float64   `json:"amount"         dynamodbav:"Amount"`
	Currency       string    `json:"currency"       dynamodbav:"Currency"`
	Frequency      string    `json:"frequency"      dynamodbav:"Frequency"`
	RenewalDate    string    `json:"renewalDate"    dynamodbav:"RenewalDate"`
	Status         string    `json:"status"         dynamodbav:"Status"`
	Category       string    `json:"category"       dynamodbav:"Category"`
	DetectedVia    string    `json:"detectedVia"    dynamodbav:"DetectedVia"`
	CreatedAt      time.Time `json:"createdAt"      dynamodbav:"CreatedAt"`
}

type DarkPatternReport struct {
	ReportID       string            `json:"reportId"`
	UserID         string            `json:"userId"`
	Provider       string            `json:"provider"`
	HostilityScore float64           `json:"hostilityScore"`
	Patterns       []DetectedPattern `json:"patterns"`
	BypassGuide    []string          `json:"bypassGuide"`
	AnalyzedAt     time.Time         `json:"analyzedAt"`
}

type DetectedPattern struct {
	PatternType string  `json:"patternType"`
	Description string  `json:"description"`
	Confidence  float64 `json:"confidence"`
	Severity    float64 `json:"severity"`
}

type NegotiationDraft struct {
	DraftID           string   `json:"draftId"`
	UserID            string   `json:"userId"`
	Provider          string   `json:"provider"`
	Strategy          string   `json:"strategy"`
	EmailDraft        string   `json:"emailDraft"`
	SuccessPrediction float64  `json:"successPrediction"`
	Leverage          []string `json:"leverage"`
}

type NegotiationOutcome struct {
	OutcomeID      string  `json:"outcomeId"`
	Provider       string  `json:"provider"`
	Strategy       string  `json:"strategy"`
	Success        bool    `json:"success"`
	SavingsAmount  float64 `json:"savingsAmount"`
	SavingsPercent float64 `json:"savingsPercent"`
	Sentiment      string  `json:"sentiment"`
}

type CalendarInsight struct {
	InsightID             string   `json:"insightId"`
	UserID                string   `json:"userId"`
	EventType             string   `json:"eventType"`
	EventDate             string   `json:"eventDate"`
	AffectedSubscriptions []string `json:"affectedSubscriptions"`
	Suggestion            string   `json:"suggestion"`
	Confidence            float64  `json:"confidence"`
}

type ImageAnalysis struct {
	TextBlocks []string `json:"textBlocks"`
	Labels     []string `json:"labels"`
	Confidence float64  `json:"confidence"`
}

type TextExtraction struct {
	Lines      []string `json:"lines"`
	RawText    string   `json:"rawText"`
	Confidence float64  `json:"confidence"`
}

type SentimentResult struct {
	Sentiment string  `json:"sentiment"`
	Score     float64 `json:"score"`
	Positive  float64 `json:"positive"`
	Negative  float64 `json:"negative"`
	Neutral   float64 `json:"neutral"`
}

// ─── Real-Time Router ──────────────────────────────────────────

// Router routes ALL data requests to real AWS services.
// No mock providers. No hybrid fallbacks. 100% real.
type Router struct {
	cfg    *config.Config
	real   DataProvider
	realAI AIProvider
	logger *slog.Logger
}

// NewRouter creates a real-time data router.
// Only real providers are initialized — no mocks.
func NewRouter(cfg *config.Config, real DataProvider, realAI AIProvider) *Router {
	return &Router{
		cfg:    cfg,
		real:   real,
		realAI: realAI,
		logger: slog.Default().With("component", "realtime-router"),
	}
}

// Data returns the real DataProvider. Always real, never mock.
func (r *Router) Data() DataProvider {
	return r.real
}

// AI returns the real AIProvider. Always real, never mock.
func (r *Router) AI() AIProvider {
	return r.realAI
}
