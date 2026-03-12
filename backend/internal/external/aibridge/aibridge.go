// Package aibridge provides the AI client interface backed by AWS Bedrock.
//
// All agents call AIClient methods for text and vision generation.
// Uses Amazon Bedrock Converse API with Nova Pro model.
//
// Features:
// - Automatic retry with exponential backoff for rate limits
// - Request queuing to prevent throttling
//
// ┌─────────────┐      ┌───────────────────┐
// │  AIClient    │─────▶│  BedrockProvider  │  (AWS Bedrock)
// │  (interface) │      └───────────────────┘
// └─────────────┘
package aibridge

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	sdkaws "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	brTypes "github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/subsentinel/subsentinel/internal/config"
)

// AIClient is the unified AI interface used by all agents.
type AIClient interface {
	// GenerateText sends a text prompt and returns the response text.
	GenerateText(ctx context.Context, prompt string, maxTokens int, temperature, topP float64) (string, error)

	// GenerateVision sends an image + text prompt and returns the response text.
	GenerateVision(ctx context.Context, imageBytes []byte, mimeType, prompt string, maxTokens int, temperature, topP float64) (string, error)

	// ProviderName returns the provider identifier.
	ProviderName() string
}

// NewAIClient creates the Bedrock AI client.
func NewAIClient(cfg *config.Config, bedrockClient *bedrockruntime.Client) (AIClient, error) {
	if bedrockClient == nil {
		return nil, fmt.Errorf("bedrock client is nil — check AWS credentials")
	}
	return &bedrockProvider{
		client:      bedrockClient,
		modelID:     cfg.BedrockModelID,
		rateLimiter: newRateLimiter(),
	}, nil
}

// ═══════════════════════════════════════════════════════════════════════════
// Bedrock Provider (wraps Converse API calls)
// ═══════════════════════════════════════════════════════════════════════════

type bedrockProvider struct {
	client      *bedrockruntime.Client
	modelID     string
	rateLimiter *rateLimiter
}

// rateLimiter implements token bucket rate limiting with exponential backoff
type rateLimiter struct {
	mu            sync.Mutex
	lastRequest   time.Time
	minInterval   time.Duration
	backoffFactor float64
	maxRetries    int
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{
		minInterval:   500 * time.Millisecond, // Minimum 500ms between requests
		backoffFactor: 2.0,
		maxRetries:    3,
	}
}

// wait implements rate limiting with exponential backoff
func (rl *rateLimiter) wait(ctx context.Context, attempt int) error {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Calculate backoff delay
	delay := rl.minInterval
	if attempt > 0 {
		backoffMultiplier := 1.0
		for i := 0; i < attempt; i++ {
			backoffMultiplier *= rl.backoffFactor
		}
		delay = time.Duration(float64(rl.minInterval) * backoffMultiplier)
	}

	// Ensure minimum interval since last request
	timeSinceLastRequest := time.Since(rl.lastRequest)
	if timeSinceLastRequest < delay {
		waitTime := delay - timeSinceLastRequest
		select {
		case <-time.After(waitTime):
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	rl.lastRequest = time.Now()
	return nil
}

// isThrottlingError checks if the error is a rate limit/throttling error
func isThrottlingError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "throttling") ||
		strings.Contains(errStr, "rate") ||
		strings.Contains(errStr, "too many requests") ||
		strings.Contains(errStr, "quota") ||
		strings.Contains(errStr, "limit exceeded")
}

func (b *bedrockProvider) GenerateText(ctx context.Context, prompt string, maxTokens int, temperature, topP float64) (string, error) {
	var lastErr error

	for attempt := 0; attempt <= b.rateLimiter.maxRetries; attempt++ {
		if err := b.rateLimiter.wait(ctx, attempt); err != nil {
			return "", fmt.Errorf("rate limiter wait: %w", err)
		}

		messages := []brTypes.Message{
			{
				Role: brTypes.ConversationRoleUser,
				Content: []brTypes.ContentBlock{
					&brTypes.ContentBlockMemberText{
						Value: prompt,
					},
				},
			},
		}

		mt := int32(maxTokens)
		temp := float32(temperature)
		tp := float32(topP)

		result, err := b.client.Converse(ctx, &bedrockruntime.ConverseInput{
			ModelId:  sdkaws.String(b.modelID),
			Messages: messages,
			InferenceConfig: &brTypes.InferenceConfiguration{
				MaxTokens:   &mt,
				Temperature: &temp,
				TopP:        &tp,
			},
		})

		if err != nil {
			lastErr = err
			if isThrottlingError(err) && attempt < b.rateLimiter.maxRetries {
				continue
			}
			return "", fmt.Errorf("bedrock converse (model: %s): %w", b.modelID, err)
		}

		return extractBedrockText(result), nil
	}

	return "", fmt.Errorf("bedrock rate limit exceeded after %d retries (model: %s): %w", b.rateLimiter.maxRetries, b.modelID, lastErr)
}

func (b *bedrockProvider) GenerateVision(ctx context.Context, imageBytes []byte, mimeType, prompt string, maxTokens int, temperature, topP float64) (string, error) {
	var lastErr error

	for attempt := 0; attempt <= b.rateLimiter.maxRetries; attempt++ {
		if err := b.rateLimiter.wait(ctx, attempt); err != nil {
			return "", fmt.Errorf("rate limiter wait: %w", err)
		}

		messages := []brTypes.Message{
			{
				Role: brTypes.ConversationRoleUser,
				Content: []brTypes.ContentBlock{
					&brTypes.ContentBlockMemberImage{
						Value: brTypes.ImageBlock{
							Format: brTypes.ImageFormat(strings.TrimPrefix(mimeType, "image/")),
							Source: &brTypes.ImageSourceMemberBytes{
								Value: imageBytes,
							},
						},
					},
					&brTypes.ContentBlockMemberText{
						Value: prompt,
					},
				},
			},
		}

		mt := int32(maxTokens)
		temp := float32(temperature)
		tp := float32(topP)

		result, err := b.client.Converse(ctx, &bedrockruntime.ConverseInput{
			ModelId:  sdkaws.String(b.modelID),
			Messages: messages,
			InferenceConfig: &brTypes.InferenceConfiguration{
				MaxTokens:   &mt,
				Temperature: &temp,
				TopP:        &tp,
			},
		})

		if err != nil {
			lastErr = err
			if isThrottlingError(err) && attempt < b.rateLimiter.maxRetries {
				continue
			}
			return "", fmt.Errorf("bedrock converse vision (model: %s): %w", b.modelID, err)
		}

		return extractBedrockText(result), nil
	}

	return "", fmt.Errorf("bedrock rate limit exceeded after %d retries (model: %s): %w", b.rateLimiter.maxRetries, b.modelID, lastErr)
}

func (b *bedrockProvider) ProviderName() string {
	return fmt.Sprintf("Bedrock (%s)", b.modelID)
}

// extractBedrockText pulls the text from a Converse API response.
func extractBedrockText(result *bedrockruntime.ConverseOutput) string {
	if result.Output == nil {
		return ""
	}
	if msgOutput, ok := result.Output.(*brTypes.ConverseOutputMemberMessage); ok {
		for _, block := range msgOutput.Value.Content {
			if textBlock, ok := block.(*brTypes.ContentBlockMemberText); ok {
				return textBlock.Value
			}
		}
	}
	return ""
}
