#!/usr/bin/env python3
import sys
print(f"Python executable: {sys.executable}")
print(f"Python version: {sys.version}")

required_modules = [
    'flask',
    'flask_cors',
    'flask_socketio',
    'anthropic',
    'pandas',
    'openpyxl',
    'eventlet',
    'dotenv'  # python-dotenv installs as 'dotenv'
]

failed = False
for module in required_modules:
    try:
        __import__(module)
        print(f"✓ {module} imported successfully")
    except ImportError as e:
        print(f"✗ {module} import failed: {e}")
        failed = True

if failed:
    sys.exit(1)
else:
    print("All imports successful!")