#!/usr/bin/env python3
"""
Example client for the CPower Dispatch Automation API Server.
Demonstrates how to use both REST endpoints and WebSocket connections.
"""

import requests
import json
import time
from typing import Optional
import socketio

# Configuration
API_BASE_URL = "http://localhost:5000"
WEBSOCKET_URL = "http://localhost:5000"


class DispatchAPIClient:
    """Client for interacting with the Dispatch API."""
    
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url
        self.session_id = f"client_{int(time.time())}"
    
    def chat(self, message: str, session_id: Optional[str] = None) -> dict:
        """Send a chat message and get response."""
        url = f"{self.base_url}/chat"
        payload = {
            "message": message,
            "session_id": session_id or self.session_id
        }
        response = requests.post(url, json=payload)
        return response.json()
    
    def test_smtp(self, test_email: Optional[str] = None) -> dict:
        """Test SMTP configuration."""
        url = f"{self.base_url}/test/smtp"
        payload = {}
        if test_email:
            payload["test_email"] = test_email
        response = requests.post(url, json=payload)
        return response.json()
    
    def test_portal(self) -> dict:
        """Test portal credentials."""
        url = f"{self.base_url}/test/portal"
        response = requests.post(url)
        return response.json()
    
    def validate_contacts(self, file_path: str) -> dict:
        """Validate Excel contact file."""
        url = f"{self.base_url}/validate/contacts"
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, files=files)
        return response.json()
    
    def parse_email(self, content: str) -> dict:
        """Parse dispatch email content."""
        url = f"{self.base_url}/parse/email"
        payload = {"content": content}
        response = requests.post(url, json=payload)
        return response.json()
    
    def get_status(self) -> dict:
        """Get system status and metrics."""
        url = f"{self.base_url}/status"
        response = requests.get(url)
        return response.json()
    
    def list_sessions(self) -> dict:
        """List all chat sessions."""
        url = f"{self.base_url}/sessions"
        response = requests.get(url)
        return response.json()
    
    def export_session(self, session_id: str, output_path: str) -> bool:
        """Export a session to file."""
        url = f"{self.base_url}/sessions/{session_id}/export"
        response = requests.post(url)
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                f.write(response.content)
            return True
        return False
    
    def clear_session(self, session_id: str) -> dict:
        """Clear a session."""
        url = f"{self.base_url}/sessions/{session_id}"
        response = requests.delete(url)
        return response.json()


class DispatchWebSocketClient:
    """WebSocket client for real-time chat."""
    
    def __init__(self, url: str = WEBSOCKET_URL):
        self.sio = socketio.Client()
        self.url = url
        self.session_id = f"ws_client_{int(time.time())}"
        self._setup_handlers()
    
    def _setup_handlers(self):
        """Set up WebSocket event handlers."""
        @self.sio.on('connected')
        def on_connected(data):
            print(f"Connected: {data['message']}")
        
        @self.sio.on('joined_session')
        def on_joined(data):
            print(f"Joined session: {data['message']}")
        
        @self.sio.on('chat_response')
        def on_response(data):
            print(f"\nAssistant: {data['response']}")
            print(f"Timestamp: {data['timestamp']}")
        
        @self.sio.on('processing')
        def on_processing(data):
            print(f"Processing: {data['message']}")
        
        @self.sio.on('error')
        def on_error(data):
            print(f"Error: {data['error']}")
    
    def connect(self):
        """Connect to WebSocket server."""
        self.sio.connect(self.url)
        self.sio.emit('join_session', {'session_id': self.session_id})
    
    def send_message(self, message: str):
        """Send a chat message."""
        self.sio.emit('chat_message', {
            'message': message,
            'session_id': self.session_id
        })
    
    def disconnect(self):
        """Disconnect from server."""
        self.sio.emit('leave_session', {'session_id': self.session_id})
        self.sio.disconnect()


def demo_rest_api():
    """Demonstrate REST API usage."""
    print("=== CPower Dispatch API Demo ===\n")
    
    client = DispatchAPIClient()
    
    # Test system status
    print("1. Getting system status...")
    status = client.get_status()
    print(f"   Status: {status['status']}")
    print(f"   Uptime: {status['uptime_seconds']:.2f} seconds")
    print(f"   SMTP configured: {status['environment']['smtp_configured']}")
    print(f"   Portal configured: {status['environment']['portal_configured']}\n")
    
    # Test chat
    print("2. Testing chat endpoint...")
    response = client.chat("What dispatch events are scheduled for today?")
    print(f"   Response: {response['response'][:100]}...\n")
    
    # Test SMTP (without sending email)
    print("3. Testing SMTP configuration...")
    smtp_result = client.test_smtp()
    print(f"   Success: {smtp_result.get('success', False)}")
    if smtp_result.get('success'):
        print(f"   SMTP Host: {smtp_result['config']['host']}")
        print(f"   SMTP Port: {smtp_result['config']['port']}\n")
    else:
        print(f"   Error: {smtp_result.get('error', 'Unknown error')}\n")
    
    # Parse sample email
    print("4. Testing email parsing...")
    sample_email = """
    Subject: Demand Response Event Notification
    
    Event Details:
    - Start Time: 2025-07-14 14:00:00
    - End Time: 2025-07-14 18:00:00
    - Program: Emergency Load Response
    
    Facilities:
    1. Aaron Industries - 500 kW reduction required
    2. Beta Corporation - 300 kW reduction required
    """
    parse_result = client.parse_email(sample_email)
    print(f"   Parsed successfully: {parse_result.get('success', False)}\n")
    
    # List sessions
    print("5. Listing chat sessions...")
    sessions = client.list_sessions()
    print(f"   Total sessions: {sessions['total']}")
    for session in sessions['sessions'][:3]:  # Show first 3
        print(f"   - {session['session_id']}: {session['message_count']} messages\n")


def demo_websocket():
    """Demonstrate WebSocket usage."""
    print("\n=== WebSocket Chat Demo ===\n")
    
    ws_client = DispatchWebSocketClient()
    
    try:
        print("Connecting to WebSocket server...")
        ws_client.connect()
        time.sleep(1)  # Wait for connection
        
        print("\nSending test messages...")
        ws_client.send_message("Hello, I need help with dispatch automation")
        time.sleep(2)  # Wait for response
        
        ws_client.send_message("What facilities are in today's dispatch event?")
        time.sleep(2)  # Wait for response
        
        print("\nDisconnecting...")
        ws_client.disconnect()
        
    except Exception as e:
        print(f"WebSocket error: {e}")


if __name__ == "__main__":
    # Run REST API demo
    try:
        demo_rest_api()
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to API server. Make sure it's running on port 5000.")
    except Exception as e:
        print(f"REST API demo error: {e}")
    
    # Optionally run WebSocket demo
    print("\nPress Enter to run WebSocket demo, or Ctrl+C to exit...")
    try:
        input()
        demo_websocket()
    except KeyboardInterrupt:
        print("\nExiting...")