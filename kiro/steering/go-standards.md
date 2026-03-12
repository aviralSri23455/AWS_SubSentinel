# Go Coding Standards

## Version
- **Go 1.21+** required
- Use latest stable release features

## Project Structure
```
backend/
├── cmd/              # Application entry points
├── internal/         # Private application code
├── pkg/             # Public reusable packages
├── configs/         # Configuration files
└── go.mod           # Module definition
```

## Naming Conventions
- **Packages**: lowercase, single word, no underscores
- **Files**: snake_case.go for test files, camelCase.go otherwise
- **Variables**: camelCase, descriptive names
- **Constants**: CamelCase or UPPER_SNAKE_CASE
- **Interfaces**: -er suffix (Reader, Writer, Handler)

## Code Style
- **Imports**: Group stdlib, third-party, local imports
- **Error Handling**: Always check errors, use `errors.New()` or `fmt.Errorf()`
- **Logging**: Use structured logging with context
- **Testing**: Table-driven tests, test helpers in `_test` packages

## Lambda Agent Standards
```go
// Agent structure
type Agent struct {
    logger    *zap.Logger
    clients   *aws.Clients
    config    *config.Config
}

// Handler signature
func (a *Agent) Handle(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
    // Parse input
    // Process request
    // Return response
}

// Error response helper
func errorResponse(err error, status int) events.APIGatewayProxyResponse {
    return events.APIGatewayProxyResponse{
        StatusCode: status,
        Body:       fmt.Sprintf(`{"error": "%s"}`, err.Error()),
    }
}
```

## TOON Protocol Implementation
```go
// TOON encoding
func EncodeToTOON(data interface{}) (string, error) {
    // Convert Go structs to TOON format
    // 60% token savings vs JSON
}

// TOON decoding  
func DecodeFromTOON(toonStr string, target interface{}) error {
    // Parse TOON to Go structs
}
```

## Testing Standards
- **Unit Tests**: Test individual functions/methods
- **Integration Tests**: Test with AWS services (use mocks)
- **Performance Tests**: Benchmark critical paths
- **Coverage**: Aim for 80%+ test coverage

## Dependencies
- **AWS SDK**: github.com/aws/aws-sdk-go-v2
- **Logging**: go.uber.org/zap
- **Testing**: github.com/stretchr/testify
- **HTTP**: net/http with middleware

## Build and Deployment
- **Binary Size**: Keep Lambda binaries under 10MB
- **Cold Start**: Optimize for < 100ms
- **Memory**: Target 128MB per agent
- **Timeout**: 30 seconds maximum per execution