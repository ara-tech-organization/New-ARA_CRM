@echo off
echo ========================================
echo    CRM Application Setup
echo ========================================
echo.
echo Step 1: Installing dependencies...
call npm install --legacy-peer-deps
echo.
echo Step 2: Starting development server...
echo.
call start.bat
