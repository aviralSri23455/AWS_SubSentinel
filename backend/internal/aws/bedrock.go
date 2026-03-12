// Package aws provides Bedrock operations for AI analysis.
// The AnalyzeReceipt function now accepts an aibridge.AIClient parameter
// so it transparently works with either provider.
package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/subsentinel/subsentinel/internal/external/aibridge"
	"github.com/subsentinel/subsentinel/internal/models"
)

// AnalyzeReceipt uses AWS Bedrock to analyze receipt text and extract subscription info.
func (c *Clients) AnalyzeReceipt(ctx context.Context, receiptText string, ai aibridge.AIClient, maxTokens int, temperature, topP float64) (*models.Subscription, error) {
	prompt := fmt.Sprintf(`Analyze this receipt text and extract subscription information. Return ONLY a valid JSON object with these fields:
{
  "provider": "company name (e.g., Netflix, Spotify, Adobe)",
  "category": "category (e.g., streaming, music, software, news)",
  "amount": 0.00,
  "currency": "USD",
  "renewalDate": "YYYY-MM-DD",
  "frequency": "monthly|yearly|weekly",
  "status": "active"
}

Receipt text:
%s

Return ONLY the JSON object, no other text.`, receiptText)

	responseText, err := ai.GenerateText(ctx, prompt, maxTokens, temperature, topP)
	if err != nil {
		return nil, fmt.Errorf("AI receipt analysis (%s): %w", ai.ProviderName(), err)
	}

	if responseText == "" {
		return nil, fmt.Errorf("empty response from AI provider")
	}

	// Extract JSON from response
	jsonStart := strings.Index(responseText, "{")
	jsonEnd := strings.LastIndex(responseText, "}") + 1
	if jsonStart < 0 || jsonEnd <= jsonStart {
		return nil, fmt.Errorf("no JSON in AI response: %s", responseText)
	}

	// Parse the JSON response
	var subscription models.Subscription
	if err := json.Unmarshal([]byte(responseText[jsonStart:jsonEnd]), &subscription); err != nil {
		return nil, fmt.Errorf("parse subscription from response: %w", err)
	}

	return &subscription, nil
}
