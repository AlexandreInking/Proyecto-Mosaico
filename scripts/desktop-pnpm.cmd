@echo off
setlocal
set "ROOT=%~dp0.."
set "PACKAGE_MANAGER="
set "PACKAGE_MANAGER_ARGS="
for /f "delims=" %%P in ('where pnpm.cmd 2^>nul') do if not defined PACKAGE_MANAGER set "PACKAGE_MANAGER=%%P"
if not defined PACKAGE_MANAGER if exist "%ProgramFiles%\nodejs\corepack.cmd" (
  set "PACKAGE_MANAGER=%ProgramFiles%\nodejs\corepack.cmd"
  set "PACKAGE_MANAGER_ARGS=pnpm"
)
if not defined PACKAGE_MANAGER (
  echo pnpm/corepack no encontrado. Instala Node.js con Corepack o pnpm. 1>&2
  exit /b 1
)
if /i "%~1"=="dev" (
  call "%PACKAGE_MANAGER%" %PACKAGE_MANAGER_ARGS% --dir "%ROOT%\DesktopApp\app" dev
) else (
  call "%PACKAGE_MANAGER%" %PACKAGE_MANAGER_ARGS% --dir "%ROOT%\DesktopApp\app" build
)
exit /b %errorlevel%
