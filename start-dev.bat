@echo off
setlocal enabledelayedexpansion
title FixIt PDAS - Dev Launcher
color 0A

echo.
echo  ===========================================================
echo     FixIT PDAS  ^|  One-Click Dev Launcher
echo     ISAT U Dumangas Facility ^& Maintenance System
echo  ===========================================================
echo.

cd /d "%~dp0"

:: ─── 1. Check MySQL ───────────────────────────────────────────
echo  [1/4] Checking XAMPP MySQL...
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo.
    echo  [!] MySQL is NOT running on port 3306.
    echo.
    echo      Please do the following before retrying:
    echo        1. Open XAMPP Control Panel
    echo        2. Click START next to MySQL
    echo        3. Wait until MySQL shows green "Running"
    echo        4. Run this launcher again
    echo.
    echo  Press any key to exit...
    pause >nul
    exit /b 1
) else (
    echo  [OK] MySQL is running on port 3306.
)

:: ─── 2. Kill any stale backend on port 5000 ──────────────────
echo.
echo  [2/4] Checking port 5000 (Backend API)...
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo  [~] Port 5000 is already in use - killing old process...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000" ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 1 /nobreak >nul
)
echo  [OK] Port 5000 is free.

:: ─── 3. Start Backend ─────────────────────────────────────────
echo.
echo  [3/4] Starting Backend API server (port 5000)...
start "FixIT Backend" cmd /k "color 0B && echo  [FixIT BACKEND] Starting... && cd /d "%~dp0backend" && node src/server.js"
echo  [OK] Backend window opened. Waiting for it to be ready...
timeout /t 4 /nobreak >nul

:: Wait for backend to actually be listening
set /a tries=0
:wait_backend
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if not errorlevel 1 goto backend_ready
set /a tries+=1
if !tries! geq 15 (
    echo  [!] Backend is taking a long time to start.
    echo      Check the Backend window for errors.
    goto open_frontend
)
timeout /t 1 /nobreak >nul
goto wait_backend
:backend_ready
echo  [OK] Backend is live on http://localhost:5000/api

:: ─── 4. Start Frontend (Vite) ─────────────────────────────────
:open_frontend
echo.
echo  [4/4] Starting Frontend dev server (Vite, port 5173)...
start "FixIT Frontend" cmd /k "color 0E && echo  [FixIT FRONTEND] Starting Vite... && cd /d "%~dp0" && npm run dev:frontend"
echo  [OK] Vite window opened. Waiting for it to be ready...
timeout /t 4 /nobreak >nul

:: Open the browser
start "" "http://localhost:5173"

echo.
echo  ===========================================================
echo   FixIT PDAS is running!
echo.
echo   Frontend:    http://localhost:5173
echo   Backend API: http://localhost:5000/api
echo   Health:      http://localhost:5000/api/health
echo.
echo   Admin Login:
echo     Email:    adminisatu.edu.ph@gmail.com
echo     Password: admin123
echo.
echo   Press any key to close this launcher window.
echo   (Backend and Frontend windows will stay open)
echo  ===========================================================
pause >nul
