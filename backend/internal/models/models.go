// Package models defines all data structures used across SubSentinel agents.
// These models are designed for TOON serialization to minimize Bedrock token usage.
package models

import (
	"encoding/json"
	"time"
)

// ─── Subscription Models ──────────────────────────────────────────────────────

// Subscription represents a detected recurring charge from a receipt.
type Subscription struct {
	SubscriptionID string    `json:"subscriptionId" dynamodbav:"subscriptionId"`
	UserID         string    `json:"userId" dynamodbav:"userId"`
	Provider       string    `json:"provider" dynamodbav:"provider"`
	Category       string    `json:"category" dynamodbav:"category"`
	Amount         float64   `json:"amount" dynamodbav:"amount"`
	Currency       string    `json:"currency" dynamodbav:"currency"`
	RenewalDate    string    `json:"renewalDate" dynamodbav:"renewalDate"`
	Frequency      string    `json:"frequency" dynamodbav:"frequency"` // monthly, yearly, weekly
	Status         string    `json:"status" dynamodbav:"status"`       // active, paused, cancelled
	DetectedAt     time.Time `json:"detectedAt" dynamodbav:"detectedAt"`
	LastCharge     time.Time `json:"lastCharge" dynamodbav:"lastCharge"`
	TOONTokenSaved int       `json:"toonTokenSaved" dynamodbav:"toonTokenSaved"`
}

// AuditResult is the output of the Auditor agent.
type AuditResult struct {
	ProcessedAt    time.Time      `json:"processedAt"`
	TotalReceipts  int            `json:"totalReceipts"`
	Subscriptions  []Subscription `json:"subscriptions"`
	FailedCount    int            `json:"failedCount"`
	TOONTokenSaved int            `json:"toonTokenSaved"`
}

// ─── Calendar Models ──────────────────────────────────────────────────────────

// CalendarEventData represents a parsed calendar event.
type CalendarEventData struct {
	EventID     string    `json:"eventId"`
	Title       string    `json:"title"`
	StartTime   time.Time `json:"startTime"`
	EndTime     time.Time `json:"endTime"`
	Location    string    `json:"location,omitempty"`
	Description string    `json:"description,omitempty"`
	IsAllDay    bool      `json:"isAllDay"`
}

// LifeEvent represents a detected life event from calendar analysis.
type LifeEvent struct {
	Type        string  `json:"type"` // vacation, relocation, job_change, etc.
	Confidence  float64 `json:"confidence"`
	StartDate   string  `json:"startDate"`
	EndDate     string  `json:"endDate"`
	Description string  `json:"description"`
}

// Suggestion represents a proactive subscription optimization suggestion.
type Suggestion struct {
	SuggestionID     string  `json:"suggestionId"`
	Provider         string  `json:"provider"`
	Action           string  `json:"action"` // pause, cancel, downgrade, negotiate
	Reason           string  `json:"reason"`
	LifeEventType    string  `json:"lifeEventType"`
	EstimatedSavings float64 `json:"estimatedSavings"`
	Priority         int     `json:"priority"` // 1=urgent, 5=nice-to-have
}

// CalendarInsight is the output of the Calendar Reasoner agent.
type CalendarInsight struct {
	UserID           string       `json:"userId"`
	AnalyzedAt       time.Time    `json:"analyzedAt"`
	EventsFound      int          `json:"eventsFound"`
	LifeEvents       []LifeEvent  `json:"lifeEvents"`
	Suggestions      []Suggestion `json:"suggestions"`
	PotentialSavings float64      `json:"potentialSavings"`
}

// ─── Negotiation Models ──────────────────────────────────────────────────────

// NegotiationRequest is the input to the Negotiator agent.
type NegotiationRequest struct {
	Provider       string `json:"provider"`
	IssueType      string `json:"issueType"` // cancel, negotiate_price, dispute_charge
	UserHistory    string `json:"userHistory"`
	DesiredOutcome string `json:"desiredOutcome"`
	UserID         string `json:"userId"`
}

// ParseNegotiationRequest deserializes a JSON request body.
func ParseNegotiationRequest(body string) (*NegotiationRequest, error) {
	var req NegotiationRequest
	if err := json.Unmarshal([]byte(body), &req); err != nil {
		return nil, err
	}
	return &req, nil
}

// NegotiationContext is the enriched context sent to Bedrock for draft generation.
type NegotiationContext struct {
	Provider        string               `json:"provider"`
	IssueType       string               `json:"issueType"`
	UserHistory     string               `json:"userHistory"`
	SimilarOutcomes []NegotiationOutcome `json:"similarOutcomes"`
	DesiredOutcome  string               `json:"desiredOutcome"`
}

// NegotiationDraft is the Bedrock-generated email draft.
type NegotiationDraft struct {
	SubjectLine    string `json:"subjectLine"`
	EmailBody      string `json:"emailBody"`
	TOONTokenSaved int    `json:"toonTokenSaved"`
}

// NegotiationResult is the stored output of the Negotiator agent.
type NegotiationResult struct {
	DraftID           string    `json:"draftId" dynamodbav:"draftId"`
	Provider          string    `json:"provider" dynamodbav:"provider"`
	IssueType         string    `json:"issueType" dynamodbav:"issueType"`
	EmailDraft        string    `json:"emailDraft" dynamodbav:"emailDraft"`
	SubjectLine       string    `json:"subjectLine" dynamodbav:"subjectLine"`
	SuccessPrediction float64   `json:"successPrediction" dynamodbav:"successPrediction"`
	SimilarCasesUsed  int       `json:"similarCasesUsed" dynamodbav:"similarCasesUsed"`
	TOONTokenSaved    int       `json:"toonTokenSaved" dynamodbav:"toonTokenSaved"`
	CreatedAt         time.Time `json:"createdAt" dynamodbav:"createdAt"`
}

