@echo off
REM
IF NOT EXIST node_modules (
    echo "node_modules not found, running npm install..."
    npm install
)

echo "Starting application..."
node index.js