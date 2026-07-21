@echo off
setlocal

if exist "%~dp0DesktopApp\src-tauri\target\release\mosaico-desktop.exe" set "MOSAICO_EXE=%~dp0DesktopApp\src-tauri\target\release\mosaico-desktop.exe"

for /f "delims=" %%F in ('dir /b /ad /o-d "%~dp0output\manual\Mosaico-T1-*" 2^>nul') do if not defined MOSAICO_EXE set "MOSAICO_EXE=%~dp0output\manual\%%F\Mosaico.exe"

for /f "delims=" %%F in ('dir /b /ad /o-d "%~dp0output\manual\Mosaico-T0-*" 2^>nul') do if not defined MOSAICO_EXE set "MOSAICO_EXE=%~dp0output\manual\%%F\Mosaico.exe"

for /f "delims=" %%F in ('dir /b /ad /o-d "%~dp0output\manual\Mosaico-F1-*" 2^>nul') do if not defined MOSAICO_EXE set "MOSAICO_EXE=%~dp0output\manual\%%F\Mosaico.App.exe"

if not defined MOSAICO_EXE goto not_found
if not exist "%MOSAICO_EXE%" goto not_found

for %%F in ("%MOSAICO_EXE%") do set "MOSAICO_DIR=%%~dpF"
start "" /D "%MOSAICO_DIR%" "%MOSAICO_EXE%"
exit /b 0

:not_found
echo No se encontro una compilacion ejecutable de Mosaico.
echo Ejecuta primero scripts\t0-gate.ps1 para generar el paquete Tauri.
pause
exit /b 1
