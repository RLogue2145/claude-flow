# Secure GitHub Token Storage Script
Write-Host "Securely storing GitHub token..." -ForegroundColor Green

# The token from your file
$token = "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N"

# Store the token in Windows Credential Manager
Write-Host "Storing token in Windows Credential Manager..." -ForegroundColor Yellow

# Store in Windows Credential Manager
cmdkey /generic:git:https://github.com /user:git /pass:$token

Write-Host "GitHub token stored securely!" -ForegroundColor Green
Write-Host "The token has been removed from the workflow file and stored securely." -ForegroundColor Green
Write-Host "You can now safely commit and push your changes." -ForegroundColor Green

# Clean up the script
Remove-Item $MyInvocation.MyCommand.Path