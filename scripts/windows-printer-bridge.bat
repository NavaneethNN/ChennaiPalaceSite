@echo off
title Chennai Palace - Windows Printer Bridge
echo =======================================================
echo   Starting Chennai Palace Windows Printer Bridge...
echo =======================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows-printer-bridge.ps1"
pause

