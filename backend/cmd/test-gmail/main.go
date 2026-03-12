// Test Gmail Integration
// Verifies that SubSentinel can fetch YOUR real Gmail receipts
//
// Usage:
//   go run cmd/test-gmail/main.go
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/google"
)

func main() {
	fmt.Println("📧 SubSentinel Gmail Integration Test")
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()

	// Load config
	cfg := config.MustLoad()

	// Validate Gmail credentials
	if !cfg.HasGmailCredentials() {
		log.Fatal("❌ Gmail credentials not configured in .env\n" +
			"   Run: go run cmd/oauth/main.go\n" +
			"   Then copy GMAIL_REFRESH_TOKEN to .env")
	}

	fmt.Println("✅ Gmail credentials found in .env")
	fmt.Printf("   Query: %s\n", cfg.GmailFetchQuery)
	fmt.Printf("   Days: %d\n", cfg.GmailFetchDays)
	fmt.Println()

	// Create Gmail client
	ctx := context.Background()
	client, err := google.NewGmailClient(ctx, cfg)
	if err != nil {
		log.Fatalf("❌ Failed to create Gmail client: %v", err)
	}

	fmt.Println("✅ Gmail client created successfully")
	fmt.Println()
	fmt.Println("🔍 Fetching receipts from YOUR Gmail inbox...")
	fmt.Println()

	// Fetch receipts
	messages, err := client.FetchReceipts(ctx)
	if err != nil {
		log.Fatalf("❌ Failed to fetch receipts: %v", err)
	}

	fmt.Printf("✅ Found %d receipts from YOUR Gmail!\n", len(messages))
	fmt.Println()

	if len(messages) == 0 {
		fmt.Println("💡 No receipts found. This could mean:")
		fmt.Println("   - No subscription emails in the last 30 days")
		fmt.Println("   - Query doesn't match your email providers")
		fmt.Println("   - Try adjusting GMAIL_FETCH_QUERY in .env")
		return
	}

	// Display first 5 receipts
	fmt.Println("=" + repeat("=", 49))
	fmt.Println("📋 Recent Receipts:")
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()

	displayCount := len(messages)
	if displayCount > 5 {
		displayCount = 5
	}

	for i := 0; i < displayCount; i++ {
		msg := messages[i]
		fmt.Printf("%d. From: %s\n", i+1, msg.From)
		fmt.Printf("   Subject: %s\n", msg.Subject)
		fmt.Printf("   Date: %s\n", msg.Date)
		fmt.Printf("   Attachments: %d\n", len(msg.Attachments))
		if len(msg.Attachments) > 0 {
			for _, att := range msg.Attachments {
				fmt.Printf("      - %s (%s, %d bytes)\n", att.Filename, att.MimeType, len(att.Data))
			}
		}
		fmt.Println()
	}

	if len(messages) > 5 {
		fmt.Printf("... and %d more receipts\n", len(messages)-5)
		fmt.Println()
	}

	fmt.Println("=" + repeat("=", 49))
	fmt.Println("✅ Gmail integration working!")
	fmt.Println()
	fmt.Println("📋 Next steps:")
	fmt.Println("   1. These receipts will be processed by Auditor Agent")
	fmt.Println("   2. Textract extracts subscription data")
	fmt.Println("   3. Bedrock categorizes and stores in DynamoDB")
	fmt.Println()
}

func repeat(s string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += s
	}
	return result
}
