$env:PATH = "$PSScriptRoot\..\nodejs;" + $env:PATH
Write-Host "Portable Node.js Environment Initialized!" -ForegroundColor Green
node -v
npm -v
