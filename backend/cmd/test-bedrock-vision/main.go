// Package main demonstrates AWS Bedrock vision model usage.
//
// This test shows how to use Amazon Nova Pro (or Claude Opus 4) for image analysis.
// Both models support multimodal input (text + images).
//
// Usage:
//
//	go run cmd/test-bedrock-vision/main.go <image-path>
//
// Example:
//
//	go run cmd/test-bedrock-vision/main.go test-receipt.jpg
//	go run cmd/test-bedrock-vision/main.go screenshot.png
package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/external/aibridge"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run cmd/test-bedrock-vision/main.go <image-path>")
		fmt.Println("\nExample:")
		fmt.Println("  go run cmd/test-bedrock-vision/main.go receipt.jpg")
		fmt.Println("  go run cmd/test-bedrock-vision/main.go screenshot.png")
		os.Exit(1)
	}

	imagePath := os.Args[1]

	// Load configuration
	cfg := config.MustLoad()
	fmt.Printf("✓ Loaded config (Model: %s)\n", cfg.BedrockModelID)

	// Initialize AWS clients
	ctx := context.Background()
	awsClients, err := aws.NewClients(ctx, cfg)
	if err != nil {
		log.Fatalf("Failed to create AWS clients: %v", err)
	}
	fmt.Println("✓ AWS clients initialized")

	// Create AI client (AWS Bedrock)
	aiClient, err := aibridge.NewAIClient(cfg, awsClients.Bedrock)
	if err != nil {
		log.Fatalf("Failed to create AI client: %v", err)
	}
	fmt.Printf("✓ AI client ready (provider: %s)\n\n", aiClient.ProviderName())

	// Read image file
	imageBytes, err := os.ReadFile(imagePath)
	if err != nil {
		log.Fatalf("Failed to read image: %v", err)
	}
	fmt.Printf("✓ Loaded image: %s (%.2f KB)\n", imagePath, float64(len(imageBytes))/1024)

	// Detect MIME type from file extension
	mimeType := detectMIMEType(imagePath)
	fmt.Printf("✓ Detected MIME type: %s\n\n", mimeType)

	// Test 1: General image description
	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Println("TEST 1: General Image Description")
	fmt.Println("═══════════════════════════════════════════════════════")

	prompt1 := "Describe what you see in this image in detail."
	response1, err := aiClient.GenerateVision(ctx, imageBytes, mimeType, prompt1, 1024, 0.3, 0.9)
	if err != nil {
		log.Fatalf("Vision analysis failed: %v", err)
	}
	fmt.Printf("\nPrompt: %s\n", prompt1)
	fmt.Printf("\nResponse:\n%s\n\n", response1)

	// Test 2: Receipt/Document extraction (if it looks like a receipt)
	if strings.Contains(strings.ToLower(imagePath), "receipt") ||
		strings.Contains(strings.ToLower(imagePath), "invoice") {
		fmt.Println("═══════════════════════════════════════════════════════")
		fmt.Println("TEST 2: Receipt Data Extraction")
		fmt.Println("═══════════════════════════════════════════════════════")

		prompt2 := `Analyze this receipt/invoice and extract:
1. Company/merchant name
2. Total amount and currency
3. Date
4. Items purchased (if visible)
5. Payment method (if visible)

Format as JSON.`

		response2, err := aiClient.GenerateVision(ctx, imageBytes, mimeType, prompt2, 2048, 0.1, 0.9)
		if err != nil {
			log.Printf("Receipt extraction failed: %v", err)
		} else {
			fmt.Printf("\nPrompt: %s\n", prompt2)
			fmt.Printf("\nResponse:\n%s\n\n", response2)
		}
	}

	// Test 3: Dark pattern detection (if it looks like a screenshot)
	if strings.Contains(strings.ToLower(imagePath), "screenshot") ||
		strings.Contains(strings.ToLower(imagePath), "screen") ||
		strings.Contains(strings.ToLower(imagePath), "ui") {
		fmt.Println("═══════════════════════════════════════════════════════")
		fmt.Println("TEST 3: Dark Pattern Detection")
		fmt.Println("═══════════════════════════════════════════════════════")

		prompt3 := `Analyze this UI screenshot for dark patterns:
1. Hidden costs or fees
2. Confusing cancellation flows
3. Pre-selected options that benefit the company
4. Urgency/scarcity tactics
5. Difficult-to-find unsubscribe buttons

List any dark patterns found with severity (low/medium/high).`

		response3, err := aiClient.GenerateVision(ctx, imageBytes, mimeType, prompt3, 2048, 0.2, 0.9)
		if err != nil {
			log.Printf("Dark pattern detection failed: %v", err)
		} else {
			fmt.Printf("\nPrompt: %s\n", prompt3)
			fmt.Printf("\nResponse:\n%s\n\n", response3)
		}
	}

	fmt.Println("═══════════════════════════════════════════════════════")
	fmt.Println("✓ All tests completed successfully!")
	fmt.Println("═══════════════════════════════════════════════════════")
}

// detectMIMEType returns the MIME type based on file extension.
func detectMIMEType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	default:
		return "image/jpeg" // default fallback
	}
}