// NegotiationOutcome represents a historical negotiation result for ML training.
type NegotiationOutcome struct {
	OutcomeID     string         `json:"outcomeId"`
	Provider      string         `json:"provider"`
	IssueType     string         `json:"issueType"`
	Success       bool           `json:"success"`
	Strategy      string         `json:"strategy"`
	Sentiment     SentimentScore `json:"sentiment"`
	UserID        string         `json:"userId"`
	NegotiationID string         `json:"negotiationId"`
	RecordedAt    time.Time      `json:"recordedAt"`
}

// SentimentScore holds the AWS Comprehend sentiment analysis result.
type SentimentScore struct {
	Primary    string  `json:"primary"` // POSITIVE, NEGATIVE, NEUTRAL, MIXED
	Confidence float64 `json:"confidence"`
	Positive   float64 `json:"positive"`
	Negative   float64 `json:"negative"`
	Neutral    float64 `json:"neutral"`
	Mixed      float64 `json:"mixed"`
}

// ─── Dark Pattern Models ──────────────────────────────────────────────────────

// DetectedPattern represents a single dark pattern found in a screenshot.
type DetectedPattern struct {
	PatternType   string    `json:"patternType"` // OBSTRUCTION, CONFUSION, FORCED_LABOR, SHAME_TACTICS
	Provider      string    `json:"provider"`    // Auto-detected: Netflix, Spotify, Adobe, etc.
	Confidence    float64   `json:"confidence"`
	Evidence      string    `json:"evidence"`
	Severity      float64   `json:"severity"`
	ScreenshotKey string    `json:"screenshotKey"`
	DetectedAt    time.Time `json:"detectedAt"`
}

// DarkPatternReport is the output of the Defender agent.
type DarkPatternReport struct {
	ReportID          string            `json:"reportId" dynamodbav:"reportId"`
	UserID            string            `json:"userId" dynamodbav:"userId"`
	AnalyzedAt        time.Time         `json:"analyzedAt" dynamodbav:"analyzedAt"`
	ScreenshotCount   int               `json:"screenshotCount" dynamodbav:"screenshotCount"`
	PatternsFound     []DetectedPattern `json:"patternsFound" dynamodbav:"patternsFound"`
	OverallConfidence float64           `json:"overallConfidence" dynamodbav:"overallConfidence"`
	HostilityScore    float64           `json:"hostilityScore" dynamodbav:"hostilityScore"`
	BypassGuide       []BypassStep      `json:"bypassGuide,omitempty" dynamodbav:"bypassGuide"`
}

// BypassStep is a single step in the generated bypass guide.
type BypassStep struct {
	StepNumber  int    `json:"stepNumber"`
	Action      string `json:"action"`
	Description string `json:"description"`
	URL         string `json:"url,omitempty"`
}

// RekognitionResult wraps Rekognition DetectText output.
type RekognitionResult struct {
	TextDetections []TextDetection `json:"textDetections"`
	Latency        string          `json:"latency"`
}

// TextDetection represents a single text block detected by Rekognition.
type TextDetection struct {
	DetectedText string  `json:"detectedText"`
	Type         string  `json:"type"` // LINE, WORD
	Confidence   float64 `json:"confidence"`
	BoundingBox  BBox    `json:"boundingBox"`
}

// BBox represents a bounding box around detected text.
type BBox struct {
	Left   float64 `json:"left"`
	Top    float64 `json:"top"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// ─── Learning Models ──────────────────────────────────────────────────────────

// LearningResult is the output of the Learner agent.
type LearningResult struct {
	OutcomeID        string         `json:"outcomeId"`
	Provider         string         `json:"provider"`
	Success          bool           `json:"success"`
	SentimentScore   float64        `json:"sentimentScore"`
	EmbeddingDim     int            `json:"embeddingDim"`
	DecayApplied     float64        `json:"decayApplied"`
	ProviderStats    *ProviderStats `json:"providerStats,omitempty"`
	TOONStorageSaved int            `json:"toonStorageSaved"`
	ProcessedAt      time.Time      `json:"processedAt"`
}

// ProviderStats tracks per-provider negotiation success rates.
type ProviderStats struct {
	Provider      string    `json:"provider"`
	TotalOutcomes int       `json:"totalOutcomes"`
	SuccessCount  int       `json:"successCount"`
	SuccessRate   float64   `json:"successRate"`
	AvgSentiment  float64   `json:"avgSentiment"`
	BestStrategy  string    `json:"bestStrategy"`
	LastUpdated   time.Time `json:"lastUpdated"`
}

// ─── Financial Freedom Score ──────────────────────────────────────────────────

// FinancialFreedomScore represents the gamified metric (0-100).
// Formula: (Savings / TotalSpend) * 100 + NegotiationWins * 5
type FinancialFreedomScore struct {
	UserID            string    `json:"userId"`
	Score             float64   `json:"score"`
	TotalSpend        float64   `json:"totalSpend"`
	TotalSavings      float64   `json:"totalSavings"`
	NegotiationWins   int       `json:"negotiationWins"`
	DarkPatternsFound int       `json:"darkPatternsFound"`
	CalculatedAt      time.Time `json:"calculatedAt"`
}
