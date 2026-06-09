$env:PATH = "$PSScriptRoot\..\tools\node;$PSScriptRoot\..\tools\git\cmd;" + $env:PATH
Write-Host "Portable Node.js & Git Environment Initialized!" -ForegroundColor Green
node -v
npm -v
git --version
