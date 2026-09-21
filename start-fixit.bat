@echo off
setlocal enabledelayedexpansion
title FixIt PDAS System Launcher

echo ======================================================================
echo            FixIt PDAS - Facilities and Maintenance Portal            
echo               ISAT U Dumangas Campus Institutional System             
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking XAMPP MySQL and Apache Services...
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [!] WARNING: MySQL is not listening on port 3306.
    echo     Please open XAMPP Control Panel and click START next to MySQL.
    echo.
) else (
    echo [OK] MySQL is active on port 3306.
)

netstat -ano | findstr ":80 " | findstr "LISTENING" >nul
if errorlevel 1 (
    echo [!] WARNING: Apache is not listening on port 80.
    echo     Please open XAMPP Control Panel and click START next to Apache.
    echo.
) else (
    echo [OK] Apache is active on port 80.
)

echo.
echo [2/4] Rebuilding Frontend Production Build (always fresh)...
call npm --prefix frontend run build
if errorlevel 1 (
    echo [!] Frontend build FAILED. Check errors above.
) else (
    echo [OK] Frontend bundle rebuilt successfully.
)

echo.
echo [3/4] Launching FixIt PDAS Backend API Server...
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if errorlevel 1 (
    start "FixIt Backend API" cmd /k "cd /d "%~dp0backend" && node src/server.js"
    echo [OK] Backend server started on port 5000.
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] Backend server is already running on port 5000.
)

echo.
echo [4/4] Opening FixIt PDAS in your browser...
echo [*] Access URL: http://localhost/capstoneSystem
start "" "http://localhost/capstoneSystem"

echo.
echo ======================================================================
echo  FixIt PDAS is running!
echo.
echo  • Web Application (Apache):  http://localhost/capstoneSystem
echo  • Dev Server (Vite):         http://localhost:5173
echo  • Backend API:               http://localhost:5000/api
echo.
echo  Press any key to exit this launcher window (backend will remain active).
echo ======================================================================
pause >nul
