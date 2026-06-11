@echo off
title Flash UI 2.0
cd /d "%~dp0"

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting Flash UI 2.0...
echo Open http://localhost:3000 in your browser
echo.
call npm run dev
pause
