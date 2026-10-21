@echo off
title Chennai Palace - Windows Printer Bridge
setlocal EnableDelayedExpansion

echo =======================================================================
echo   Chennai Palace - Windows POS Thermal Printer Bridge
echo =======================================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [Requesting Administrator access to allow local network printing...]
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs" 2>nul
    if !errorLevel! == 0 (
        exit /b 0
    )
    echo [Continuing in Standard User Mode - Localhost access only]
    echo Tip: Right-click this file and choose 'Run as administrator'
    echo      to enable Wi-Fi printing from other devices.
    echo.
) else (
    echo [Administrator Mode Detected]
    echo Configuring Windows firewall and Port 18080 URL reservation...
    netsh http add urlacl url=http://*:18080/ user=Everyone >nul 2>&1
    netsh advfirewall firewall add rule name="Chennai Palace Printer Bridge" dir=in action=allow protocol=TCP localport=18080 >nul 2>&1
    echo [Port 18080 and firewall configured successfully]
    echo.
)

:: Locate the PowerShell companion script
set "PS_SCRIPT=%~dp0windows-printer-bridge.ps1"
if not exist "!PS_SCRIPT!" (
    set "PS_SCRIPT=%~dp0..\scripts\windows-printer-bridge.ps1"
)
if not exist "!PS_SCRIPT!" (
    set "PS_SCRIPT=%CD%\windows-printer-bridge.ps1"
)

if not exist "!PS_SCRIPT!" (
    echo =======================================================================
    echo [ERROR] windows-printer-bridge.ps1 was not found!
    echo.
    echo Please make sure both 'windows-printer-bridge.bat' and
    echo 'windows-printer-bridge.ps1' are saved in the same folder.
    echo =======================================================================
    echo.
    pause
    exit /b 1
)

echo Starting printer bridge listener...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "!PS_SCRIPT!"
pause
