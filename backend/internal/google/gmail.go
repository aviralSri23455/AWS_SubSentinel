// Package google provides real-time Google API clients for SubSentinel.
// Connects to YOUR Gmail and Google Calendar using OAuth 2.0 credentials
// loaded directly from .env — no mock data, no Secrets Manager needed locally.
package google

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"google.golang.org/api/option"

	"github.com/subsentinel/subsentinel/internal/config"
)

// GmailClient wraps the real Gmail API client.
// Fetches YOUR actual subscription receipts from YOUR inbox.
type GmailClient struct {
	service *gmail.Service
	config  *config.Config
}

// NewGmailClient creates a real Gmail API client using OAuth credentials from .env.
// No mock data. No hybrid fallback. YOUR real Gmail inbox.
func NewGmailClient(ctx context.Context, cfg *config.Config) (*GmailClient, error) {
	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" || cfg.GmailRefreshToken == "" {
		return nil, fmt.Errorf("Gmail OAuth credentials missing from .env — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN")
	}

	oauthConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		Endpoint:     google.Endpoint,
		RedirectURL:  cfg.GoogleRedirectURI,
		Scopes:       []string{gmail.GmailReadonlyScope},
	}

	token := &oauth2.Token{
		RefreshToken: cfg.GmailRefreshToken,
	}

	httpClient := oauthConfig.Client(ctx, token)

	service, err := gmail.NewService(ctx, option.WithHTTPClient(httpClient))
	if err != nil {
		return nil, fmt.Errorf("failed to create Gmail service: %w", err)
	}

	return &GmailClient{
		service: service,
		config:  cfg,
	}, nil
}

// GmailMessage represents a parsed email from YOUR Gmail inbox.
type GmailMessage struct {
	MessageID   string
	From        string
	Subject     string
	Date        string
	Body        string
	Attachments []GmailAttachment
}

// GmailAttachment represents an email attachment (receipt PDF/image).
type GmailAttachment struct {
	Filename     string
	MimeType     string
	Data         []byte
	AttachmentID string
}

// FetchReceipts fetches real subscription receipts from YOUR Gmail inbox.
// Uses the query configured in GMAIL_FETCH_QUERY and GMAIL_FETCH_DAYS from .env.
func (g *GmailClient) FetchReceipts(ctx context.Context) ([]GmailMessage, error) {
	query := fmt.Sprintf("%s newer_than:%dd", g.config.GmailFetchQuery, g.config.GmailFetchDays)

	messages, err := g.service.Users.Messages.List("me").Q(query).MaxResults(50).Do()
	if err != nil {
		return nil, fmt.Errorf("Gmail API list messages: %w", err)
	}

	var results []GmailMessage
	for _, m := range messages.Messages {
		msg, err := g.service.Users.Messages.Get("me", m.Id).Format("full").Do()
		if err != nil {
			continue // Skip failed messages, process the rest
		}

		parsed := GmailMessage{
			MessageID: msg.Id,
			From:      getHeader(msg, "From"),
			Subject:   getHeader(msg, "Subject"),
			Date:      getHeader(msg, "Date"),
		}

		// Extract body text
		parsed.Body = extractBody(msg.Payload)

		// Extract attachments (receipts — PDFs, images)
		parsed.Attachments = g.extractAttachments(ctx, msg)

		results = append(results, parsed)
	}

	return results, nil
}

// FetchMessageByID fetches a specific email by its message ID.
func (g *GmailClient) FetchMessageByID(ctx context.Context, messageID string) (*GmailMessage, error) {
	msg, err := g.service.Users.Messages.Get("me", messageID).Format("full").Do()
	if err != nil {
		return nil, fmt.Errorf("Gmail API get message: %w", err)
	}

	parsed := &GmailMessage{
		MessageID: msg.Id,
		From:      getHeader(msg, "From"),
		Subject:   getHeader(msg, "Subject"),
		Date:      getHeader(msg, "Date"),
		Body:      extractBody(msg.Payload),
	}

	parsed.Attachments = g.extractAttachments(ctx, msg)
	return parsed, nil
}

// Service returns the underlying Gmail API service for advanced operations.
func (g *GmailClient) Service() *gmail.Service {
	return g.service
}

// extractAttachments pulls attachment data from the email.
func (g *GmailClient) extractAttachments(ctx context.Context, msg *gmail.Message) []GmailAttachment {
	var attachments []GmailAttachment

	if msg.Payload == nil || msg.Payload.Parts == nil {
		return attachments
	}

	for _, part := range msg.Payload.Parts {
		if part.Filename == "" || part.Body == nil || part.Body.AttachmentId == "" {
			continue
		}

		// Fetch attachment data
		att, err := g.service.Users.Messages.Attachments.Get("me", msg.Id, part.Body.AttachmentId).Do()
		if err != nil {
			continue
		}

		attachments = append(attachments, GmailAttachment{
			Filename:     part.Filename,
			MimeType:     part.MimeType,
			Data:         decodeAttachmentData(att.Data),
			AttachmentID: part.Body.AttachmentId,
		})
	}

	return attachments
}

// getHeader extracts a header value from the email message.
func getHeader(msg *gmail.Message, name string) string {
	if msg.Payload == nil {
		return ""
	}
	for _, header := range msg.Payload.Headers {
		if header.Name == name {
			return header.Value
		}
	}
	return ""
}

func decodeAttachmentData(encoded string) []byte {
	if encoded == "" {
		return nil
	}
	data, err := base64.RawURLEncoding.DecodeString(encoded)
	if err == nil {
		return data
	}
	data, err = base64.StdEncoding.DecodeString(strings.ReplaceAll(encoded, "-", "+"))
	if err == nil {
		return data
	}
	return []byte(encoded)
}

// extractBody extracts the plain text body from the email payload.
func extractBody(payload *gmail.MessagePart) string {
	if payload == nil {
		return ""
	}

	// Direct body
	if payload.MimeType == "text/plain" && payload.Body != nil && payload.Body.Data != "" {
		decoded := decodeAttachmentData(payload.Body.Data)
		if len(decoded) > 0 {
			return string(decoded)
		}
		return payload.Body.Data
	}

	// Check parts recursively
	for _, part := range payload.Parts {
		if body := extractBody(part); body != "" {
			return body
		}
	}

	return ""
}
