@echo off
REM Hourly tracker scrape — invoked by Windows Task Scheduler.
REM Loads SHEET_ID + GOOGLE_SERVICE_ACCOUNT_PATH from .env.local in the project root.

setlocal
cd /d "%~dp0\.."
set "LOGFILE=logs\run-tracker.log"

echo. >> "%LOGFILE%"
echo === %DATE% %TIME% === >> "%LOGFILE%"
"C:\Program Files\nodejs\node.exe" --env-file=.env.local --import tsx src/index.ts >> "%LOGFILE%" 2>&1
echo Exit code: %ERRORLEVEL% >> "%LOGFILE%"
endlocal
