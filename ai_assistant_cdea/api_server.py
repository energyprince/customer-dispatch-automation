import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from pathlib import Path

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
import pandas as pd
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import email
from email import policy
from email.parser import BytesParser

from assistant import DispatchAssistant

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Enable CORS
CORS(app, origins="*")

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize DispatchAssistant
assistant = DispatchAssistant()

# Store active sessions
sessions: Dict[str, Dict[str, Any]] = {}

# Metrics storage
metrics = {
    'total_requests': 0,
    'successful_requests': 0,
    'failed_requests': 0,
    'active_sessions': 0,
    'start_time': datetime.now()
}


def update_metrics(success: bool = True):
    """Update system metrics."""
    metrics['total_requests'] += 1
    if success:
        metrics['successful_requests'] += 1
    else:
        metrics['failed_requests'] += 1
    metrics['active_sessions'] = len(sessions)


# Routes for serving the web interface
@app.route('/')
def index():
    """Serve the main HTML file."""
    return send_file('index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (JS, CSS)."""
    if filename in ['app.js', 'style.css', 'index.html']:
        return send_file(filename)
    return jsonify({'error': 'File not found'}), 404


# API Routes
@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages."""
    try:
        # Handle both JSON and FormData
        if request.content_type and 'multipart/form-data' in request.content_type:
            # FormData with file upload
            message = request.form.get('message', '')
            session_id = request.form.get('session_id', 'default')
            file = request.files.get('file')
            
            # Process file if present
            if file:
                filename = secure_filename(file.filename)
                if filename.lower().endswith('.eml'):
                    # Parse .eml file
                    msg = BytesParser(policy=policy.default).parsebytes(file.read())
                    
                    # Extract email content
                    body_parts = []
                    if msg.is_multipart():
                        for part in msg.walk():
                            if part.get_content_type() == 'text/plain':
                                body_parts.append(part.get_payload(decode=True).decode('utf-8', errors='ignore'))
                    else:
                        body_parts.append(msg.get_payload(decode=True).decode('utf-8', errors='ignore'))
                    
                    email_content = '\n'.join(body_parts)
                    
                    # Parse dispatch information
                    parsed_data = assistant.diagnose_dispatch_parsing(email_content)
                    
                    # Create enhanced message
                    message = f"{message}\n\nI've attached an email file: {filename}\n\nEmail Subject: {msg.get('subject', 'N/A')}\n\nParsed dispatch information:\n{json.dumps(parsed_data, indent=2)}"
                else:
                    # For other file types, just read as text
                    file_content = file.read().decode('utf-8', errors='ignore')
                    message = f"{message}\n\nFile content from {filename}:\n{file_content[:1000]}..."
        else:
            # JSON request
            data = request.json
            message = data.get('message', '')
            session_id = data.get('session_id', 'default')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Create session if it doesn't exist
        if session_id not in sessions:
            sessions[session_id] = {
                'created_at': datetime.now().isoformat(),
                'messages': []
            }
        
        # Get assistant response
        response_data = assistant.process_query(message, session_id)
        response = response_data.get('text', 'I apologize, but I encountered an error processing your request.')
        
        # Store conversation
        sessions[session_id]['messages'].append({
            'timestamp': datetime.now().isoformat(),
            'user': message,
            'assistant': response
        })
        
        update_metrics(success=True)
        
        # Emit to WebSocket if connected
        if session_id in sessions:
            socketio.emit('message', {
                'type': 'assistant_response',
                'content': response,
                'timestamp': datetime.now().isoformat()
            }, room=session_id)
        
        return jsonify({
            'response': response,
            'session_id': session_id,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        update_metrics(success=False)
        return jsonify({'error': str(e)}), 500


@app.route('/api/test/smtp', methods=['POST'])
def test_smtp():
    """Test SMTP configuration."""
    try:
        # Get SMTP settings from environment
        smtp_host = os.getenv('SMTP_HOST')
        smtp_port = int(os.getenv('SMTP_PORT', 587))
        smtp_user = os.getenv('SMTP_USER')
        smtp_password = os.getenv('SMTP_PASSWORD')
        smtp_secure = os.getenv('SMTP_SECURE', 'false').lower() == 'true'
        
        if not all([smtp_host, smtp_user, smtp_password]):
            return jsonify({
                'success': False,
                'error': 'Missing SMTP configuration in environment variables'
            }), 400
        
        # Test connection
        if smtp_secure:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port)
            server.starttls()
        
        server.login(smtp_user, smtp_password)
        
        # Send test email if recipient provided
        test_email = request.json.get('test_email')
        if test_email:
            msg = MIMEMultipart()
            msg['From'] = f'"L.R.U" <{smtp_user}>'
            msg['To'] = test_email
            msg['Subject'] = 'SMTP Test - THIS MESSAGE WAS SENT BY LEO\'S ROBOT UNDERLING'
            
            body = """
            <html>
            <body>
                <h2>SMTP Configuration Test Successful</h2>
                <p>This is a test email from the CPower Dispatch Automation system.</p>
                <p>SMTP Settings:</p>
                <ul>
                    <li>Host: {}</li>
                    <li>Port: {}</li>
                    <li>User: {}</li>
                    <li>Secure: {}</li>
                </ul>
                <p>If you received this email, your SMTP configuration is working correctly.</p>
            </body>
            </html>
            """.format(smtp_host, smtp_port, smtp_user, smtp_secure)
            
            msg.attach(MIMEText(body, 'html'))
            server.send_message(msg)
        
        server.quit()
        
        update_metrics(success=True)
        
        return jsonify({
            'success': True,
            'message': 'SMTP connection successful',
            'config': {
                'host': smtp_host,
                'port': smtp_port,
                'user': smtp_user,
                'secure': smtp_secure
            },
            'test_email_sent': bool(test_email)
        })
        
    except Exception as e:
        logger.error(f"SMTP test error: {str(e)}")
        update_metrics(success=False)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/test/portal', methods=['POST'])
def test_portal():
    """Test portal login credentials."""
    try:
        # Get portal settings from environment
        portal_url = os.getenv('PORTAL_URL')
        portal_username = os.getenv('PORTAL_USERNAME')
        portal_password = os.getenv('PORTAL_PASSWORD')
        
        if not all([portal_url, portal_username, portal_password]):
            return jsonify({
                'success': False,
                'error': 'Missing portal configuration in environment variables'
            }), 400
        
        # Here you would typically test the actual portal login
        # For now, we'll just validate that credentials exist
        
        update_metrics(success=True)
        
        return jsonify({
            'success': True,
            'message': 'Portal credentials configured',
            'portal_url': portal_url,
            'username': portal_username,
            'has_password': bool(portal_password)
        })
        
    except Exception as e:
        logger.error(f"Portal test error: {str(e)}")
        update_metrics(success=False)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/validate/contacts', methods=['POST'])
def validate_contacts():
    """Validate Excel contact file."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save temporary file
        filename = secure_filename(file.filename)
        temp_path = Path('/tmp') / filename
        file.save(str(temp_path))
        
        # Read Excel file
        df = pd.read_excel(temp_path)
        
        # Validate required columns
        required_columns = ['Company', 'Email']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            temp_path.unlink()
            return jsonify({
                'success': False,
                'error': f'Missing required columns: {", ".join(missing_columns)}'
            }), 400
        
        # Analyze data
        total_rows = len(df)
        companies_with_email = df[df['Email'].notna()]['Company'].nunique()
        missing_emails = df[df['Email'].isna()]['Company'].tolist()
        
        # Clean up
        temp_path.unlink()
        
        update_metrics(success=True)
        
        return jsonify({
            'success': True,
            'stats': {
                'total_companies': total_rows,
                'companies_with_email': companies_with_email,
                'companies_without_email': len(missing_emails)
            },
            'missing_emails': missing_emails[:10],  # First 10
            'columns': df.columns.tolist()
        })
        
    except Exception as e:
        logger.error(f"Contact validation error: {str(e)}")
        update_metrics(success=False)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/parse/email', methods=['POST'])
def parse_email():
    """Parse dispatch email content."""
    try:
        email_content = ""
        email_metadata = {}
        
        # Check if content is provided as text
        if request.json and 'content' in request.json:
            email_content = request.json['content']
        # Check if file is uploaded
        elif 'file' in request.files:
            file = request.files['file']
            filename = secure_filename(file.filename)
            
            # If it's an .eml file, parse it properly
            if filename.lower().endswith('.eml'):
                # Parse the email file
                msg = BytesParser(policy=policy.default).parsebytes(file.read())
                
                # Extract metadata
                email_metadata = {
                    'subject': msg.get('subject', ''),
                    'from': msg.get('from', ''),
                    'to': msg.get('to', ''),
                    'date': msg.get('date', ''),
                    'filename': filename
                }
                
                # Extract body
                body_parts = []
                if msg.is_multipart():
                    for part in msg.walk():
                        if part.get_content_type() == 'text/plain':
                            body_parts.append(part.get_payload(decode=True).decode('utf-8', errors='ignore'))
                        elif part.get_content_type() == 'text/html' and not body_parts:
                            # Use HTML only if no plain text is available
                            html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                            # Simple HTML to text conversion
                            body_parts.append(html_content)
                else:
                    body_parts.append(msg.get_payload(decode=True).decode('utf-8', errors='ignore'))
                
                email_content = '\n'.join(body_parts)
            else:
                # For non-.eml files, just read as text
                email_content = file.read().decode('utf-8', errors='ignore')
                email_metadata['filename'] = filename
        else:
            return jsonify({'error': 'No email content or file provided'}), 400
        
        # Parse email using assistant's diagnose function
        parsed_data = assistant.diagnose_dispatch_parsing(email_content)
        
        # Add metadata to response
        parsed_data['email_metadata'] = email_metadata
        
        update_metrics(success=True)
        
        return jsonify({
            'success': True,
            'parsed_data': parsed_data,
            'email_content': email_content[:500] + '...' if len(email_content) > 500 else email_content,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Email parsing error: {str(e)}")
        update_metrics(success=False)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/quick-action', methods=['POST'])
def quick_action():
    """Handle quick action buttons from the UI."""
    try:
        data = request.json
        action = data.get('action')
        
        if action == 'test-smtp':
            # Call the test_smtp function
            return test_smtp()
        elif action == 'validate-portal':
            # Call the test_portal function
            return test_portal()
        elif action == 'check-contacts':
            # For check contacts, we need to return a simple validation
            result = assistant.check_contact_mapping("*")  # Check all contacts
            return jsonify(result)
        elif action == 'parse-email':
            # For parse email, return instruction
            return jsonify({
                'success': True,
                'message': 'Please upload an email file using the file upload button to parse it.'
            })
        else:
            return jsonify({'error': 'Unknown action'}), 400
            
    except Exception as e:
        logger.error(f"Quick action error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    """Return system health and metrics."""
    try:
        uptime = datetime.now() - metrics['start_time']
        
        return jsonify({
            'status': 'healthy',
            'uptime_seconds': uptime.total_seconds(),
            'metrics': {
                'total_requests': metrics['total_requests'],
                'successful_requests': metrics['successful_requests'],
                'failed_requests': metrics['failed_requests'],
                'success_rate': metrics['successful_requests'] / max(metrics['total_requests'], 1),
                'active_sessions': metrics['active_sessions']
            },
            'environment': {
                'smtp_configured': bool(os.getenv('SMTP_HOST')),
                'portal_configured': bool(os.getenv('PORTAL_URL')),
                'test_mode': bool(os.getenv('TEST_EMAIL'))
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Status error: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e)
        }), 500


@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    """List all conversation sessions."""
    try:
        session_list = []
        for session_id, session_data in sessions.items():
            session_list.append({
                'session_id': session_id,
                'created_at': session_data['created_at'],
                'message_count': len(session_data['messages']),
                'last_message': session_data['messages'][-1]['timestamp'] if session_data['messages'] else None
            })
        
        return jsonify({
            'sessions': session_list,
            'total': len(session_list)
        })
        
    except Exception as e:
        logger.error(f"Session list error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>/export', methods=['POST'])
def export_session(session_id):
    """Export a specific session."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        session_data = sessions[session_id]
        
        # Create export file
        export_path = Path('/tmp') / f'session_{session_id}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
        with open(export_path, 'w') as f:
            json.dump({
                'session_id': session_id,
                'created_at': session_data['created_at'],
                'messages': session_data['messages'],
                'exported_at': datetime.now().isoformat()
            }, f, indent=2)
        
        return send_file(
            str(export_path),
            as_attachment=True,
            download_name=export_path.name,
            mimetype='application/json'
        )
        
    except Exception as e:
        logger.error(f"Session export error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def clear_session(session_id):
    """Clear a session."""
    try:
        if session_id not in sessions:
            return jsonify({'error': 'Session not found'}), 404
        
        del sessions[session_id]
        metrics['active_sessions'] = len(sessions)
        
        return jsonify({
            'success': True,
            'message': f'Session {session_id} cleared'
        })
        
    except Exception as e:
        logger.error(f"Session clear error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# WebSocket handlers
@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection."""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'message': 'Connected to CPower Dispatch Assistant'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection."""
    logger.info(f"Client disconnected: {request.sid}")


@socketio.on('join_session')
def handle_join_session(data):
    """Join a chat session room."""
    session_id = data.get('session_id', 'default')
    join_room(session_id)
    
    # Create session if it doesn't exist
    if session_id not in sessions:
        sessions[session_id] = {
            'created_at': datetime.now().isoformat(),
            'messages': []
        }
    
    emit('joined_session', {
        'session_id': session_id,
        'message': f'Joined session {session_id}'
    })


@socketio.on('leave_session')
def handle_leave_session(data):
    """Leave a chat session room."""
    session_id = data.get('session_id', 'default')
    leave_room(session_id)
    emit('left_session', {
        'session_id': session_id,
        'message': f'Left session {session_id}'
    })


@socketio.on('chat_message')
def handle_chat_message(data):
    """Handle real-time chat messages."""
    try:
        message = data.get('message', '')
        session_id = data.get('session_id', 'default')
        
        if not message:
            emit('error', {'error': 'Message is required'})
            return
        
        # Create session if it doesn't exist
        if session_id not in sessions:
            sessions[session_id] = {
                'created_at': datetime.now().isoformat(),
                'messages': []
            }
        
        # Emit that we're processing
        emit('processing', {'message': 'Processing your message...'}, room=session_id)
        
        # Get assistant response
        response = assistant.process_message(message, session_id)
        
        # Store conversation
        sessions[session_id]['messages'].append({
            'timestamp': datetime.now().isoformat(),
            'user': message,
            'assistant': response
        })
        
        # Emit response to all in the session
        emit('chat_response', {
            'response': response,
            'timestamp': datetime.now().isoformat()
        }, room=session_id)
        
        update_metrics(success=True)
        
    except Exception as e:
        logger.error(f"WebSocket chat error: {str(e)}")
        emit('error', {'error': str(e)})
        update_metrics(success=False)


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal error: {str(error)}")
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 3333))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info(f"Starting CPower Dispatch API Server on port {port}")
    logger.info(f"Debug mode: {debug}")
    logger.info(f"SMTP configured: {bool(os.getenv('SMTP_HOST'))}")
    logger.info(f"Portal configured: {bool(os.getenv('PORTAL_URL'))}")
    
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)