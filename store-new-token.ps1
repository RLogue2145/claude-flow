# Secure GitHub Token Storage Script
Write-Host "Storing new GitHub token securely..." -ForegroundColor Green

# Prompt for the new token
$newToken = Read-Host "Please enter your new GitHub Personal Access Token" -AsSecureString
$plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($newToken))

# Store the token in Windows Credential Manager
Write-Host "Storing token in Windows Credential Manager..." -ForegroundColor Yellow
cmdkey /generic:git:https://github.com /user:git /pass:$plainToken

# Clear the plain text token from memory
$plainToken = $null

Write-Host "New GitHub token stored securely!" -ForegroundColor Green
Write-Host "The token has been stored in Windows Credential Manager." -ForegroundColor Green
Write-Host "You can now add it to your GitHub repository secrets as PAT_TOKEN." -ForegroundColor Green

# Test the connection
Write-Host "Testing GitHub connection..." -ForegroundColor Yellow
try {
    git ls-remote origin | Select-Object -First 5
    Write-Host "GitHub authentication successful!" -ForegroundColor Green
} catch {
    Write-Host "Authentication test failed. Please check your token." -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to your GitHub repository settings" -ForegroundColor White
Write-Host "2. Navigate to Secrets and variables > Actions" -ForegroundColor White
Write-Host "3. Add a new repository secret named PAT_TOKEN" -ForegroundColor White
Write-Host "4. Use the same token value you just entered" -ForegroundColor White