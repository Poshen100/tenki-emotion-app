@echo off
REM --- Portable Node.js for this machine (2026-05-14) ---
set "NODE_DIR=C:\Users\patron\.gemini\antigravity\scratch\nodejs\node-v20.19.2-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
echo Node.js portable environment configured!
echo Node version:
node -v
echo NPM version:
npm -v
echo You can now use npm and node commands here.
cmd.exe /k
