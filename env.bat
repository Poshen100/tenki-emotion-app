@echo off
set "PATH=%~dp0..\tools\node;%~dp0..\tools\git\cmd;%PATH%"
echo Portable Node.js & Git Environment Initialized!
node -v
npm -v
git --version

