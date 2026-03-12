# Cleanup SubSentinel Data Script
# This script clears all subscriptions and dark patterns from DynamoDB via the cleanup endpoint

Write-Host "🧹 Cleaning SubSentinel Data..." -ForegroundColor Cyan
Write-Host "====================================="
Write-Host ""

# Check if backend is running
Write-Host "Step 1: Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Backend is not running. Start it with: go run cmd/server/main.go" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Call the cleanup endpoint (deletes all subscriptions + dark patterns)
Write-Host "Step 2: Calling cleanup endpoint..." -ForegroundColor Yellow
try {
    $cleanupResult = Invoke-RestMethod -Uri "http://localhost:4000/v1/cleanup" -Method POST -UseBasicParsing
    $deletedSubs = $cleanupResult.deletedSubscriptions
    $deletedDP = $cleanupResult.deletedDarkPatterns
    Write-Host "  ✅ Deleted $deletedSubs subscriptions" -ForegroundColor Green
    Write-Host "  ✅ Deleted $deletedDP dark patterns" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Cleanup endpoint failed, trying individual endpoints..." -ForegroundColor Yellow
    
    # Fallback: Delete subscriptions individually
    Write-Host "  Clearing subscriptions..." -ForegroundColor Yellow
    try {
        $subscriptions = Invoke-RestMethod -Uri "http://localhost:4000/v1/subscriptions" -Method GET -UseBasicParsing
        $subCount = $subscriptions.count
        Write-Host "    Found $subCount subscriptions" -ForegroundColor Gray
        
        if ($subCount -gt 0) {
            # Try DELETE all at once
            try {
                $deleteResult = Invoke-WebRequest -Uri "http://localhost:4000/v1/subscriptions" -Method DELETE -UseBasicParsing
                Write-Host "    ✅ All subscriptions deleted" -ForegroundColor Green
            } catch {
                # Fallback: delete one by one
                foreach ($sub in $subscriptions.subscriptions) {
                    $subId = $sub.subscriptionId
                    if (-not $subId) { $subId = $sub.subscription_id }
                    if ($subId) {
                        try {
                            Invoke-WebRequest -Uri "http://localhost:4000/v1/subscriptions/$subId" -Method DELETE -UseBasicParsing | Out-Null
                            Write-Host "    ✅ Deleted: $subId" -ForegroundColor Green
                        } catch {
                            Write-Host "    ⚠️  Failed to delete: $subId" -ForegroundColor Yellow
                        }
                    }
                }
            }
        } else {
            Write-Host "    No subscriptions to delete" -ForegroundColor Gray
        }
    } catch {
        Write-Host "    ⚠️  Failed to fetch subscriptions: $_" -ForegroundColor Yellow
    }
    
    # Fallback: Delete dark patterns
    Write-Host "  Clearing dark patterns..." -ForegroundColor Yellow
    try {
        $darkPatterns = Invoke-RestMethod -Uri "http://localhost:4000/v1/dark-patterns" -Method GET -UseBasicParsing
        $dpCount = $darkPatterns.count
        Write-Host "    Found $dpCount dark pattern reports" -ForegroundColor Gray
        
        if ($dpCount -gt 0) {
            try {
                Invoke-WebRequest -Uri "http://localhost:4000/v1/dark-patterns" -Method DELETE -UseBasicParsing | Out-Null
                Write-Host "    ✅ Dark patterns deleted" -ForegroundColor Green
            } catch {
                Write-Host "    ⚠️  Failed to delete dark patterns: $_" -ForegroundColor Yellow
            }
        } else {
            Write-Host "    No dark patterns to delete" -ForegroundColor Gray
        }
    } catch {
        Write-Host "    ⚠️  Failed to fetch dark patterns: $_" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 3: Verify cleanup
Write-Host "Step 3: Verifying cleanup..." -ForegroundColor Yellow

# Verify subscriptions
try {
    $subscriptions = Invoke-RestMethod -Uri "http://localhost:4000/v1/subscriptions" -Method GET -UseBasicParsing
    $subCount = $subscriptions.count
    if ($subCount -eq 0) {
        Write-Host "  ✅ All subscriptions cleared" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Still $subCount subscriptions remaining" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Failed to verify subscriptions: $_" -ForegroundColor Yellow
}

# Verify dark patterns
try {
    $darkPatterns = Invoke-RestMethod -Uri "http://localhost:4000/v1/dark-patterns" -Method GET -UseBasicParsing
    $dpCount = $darkPatterns.count
    if ($dpCount -eq 0) {
        Write-Host "  ✅ All dark patterns cleared" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Still $dpCount dark patterns remaining" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Failed to verify dark patterns: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "====================================="
Write-Host "✅ Cleanup script completed!" -ForegroundColor Green
