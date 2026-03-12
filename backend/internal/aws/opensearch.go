// Package aws provides thin wrappers around AWS SDK v2 clients
package aws

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	v4 "github.com/aws/aws-sdk-go-v2/aws/signer/v4"
	"github.com/subsentinel/subsentinel/internal/config"
)

// OpenSearchClient provides AWS SigV4 signed HTTP client for OpenSearch Serverless
type OpenSearchClient struct {
	Endpoint  string
	Region    string
	Signer    *v4.Signer
	Config    *config.Config
	AWSConfig aws.Config
}

// NewOpenSearchClient creates a new OpenSearch client with AWS SigV4 signing
func NewOpenSearchClient(cfg aws.Config, appConfig *config.Config) *OpenSearchClient {
	return &OpenSearchClient{
		Endpoint:  appConfig.OpenSearchEndpoint,
		Region:    cfg.Region,
		Signer:    v4.NewSigner(),
		Config:    appConfig,
		AWSConfig: cfg,
	}
}

// Do sends an HTTP request to OpenSearch with AWS SigV4 signing
func (c *OpenSearchClient) Do(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	// Create request URL
	url := fmt.Sprintf("%s/%s", c.Endpoint, path)
	
	// Marshal body if provided
	var bodyReader io.Reader
	var payloadHash string
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
		
		// Calculate SHA256 hash of body
		hash := sha256.Sum256(bodyBytes)
		payloadHash = hex.EncodeToString(hash[:])
	} else {
		// Empty body hash
		payloadHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	}
	
	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Set headers
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	
	// Get AWS credentials
	creds, err := c.AWSConfig.Credentials.Retrieve(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve credentials: %w", err)
	}
	
	// Sign the request with AWS SigV4
	// For OpenSearch Serverless, the service name is "aoss"
	err = c.Signer.SignHTTP(ctx, creds, req, payloadHash, "aoss", c.Region, time.Now())
	if err != nil {
		return nil, fmt.Errorf("failed to sign request: %w", err)
	}
	
	// Send request
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	return client.Do(req)
}

// Search performs a search query on OpenSearch
func (c *OpenSearchClient) Search(ctx context.Context, index string, query map[string]interface{}) (map[string]interface{}, error) {
	path := fmt.Sprintf("%s/_search", index)
	
	resp, err := c.Do(ctx, "POST", path, query)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("opensearch error %d: %s", resp.StatusCode, string(body))
	}
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}
	
	return result, nil
}

// IndexDocument indexes a document in OpenSearch
func (c *OpenSearchClient) IndexDocument(ctx context.Context, index, id string, document interface{}) error {
	path := fmt.Sprintf("%s/_doc/%s", index, id)
	
	resp, err := c.Do(ctx, "PUT", path, document)
	if err != nil {
		return fmt.Errorf("index request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("opensearch error %d: %s", resp.StatusCode, string(body))
	}
	
	return nil
}

// DeleteDocument deletes a document from OpenSearch
func (c *OpenSearchClient) DeleteDocument(ctx context.Context, index, id string) error {
	path := fmt.Sprintf("%s/_doc/%s", index, id)
	
	resp, err := c.Do(ctx, "DELETE", path, nil)
	if err != nil {
		return fmt.Errorf("delete request failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 && resp.StatusCode != 404 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("opensearch error %d: %s", resp.StatusCode, string(body))
	}
	
	return nil
}

// HealthCheck checks if OpenSearch is accessible
func (c *OpenSearchClient) HealthCheck(ctx context.Context) error {
	resp, err := c.Do(ctx, "GET", "_cluster/health", nil)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode >= 400 {
		return fmt.Errorf("opensearch health check failed with status %d", resp.StatusCode)
	}
	
	return nil
}