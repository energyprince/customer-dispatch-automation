#!/bin/bash

# Start script for CPower Dispatch API Server

echo "Starting CPower Dispatch API Server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "Warning: .env file not found in parent directory!"
    echo "Please create a .env file with the following variables:"
    echo "  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD"
    echo "  PORTAL_URL, PORTAL_USERNAME, PORTAL_PASSWORD"
    echo "  TEST_EMAIL (optional)"
fi

# Export Flask environment variables
export FLASK_APP=api_server.py
export FLASK_ENV=development

# Start the server
echo "Starting Flask server on http://localhost:5000"
echo "Press Ctrl+C to stop..."

# Run with python directly to ensure socketio support
python api_server.py