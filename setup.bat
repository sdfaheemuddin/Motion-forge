@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
    echo Python launcher not found. Install Python 3.11 or newer for Windows, then run setup.bat again.
    pause
    exit /b 1
)
py -3 -m venv .venv
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m pip install -e ".[api]"
if errorlevel 1 goto failed
.venv\Scripts\python.exe -m motion_forge doctor
if errorlevel 1 goto failed
echo Setup complete. Run render.bat to generate the quick-start video.
pause
exit /b 0
:failed
echo Setup failed. Review the error above.
pause
exit /b 1
