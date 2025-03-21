@echo off
echo Starting Qdrant service...

REM Check if Docker is installed
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Docker is not installed or not running, please install and start Docker first
    exit /b 1
)

REM Check if Qdrant container already exists
docker ps -a | findstr qdrant >nul
if %ERRORLEVEL% EQU 0 (
    echo Qdrant container exists, starting...
    docker start qdrant
) else (
    echo Creating and starting Qdrant container...
    docker run -d --name qdrant -p 6333:6333 -p 6334:6334 -v qdrant_storage:/qdrant/storage qdrant/qdrant
)

echo Qdrant service started, accessible at http://172.16.0.78:6333
echo Press any key to exit...
pause >nul
