// Package aws provides DynamoDB operations for SubSentinel
package aws

import (
	"context"
	"fmt"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb/types"
	"github.com/subsentinel/subsentinel/internal/models"
)

func subscriptionsTableName() string {
	if tableName := os.Getenv("SUBSCRIPTIONS_TABLE"); tableName != "" {
		return tableName
	}
	return "SubSentinel-Subscriptions"
}

// GetSubscriptions retrieves all subscriptions for a user
func (c *Clients) GetSubscriptions(ctx context.Context, userID string) ([]models.Subscription, error) {
	input := &dynamodb.QueryInput{
		TableName:              aws.String(subscriptionsTableName()),
		KeyConditionExpression: aws.String("user_id = :userId"),
		ExpressionAttributeValues: map[string]types.AttributeValue{
			":userId": &types.AttributeValueMemberS{Value: userID},
		},
	}

	result, err := c.DynamoDB.Query(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("query subscriptions: %w", err)
	}

	var subscriptions []models.Subscription
	if err := attributevalue.UnmarshalListOfMaps(result.Items, &subscriptions); err != nil {
		return nil, fmt.Errorf("unmarshal subscriptions: %w", err)
	}

	return subscriptions, nil
}

// GetSubscription retrieves a single subscription by ID
// Note: This requires both user_id and subscription_id since they form a composite key
func (c *Clients) GetSubscription(ctx context.Context, userID, subscriptionID string) (*models.Subscription, error) {
	input := &dynamodb.GetItemInput{
		TableName: aws.String(subscriptionsTableName()),
		Key: map[string]types.AttributeValue{
			"user_id":        &types.AttributeValueMemberS{Value: userID},
			"subscription_id": &types.AttributeValueMemberS{Value: subscriptionID},
		},
	}

	result, err := c.DynamoDB.GetItem(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
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

// PutSubscription creates or updates a subscription
func (c *Clients) PutSubscription(ctx context.Context, sub *models.Subscription) error {
	item, err := attributevalue.MarshalMap(sub)
	if err != nil {
		return fmt.Errorf("marshal subscription: %w", err)
	}

	// Ensure user_id and subscription_id are set for the table schema
	item["user_id"] = &types.AttributeValueMemberS{Value: sub.UserID}
	item["subscription_id"] = &types.AttributeValueMemberS{Value: sub.SubscriptionID}

	input := &dynamodb.PutItemInput{
		TableName: aws.String(subscriptionsTableName()),
		Item:      item,
	}

	if _, err := c.DynamoDB.PutItem(ctx, input); err != nil {
		return fmt.Errorf("put subscription: %w", err)
	}

	return nil
}

// DeleteSubscription deletes a subscription by ID
// Note: This requires both user_id and subscription_id since they form a composite key
func (c *Clients) DeleteSubscription(ctx context.Context, userID, subscriptionID string) error {
	input := &dynamodb.DeleteItemInput{
		TableName: aws.String(subscriptionsTableName()),
		Key: map[string]types.AttributeValue{
			"user_id":        &types.AttributeValueMemberS{Value: userID},
			"subscription_id": &types.AttributeValueMemberS{Value: subscriptionID},
		},
	}

	if _, err := c.DynamoDB.DeleteItem(ctx, input); err != nil {
		return fmt.Errorf("delete subscription: %w", err)
	}

	return nil
}
