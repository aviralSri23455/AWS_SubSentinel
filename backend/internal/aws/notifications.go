// Package aws provides thin wrappers around AWS SDK v2 clients
// used by SubSentinel agents. All clients are initialized once per
// Lambda cold start and reused across invocations.
package aws

import (
	"context"
	"fmt"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/ses"
	sesTypes "github.com/aws/aws-sdk-go-v2/service/ses/types"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snsTypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
)

// EmailRequest represents an email to be sent via AWS SES
type EmailRequest struct {
	To          string
	Subject     string
	Body        string
	From        string
	ReplyTo     string
	IsHTML      bool
	CC          []string
	BCC         []string
}

// NotificationRequest represents a notification to be sent via AWS SNS
type NotificationRequest struct {
	TopicARN string
	Subject  string
	Message  string
	// Optional attributes for SNS message
	Attributes map[string]string
}

// SendEmail sends an email using AWS SES
func (c *Clients) SendEmail(ctx context.Context, req EmailRequest) error {
	if req.From == "" {
		// Use the verified email from environment
		req.From = c.AppConfig.SESVerifiedEmail
		if req.From == "" {
			return fmt.Errorf("no sender email configured. Set SES_VERIFIED_EMAIL in .env")
		}
	}

	// Prepare email destination
	destination := &sesTypes.Destination{
		ToAddresses: []string{req.To},
	}
	
	if len(req.CC) > 0 {
		destination.CcAddresses = req.CC
	}
	
	if len(req.BCC) > 0 {
		destination.BccAddresses = req.BCC
	}

	// Prepare message body
	body := &sesTypes.Body{}
	if req.IsHTML {
		body.Html = &sesTypes.Content{
			Data:    aws.String(req.Body),
			Charset: aws.String("UTF-8"),
		}
	} else {
		body.Text = &sesTypes.Content{
			Data:    aws.String(req.Body),
			Charset: aws.String("UTF-8"),
		}
	}

	// Create message
	message := &sesTypes.Message{
		Subject: &sesTypes.Content{
			Data:    aws.String(req.Subject),
			Charset: aws.String("UTF-8"),
		},
		Body: body,
	}

	// Prepare send email input
	input := &ses.SendEmailInput{
		Source:      aws.String(req.From),
		Destination: destination,
		Message:     message,
	}

	if req.ReplyTo != "" {
		input.ReplyToAddresses = []string{req.ReplyTo}
	}

	// Send email
	_, err := c.SES.SendEmail(ctx, input)
	if err != nil {
		// Check if the error is due to unverified email
		errStr := err.Error()
		if strings.Contains(errStr, "Email address is not verified") || 
		   strings.Contains(errStr, "not verified") ||
		   strings.Contains(errStr, "verification") {
			return fmt.Errorf("email address %s is not verified in AWS SES. Please verify it in the AWS SES console: %w", req.From, err)
		}
		return fmt.Errorf("failed to send email via SES: %w", err)
	}

	return nil
}

// SendNotification sends a notification using AWS SNS
func (c *Clients) SendNotification(ctx context.Context, req NotificationRequest) (string, error) {
	if req.TopicARN == "" {
		// Use default notification topic from environment
		req.TopicARN = c.AppConfig.SNSNotificationsTopicARN
		if req.TopicARN == "" {
			return "", fmt.Errorf("no SNS topic ARN configured. Set SNS_NOTIFICATIONS_TOPIC_ARN in .env")
		}
	}

	// Prepare message attributes
	var messageAttributes map[string]snsTypes.MessageAttributeValue
	if len(req.Attributes) > 0 {
		messageAttributes = make(map[string]snsTypes.MessageAttributeValue)
		for key, value := range req.Attributes {
			messageAttributes[key] = snsTypes.MessageAttributeValue{
				DataType:    aws.String("String"),
				StringValue: aws.String(value),
			}
		}
	}

	// Prepare publish input
	input := &sns.PublishInput{
		TopicArn:          aws.String(req.TopicARN),
		Subject:           aws.String(req.Subject),
		Message:           aws.String(req.Message),
		MessageAttributes: messageAttributes,
	}

	// Publish notification
	result, err := c.SNS.Publish(ctx, input)
	if err != nil {
		return "", fmt.Errorf("failed to publish notification via SNS: %w", err)
	}

	return *result.MessageId, nil
}

