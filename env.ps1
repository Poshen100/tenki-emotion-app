$env:PATH = "$PSScriptRoot\..\node-v26.1.0-win-x64;" + $env:PATH
Write-Host "Portable Node.js (v26.1.0) Environment Initialized!" -ForegroundColor Green
node -v
npm -v
