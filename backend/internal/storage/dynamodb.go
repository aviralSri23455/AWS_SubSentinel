// Package storage provides DynamoDB storage for production use
package storage

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	awswrap "github.com/subsentinel/subsentinel/internal/aws"
	"github.com/subsentinel/subsentinel/internal/models"
)

// DynamoStore provides DynamoDB storage for subscriptions
type DynamoStore struct {
	client            *dynamodb.Client
	tableName         string
	darkPatternsTable string
}

// NewDynamoStore creates a new DynamoDB store
func NewDynamoStore(clients *awswrap.Clients, tableName string, darkPatternsTable string) *DynamoStore {
	return &DynamoStore{
		client:            clients.DynamoDB,
		tableName:         tableName,
		darkPatternsTable: darkPatternsTable,
	}
}

// GetSubscriptions retrieves all subscriptions for a user from DynamoDB
func (d *DynamoStore) GetSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(d.tableName),
		KeyConditionExpression: aws.String("user_id = :userId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":userId": &types.AttributeValueMemberS{Value: userID},
		},
	}

	result, err := d.client.Query(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("query subscriptions from DynamoDB table %q for user %q: %w", d.tableName, userID, err)
	}

	var subscriptions []models.Subscription
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &subscriptions); err != nil {
		return nil, fmt.Errorf("unmarshal subscriptions: %w", err)
	}

	return subscriptions, nil
}

// GetSubscription retrieves a single subscription by ID from DynamoDB
func (d *DynamoStore) GetSubscription(ctx context.Context, userID, subscriptionID string) (*models.Subscription, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(d.tableName),
		Key: map[string]types.AttributeValue{
			"user_id":        &types.AttributeValueMemberS{Value: userID},
			"subscription_id": &types.AttributeValueMemberS{Value: subscriptionID},
		},
	}

	result, err := d.client.GetItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("get subscription from DynamoDB table %q for user %q subscription %q: %w", d.tableName, userID, subscriptionID, err)
	}

	if result.Item == nil {
		return nil, fmt.Errorf("subscription not found")
	}

	var subscription models.Subscription
	if err := attributevalue.UnmarshalMap(result.Item, &subscription); err != nil {
		return nil, fmt.Errorf("unmarshal subscription: %w", err)
	}

	return &subscription, nil
}

// PutSubscription creates or updates a subscription in DynamoDB
func (d *DynamoStore) PutSubscription(ctx context.Context, sub *models.Subscription) error {
	item, err := attributevalue.MarshalMap(sub)
	if err != nil {
		return fmt.Errorf("marshal subscription: %w", err)
	}

	// Ensure user_id and subscription_id are set for the table schema
	item["user_id"] = &types.AttributeValueMemberS{Value: sub.UserID}
	item["subscription_id"] = &types.AttributeValueMemberS{Value: sub.SubscriptionID}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(d.tableName),
		Item:      item,
	}

	if _, err := d.client.PutItem(ctx, input); err != nil {
		return fmt.Errorf("put subscription to DynamoDB table %q for user %q subscription %q: %w", d.tableName, sub.UserID, sub.SubscriptionID, err)
	}

	return nil
}

// DeleteSubscription deletes a subscription by ID from DynamoDB
func (d *DynamoStore) DeleteSubscription(ctx context.Context, userID, subscriptionID string) error {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(d.tableName),
		Key: map[string]types.AttributeValue{
			"user_id":        &types.AttributeValueMemberS{Value: userID},
			"subscription_id": &types.AttributeValueMemberS{Value: subscriptionID},
		},
	}

	if _, err := d.client.DeleteItem(ctx, input); err != nil {
		return fmt.Errorf("delete subscription from DynamoDB table %q for user %q subscription %q: %w", d.tableName, userID, subscriptionID, err)
	}

	return nil
}

// GetDarkPatterns retrieves all dark pattern reports for a user from DynamoDB
func (d *DynamoStore) GetDarkPatterns(ctx context.Context, userID string) ([]models.DarkPatternReport, error) {
	// Use Scan with filter since we can't query by userId (table might have pattern_id as PK)
	// Try both userId and user_id for backward compatibility
	input := &dynamodb.ScanInput{
		TableName:        aws.String(d.darkPatternsTable),
		FilterExpression: aws.String("userId = :userId OR user_id = :userId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":userId": &types.AttributeValueMemberS{Value: userID},
		},
	}

	result, err := d.client.Scan(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("scan dark patterns from DynamoDB table %q for user %q: %w", d.darkPatternsTable, userID, err)
	}

	var reports []models.DarkPatternReport
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &reports); err != nil {
		return nil, fmt.Errorf("unmarshal dark patterns: %w", err)
	}

	return reports, nil
}

// PutDarkPattern creates or updates a dark pattern report in DynamoDB
func (d *DynamoStore) PutDarkPattern(ctx context.Context, report *models.DarkPatternReport) error {
	// Use default user if not set
	userID := report.UserID
	if userID == "" {
		userID = "local-user"
		report.UserID = userID
	}

	item, err := attributevalue.MarshalMap(report)
	if err != nil {
		return fmt.Errorf("marshal dark pattern report: %w", err)
	}

	// For backward compatibility and query flexibility, ensure both naming conventions exist
	// The struct fields are marshaled as "userId" and "reportId" (from dynamodbav tags)
	// But we also want "user_id" and "pattern_id" for querying
	item["user_id"] = &types.AttributeValueMemberS{Value: userID}
	item["pattern_id"] = &types.AttributeValueMemberS{Value: report.ReportID}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(d.darkPatternsTable),
		Item:      item,
	}

	if _, err := d.client.PutItem(ctx, input); err != nil {
		return fmt.Errorf("put dark pattern report to DynamoDB table %q for user %q report %q: %w", d.darkPatternsTable, userID, report.ReportID, err)
	}

	return nil
}

// DeleteDarkPattern deletes a dark pattern report from DynamoDB
func (d *DynamoStore) DeleteDarkPattern(ctx context.Context, userID, reportID string) error {
	// DynamoDB table has composite key: user_id (HASH) + pattern_id (RANGE)
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(d.darkPatternsTable),
		Key: map[string]types.AttributeValue{
			"user_id":    &types.AttributeValueMemberS{Value: userID},
			"pattern_id": &types.AttributeValueMemberS{Value: reportID},
		},
	}

	_, err := d.client.DeleteItem(ctx, input)
	if err != nil {
		return fmt.Errorf("delete dark pattern report from DynamoDB table %q for user %q report %q: %w", d.darkPatternsTable, userID, reportID, err)
	}

	return nil
}
