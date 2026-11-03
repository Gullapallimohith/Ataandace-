@echo off
cd /d "%~dp0"
echo Starting Attendance & Timetable Daemon in background...
start "" "wscript.exe" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AttendanceDaemon.vbs"
echo Daemon started successfully!

