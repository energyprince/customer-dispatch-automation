"""
Conversation Memory Manager for CPower Quote Tool AI Assistant
Handles conversation history, context management, and session persistence
"""
import os
import json
import uuid
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
from collections import defaultdict, OrderedDict
import logging

logger = logging.getLogger(__name__)


class ConversationMemory:
    """
    Manages conversation history and context for AI assistant sessions.
    Supports in-memory storage with optional persistence.
    """
    
    def __init__(
        self, 
        max_messages: int = 10,
        max_context_tokens: int = 3000,
        session_timeout_hours: int = 24,
        storage_backend: str = 'file'  # 'memory', 'file', or 'redis'
    ):
        """
        Initialize conversation memory manager.
        
        Args:
            max_messages: Maximum messages to keep in active context
            max_context_tokens: Approximate max tokens for context window
            session_timeout_hours: Hours before a session expires
            storage_backend: Storage backend type
        """
        self.max_messages = max_messages
        self.max_context_tokens = max_context_tokens
        self.session_timeout = timedelta(hours=session_timeout_hours)
        self.storage_backend = storage_backend
        
        # In-memory storage (used by all backends as cache)
        self.sessions: Dict[str, Dict] = OrderedDict()
        
        # Initialize storage backend
        self._init_storage()
        
        logger.info(f"ConversationMemory initialized with {storage_backend} backend")
    
    def _init_storage(self):
        """Initialize the storage backend."""
        if self.storage_backend == 'file':
            self.storage_path = os.path.join(
                os.path.dirname(__file__), 
                'conversation_sessions.json'
            )
            self._load_from_file()
        elif self.storage_backend == 'redis':
            # Redis implementation would go here
            logger.warning("Redis backend not implemented, falling back to memory")
            self.storage_backend = 'memory'
    
    def create_session(self, session_id: Optional[str] = None) -> str:
        """
        Create a new conversation session.
        
        Args:
            session_id: Optional session ID, generates UUID if not provided
            
        Returns:
            Session ID
        """
        if not session_id:
            session_id = str(uuid.uuid4())
        
        self.sessions[session_id] = {
            'id': session_id,
            'messages': [],
            'metadata': {
                'created_at': datetime.now().isoformat(),
                'last_active': datetime.now().isoformat(),
                'message_count': 0,
                'context_summary': None
            }
        }
        
        self._persist_session(session_id)
        logger.info(f"Created new session: {session_id}")
        return session_id
    
    def add_message(
        self, 
        session_id: str, 
        role: str, 
        content: str, 
        metadata: Optional[Dict] = None
    ) -> bool:
        """
        Add a message to the conversation history.
        
        Args:
            session_id: Session identifier
            role: Message role ('user' or 'assistant')
            content: Message content
            metadata: Optional metadata for the message
            
        Returns:
            Success status
        """
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found, creating new session")
            self.create_session(session_id)
        
        session = self.sessions[session_id]
        
        message = {
            'role': role,
            'content': content,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        }
        
        session['messages'].append(message)
        session['metadata']['last_active'] = datetime.now().isoformat()
        session['metadata']['message_count'] += 1
        
        logger.info(f"Added {role} message to session {session_id}. Total messages: {len(session['messages'])}")
        logger.debug(f"Message preview: {content[:100]}...")
        
        # Trim messages if exceeding limit
        if len(session['messages']) > self.max_messages * 2:
            self._trim_messages(session_id)
        
        self._persist_session(session_id)
        return True
    
    def get_conversation_context(
        self, 
        session_id: str, 
        include_system_prompt: bool = False
    ) -> List[Dict[str, str]]:
        """
        Get conversation context for Claude API.
        
        Args:
            session_id: Session identifier
            include_system_prompt: Whether to include system context
            
        Returns:
            List of messages formatted for Claude API
        """
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found")
            return []
        
        session = self.sessions[session_id]
        messages = session['messages']
        
        logger.info(f"Getting conversation context for session {session_id}. Total messages in session: {len(messages)}")
        
        # Get recent messages within token limit
        context_messages = self._get_context_window(messages)
        
        logger.info(f"Context window contains {len(context_messages)} messages (max: {self.max_messages})")
        
        # Format for Claude API
        formatted_messages = []
        for msg in context_messages:
            formatted_messages.append({
                'role': msg['role'],
                'content': msg['content']
            })
        
        # Add context summary if available and messages were trimmed
        if session['metadata'].get('context_summary') and len(messages) > len(context_messages):
            summary_message = {
                'role': 'assistant',
                'content': f"[Previous conversation summary: {session['metadata']['context_summary']}]"
            }
            formatted_messages.insert(0, summary_message)
            logger.info("Added context summary to conversation history")
        
        return formatted_messages
    
    def _get_context_window(self, messages: List[Dict]) -> List[Dict]:
        """
        Get messages that fit within the context window.
        
        Args:
            messages: All messages in the session
            
        Returns:
            Messages that fit in the context window
        """
        if len(messages) <= self.max_messages:
            return messages
        
        # Simple strategy: take the most recent messages
        # More sophisticated token counting could be implemented
        return messages[-self.max_messages:]
    
    def _trim_messages(self, session_id: str):
        """
        Trim old messages and create summary if needed.
        
        Args:
            session_id: Session identifier
        """
        session = self.sessions[session_id]
        messages = session['messages']
        
        if len(messages) <= self.max_messages:
            return
        
        # Keep recent messages
        messages_to_keep = messages[-self.max_messages:]
        
        # Create summary of trimmed messages (simplified version)
        trimmed_messages = messages[:-self.max_messages]
        summary_parts = []
        
        # Group by topic changes or significant points
        for msg in trimmed_messages[-5:]:  # Summarize last 5 trimmed messages
            if msg['role'] == 'user':
                summary_parts.append(f"User asked about: {msg['content'][:50]}...")
        
        if summary_parts:
            session['metadata']['context_summary'] = "; ".join(summary_parts)
        
        session['messages'] = messages_to_keep
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """
        Get session metadata and statistics.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Session information or None if not found
        """
        if session_id not in self.sessions:
            return None
        
        session = self.sessions[session_id]
        return {
            'id': session_id,
            'created_at': session['metadata']['created_at'],
            'last_active': session['metadata']['last_active'],
            'message_count': session['metadata']['message_count'],
            'has_summary': bool(session['metadata'].get('context_summary')),
            'current_context_size': len(self._get_context_window(session['messages']))
        }
    
    def clear_session(self, session_id: str) -> bool:
        """
        Clear a conversation session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Success status
        """
        if session_id in self.sessions:
            del self.sessions[session_id]
            self._persist_session(session_id, delete=True)
            logger.info(f"Cleared session: {session_id}")
            return True
        return False
    
    def export_session(self, session_id: str) -> Optional[Dict]:
        """
        Export full session data.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Complete session data or None
        """
        if session_id not in self.sessions:
            return None
        
        return self.sessions[session_id].copy()
    
    def cleanup_expired_sessions(self):
        """Remove sessions that have been inactive beyond the timeout period."""
        current_time = datetime.now()
        expired_sessions = []
        
        for session_id, session in self.sessions.items():
            last_active = datetime.fromisoformat(session['metadata']['last_active'])
            if current_time - last_active > self.session_timeout:
                expired_sessions.append(session_id)
        
        for session_id in expired_sessions:
            self.clear_session(session_id)
        
        if expired_sessions:
            logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")
    
    def _persist_session(self, session_id: str, delete: bool = False):
        """
        Persist session to storage backend.
        
        Args:
            session_id: Session identifier
            delete: Whether to delete the session
        """
        if self.storage_backend == 'file':
            logger.debug(f"Persisting session {session_id} to file storage")
            self._save_to_file()
        elif self.storage_backend == 'memory':
            logger.debug(f"Using memory storage only - session {session_id} not persisted to disk")
        # Redis persistence would go here
    
    def _save_to_file(self):
        """Save all sessions to file."""
        try:
            with open(self.storage_path, 'w') as f:
                json.dump(dict(self.sessions), f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save sessions to file: {e}")
    
    def _load_from_file(self):
        """Load sessions from file."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r') as f:
                    data = json.load(f)
                    self.sessions = OrderedDict(data)
                logger.info(f"Loaded {len(self.sessions)} sessions from file")
            except Exception as e:
                logger.error(f"Failed to load sessions from file: {e}")
    
    def get_all_sessions(self) -> List[Dict]:
        """
        Get list of all active sessions.
        
        Returns:
            List of session summaries
        """
        sessions_list = []
        for session_id in self.sessions:
            info = self.get_session_info(session_id)
            if info:
                sessions_list.append(info)
        
        # Sort by last active
        sessions_list.sort(key=lambda x: x['last_active'], reverse=True)
        return sessions_list


# Singleton instance
_conversation_memory_instance = None


def get_conversation_memory() -> ConversationMemory:
    """Get the singleton ConversationMemory instance."""
    global _conversation_memory_instance
    if _conversation_memory_instance is None:
        _conversation_memory_instance = ConversationMemory()
    return _conversation_memory_instance