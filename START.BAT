@echo off
title Server Rekap Pasien ICU dan HCU
set PORT=3005

echo ===================================================
echo   Menjalankan Server Rekap Pasien ICU dan HCU
echo   Akses URL: http://localhost:%PORT%
echo ===================================================
echo.

:: Membuka default browser secara otomatis ke http://localhost:3005
start "" "http://localhost:%PORT%"

:: Menjalankan server Node.js
node server.js

pause
