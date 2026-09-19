@echo off
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    py -3 ensure_local_server.py --host 127.0.0.1 --port 8000
) else (
    python ensure_local_server.py --host 127.0.0.1 --port 8000
)

exit /b %errorlevel%
