@echo off
set "PATH=%~dp0..\nodejs;%PATH%"
echo Portable Node.js Environment Initialized!
echo Node version:
node -v
echo NPM version:
npm -v
echo.
echo You are now in the portable Node.js command prompt for tenki-emotion-app.
cmd.exe /k
