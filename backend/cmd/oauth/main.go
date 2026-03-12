// OAuth Token Generator for SubSentinel
// Run this ONCE to get Gmail and Calendar refresh tokens
//
// Usage:
//
//	go run cmd/oauth/main.go
//
// This will:
// 1. Open your browser for Google OAuth authorization
// 2. Generate refresh tokens for Gmail + Calendar
// 3. Print tokens to copy into .env file
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/calendar/v3"
	"google.golang.org/api/gmail/v1"

	"github.com/subsentinel/subsentinel/internal/config"
)

func main() {
	fmt.Println("🔐 SubSentinel OAuth Token Generator")
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()

	// Load config from .env
	cfg := config.MustLoad()

	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" {
		log.Fatal("❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env\n" +
			"   Get these from: https://console.cloud.google.com\n" +
			"   Project: SubSentinel-Demo > APIs & Services > Credentials")
	}

	// OAuth config with BOTH Gmail and Calendar scopes
	oauthConfig := &oauth2.Config{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  "http://localhost:3000/callback",
		Scopes: []string{
			gmail.GmailReadonlyScope,       // Read Gmail receipts
			calendar.CalendarReadonlyScope, // Read Calendar events
		},
		Endpoint: google.Endpoint,
	}

	// Generate authorization URL
	authURL := oauthConfig.AuthCodeURL("state-token", oauth2.AccessTypeOffline, oauth2.ApprovalForce)

	fmt.Println("📱 Step 1: Authorize SubSentinel")
	fmt.Println("   Open this URL in your browser:")
	fmt.Println()
	fmt.Println("   " + authURL)
	fmt.Println()
	fmt.Println("   Sign in with YOUR Gmail account")
	fmt.Println("   Allow access to Gmail (read-only) and Calendar (read-only)")
	fmt.Println()
	fmt.Println("🌐 Step 2: Starting local server on http://localhost:3000")
	fmt.Println("   Waiting for authorization callback...")
	fmt.Println()

	// Channel to receive the authorization code
	codeChan := make(chan string)
	errChan := make(chan error)

	// Start HTTP server to receive callback
	http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			errChan <- fmt.Errorf("no authorization code received")
			return
		}

		fmt.Fprintf(w, `
			<html>
			<head><title>SubSentinel OAuth</title></head>
			<body style="font-family: Arial; text-align: center; padding: 50px;">
				<h1>✅ Authorization Successful!</h1>
				<p>You can close this window and return to the terminal.</p>
			</body>
			</html>
		`)

		codeChan <- code
	})

	server := &http.Server{Addr: ":3000"}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- err
		}
	}()

	// Wait for authorization code or error
	var code string
	select {
	case code = <-codeChan:
		fmt.Println("✅ Authorization code received!")
	case err := <-errChan:
		log.Fatalf("❌ Authorization failed: %v", err)
	}

	// Shutdown server
	ctx := context.Background()
	server.Shutdown(ctx)

	// Exchange code for token
	fmt.Println()
	fmt.Println("🔄 Step 3: Exchanging code for refresh token...")
	token, err := oauthConfig.Exchange(ctx, code)
	if err != nil {
		log.Fatalf("❌ Token exchange failed: %v", err)
	}

	fmt.Println("✅ Refresh token obtained!")
	fmt.Println()
	fmt.Println("=" + repeat("=", 49))
	fmt.Println("📋 COPY THESE TO YOUR .env FILE:")
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()
	fmt.Printf("GMAIL_REFRESH_TOKEN=%s\n", token.RefreshToken)
	fmt.Println()
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()
	fmt.Println("📋 CALENDAR OAUTH - Store in AWS Secrets Manager:")
	fmt.Println("   Secret ARN: SubSentinel/CalendarOAuth")
	fmt.Println("   Format: {\"clientId\": \"...\", \"clientSecret\": \"...\", \"refreshToken\": \"...\", \"redirectUri\": \"...\"}")
	fmt.Printf("   Refresh Token: %s\n", token.RefreshToken)
	fmt.Println()
	fmt.Println("=" + repeat("=", 49))
	fmt.Println()
	fmt.Println("✅ Setup complete! Next steps:")
	fmt.Println("   1. Copy GMAIL_REFRESH_TOKEN to backend/.env")
	fmt.Println("   2. Store Calendar OAuth in AWS Secrets Manager (see above)")
	fmt.Println("   3. Test Gmail: go run cmd/test-gmail/main.go")
	fmt.Println("   4. Test Calendar: go run cmd/test-calendar/main.go")
	fmt.Println()

	// Save to file for convenience
	tokenData := map[string]string{
		"gmail_refresh_token": token.RefreshToken,
		"calendar_oauth_json": fmt.Sprintf(`{"clientId": "%s", "clientSecret": "%s", "refreshToken": "%s", "redirectUri": "%s"}`,
			cfg.GoogleClientID, cfg.GoogleClientSecret, token.RefreshToken, cfg.GoogleRedirectURI),
		"client_id":     cfg.GoogleClientID,
		"client_secret": cfg.GoogleClientSecret,
	}

	data, _ := json.MarshalIndent(tokenData, "", "  ")
	filename := "oauth-tokens.json"
	if err := os.WriteFile(filename, data, 0600); err == nil {
		fmt.Printf("💾 Tokens also saved to: %s\n", filename)
		fmt.Println("   ⚠️  DELETE this file after copying to .env (security!)")
		fmt.Println()
	}
}

func repeat(s string, count int) string {
	result := ""
	for i := 0; i < count; i++ {
		result += s
	}
	return result
}
