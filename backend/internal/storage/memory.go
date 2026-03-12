// Package storage provides in-memory storage for local development
package storage

import (
	"context"
	"fmt"
	"sync"

	"github.com/subsentinel/subsentinel/internal/models"
)

// MemoryStore provides in-memory storage for subscriptions (local dev only)
type MemoryStore struct {
	mu                sync.RWMutex
	subscriptions     map[string]*models.Subscription
	userSubscriptions map[string][]string // userID -> []subscriptionID
	darkPatterns      map[string]*models.DarkPatternReport
	userDarkPatterns  map[string][]string // userID -> []reportID
}

// NewMemoryStore creates a new in-memory store
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		subscriptions:     make(map[string]*models.Subscription),
		userSubscriptions: make(map[string][]string),
		darkPatterns:      make(map[string]*models.DarkPatternReport),
		userDarkPatterns:  make(map[string][]string),
	}
}

// GetSubscriptions retrieves all subscriptions for a user
func (m *MemoryStore) GetSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	subIDs := m.userSubscriptions[userID]
	result := make([]models.Subscription, 0, len(subIDs))

	for _, id := range subIDs {
		if sub, ok := m.subscriptions[id]; ok {
			result = append(result, *sub)
		}
	}

	return result, nil
}

// GetSubscription retrieves a single subscription by ID
func (m *MemoryStore) GetSubscription(ctx context.Context, userID, subscriptionID string) (*models.Subscription, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sub, ok := m.subscriptions[subscriptionID]
	if !ok {
		return nil, fmt.Errorf("subscription not found")
	}

	// Verify it belongs to the user
	if sub.UserID != userID {
		return nil, fmt.Errorf("subscription not found")
	}

	return sub, nil
}

// PutSubscription creates or updates a subscription
func (m *MemoryStore) PutSubscription(ctx context.Context, sub *models.Subscription) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store subscription
	m.subscriptions[sub.SubscriptionID] = sub

	// Update user index
	userID := sub.UserID
	if userID == "" {
		userID = "local-user"
	}

	// Check if already in user's list
	found := false
	for _, id := range m.userSubscriptions[userID] {
		if id == sub.SubscriptionID {
			found = true
			break
		}
	}

	if !found {
		m.userSubscriptions[userID] = append(m.userSubscriptions[userID], sub.SubscriptionID)
	}

	return nil
}

// DeleteSubscription deletes a subscription by ID
func (m *MemoryStore) DeleteSubscription(ctx context.Context, userID, subscriptionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	sub, ok := m.subscriptions[subscriptionID]
	if !ok {
		return fmt.Errorf("subscription not found")
	}

	// Verify it belongs to the user
	if sub.UserID != userID {
		return fmt.Errorf("subscription not found")
	}

	// Remove from subscriptions
	delete(m.subscriptions, subscriptionID)

	// Remove from user index
	subIDs := m.userSubscriptions[userID]
	for i, id := range subIDs {
		if id == subscriptionID {
			m.userSubscriptions[userID] = append(subIDs[:i], subIDs[i+1:]...)
			break
		}
	}

	return nil
}

// GetDarkPatterns retrieves all dark pattern reports for a user
func (m *MemoryStore) GetDarkPatterns(ctx context.Context, userID string) ([]models.DarkPatternReport, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	reportIDs := m.userDarkPatterns[userID]
	result := make([]models.DarkPatternReport, 0, len(reportIDs))

	for _, id := range reportIDs {
		if report, ok := m.darkPatterns[id]; ok {
			result = append(result, *report)
		}
	}

	return result, nil
}

// PutDarkPattern creates or updates a dark pattern report
func (m *MemoryStore) PutDarkPattern(ctx context.Context, report *models.DarkPatternReport) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Store report
	m.darkPatterns[report.ReportID] = report

	// Update user index
	userID := "local-user"

	// Check if already in user's list
	found := false
	for _, id := range m.userDarkPatterns[userID] {
		if id == report.ReportID {
			found = true
			break
		}
	}

	if !found {
		m.userDarkPatterns[userID] = append(m.userDarkPatterns[userID], report.ReportID)
	}

	return nil
}

// DeleteDarkPattern deletes a dark pattern report
func (m *MemoryStore) DeleteDarkPattern(ctx context.Context, userID, reportID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Delete from main map
	delete(m.darkPatterns, reportID)

	// Remove from user index
	if reportIDs, ok := m.userDarkPatterns[userID]; ok {
		newReportIDs := []string{}
		for _, id := range reportIDs {
			if id != reportID {
				newReportIDs = append(newReportIDs, id)
			}
		}
		m.userDarkPatterns[userID] = newReportIDs
	}

	return nil
}
