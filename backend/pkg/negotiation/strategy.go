// Package negotiation provides the negotiation strategy engine.
// It selects optimal strategies based on provider history and success data.
package negotiation

import (
	"github.com/subsentinel/subsentinel/internal/models"
)

// Strategy represents a negotiation approach.
type Strategy string

const (
	PriceMatch    Strategy = "price_match"
	LoyaltyAppeal Strategy = "loyalty_appeal"
	DirectCancel  Strategy = "direct_cancel"
	Escalation    Strategy = "escalation"
	Competitor    Strategy = "competitor_offer"
)

// ProviderProfile defines known characteristics of subscription providers.
type ProviderProfile struct {
	Provider         string
	AvgSuccessRate   float64
	BestStrategies   []Strategy
	AvgResponseTime  string
	RetentionOffer   bool
	DifficultyScore  int // 1-10
}

// DefaultProfiles returns built-in provider profiles.
var DefaultProfiles = map[string]ProviderProfile{
	"Netflix": {
		Provider:        "Netflix",
		AvgSuccessRate:  0.82,
		BestStrategies:  []Strategy{PriceMatch, LoyaltyAppeal},
		AvgResponseTime: "2 hours",
		RetentionOffer:  true,
		DifficultyScore: 3,
	},
	"Spotify": {
		Provider:        "Spotify",
		AvgSuccessRate:  0.68,
		BestStrategies:  []Strategy{DirectCancel, Competitor},
		AvgResponseTime: "24 hours",
		RetentionOffer:  false,
		DifficultyScore: 5,
	},
	"Adobe": {
		Provider:        "Adobe",
		AvgSuccessRate:  0.45,
		BestStrategies:  []Strategy{Escalation, LoyaltyAppeal},
		AvgResponseTime: "48 hours",
		RetentionOffer:  true,
		DifficultyScore: 9,
	},
	"Hulu": {
		Provider:        "Hulu",
		AvgSuccessRate:  0.75,
		BestStrategies:  []Strategy{PriceMatch, DirectCancel},
		AvgResponseTime: "4 hours",
		RetentionOffer:  true,
		DifficultyScore: 4,
	},
	"NYTimes": {
		Provider:        "NYTimes",
		AvgSuccessRate:  0.60,
		BestStrategies:  []Strategy{DirectCancel, Escalation},
		AvgResponseTime: "12 hours",
		RetentionOffer:  false,
		DifficultyScore: 6,
	},
}

// SelectOptimalStrategy chooses the best strategy based on provider profile
// and historical outcomes. Returns the strategy and expected success rate.
func SelectOptimalStrategy(provider string, outcomes []models.NegotiationOutcome) (Strategy, float64) {
	profile, exists := DefaultProfiles[provider]
	if !exists {
		// Unknown provider: use generic approach
		return DirectCancel, 0.50
	}

	// If we have historical data, use the most successful strategy
	if len(outcomes) > 0 {
		strategySuccess := make(map[Strategy]struct {
			wins  int
			total int
		})

		for _, o := range outcomes {
			s := Strategy(o.Strategy)
			stats := strategySuccess[s]
			stats.total++
			if o.Success {
				stats.wins++
			}
			strategySuccess[s] = stats
		}

		bestStrategy := profile.BestStrategies[0]
		bestRate := 0.0
		for s, stats := range strategySuccess {
			rate := float64(stats.wins) / float64(stats.total)
			if rate > bestRate {
				bestRate = rate
				bestStrategy = s
			}
		}

		return bestStrategy, bestRate
	}

	return profile.BestStrategies[0], profile.AvgSuccessRate
}
