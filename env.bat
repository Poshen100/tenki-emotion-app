@echo off
set "PATH=%~dp0..\tools\node;%~dp0..\tools\git\cmd;%PATH%"
echo Portable Node.js and Git Environment Initialized!
node -v
call npm -v
git --version

