// Package storage defines the storage interface for subscriptions
package storage

import (
	"context"

	"github.com/subsentinel/subsentinel/internal/models"
)

// Store defines the interface for subscription storage
type Store interface {
	GetSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error)
	GetSubscription(ctx context.Context, userID, subscriptionID string) (*models.Subscription, error)
	PutSubscription(ctx context.Context, sub *models.Subscription) error
	DeleteSubscription(ctx context.Context, userID, subscriptionID string) error
	GetDarkPatterns(ctx context.Context, userID string) ([]models.DarkPatternReport, error)
	PutDarkPattern(ctx context.Context, report *models.DarkPatternReport) error
	DeleteDarkPattern(ctx context.Context, userID, reportID string) error
}
