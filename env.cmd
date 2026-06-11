@echo off
set "PATH=%~dp0..\tools\node;%~dp0..\tools\git\cmd;%PATH%"
echo Portable Node.js and Git Environment Initialized!
echo Node version:
node -v
echo NPM version:
call npm -v
echo Git version:
git --version
echo.
echo You are now in the portable Node.js and Git command prompt for tenki-emotion-app.
cmd.exe /k
