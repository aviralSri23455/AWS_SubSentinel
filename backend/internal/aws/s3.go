// Package aws provides S3 operations for file storage
package aws

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// UploadReceipt uploads a receipt file to S3
func (c *Clients) UploadReceipt(ctx context.Context, bucket, key string, body io.Reader, contentType string) error {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	}

	_, err := c.S3.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("upload to s3: %w", err)
	}

	return nil
}

// UploadScreenshot uploads a screenshot file to S3
func (c *Clients) UploadScreenshot(ctx context.Context, bucket, key string, body io.Reader, contentType string) error {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	}

	_, err := c.S3.PutObject(ctx, input)
	if err != nil {
		return fmt.Errorf("upload screenshot to s3: %w", err)
	}

	return nil
}

// GetReceiptURL generates a presigned URL for receipt upload
func (c *Clients) GetReceiptURL(ctx context.Context, bucket, key string) (string, error) {
	presignClient := s3.NewPresignClient(c.S3)
	
	request, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", fmt.Errorf("generate presigned url: %w", err)
	}

	return request.URL, nil
}
