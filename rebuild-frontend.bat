@echo off
title FixIt PDAS - Rebuild Frontend
cd /d "%~dp0"
echo  Rebuilding frontend so http://localhost/FixIT/ shows latest changes...
call npm --prefix frontend run build
if errorlevel 1 (
    echo  [!] Build FAILED. See errors above.
    pause
    exit /b 1
)
echo.
echo  [OK] Done. Now hard-refresh your browser: Ctrl + F5 on http://localhost/FixIT/
pause
