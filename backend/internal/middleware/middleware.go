// Package middleware provides Lambda middleware for logging, auth, and error handling.
package middleware

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/aws/aws-lambda-go/events"
)

// ─── Logger ──────────────────────────────────────────────────────────────────

// Logger provides structured logging for Lambda agents.
type Logger struct {
	Agent     string
	StartTime time.Time
}

// NewLogger creates a new structured logger for the given agent.
func NewLogger(agentName string) *Logger {
	return &Logger{
		Agent:     agentName,
		StartTime: time.Now(),
	}
}

// Info logs an informational message with structured fields.
func (l *Logger) Info(msg string, fields ...interface{}) {
	l.log("INFO", msg, fields...)
}

// Error logs an error message with structured fields.
func (l *Logger) Error(msg string, fields ...interface{}) {
	l.log("ERROR", msg, fields...)
}

// Warn logs a warning message with structured fields.
func (l *Logger) Warn(msg string, fields ...interface{}) {
	l.log("WARN", msg, fields...)
}

// Debug logs a debug message with structured fields (only in dev).
func (l *Logger) Debug(msg string, fields ...interface{}) {
	if os.Getenv("LOG_LEVEL") == "debug" {
		l.log("DEBUG", msg, fields...)
	}
}

// log writes a structured JSON log entry to stdout (for CloudWatch).
func (l *Logger) log(level, msg string, fields ...interface{}) {
	entry := map[string]interface{}{
		"level":     level,
		"agent":     l.Agent,
		"message":   msg,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		"elapsed":   time.Since(l.StartTime).Milliseconds(),
	}

	// Parse key-value pairs from fields
	for i := 0; i < len(fields)-1; i += 2 {
		key, ok := fields[i].(string)
		if ok {
			value := fields[i+1]
			if err, ok := value.(error); ok && err != nil {
				entry[key] = err.Error()
				continue
			}
			entry[key] = value
		}
	}

	jsonEntry, _ := json.Marshal(entry)
	fmt.Println(string(jsonEntry))
}

// ─── API Gateway Response Helpers ───────────────────────────────────────────

// SuccessResponse creates a 200 API Gateway response with JSON body.
func SuccessResponse(body interface{}) events.APIGatewayProxyResponse {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return ErrorResponse(500, "Failed to serialize response")
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type,Authorization",
		},
		Body: string(jsonBody),
	}
}

// ErrorResponse creates an error API Gateway response.
func ErrorResponse(statusCode int, message string) events.APIGatewayProxyResponse {
	body := map[string]interface{}{
		"error":     message,
		"status":    statusCode,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	jsonBody, _ := json.Marshal(body)

	return events.APIGatewayProxyResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"Content-Type":                 "application/json",
			"Access-Control-Allow-Origin":  "*",
			"Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type,Authorization",
		},
		Body: string(jsonBody),
	}
}

// ─── Cognito Auth Middleware ─────────────────────────────────────────────────

// ExtractUserID extracts the Cognito user ID from the API Gateway request context.
func ExtractUserID(request events.APIGatewayProxyRequest) (string, error) {
	claims, ok := request.RequestContext.Authorizer["claims"]
	if !ok {
		return "", fmt.Errorf("no authorization claims found")
	}

	claimsMap, ok := claims.(map[string]interface{})
	if !ok {
		return "", fmt.Errorf("invalid claims format")
	}

	sub, ok := claimsMap["sub"].(string)
	if !ok {
		return "", fmt.Errorf("user sub not found in claims")
	}

	return sub, nil
}
