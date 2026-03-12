// Gmail Fetcher Lambda
// Scheduled Lambda that fetches receipts from YOUR Gmail and triggers Auditor
//
// Trigger: EventBridge (daily at 9 AM)
// Output: Uploads receipts to S3, invokes Auditor Lambda
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	sdkaws "github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/config"
	"github.com/subsentinel/subsentinel/internal/google"
)

type GmailFetcherEvent struct {
	// EventBridge scheduled event (empty payload)
}

type GmailFetcherResponse struct {
	ReceiptsFetched  int      `json:"receipts_fetched"`
	ReceiptsUploaded int      `json:"receipts_uploaded"`
	S3Keys           []string `json:"s3_keys"`
	Error            string   `json:"error,omitempty"`
}

func handler(ctx context.Context, event GmailFetcherEvent) (GmailFetcherResponse, error) {
	log.Println("🚀 Gmail Fetcher Lambda started")

	// Load config
	cfg := config.MustLoad()

	// Validate Gmail credentials
	if !cfg.HasGmailCredentials() {
		return GmailFetcherResponse{
			Error: "Gmail credentials not configured",
		}, fmt.Errorf("missing Gmail OAuth credentials")
	}

	// Create Gmail client
	gmailClient, err := google.NewGmailClient(ctx, cfg)
	if err != nil {
		return GmailFetcherResponse{
			Error: fmt.Sprintf("Failed to create Gmail client: %v", err),
		}, err
	}

	log.Println("✅ Gmail client created")

	// Fetch receipts
	messages, err := gmailClient.FetchReceipts(ctx)
	if err != nil {
		return GmailFetcherResponse{
			Error: fmt.Sprintf("Failed to fetch receipts: %v", err),
		}, err
	}

	log.Printf("✅ Fetched %d receipts from Gmail", len(messages))

	if len(messages) == 0 {
		return GmailFetcherResponse{
			ReceiptsFetched:  0,
			ReceiptsUploaded: 0,
		}, nil
	}

	// Create AWS clients
	awsClients, err := awswrap.NewClients(ctx, cfg)
	if err != nil {
		return GmailFetcherResponse{
			Error: fmt.Sprintf("Failed to create AWS clients: %v", err),
		}, err
	}

	// Upload receipts to S3
	var s3Keys []string
	uploadedCount := 0

	for _, msg := range messages {
		// Upload email body as text — bytes.NewReader wraps []byte as io.Reader
		bodyKey := fmt.Sprintf("gmail/%s/%s.txt", time.Now().Format("2006-01-02"), msg.MessageID)
		_, err := awsClients.S3.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      sdkaws.String(cfg.ReceiptsBucket),
			Key:         sdkaws.String(bodyKey),
			Body:        bytes.NewReader([]byte(msg.Body)),
			ContentType: sdkaws.String("text/plain"),
			Metadata: map[string]string{
				"from":       msg.From,
				"subject":    msg.Subject,
				"date":       msg.Date,
				"message-id": msg.MessageID,
			},
		})
		if err != nil {
			log.Printf("⚠️  Failed to upload body for %s: %v", msg.MessageID, err)
			continue
		}

		s3Keys = append(s3Keys, bodyKey)
		uploadedCount++

		// Upload attachments (PDFs, images)
		for _, att := range msg.Attachments {
			// Decode base64 attachment data
			data, err := base64.URLEncoding.DecodeString(string(att.Data))
			if err != nil {
				log.Printf("⚠️  Failed to decode attachment %s: %v", att.Filename, err)
				continue
			}

			attKey := fmt.Sprintf("gmail/%s/%s/%s", time.Now().Format("2006-01-02"), msg.MessageID, att.Filename)
			_, err = awsClients.S3.PutObject(ctx, &s3.PutObjectInput{
				Bucket:      sdkaws.String(cfg.ReceiptsBucket),
				Key:         sdkaws.String(attKey),
				Body:        bytes.NewReader(data), // wrap []byte as io.Reader
				ContentType: sdkaws.String(att.MimeType),
				Metadata: map[string]string{
					"from":          msg.From,
					"subject":       msg.Subject,
					"message-id":    msg.MessageID,
					"attachment-id": att.AttachmentID,
				},
			})
			if err != nil {
				log.Printf("⚠️  Failed to upload attachment %s: %v", att.Filename, err)
				continue
			}

			s3Keys = append(s3Keys, attKey)
			uploadedCount++
		}

		log.Printf("✅ Uploaded receipt: %s (from: %s)", msg.Subject, msg.From)
	}

	log.Printf("✅ Uploaded %d receipts to S3", uploadedCount)

	// TODO: Invoke Auditor Lambda for each receipt
	// This will be done via S3 event notification -> Auditor Lambda

	return GmailFetcherResponse{
		ReceiptsFetched:  len(messages),
		ReceiptsUploaded: uploadedCount,
		S3Keys:           s3Keys,
	}, nil
}

func main() {
	lambda.Start(handler)
}
