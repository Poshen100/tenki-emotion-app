@echo off
REM --- Portable Node.js & Git Environment (Auto-detecting) ---
set "NODE_DIR=%~dp0..\tools\node"
set "GIT_DIR=%~dp0..\tools\git\cmd"
set "PATH=%NODE_DIR%;%GIT_DIR%;%PATH%"
echo Node.js & Git portable environment configured!
echo Node version:
node -v
echo NPM version:
npm -v
echo Git version:
git --version
echo You can now use npm, node, and git commands here.
cmd.exe /k
