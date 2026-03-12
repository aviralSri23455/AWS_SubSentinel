package events

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// EventType represents different types of real-time events
type EventType string

const (
	EventScreenshotUploaded  EventType = "screenshot_uploaded"
	EventScreenshotAnalyzing EventType = "screenshot_analyzing"
	EventScreenshotComplete  EventType = "screenshot_complete"
	EventPatternsDetected    EventType = "patterns_detected"
	EventDarkPatternAdded    EventType = "dark_pattern_added"
	EventGmailScanStarted    EventType = "gmail_scan_started"
	EventGmailScanComplete   EventType = "gmail_scan_complete"
	EventSubscriptionAdded   EventType = "subscription_added"
	EventAgentActivity       EventType = "agent_activity"
	EventPipelineProgress    EventType = "pipeline_progress"
)

// Event represents a server-sent event
type Event struct {
	Type      EventType              `json:"type"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
}

// Broker manages SSE connections and broadcasts events
type Broker struct {
	clients     map[chan Event]bool
	newClients  chan chan Event
	deadClients chan chan Event
	events      chan Event
	mu          sync.RWMutex
	// Deduplication: track recent events to prevent flooding
	recentEvents map[string]time.Time
	dedupMu      sync.Mutex
}

// Mu exposes the broker mutex for global state synchronization.
func (b *Broker) Mu() *sync.RWMutex {
	return &b.mu
}

// NewBroker creates a new SSE broker
func NewBroker() *Broker {
	b := &Broker{
		clients:      make(map[chan Event]bool),
		newClients:   make(chan chan Event),
		deadClients:  make(chan chan Event),
		events:       make(chan Event, 100),
		recentEvents: make(map[string]time.Time),
	}
	go b.listen()
	go b.cleanupRecentEvents()
	return b
}

// listen handles client connections and event broadcasting
func (b *Broker) listen() {
	for {
		select {
		case client := <-b.newClients:
			b.mu.Lock()
			b.clients[client] = true
			b.mu.Unlock()

		case client := <-b.deadClients:
			b.mu.Lock()
			delete(b.clients, client)
			close(client)
			b.mu.Unlock()

		case event := <-b.events:
			b.mu.RLock()
			for client := range b.clients {
				select {
				case client <- event:
				case <-time.After(1 * time.Second):
					// Client not responding, will be cleaned up
				}
			}
			b.mu.RUnlock()
		}
	}
}

// Publish sends an event to all connected clients
func (b *Broker) Publish(eventType EventType, data map[string]interface{}) {
	// Create deduplication key from event type and key data fields
	dedupKey := b.createDedupKey(eventType, data)
	
	// Check if we've seen this event recently (within 2 seconds)
	b.dedupMu.Lock()
	if lastSeen, exists := b.recentEvents[dedupKey]; exists {
		if time.Since(lastSeen) < 2*time.Second {
			b.dedupMu.Unlock()
			return // Skip duplicate event
		}
	}
	b.recentEvents[dedupKey] = time.Now()
	b.dedupMu.Unlock()
	
	event := Event{
		Type:      eventType,
		Data:      data,
		Timestamp: time.Now().UTC(),
	}
	select {
	case b.events <- event:
	case <-time.After(100 * time.Millisecond):
		// Drop event if channel is full
	}
}

// createDedupKey creates a unique key for deduplication
func (b *Broker) createDedupKey(eventType EventType, data map[string]interface{}) string {
	key := string(eventType)
	if agent, ok := data["agent"].(string); ok {
		key += ":" + agent
	}
	if action, ok := data["action"].(string); ok {
		key += ":" + action
	}
	if status, ok := data["status"].(string); ok {
		key += ":" + status
	}
	return key
}

// cleanupRecentEvents periodically cleans up old entries from the deduplication map
func (b *Broker) cleanupRecentEvents() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		b.dedupMu.Lock()
		now := time.Now()
		for key, lastSeen := range b.recentEvents {
			if now.Sub(lastSeen) > 5*time.Second {
				delete(b.recentEvents, key)
			}
		}
		b.dedupMu.Unlock()
	}
}

// ServeHTTP handles SSE connections
func (b *Broker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-ID")
	w.Header().Set("X-Accel-Buffering", "no")

	// Create client channel
	clientChan := make(chan Event, 10)
	b.newClients <- clientChan

	// Remove client on disconnect
	defer func() {
		b.deadClients <- clientChan
	}()

	// Send initial connection event
	initialEvent := Event{
		Type: "connected",
		Data: map[string]interface{}{
			"message": "Connected to SubSentinel real-time events",
		},
		Timestamp: time.Now().UTC(),
	}
	b.sendEvent(w, initialEvent)

	// Stream events to client
	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event := <-clientChan:
			if err := b.sendEvent(w, event); err != nil {
				return
			}
		case <-time.After(30 * time.Second):
			// Send keepalive ping
			fmt.Fprintf(w, ": keepalive\n\n")
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
	}
}

// sendEvent writes an event to the response writer
func (b *Broker) sendEvent(w http.ResponseWriter, event Event) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}

	fmt.Fprintf(w, "data: %s\n\n", data)
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}
	return nil
}

// PublishPipelineProgress publishes pipeline progress updates
func (b *Broker) PublishPipelineProgress(stage string, status string, details map[string]interface{}) {
	data := map[string]interface{}{
		"stage":  stage,
		"status": status,
	}
	for k, v := range details {
		data[k] = v
	}
	b.Publish(EventPipelineProgress, data)
}

// PublishScreenshotAnalysis publishes screenshot analysis results
func (b *Broker) PublishScreenshotAnalysis(reportID, provider string, hostilityScore float64, patternsCount int) {
	b.Publish(EventScreenshotComplete, map[string]interface{}{
		"reportId":       reportID,
		"provider":       provider,
		"hostilityScore": hostilityScore,
		"patternsCount":  patternsCount,
	})
}

// PublishAgentActivity publishes agent activity events
func (b *Broker) PublishAgentActivity(agent, action, status string, details map[string]interface{}) {
	data := map[string]interface{}{
		"agent":     agent,
		"action":    action,
		"status":    status,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	for k, v := range details {
		data[k] = v
	}
	b.Publish(EventAgentActivity, data)

	b.mu.Lock()
	GlobalActivityCache = append([]map[string]interface{}{data}, GlobalActivityCache...)
	if len(GlobalActivityCache) > 50 {
		GlobalActivityCache = GlobalActivityCache[:50]
	}
	b.mu.Unlock()
}

// Global broker instance
var GlobalBroker *Broker

// GlobalActivityCache stores the last 50 activities in memory
var GlobalActivityCache []map[string]interface{}

func init() {
	GlobalBroker = NewBroker()
	GlobalActivityCache = make([]map[string]interface{}, 0, 50)
}
