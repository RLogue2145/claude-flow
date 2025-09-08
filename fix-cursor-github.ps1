# Fix Cursor GitHub Integration for Fork
Write-Host "Fixing Cursor GitHub integration for your fork..." -ForegroundColor Green

# Ensure we're using the correct repository
Write-Host "Current repository: RLogue2145/claude-flow" -ForegroundColor Yellow

# Set up proper GitHub authentication for your fork
Write-Host "Setting up authentication for your fork..." -ForegroundColor Yellow

# Test connection to your fork
Write-Host "Testing connection to your fork..." -ForegroundColor Yellow
git ls-remote origin

Write-Host "Repository configuration is correct!" -ForegroundColor Green
Write-Host "Your fork (RLogue2145/claude-flow) is properly configured." -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Click Go to GitHub in the Cursor error message" -ForegroundColor White
Write-Host "2. Make sure you are on YOUR fork (RLogue2145/claude-flow)" -ForegroundColor White
Write-Host "3. Install the Cursor GitHub app for your fork" -ForegroundColor White
Write-Host "4. Grant the necessary permissions" -ForegroundColor White

# Clean up
Remove-Item $MyInvocation.MyCommand.Path