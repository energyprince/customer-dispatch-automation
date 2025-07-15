"""
Prompt Loader and Version Management
Handles loading, versioning, and A/B testing of prompts
"""
import os
import json
import hashlib
from datetime import datetime
from typing import Dict, Optional, List
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class PromptLoader:
    """
    Manages prompt loading, versioning, and A/B testing capabilities.
    """
    
    def __init__(self, prompts_dir: Optional[str] = None):
        """
        Initialize the prompt loader.
        
        Args:
            prompts_dir: Directory containing prompt files
        """
        self.prompts_dir = prompts_dir or os.path.dirname(__file__)
        self.prompts_cache = {}
        self.active_version = 'v2'  # Default version
        self.version_metrics = {}  # Track performance metrics per version
        
        # Load version configuration if exists
        self.config_file = os.path.join(self.prompts_dir, 'prompt_config.json')
        self.load_config()
    
    def load_config(self):
        """Load prompt configuration from file."""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    self.active_version = config.get('active_version', 'v1')
                    self.version_metrics = config.get('metrics', {})
                    logger.info(f"Loaded prompt config: active version = {self.active_version}")
            except Exception as e:
                logger.error(f"Error loading prompt config: {e}")
    
    def save_config(self):
        """Save current configuration to file."""
        config = {
            'active_version': self.active_version,
            'metrics': self.version_metrics,
            'last_updated': datetime.now().isoformat()
        }
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info("Saved prompt configuration")
        except Exception as e:
            logger.error(f"Error saving prompt config: {e}")
    
    def load_prompt(self, prompt_name: str, version: Optional[str] = None) -> str:
        """
        Load a specific prompt by name and version.
        
        Args:
            prompt_name: Name of the prompt (e.g., 'quote_generation')
            version: Specific version to load (defaults to active_version)
            
        Returns:
            Prompt content as string
        """
        version = version or self.active_version
        cache_key = f"{prompt_name}_{version}"
        
        # Check cache first
        if cache_key in self.prompts_cache:
            logger.debug(f"Returning cached prompt: {cache_key}")
            return self.prompts_cache[cache_key]
        
        # Construct filename
        filename = f"{prompt_name}_{version}.txt"
        filepath = os.path.join(self.prompts_dir, filename)
        
        # Try to load the file
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Cache the content
            self.prompts_cache[cache_key] = content
            logger.info(f"Loaded prompt: {filename}")
            return content
            
        except FileNotFoundError:
            # Fallback to v1 if specific version not found
            if version != 'v1':
                logger.warning(f"Version {version} not found for {prompt_name}, falling back to v1")
                return self.load_prompt(prompt_name, 'v1')
            else:
                raise FileNotFoundError(f"Prompt file not found: {filename}")
    
    def list_versions(self, prompt_name: str) -> List[str]:
        """
        List all available versions for a prompt.
        
        Args:
            prompt_name: Name of the prompt
            
        Returns:
            List of available versions
        """
        versions = []
        pattern = f"{prompt_name}_*.txt"
        
        for file in Path(self.prompts_dir).glob(pattern):
            # Extract version from filename
            version = file.stem.split('_')[-1]
            versions.append(version)
        
        return sorted(versions)
    
    def set_active_version(self, version: str):
        """
        Set the active prompt version.
        
        Args:
            version: Version to activate
        """
        self.active_version = version
        self.save_config()
        logger.info(f"Set active prompt version to: {version}")
    
    def create_version(self, prompt_name: str, content: str, version: Optional[str] = None) -> str:
        """
        Create a new version of a prompt.
        
        Args:
            prompt_name: Name of the prompt
            content: Prompt content
            version: Version name (auto-generated if not provided)
            
        Returns:
            Version name that was created
        """
        if not version:
            # Generate version based on content hash and timestamp
            content_hash = hashlib.md5(content.encode()).hexdigest()[:6]
            timestamp = datetime.now().strftime('%Y%m%d')
            version = f"v_{timestamp}_{content_hash}"
        
        filename = f"{prompt_name}_{version}.txt"
        filepath = os.path.join(self.prompts_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"Created new prompt version: {filename}")
        return version
    
    def track_metric(self, version: str, metric_name: str, value: float):
        """
        Track a performance metric for a specific version.
        
        Args:
            version: Prompt version
            metric_name: Name of the metric (e.g., 'success_rate', 'avg_response_time')
            value: Metric value
        """
        if version not in self.version_metrics:
            self.version_metrics[version] = {
                'created_at': datetime.now().isoformat(),
                'metrics': {},
                'usage_count': 0
            }
        
        metrics = self.version_metrics[version]['metrics']
        
        # Initialize metric tracking
        if metric_name not in metrics:
            metrics[metric_name] = {
                'values': [],
                'count': 0,
                'sum': 0,
                'average': 0
            }
        
        # Update metric
        metric_data = metrics[metric_name]
        metric_data['values'].append(value)
        metric_data['count'] += 1
        metric_data['sum'] += value
        metric_data['average'] = metric_data['sum'] / metric_data['count']
        
        # Increment usage count
        self.version_metrics[version]['usage_count'] += 1
        
        # Keep only last 100 values to prevent memory issues
        if len(metric_data['values']) > 100:
            metric_data['values'] = metric_data['values'][-100:]
        
        self.save_config()
    
    def get_metrics_summary(self) -> Dict:
        """
        Get a summary of metrics for all versions.
        
        Returns:
            Dict with metrics summary for each version
        """
        summary = {}
        
        for version, data in self.version_metrics.items():
            summary[version] = {
                'created_at': data.get('created_at', 'Unknown'),
                'usage_count': data.get('usage_count', 0),
                'metrics': {}
            }
            
            for metric_name, metric_data in data.get('metrics', {}).items():
                summary[version]['metrics'][metric_name] = {
                    'average': metric_data.get('average', 0),
                    'count': metric_data.get('count', 0),
                    'latest': metric_data['values'][-1] if metric_data.get('values') else None
                }
        
        return summary
    
    def ab_test_select(self, test_percentage: int = 10) -> str:
        """
        Select a prompt version for A/B testing.
        
        Args:
            test_percentage: Percentage of requests to use test version
            
        Returns:
            Selected version
        """
        import random
        
        # Get all available versions
        versions = self.list_versions('dispatch_assistant')
        
        # If only one version, use it
        if len(versions) <= 1:
            return self.active_version
        
        # Remove active version from test candidates
        test_versions = [v for v in versions if v != self.active_version]
        
        # Random selection based on percentage
        if random.randint(1, 100) <= test_percentage and test_versions:
            selected = random.choice(test_versions)
            logger.info(f"A/B test: selected version {selected}")
            return selected
        
        return self.active_version
    
    def reload_prompts(self):
        """Clear cache to force reload of prompts (useful for development)."""
        self.prompts_cache.clear()
        logger.info("Cleared prompt cache - prompts will be reloaded")


# Convenience function for quick prompt loading
def load_prompt(prompt_name: str = 'dispatch_assistant', version: Optional[str] = None) -> str:
    """
    Quick function to load a prompt.
    
    Args:
        prompt_name: Name of the prompt
        version: Optional version (defaults to active)
        
    Returns:
        Prompt content
    """
    loader = PromptLoader()
    return loader.load_prompt(prompt_name, version)