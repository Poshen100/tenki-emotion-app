@echo off
set "PATH=%~dp0..\node-v24.15.0-win-x64;%PATH%"
echo Node.js portable environment configured!
echo Node version:
node -v
echo NPM version:
npm -v
echo You can now use npm and node commands here.
cmd.exe /k
