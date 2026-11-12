@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Run setup.bat first to install Motion Forge.
    pause
    exit /b 1
)
.venv\Scripts\python.exe -m motion_forge ui --root "%CD%"
if errorlevel 1 (
    echo The builder could not start. Review the error above. Port 8765 must be available.
    pause
    exit /b 1
)
