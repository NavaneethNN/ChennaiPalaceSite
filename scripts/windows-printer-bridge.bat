@echo off
title Chennai Palace - Windows Printer Bridge
echo =======================================================
echo   Starting Chennai Palace Windows Printer Bridge...
echo =======================================================

net session >nul 2>&1
if %errorLevel% == 0 (
    echo [Admin Mode Detected - Enabling LAN access on port 18080]
    netsh http add urlacl url=http://*:18080/ user=Everyone >nul 2>&1
    netsh advfirewall firewall add rule name="Chennai Palace Printer Bridge" dir=in action=allow protocol=TCP localport=18080 >nul 2>&1
) else (
    echo [Standard User Mode]
    echo [Tip: To allow scanning/printing from a Mac or iPad on your Wi-Fi,
    echo       close this and right-click -> "Run as administrator"]
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows-printer-bridge.ps1"
pause

