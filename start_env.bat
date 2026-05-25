@echo off
REM --- Portable Node.js Environment (Auto-detecting) ---
set "NODE_DIR=%~dp0..\nodejs"
set "PATH=%NODE_DIR%;%PATH%"
echo Node.js portable environment configured!
echo Node version:
node -v
echo NPM version:
npm -v
echo You can now use npm and node commands here.
cmd.exe /k
