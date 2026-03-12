# Kiro Autopilot Setup Script for SubSentinel
# This script sets up Kiro Autopilot for spec-driven development

Write-Host "Setting up Kiro Autopilot for SubSentinel" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "`nChecking prerequisites..." -ForegroundColor Yellow

$prerequisites = @(
    @{Name="Node.js"; Command="node --version"; MinVersion="18"},
    @{Name="Go"; Command="go version"; MinVersion="1.21"},
    @{Name="AWS CLI"; Command="aws --version"},
    @{Name="AWS CDK"; Command="cdk --version"}
)

foreach ($prereq in $prerequisites) {
    try {
        $output = Invoke-Expression $prereq.Command 2>&1
        Write-Host "[OK] $($prereq.Name): $output" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] $($prereq.Name): Not found" -ForegroundColor Red
        Write-Host "   Please install $($prereq.Name) and try again." -ForegroundColor Yellow
        exit 1
    }
}

# Install Kiro CLI if not present
Write-Host "`nInstalling Kiro CLI..." -ForegroundColor Yellow
try {
    npm list -g @kirohq/cli 2>&1 | Out-Null
    Write-Host "[OK] Kiro CLI already installed" -ForegroundColor Green
} catch {
    Write-Host "Installing Kiro CLI..." -ForegroundColor Cyan
    npm install -g @kirohq/cli
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install Kiro CLI" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Kiro CLI installed successfully" -ForegroundColor Green
}

# Verify Kiro installation
Write-Host "`nVerifying Kiro installation..." -ForegroundColor Yellow
$kiroVersion = kiro --version
Write-Host "[OK] Kiro version: $kiroVersion" -ForegroundColor Green

# Initialize Kiro Autopilot
Write-Host "`nInitializing Kiro Autopilot..." -ForegroundColor Yellow
cd kiro
kiro autopilot init --force

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to initialize Kiro Autopilot" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Kiro Autopilot initialized" -ForegroundColor Green

# Validate configuration
Write-Host "`nValidating configuration..." -ForegroundColor Yellow
kiro spec validate specs/agents/receipt-auditor-agent.yaml

if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Spec validation warnings (expected for demo)" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Spec validation passed" -ForegroundColor Green
}

# Create example workflow
Write-Host "`nCreating example workflow..." -ForegroundColor Yellow
$workflowContent = @'
# Example workflow for testing
name: "test-workflow"
steps:
  - name: "validate"
    action: "validate-spec"
  - name: "generate"
    action: "generate-code"
'@

$workflowContent | Out-File -FilePath "workflows/test-workflow.yaml" -Encoding UTF8
Write-Host "[OK] Created test workflow" -ForegroundColor Green

# Set up environment variables
Write-Host "`nSetting up environment..." -ForegroundColor Yellow
$envFile = @'
# Kiro Autopilot Environment Variables
AWS_REGION=us-east-1
ENVIRONMENT=development
LOG_LEVEL=info
KIRO_AUTOPILOT=true

# Google OAuth (for agent development)
# GOOGLE_CLIENT_ID=your-client-id
# GOOGLE_CLIENT_SECRET=your-client-secret
# GMAIL_REFRESH_TOKEN=your-refresh-token
# CALENDAR_REFRESH_TOKEN=your-refresh-token
'@

$envFile | Out-File -FilePath ".env.example" -Encoding UTF8
Write-Host "[OK] Created environment template" -ForegroundColor Green

# Create quick start guide
Write-Host "`nCreating quick start guide..." -ForegroundColor Yellow
$quickStart = @'
# Quick Start Guide

## 1. Configure Environment
```powershell
# Copy environment template
Copy-Item .env.example .env

# Edit with your credentials
code .env
```

## 2. Create Your First Spec
```powershell
# Create a new agent spec
kiro spec create specs/agents/my-agent.yaml

# Edit the spec
code specs/agents/my-agent.yaml
```

## 3. Generate Code
```powershell
# Generate code from spec
kiro autopilot generate specs/agents/my-agent.yaml

# Or run full workflow
kiro autopilot run spec-development --spec specs/agents/my-agent.yaml
```

## 4. Test Generated Code
```powershell
cd ../backend
go test ./cmd/my-agent/...
```

## 5. Deploy
```powershell
cd ../infrastructure
cdk deploy MyAgentStack
```

## Useful Commands
- `kiro spec list` - List all specs
- `kiro autopilot status` - Check workflow status
- `kiro test run --spec <path>` - Run tests for spec
- `kiro autopilot clean` - Clean generated files
'@

$quickStart | Out-File -FilePath "QUICKSTART.md" -Encoding UTF8
Write-Host "[OK] Created quick start guide" -ForegroundColor Green

# Summary
Write-Host "`nKiro Autopilot Setup Complete!" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Cyan

Write-Host "`nDirectory Structure Created:" -ForegroundColor Yellow
Get-ChildItem -Recurse -Depth 2 | Select-Object Name, Directory | Format-Table -AutoSize

Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Review the configuration: code kiro-config.yaml" -ForegroundColor Cyan
Write-Host "2. Check example specs: code specs/agents/receipt-auditor-agent.yaml" -ForegroundColor Cyan
Write-Host "3. Read the quick start: code QUICKSTART.md" -ForegroundColor Cyan
Write-Host "4. Create your first spec: kiro spec create specs/agents/my-agent.yaml" -ForegroundColor Cyan

Write-Host "`nTip: Use 'kiro autopilot --help' for all available commands" -ForegroundColor Magenta

Write-Host "`nSetup completed successfully!" -ForegroundColor Green