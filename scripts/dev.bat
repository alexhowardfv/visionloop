@echo off
REM Dev server script - kills existing process on port 3080 and starts fresh

echo Checking for existing process on port 3080...

REM Find PID using port 3080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3080 ^| findstr LISTENING') do (
    echo Found process %%a on port 3080, killing...
    taskkill /F /PID %%a >nul 2>&1
)

REM Small delay to ensure port is released
timeout /t 1 /nobreak >nul

echo Starting dev server...
cd /d "%~dp0.."
npm run dev
