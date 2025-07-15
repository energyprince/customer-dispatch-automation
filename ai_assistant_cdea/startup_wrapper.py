#!/usr/bin/env python3
"""
Startup wrapper for AI Assistant API server
Captures and logs any startup errors before crashing
"""
import sys
import os
import traceback

print("[AI-ASSISTANT] Starting up...", flush=True)
print(f"[AI-ASSISTANT] Python version: {sys.version}", flush=True)
print(f"[AI-ASSISTANT] Working directory: {os.getcwd()}", flush=True)
print(f"[AI-ASSISTANT] Python path: {sys.path}", flush=True)
print(f"[AI-ASSISTANT] Site packages locations:", flush=True)
import site
for path in site.getsitepackages():
    print(f"[AI-ASSISTANT]   - {path}", flush=True)
    
# Check if flask is installed
try:
    import subprocess
    result = subprocess.run([sys.executable, '-m', 'pip', 'show', 'flask'], 
                          capture_output=True, text=True)
    if result.returncode == 0:
        print(f"[AI-ASSISTANT] Flask is installed: {result.stdout.strip()}", flush=True)
    else:
        print(f"[AI-ASSISTANT] Flask NOT found by pip: {result.stderr}", flush=True)
except Exception as e:
    print(f"[AI-ASSISTANT] Error checking pip: {e}", flush=True)
print(f"[AI-ASSISTANT] Environment variables:", flush=True)
for key in ['PORT', 'PYTHONPATH', 'ANTHROPIC_API_KEY', 'NODE_ENV']:
    value = os.environ.get(key, 'NOT SET')
    if key == 'ANTHROPIC_API_KEY' and value != 'NOT SET':
        value = value[:10] + '...' if len(value) > 10 else value
    print(f"[AI-ASSISTANT]   {key}: {value}", flush=True)

try:
    print("[AI-ASSISTANT] Attempting to import api_server...", flush=True)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import api_server
    print("[AI-ASSISTANT] Import successful, api_server module loaded", flush=True)
    
    # The api_server module starts the server when imported
    # If we reach here without errors, the server is running
    
except Exception as e:
    print(f"[AI-ASSISTANT] FATAL ERROR during startup:", flush=True)
    print(f"[AI-ASSISTANT] {type(e).__name__}: {str(e)}", flush=True)
    traceback.print_exc()
    sys.exit(1)