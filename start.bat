@echo off
setlocal
cd /d "%~dp0"

rem Use a nearby Electron binary mirror. npm packages and Electron binaries
rem are downloaded from different servers; the latter is usually the large one.
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "npm_config_electron_mirror=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_GET_USE_PROXY=1"
set "npm_config_cache=%~dp0.npm-cache"
set "electron_config_cache=%~dp0.electron-cache"

if not exist "node_modules\matter-js\build\matter.min.js" (
  echo First run: installing JavaScript packages...
  call npm.cmd install --ignore-scripts
  if errorlevel 1 goto install_failed
)

if not exist "node_modules\electron\install.js" (
  echo Installing Electron package...
  call npm.cmd install --ignore-scripts
  if errorlevel 1 goto install_failed
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Downloading the Electron runtime from the mirror...
  for /l %%I in (1,1,3) do (
    echo Attempt %%I of 3...
    node "node_modules\electron\install.js"
    if exist "node_modules\electron\dist\electron.exe" goto installed
    if not %%I==3 timeout /t 2 /nobreak >nul
  )
  goto install_failed
)

:installed
echo Starting Shake Pet...
start "" "%~dp0node_modules\electron\dist\electron.exe" .
exit /b 0

:install_failed
echo.
echo Installation is incomplete. The launcher used the Electron mirror and
echo will safely continue from the existing files when you run it again.
pause
exit /b 1
