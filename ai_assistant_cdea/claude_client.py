"""
Claude API Client for CPower Quote Tool
Handles all interactions with the Anthropic Claude API
"""
import os
import re
import json
from typing import Dict, Optional, Tuple, Any, List
from anthropic import Anthropic
import logging

logger = logging.getLogger(__name__)


class ClaudeClient:
    """
    Wrapper for Claude API interactions with enhanced error handling,
    response parsing, and configuration management.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """
        Initialize Claude client with API key and model selection.
        
        Args:
            api_key: Anthropic API key (defaults to environment variable)
            model: Model to use (defaults to claude-3-haiku-20240307)
        """
        # Get API key from parameter or environment
        self.api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("No API key provided. Set ANTHROPIC_API_KEY environment variable or pass api_key parameter.")
        
        # Initialize client
        try:
            # Create httpx client that ignores proxy environment variables
            import httpx
            http_client = httpx.Client(trust_env=False)
            self.client = Anthropic(api_key=self.api_key, http_client=http_client)
            logger.info("Anthropic client initialized successfully with custom http client")
        except Exception as e:
            logger.error(f"Failed to initialize Anthropic client: {e}")
            # Try without custom http client as fallback
            try:
                self.client = Anthropic(api_key=self.api_key)
                logger.info("Anthropic client initialized successfully (fallback)")
            except Exception as e2:
                logger.error(f"Fallback initialization also failed: {e2}")
                raise
        
        # Model configuration
        self.model = model or os.environ.get('CLAUDE_MODEL', 'claude-3-haiku-20240307')
        self.max_tokens = int(os.environ.get('CLAUDE_MAX_TOKENS', '2000'))
        self.temperature = float(os.environ.get('CLAUDE_TEMPERATURE', '0.3'))
        
        logger.info(f"Claude client initialized with model: {self.model}")
    
    def generate_response(
        self, 
        system_prompt: str, 
        user_query: str, 
        context: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        history: Optional[Any] = None  # Accept history for compatibility
    ) -> Dict[str, Any]:
        """
        Generate a response from Claude API.
        
        Args:
            system_prompt: System instructions for Claude
            user_query: User's question or request
            context: Additional context (e.g., file contents)
            conversation_history: Previous messages in the conversation
            max_tokens: Override default max tokens
            temperature: Override default temperature
            
        Returns:
            Dict containing response text, usage info, and extracted JSON if present
        """
        try:
            # Build messages list
            messages = []
            
            # Add conversation history if provided
            if conversation_history:
                messages.extend(conversation_history)
                logger.info(f"Claude API: Including {len(conversation_history)} messages from conversation history")
                logger.debug(f"History preview: {[{'role': m['role'], 'len': len(m['content'])} for m in conversation_history[:3]]}")
            else:
                logger.info("Claude API: No conversation history provided")
            
            # Build the user message
            user_content = user_query
            if context:
                user_content = f"Context from codebase:\n{context}\n\nUser Query: {user_query}\n\nPlease provide a helpful response following the analysis process and guidelines in your system prompt. If generating a quote, include the JSON configuration in a ```json code block."

            # Optionally, append history to the END of the user_content for context
            if history and hasattr(history, 'messages') and history.messages:
                history_str = "\n\nConversation history (this session):\n"
                for turn in history.messages:
                    q = turn.get('question', '')
                    a = turn.get('answer', '')
                    history_str += f"Q: {q}\nA: {a}\n"
                user_content = user_content + history_str

            # Log the full prompt for debugging
            logger.info(f"Prompt sent to Claude (user_content):\n{user_content}")
            
            # Add current user message
            messages.append({
                "role": "user",
                "content": user_content
            })
            
            logger.info(f"Claude API: Total messages to send: {len(messages)}")
            
            # Make API call
            message = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens or self.max_tokens,
                temperature=temperature or self.temperature,
                system=system_prompt,
                messages=messages
            )
            
            # Extract response
            response_text = message.content[0].text
            
            # Parse response
            result = {
                'text': response_text,
                'api_used': 'claude',
                'model': self.model,
                'usage': {
                    'input_tokens': message.usage.input_tokens,
                    'output_tokens': message.usage.output_tokens
                }
            }
            
            # Try to extract JSON configuration if present
            json_config = self._extract_json(response_text)
            if json_config:
                result['json_config'] = json_config
            
            logger.info(f"Generated response with {message.usage.output_tokens} tokens")
            return result
            
        except Exception as e:
            logger.error(f"Claude API error: {str(e)}")
            raise
    
    def _extract_json(self, text: str) -> Optional[Dict]:
        """
        Extract JSON configuration from response text.
        
        Args:
            text: Response text potentially containing JSON
            
        Returns:
            Parsed JSON dict or None if not found/invalid
        """
        json_match = re.search(r'```json\n([\s\S]*?)\n```', text)
        if json_match:
            try:
                json_str = json_match.group(1)
                return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from response: {e}")
        return None
    
    def validate_json_config(self, config: Dict) -> Tuple[bool, Optional[str]]:
        """
        Validate a quote configuration JSON.
        
        Args:
            config: Configuration dictionary to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        required_fields = ['customer_name', 'region', 'programs']
        
        # Check required fields
        for field in required_fields:
            if field not in config:
                return False, f"Missing required field: {field}"
        
        # Validate region
        valid_regions = ['ISO-NE', 'NYISO', 'ERCOT', 'CAISO', 'APS']
        if config['region'] not in valid_regions:
            return False, f"Invalid region: {config['region']}. Must be one of {valid_regions}"
        
        # Validate programs structure
        if not isinstance(config['programs'], dict):
            return False, "Programs must be a dictionary"
        
        return True, None
    
    def check_health(self) -> bool:
        """
        Check if Claude API is accessible.
        
        Returns:
            True if API is healthy, False otherwise
        """
        try:
            # Simple health check with minimal tokens
            message = self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Hi"}]
            )
            return len(message.content) > 0
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False