"""
CPower Dispatch Automation AI Assistant
Main module that orchestrates AI-powered dispatch automation assistance
"""

import os
import json
import re
import subprocess
import smtplib
from typing import Dict, Optional, Any, List
from datetime import datetime
import logging
import pandas as pd
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# DSPy for conversational history
# import dspy  # Temporarily disabled - version conflict

from claude_client import ClaudeClient
from context_manager import FileContextManager
from prompts.prompt_loader import PromptLoader
from conversation_memory import get_conversation_memory

logger = logging.getLogger(__name__)


class DispatchAssistant:
    """
    Main AI Assistant class for the CPower Dispatch Automation system.
    Coordinates between Claude API, file context, and prompt management for dispatch-related tasks.
    """
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        prompt_version: Optional[str] = None,
        enable_ab_testing: bool = False
    ):
        """
        Initialize the Dispatch Assistant.
        
        Args:
            api_key: Anthropic API key (defaults to env var)
            model: Claude model to use
            prompt_version: Specific prompt version to use
            enable_ab_testing: Enable A/B testing for prompts
        """
        # Initialize components
        self.claude_client = ClaudeClient(api_key=api_key, model=model)
        self.context_manager = FileContextManager()
        self.prompt_loader = PromptLoader()
        self.conversation_memory = get_conversation_memory()
        
        # Configuration
        self.prompt_version = prompt_version or os.environ.get('PROMPT_VERSION')
        self.enable_ab_testing = enable_ab_testing
        
        # Track metrics
        self.request_count = 0
        self.start_time = datetime.now()

        # DSPy conversation history (per session)
        self.session_histories = {}
        logger.info("Dispatch Assistant initialized")
    
    def process_query(
        self, 
        query: str, 
        session_id: Optional[str] = None,
        custom_context_files: Optional[List[str]] = None,
        include_conversation_context: bool = True
    ) -> Dict[str, Any]:
        """
        Process a user query and generate a response.
        
        Args:
            query: User's question or request
            session_id: Optional session ID for tracking
            custom_context_files: Optional list of specific files to include
            include_conversation_context: Whether to include conversation history
            
        Returns:
            Response dictionary with text, metadata, and extracted data
        """
        self.request_count += 1
        start_time = datetime.now()

        # --- DSPy History integration ---
        # Temporarily disabled until dspy is properly configured
        history = None

        try:
            # Create or get session
            if not session_id:
                session_id = self.conversation_memory.create_session()
            elif session_id not in self.conversation_memory.sessions:
                self.conversation_memory.create_session(session_id)
            
            # Add user message to conversation history
            self.conversation_memory.add_message(session_id, 'user', query)
            # Select prompt version (with A/B testing if enabled)
            if self.enable_ab_testing and not self.prompt_version:
                prompt_version = self.prompt_loader.ab_test_select(test_percentage=20)
            else:
                prompt_version = self.prompt_version

            # Load the prompt
            system_prompt = self.prompt_loader.load_prompt('dispatch_assistant', prompt_version)

            # Prepare context
            context = self.context_manager.prepare_context(query, custom_context_files)
            
            # Get conversation history if enabled
            conversation_context = []
            if include_conversation_context and session_id:
                conversation_context = self.conversation_memory.get_conversation_context(session_id)
                # Remove the last message (current query) to avoid duplication
                if conversation_context and conversation_context[-1]['role'] == 'user':
                    conversation_context = conversation_context[:-1]
                
                # Log conversation context for debugging
                logger.info(f"Session {session_id}: Retrieved {len(conversation_context)} messages from history")
                if conversation_context:
                    logger.debug(f"Conversation context: {[{'role': m['role'], 'content_preview': m['content'][:50] + '...'} for m in conversation_context]}")
            
            # Generate response
            response = self.claude_client.generate_response(
                system_prompt=system_prompt,
                user_query=query,
                context=context,
                conversation_history=conversation_context,
                history=history
            )

            # Process and enhance response
            enhanced_response = self._enhance_response(response, query)
            
            # Add assistant response to conversation history
            self.conversation_memory.add_message(
                session_id, 
                'assistant', 
                enhanced_response.get('text', ''),
                metadata={
                    'json_config': enhanced_response.get('json_config'),
                    'query_type': enhanced_response.get('query_type')
                }
            )
            
            # Track metrics
            elapsed_time = (datetime.now() - start_time).total_seconds()
            self._track_metrics(prompt_version, elapsed_time, enhanced_response)
            
            # Get session info
            session_info = self.conversation_memory.get_session_info(session_id)
            # Add metadata
            enhanced_response['metadata'] = {
                'session_id': session_id,
                'prompt_version': prompt_version,
                'context_files': self.context_manager.get_context_files(query),
                'processing_time': elapsed_time,
                'request_number': self.request_count,
                'conversation_length': session_info['message_count'] if session_info else 1,
                'has_context': len(conversation_context) > 0
            }

            # --- Update DSPy history with this turn ---
            # Temporarily disabled until dspy is properly configured
            pass

            logger.info(f"Processed query in {elapsed_time:.2f}s using prompt {prompt_version}")
            return enhanced_response

        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return {
                'success': False,
                'error': str(e),
                'text': f"I encountered an error processing your request: {str(e)}",
                'metadata': {
                    'session_id': session_id,
                    'error_type': type(e).__name__
                }
            }
    
    def _enhance_response(self, response: Dict[str, Any], query: str) -> Dict[str, Any]:
        """
        Enhance the response with additional processing for dispatch automation.
        
        Args:
            response: Raw response from Claude
            query: Original query
            
        Returns:
            Enhanced response dictionary
        """
        enhanced = response.copy()
        enhanced['success'] = True
        
        # Validate JSON configuration if present
        if 'json_config' in response:
            is_valid, error_msg = self.claude_client.validate_json_config(response['json_config'])
            enhanced['json_valid'] = is_valid
            if not is_valid:
                enhanced['json_error'] = error_msg
        
        # Classify query type
        enhanced['query_type'] = self._classify_query(query)
        
        # Add dispatch-specific enhancements based on query type
        if enhanced['query_type'] == 'email_configuration':
            # Check if SMTP validation was mentioned
            if 'smtp' in query.lower() or 'email' in query.lower():
                enhanced['smtp_status'] = self.validate_smtp_config()
        
        elif enhanced['query_type'] == 'portal_issues':
            # Check portal access if mentioned
            if 'portal' in query.lower() or 'login' in query.lower():
                enhanced['portal_status'] = self.validate_portal_access()
        
        return enhanced
    
    
    def _classify_query(self, query: str) -> str:
        """Classify the type of query for dispatch automation."""
        query_lower = query.lower()
        
        # Email configuration patterns
        if any(word in query_lower for word in ['email', 'smtp', 'gmail', 'office 365', 'outlook', 'mail']):
            return 'email_configuration'
        
        # Portal issues patterns
        if any(word in query_lower for word in ['portal', 'login', 'screenshot', 'browser', 'puppeteer']):
            return 'portal_issues'
        
        # Contact management patterns
        if any(word in query_lower for word in ['contact', 'excel', 'facility', 'recipient']):
            return 'contact_management'
        
        # Dispatch parsing patterns
        if any(word in query_lower for word in ['parse', 'dispatch', 'event', 'extract', 'parsing']):
            return 'dispatch_parsing'
        
        # Testing patterns
        if any(word in query_lower for word in ['test', 'verify', 'check', 'validate']):
            return 'testing'
        
        # Troubleshooting
        if any(word in query_lower for word in ["can't", 'cannot', 'blocked', 'why not', 'error', 'fail']):
            return 'troubleshooting'
        
        return 'general'
    
    def _track_metrics(self, prompt_version: str, elapsed_time: float, response: Dict[str, Any]):
        """Track performance metrics for the prompt version."""
        # Track response time
        self.prompt_loader.track_metric(prompt_version, 'response_time', elapsed_time)
        
        # Track success rate
        success = 1.0 if response.get('success', False) else 0.0
        self.prompt_loader.track_metric(prompt_version, 'success_rate', success)
        
        # Track JSON generation success (if applicable)
        if 'json_config' in response:
            json_success = 1.0 if response.get('json_valid', False) else 0.0
            self.prompt_loader.track_metric(prompt_version, 'json_success_rate', json_success)
    
    def validate_smtp_config(self) -> Dict[str, Any]:
        """
        Test SMTP connection using environment variables.
        
        Returns:
            Dictionary with validation results
        """
        result = {
            'valid': False,
            'error': None,
            'config': {}
        }
        
        try:
            # Get SMTP configuration from environment
            smtp_config = {
                'host': os.environ.get('SMTP_HOST'),
                'port': int(os.environ.get('SMTP_PORT', '587')),
                'user': os.environ.get('SMTP_USER'),
                'password': os.environ.get('SMTP_PASSWORD'),
                'secure': os.environ.get('SMTP_SECURE', 'false').lower() == 'true'
            }
            
            result['config'] = {k: v for k, v in smtp_config.items() if k != 'password'}
            
            # Check required fields
            if not all([smtp_config['host'], smtp_config['user'], smtp_config['password']]):
                result['error'] = 'Missing required SMTP configuration'
                return result
            
            # Test connection
            server = smtplib.SMTP(smtp_config['host'], smtp_config['port'])
            server.starttls()
            server.login(smtp_config['user'], smtp_config['password'])
            server.quit()
            
            result['valid'] = True
            logger.info("SMTP configuration validated successfully")
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"SMTP validation failed: {e}")
        
        return result
    
    def validate_portal_access(self) -> Dict[str, Any]:
        """
        Check portal credentials and accessibility.
        
        Returns:
            Dictionary with validation results
        """
        result = {
            'valid': False,
            'error': None,
            'portal_url': os.environ.get('PORTAL_URL')
        }
        
        try:
            # Check required environment variables
            portal_config = {
                'url': os.environ.get('PORTAL_URL'),
                'username': os.environ.get('PORTAL_USERNAME'),
                'password': os.environ.get('PORTAL_PASSWORD')
            }
            
            if not all(portal_config.values()):
                result['error'] = 'Missing portal configuration'
                return result
            
            # Could add actual portal connectivity test here
            # For now, just validate that credentials exist
            result['valid'] = True
            result['username'] = portal_config['username']
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Portal validation failed: {e}")
        
        return result
    
    def diagnose_dispatch_parsing(self, email_content: str) -> Dict[str, Any]:
        """
        Help diagnose issues with dispatch email parsing.
        
        Args:
            email_content: Raw email content to analyze
            
        Returns:
            Dictionary with parsing diagnostics
        """
        result = {
            'facilities_found': [],
            'event_info': {},
            'potential_issues': [],
            'recommendations': []
        }
        
        try:
            # Look for facility patterns
            facility_pattern = r'([A-Za-z0-9\s\-&,\.]+?)(?:\s*\(ID:\s*(\d+)\))?'
            facilities = re.findall(facility_pattern, email_content)
            result['facilities_found'] = [f[0].strip() for f in facilities if f[0].strip()]
            
            # Look for event timing
            time_pattern = r'(\d{1,2}:\d{2}\s*(?:AM|PM))'
            times = re.findall(time_pattern, email_content, re.IGNORECASE)
            if times:
                result['event_info']['times_found'] = times
            
            # Look for date patterns
            date_pattern = r'(\d{1,2}/\d{1,2}/\d{2,4})'
            dates = re.findall(date_pattern, email_content)
            if dates:
                result['event_info']['dates_found'] = dates
            
            # Identify potential issues
            if not result['facilities_found']:
                result['potential_issues'].append('No facilities detected in email')
                result['recommendations'].append('Check facility name format in dispatch emails')
            
            if 'times_found' not in result['event_info']:
                result['potential_issues'].append('No event times detected')
                result['recommendations'].append('Ensure email contains event start/end times')
            
            # Check for common dispatch keywords
            keywords = ['dispatch', 'event', 'curtailment', 'reduction']
            found_keywords = [kw for kw in keywords if kw.lower() in email_content.lower()]
            result['event_info']['keywords_found'] = found_keywords
            
            if not found_keywords:
                result['potential_issues'].append('No dispatch-related keywords found')
                result['recommendations'].append('Verify this is a dispatch notification email')
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Dispatch parsing diagnosis failed: {e}")
        
        return result
    
    def check_contact_mapping(self, facility_name: str) -> Dict[str, Any]:
        """
        Validate Excel contact mapping for a facility.
        
        Args:
            facility_name: Name of the facility to check
            
        Returns:
            Dictionary with contact validation results
        """
        result = {
            'facility': facility_name,
            'contacts_found': [],
            'excel_file': None,
            'error': None
        }
        
        try:
            # Look for Excel file
            excel_files = [f for f in os.listdir('.') if f.endswith(('.xlsx', '.xls'))]
            if not excel_files:
                result['error'] = 'No Excel file found in current directory'
                return result
            
            # Use the first Excel file found
            excel_file = excel_files[0]
            result['excel_file'] = excel_file
            
            # Read Excel file
            df = pd.read_excel(excel_file)
            
            # Look for facility in various possible column names
            facility_columns = ['Facility', 'FacilityName', 'Facility Name', 'Name']
            email_columns = ['Email', 'EmailAddress', 'Email Address', 'Contact']
            
            facility_col = None
            email_col = None
            
            for col in df.columns:
                if col in facility_columns:
                    facility_col = col
                if col in email_columns:
                    email_col = col
            
            if not facility_col or not email_col:
                result['error'] = f'Could not find facility or email columns in {excel_file}'
                return result
            
            # Search for facility
            matches = df[df[facility_col].str.contains(facility_name, case=False, na=False)]
            
            if not matches.empty:
                for _, row in matches.iterrows():
                    if pd.notna(row[email_col]):
                        result['contacts_found'].append({
                            'facility': row[facility_col],
                            'email': row[email_col]
                        })
            
            if not result['contacts_found']:
                result['error'] = f'No contacts found for facility: {facility_name}'
            
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Contact mapping check failed: {e}")
        
        return result
    
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status of the assistant."""
        uptime = (datetime.now() - self.start_time).total_seconds()
        
        return {
            'status': 'healthy' if self.claude_client.check_health() else 'unhealthy',
            'uptime_seconds': uptime,
            'request_count': self.request_count,
            'average_request_time': uptime / self.request_count if self.request_count > 0 else 0,
            'active_prompt_version': self.prompt_loader.active_version,
            'available_prompt_versions': self.prompt_loader.list_versions('dispatch_assistant'),
            'metrics_summary': self.prompt_loader.get_metrics_summary(),
            'active_sessions': len(self.conversation_memory.sessions),
            'total_conversations': sum(s['metadata']['message_count'] for s in self.conversation_memory.sessions.values())
        }
    
    def clear_session(self, session_id: str) -> bool:
        """
        Clear a conversation session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Success status
        """
        return self.conversation_memory.clear_session(session_id)
    
    def export_session(self, session_id: str) -> Optional[Dict]:
        """
        Export a conversation session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session data or None
        """
        return self.conversation_memory.export_session(session_id)
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """
        Get information about a specific session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session info or None
        """
        return self.conversation_memory.get_session_info(session_id)
    
    def list_sessions(self) -> List[Dict]:
        """
        Get list of all active sessions.
        
        Returns:
            List of session summaries
        """
        return self.conversation_memory.get_all_sessions()


# Convenience function for quick assistant creation
def create_assistant(api_key: Optional[str] = None, **kwargs) -> DispatchAssistant:
    """Create a DispatchAssistant instance with optional configuration."""
    return DispatchAssistant(api_key=api_key, **kwargs)