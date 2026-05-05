@echo off
set "PATH=%~dp0..\nodejs;%PATH%"
echo Portable Node.js environment initialized.
node -v
npm -v
cmd.exe /k
