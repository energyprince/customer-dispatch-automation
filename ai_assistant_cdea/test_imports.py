#!/usr/bin/env python3
"""Test if imports work correctly"""
import sys
print(f"Python executable: {sys.executable}", flush=True)
print(f"Python version: {sys.version}", flush=True)
print("Attempting imports...", flush=True)

try:
    import flask
    print(f"✓ flask imported successfully: {flask.__version__}", flush=True)
except ImportError as e:
    print(f"✗ flask import failed: {e}", flush=True)

try:
    import anthropic
    print(f"✓ anthropic imported successfully", flush=True)
except ImportError as e:
    print(f"✗ anthropic import failed: {e}", flush=True)

try:
    import pandas
    print(f"✓ pandas imported successfully: {pandas.__version__}", flush=True)
except ImportError as e:
    print(f"✗ pandas import failed: {e}", flush=True)

print("Import test complete.", flush=True)