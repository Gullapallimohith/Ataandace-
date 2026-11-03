@echo off
cd /d "%~dp0"
echo Starting Attendance and Timetable Daemon in background...
start "" "wscript.exe" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AttendanceDaemon.vbs"
echo Daemon started successfully!