// SendEmailNotification sends an email and also publishes a notification to SNS
func (c *Clients) SendEmailNotification(ctx context.Context, emailReq EmailRequest, notificationReq NotificationRequest) error {
	// Send email
	if err := c.SendEmail(ctx, emailReq); err != nil {
		return fmt.Errorf("failed to send email: %w", err)
	}

	// Send notification
	messageID, err := c.SendNotification(ctx, notificationReq)
	if err != nil {
		// Log the error but don't fail the entire operation
		// The email was sent successfully, just the notification failed
		fmt.Printf("Warning: Failed to send SNS notification (email was sent): %v\n", err)
		return nil
	}

	fmt.Printf("Email sent successfully and notification published (MessageId: %s)\n", messageID)
	return nil
}

// SendNegotiationEmail sends a negotiation email with proper formatting
func (c *Clients) SendNegotiationEmail(ctx context.Context, to, provider, subject, emailBody string) error {
	// Format the email with proper HTML
	htmlBody := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>%s</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { padding: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        .signature { margin-top: 20px; font-style: italic; }
    </style>
</head>
<body>
    <div class="header">
        <h2>SubSentinel Negotiation</h2>
        <p>Provider: %s</p>
    </div>
    <div class="content">
        %s
    </div>
    <div class="footer">
        <p>This email was generated by SubSentinel, an AI-powered subscription management assistant.</p>
        <p>Sent via AWS SES</p>
    </div>
</body>
</html>
`, subject, provider, strings.ReplaceAll(emailBody, "\n", "<br>"))

	// Create email request
	emailReq := EmailRequest{
		To:      to,
		Subject: subject,
		Body:    htmlBody,
		IsHTML:  true,
		From:    c.AppConfig.SESVerifiedEmail,
		ReplyTo: c.AppConfig.SESVerifiedEmail,
	}

	// Send email
	err := c.SendEmail(ctx, emailReq)
	if err != nil {
		// Check if this is a sandbox mode error (recipient not verified)
		errStr := err.Error()
		if strings.Contains(errStr, "Email address is not verified") || 
		   strings.Contains(errStr, "not verified") ||
		   strings.Contains(errStr, "MessageRejected") {
			// This is likely AWS SES sandbox mode
			// In sandbox mode, both sender and recipient must be verified
			// For now, we'll return a more helpful error
			return fmt.Errorf("AWS SES sandbox mode restriction: %v\n\nNote: In AWS SES sandbox mode, both sender and recipient emails must be verified. The recipient email '%s' needs to be verified in AWS SES Console.", err, to)
		}
		return err
	}

	return nil
}

// SendNegotiationNotification sends a notification about a negotiation email being sent
func (c *Clients) SendNegotiationNotification(ctx context.Context, draftID, provider, to string, successRate float64) (string, error) {
	// Create notification message
	message := fmt.Sprintf(
		"Negotiation email sent to %s for %s\n\n"+
			"Draft ID: %s\n"+
			"Success Rate: %.1f%%\n"+
			"Timestamp: %s",
		to, provider, draftID, successRate*100, "now",
	)

	// Create notification request
	notificationReq := NotificationRequest{
		Subject: fmt.Sprintf("Negotiation Email Sent - %s", provider),
		Message: message,
		Attributes: map[string]string{
			"draftId":     draftID,
			"provider":    provider,
			"type":        "negotiation_email_sent",
			"successRate": fmt.Sprintf("%.1f", successRate*100),
		},
	}

	// Send notification
	return c.SendNotification(ctx, notificationReq)
}