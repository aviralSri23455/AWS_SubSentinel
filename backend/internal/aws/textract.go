// Package aws provides Textract operations for receipt text extraction
package aws

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/textract"
	"github.com/aws/aws-sdk-go-v2/service/textract/types"
)

// ExtractReceiptText uses Textract to extract text from a receipt image in S3
func (c *Clients) ExtractReceiptText(ctx context.Context, bucket, key string) (string, error) {
	input := &textract.DetectDocumentTextInput{
		Document: &types.Document{
			S3Object: &types.S3Object{
				Bucket: aws.String(bucket),
				Name:   aws.String(key),
			},
		},
	}

	result, err := c.Textract.DetectDocumentText(ctx, input)
	if err != nil {
		return "", fmt.Errorf("textract detect text: %w", err)
	}

	// Concatenate all detected text blocks
	var extractedText string
	for _, block := range result.Blocks {
		if block.BlockType == types.BlockTypeLine && block.Text != nil {
			extractedText += *block.Text + "\n"
		}
	}

	return extractedText, nil
}

// ExtractReceiptTextFromBytes uses Textract to extract text from receipt image bytes
func (c *Clients) ExtractReceiptTextFromBytes(ctx context.Context, imageBytes []byte) (string, error) {
	input := &textract.DetectDocumentTextInput{
		Document: &types.Document{
			Bytes: imageBytes,
		},
	}

	result, err := c.Textract.DetectDocumentText(ctx, input)
	if err != nil {
		return "", fmt.Errorf("textract detect text from bytes: %w", err)
	}

	// Concatenate all detected text blocks
	var extractedText string
	for _, block := range result.Blocks {
		if block.BlockType == types.BlockTypeLine && block.Text != nil {
			extractedText += *block.Text + "\n"
		}
	}

	return extractedText, nil
}
