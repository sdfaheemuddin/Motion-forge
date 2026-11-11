@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Run setup.bat first.
    pause
    exit /b 1
)
set "MOTION_PROJECT=%~1"
if not defined MOTION_PROJECT set "MOTION_PROJECT=projects\quick-start\project.json"
.venv\Scripts\python.exe -m motion_forge render "%MOTION_PROJECT%"
if errorlevel 1 (
    echo Video generation failed. Review the error above.
    pause
    exit /b 1
)
echo Video export complete. See the output folder.
pause
