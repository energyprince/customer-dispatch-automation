"""
File Context Manager for CPower Dispatch Automation AI Assistant
Handles intelligent file reading and context preparation based on queries
"""
import os
import re
from typing import List, Dict, Tuple, Optional, Set
from functools import lru_cache
import logging
from collections import defaultdict
import mimetypes

logger = logging.getLogger(__name__)


class FileContextManager:
    """
    Manages file reading and context preparation for AI queries.
    Includes intelligent file selection, caching, and size management.
    """
    
    def __init__(self, base_path: str = None, max_context_size: int = 50000):
        """
        Initialize the context manager.
        
        Args:
            base_path: Base directory for file reads (defaults to project root)
            max_context_size: Maximum characters for context (increased for better coverage)
        """
        # Set base path to project root to access all files
        self.base_path = base_path or os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        self.max_context_size = max_context_size
        self.file_cache = {}
        
        # File extensions to include
        self.include_extensions = {'.js', '.ts', '.html', '.css', '.py', '.json', '.md', '.txt'}
        
        # Directories to exclude
        self.exclude_dirs = {'node_modules', 'venv', '__pycache__', '.git', 'dist', 'build'}
        
        # Build file index on initialization
        self.file_index = self.build_file_index()
        logger.info(f"File index built with {len(self.file_index)} files")
        
        # Core files that should always be prioritized
        self.core_files = {
            'src/parsers/customerDispatchParser.ts',
            'src/services/emailSender.ts',
            'src/services/portalAutomation.ts',
            'src/services/scheduler.ts',
            'src/utils/excelReader.ts',
            'CLAUDE.md'
        }
    
    def build_file_index(self) -> Dict[str, Dict]:
        """
        Build an index of all project files with metadata and content preview.
        
        Returns:
            Dict mapping file paths to metadata (size, type, keywords, etc.)
        """
        file_index = {}
        
        for root, dirs, files in os.walk(self.base_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in self.exclude_dirs]
            
            for file in files:
                # Check file extension
                _, ext = os.path.splitext(file)
                if ext not in self.include_extensions:
                    continue
                
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, self.base_path)
                
                try:
                    # Get file metadata
                    file_stat = os.stat(file_path)
                    file_size = file_stat.st_size
                    
                    # Skip very large files
                    if file_size > 500000:  # 500KB
                        logger.debug(f"Skipping large file: {rel_path} ({file_size} bytes)")
                        continue
                    
                    # Read file content for keyword extraction
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    # Extract keywords and metadata
                    keywords = self.extract_keywords(content, file_path)
                    
                    file_index[rel_path] = {
                        'size': file_size,
                        'extension': ext,
                        'keywords': keywords,
                        'content_preview': content[:500],  # First 500 chars
                        'type': self.determine_file_type(rel_path)
                    }
                    
                except Exception as e:
                    logger.debug(f"Error indexing {rel_path}: {e}")
                    continue
        
        return file_index
    
    def extract_keywords(self, content: str, file_path: str) -> Set[str]:
        """
        Extract relevant keywords from file content.
        
        Args:
            content: File content
            file_path: Path to file for context
            
        Returns:
            Set of keywords found in file
        """
        keywords = set()
        
        # Convert to lowercase for matching
        content_lower = content.lower()
        
        # Common dispatch automation terms
        dr_terms = [
            'dispatch', 'smtp', 'imap', 'portal', 'screenshot',
            'email sender', 'automation', 'facility', 'contact',
            'puppeteer', 'test email', 'office 365', 'gmail',
            'nodemailer', 'excel', 'parser', 'scheduler',
            'customer dispatch', 'event', 'notification',
            'cpowerenergy', 'northeast', 'aaron industries',
            'usage data', 'portal automation', 'email configuration'
        ]
        
        # Region terms
        region_terms = [
            'isone', 'iso-ne', 'nyiso', 'ercot', 'caiso', 'aps',
            'massachusetts', 'new york', 'texas', 'california', 'arizona',
            'ct', 'ma', 'ny', 'tx', 'ca', 'az',
            # Additional regions
            'pjm', 'mdu', 'miso', 'pennsylvania', 'pa', 'new jersey', 'nj',
            'maryland', 'md', 'delaware', 'de', 'virginia', 'va'
        ]
        
        # Check for presence of terms
        for term in dr_terms + region_terms:
            if term in content_lower:
                keywords.add(term)
        
        # Extract function/class names for JS/TS files
        if file_path.endswith(('.js', '.ts')):
            # Find class names
            class_matches = re.findall(r'class\s+(\w+)', content)
            keywords.update(m.lower() for m in class_matches)
            
            # Find function names
            func_matches = re.findall(r'(?:function|async\s+function)\s+(\w+)', content)
            keywords.update(m.lower() for m in func_matches if len(m) > 3)
            
            # Find exported functions/classes
            export_matches = re.findall(r'export\s+(?:class|function|async\s+function)\s+(\w+)', content)
            keywords.update(m.lower() for m in export_matches if len(m) > 3)
        
        # Extract HTML IDs and classes
        if file_path.endswith('.html'):
            id_matches = re.findall(r'id=["\']([^"\']+)["\']', content)
            keywords.update(m.lower() for m in id_matches if len(m) > 3)
            
            class_matches = re.findall(r'class=["\']([^"\']+)["\']', content)
            for class_str in class_matches:
                keywords.update(c.lower() for c in class_str.split() if len(c) > 3)
        
        return keywords
    
    def determine_file_type(self, file_path: str) -> str:
        """
        Determine the type/category of a file based on its path and name.
        
        Args:
            file_path: Relative file path
            
        Returns:
            File type category
        """
        if 'parser' in file_path:
            return 'parser_module'
        elif 'services' in file_path:
            return 'service_module'
        elif 'utils' in file_path:
            return 'utility_module'
        elif file_path.endswith('.html'):
            return 'html_template'
        elif file_path.endswith('.css'):
            return 'stylesheet'
        elif 'ai_assistant' in file_path:
            return 'ai_module'
        elif 'test' in file_path:
            return 'test_file'
        elif file_path.endswith('.md'):
            return 'documentation'
        else:
            return 'other'
    
    def calculate_relevance_score(self, file_info: Dict, query: str) -> float:
        """
        Calculate relevance score for a file based on the query.
        
        Args:
            file_info: File metadata from index
            query: User query
            
        Returns:
            Relevance score (0-1)
        """
        score = 0.0
        query_lower = query.lower()
        query_terms = set(query_lower.split())
        
        # Check keyword matches
        keyword_matches = len(query_terms.intersection(file_info['keywords']))
        score += keyword_matches * 0.3
        
        # Check content preview matches
        preview_lower = file_info['content_preview'].lower()
        for term in query_terms:
            if term in preview_lower:
                score += 0.1
        
        # Boost scores for certain file types based on query
        if 'email' in query_lower or 'smtp' in query_lower:
            if 'emailSender' in file_info.get('content_preview', ''):
                score += 0.5
        
        if 'dispatch' in query_lower or 'parser' in query_lower:
            if file_info['type'] in ['parser_module', 'service_module']:
                score += 0.2
        
        if 'portal' in query_lower or 'screenshot' in query_lower:
            if 'portalAutomation' in file_info.get('content_preview', ''):
                score += 0.3
        
        # Normalize score
        return min(score, 1.0)
    
    def get_context_files(self, query: str) -> List[str]:
        """
        Dynamically determine which files to read based on the query.
        Uses intelligent search across all indexed files.
        
        Args:
            query: User's query text
            
        Returns:
            List of file paths to include in context
        """
        # Calculate relevance scores for all files
        file_scores = []
        for file_path, file_info in self.file_index.items():
            score = self.calculate_relevance_score(file_info, query)
            if score > 0:
                file_scores.append((file_path, score, file_info))
        
        # Sort by relevance score
        file_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Start with core files
        selected_files = []
        for core_file in self.core_files:
            if core_file in self.file_index:
                selected_files.append(core_file)
        
        # Add relevant files based on score
        for file_path, score, file_info in file_scores:
            if file_path not in selected_files:
                selected_files.append(file_path)
                
                # Stop if we have enough files (to manage context size)
                if len(selected_files) >= 20:
                    break
        
        # Special handling for certain query types
        query_lower = query.lower()
        
        # Dispatch-specific feature handling
        region_program_map = {
            'smtp': ['src/services/emailSender.ts', 'CLAUDE.md'],
            'portal': ['src/services/portalAutomation.ts'],
            'dispatch': ['src/parsers/customerDispatchParser.ts'],
            'contact': ['src/utils/excelReader.ts'],
            'email': ['src/services/emailSender.ts', 'CLAUDE.md'],
            'screenshot': ['src/services/portalAutomation.ts'],
            'scheduler': ['src/services/scheduler.ts'],
            'office 365': ['CLAUDE.md'],
            'gmail': ['CLAUDE.md'],
            'test email': ['src/tests/phase3/test-aaron-safe.ts', 'src/tests/phase3/test-email-only.ts']
        }
        
        # Check for region/program specific queries and prioritize relevant files
        for keyword, files in region_program_map.items():
            if keyword in query_lower:
                for file_pattern in files:
                    matching_files = [f for f in self.file_index if file_pattern in f]
                    for match in matching_files[:2]:  # Add top matches
                        if match not in selected_files:
                            selected_files.insert(0, match)  # Prioritize at the beginning
                            logger.info(f"Prioritizing {match} for query containing '{keyword}'")
        
        # If asking about HTML structure or UI, prioritize HTML files
        if any(word in query_lower for word in ['html', 'button', 'form', 'ui', 'interface', 'tab']):
            html_files = [f for f in self.file_index if f.endswith('.html')]
            for html_file in html_files[:3]:  # Add top 3 HTML files
                if html_file not in selected_files:
                    selected_files.insert(0, html_file)
        
        # If asking about styling, include CSS
        if any(word in query_lower for word in ['style', 'css', 'color', 'design', 'layout']):
            css_files = [f for f in self.file_index if f.endswith('.css')]
            for css_file in css_files[:2]:  # Add top 2 CSS files
                if css_file not in selected_files:
                    selected_files.append(css_file)
        
        logger.info(f"Selected {len(selected_files)} context files for query: {query[:50]}...")
        logger.debug(f"Top files: {selected_files[:5]}")
        
        return selected_files
    
    @lru_cache(maxsize=100)
    def read_file(self, filepath: str) -> Tuple[str, bool]:
        """
        Read a file with caching support.
        
        Args:
            filepath: Relative path to file from base_path
            
        Returns:
            Tuple of (content, success)
        """
        try:
            full_path = os.path.join(self.base_path, filepath)
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            logger.debug(f"Successfully read {filepath} ({len(content)} chars)")
            return content, True
        except Exception as e:
            logger.error(f"Error reading {filepath}: {e}")
            return f"Error reading file: {str(e)}", False
    
    def prepare_context(self, query: str, custom_files: Optional[List[str]] = None) -> str:
        """
        Prepare context string from relevant files.
        
        Args:
            query: User's query
            custom_files: Optional list of specific files to include
            
        Returns:
            Formatted context string within size limits
        """
        # Get files to include
        files_to_read = custom_files or self.get_context_files(query)
        
        context_parts = []
        total_size = 0
        
        for filepath in files_to_read:
            content, success = self.read_file(filepath)
            if success:
                # Calculate space needed
                header = f"\n=== {filepath} ===\n"
                available_space = self.max_context_size - total_size - len(header) - 100  # Buffer
                
                if available_space <= 0:
                    logger.warning(f"Context size limit reached, skipping {filepath}")
                    break
                
                # Truncate if needed
                if len(content) > available_space:
                    content = content[:available_space] + "\n... [truncated]"
                
                context_parts.append(f"{header}{content}")
                total_size += len(header) + len(content)
        
        context_str = "".join(context_parts)
        logger.info(f"Prepared context with {len(context_parts)} files, {total_size} total chars")
        
        return context_str
    
    def get_file_summary(self, filepath: str, max_lines: int = 10) -> str:
        """
        Get a summary of a file (first N lines).
        
        Args:
            filepath: Path to file
            max_lines: Maximum lines to include
            
        Returns:
            File summary string
        """
        content, success = self.read_file(filepath)
        if not success:
            return content
        
        lines = content.splitlines()[:max_lines]
        total_lines = len(content.splitlines())
        if len(lines) < total_lines:
            remaining = total_lines - max_lines
            summary = '\n'.join(lines) + f"\n... [{remaining} more lines]"
        else:
            summary = '\n'.join(lines)
        
        return summary
    
    def search_files(self, pattern: str, file_filter: Optional[str] = None) -> Dict[str, List[str]]:
        """
        Search for a pattern across files.
        
        Args:
            pattern: Regex pattern to search
            file_filter: Optional file pattern filter (e.g., "*.js")
            
        Returns:
            Dict mapping filenames to list of matching lines
        """
        results = {}
        pattern_re = re.compile(pattern, re.IGNORECASE)
        
        # Walk through base directory
        for root, dirs, files in os.walk(self.base_path):
            for file in files:
                if file_filter and not file.endswith(file_filter):
                    continue
                
                filepath = os.path.relpath(os.path.join(root, file), self.base_path)
                content, success = self.read_file(filepath)
                
                if success:
                    matches = []
                    for i, line in enumerate(content.split('\n')):
                        if pattern_re.search(line):
                            matches.append(f"Line {i+1}: {line.strip()}")
                    
                    if matches:
                        results[filepath] = matches[:5]  # Limit to 5 matches per file
        
        return results
    
    def refresh_index(self):
        """
        Refresh the file index to pick up any new or changed files.
        """
        logger.info("Refreshing file index...")
        self.file_index = self.build_file_index()
        self.read_file.cache_clear()  # Clear the file cache
        logger.info(f"File index refreshed with {len(self.file_index)} files")
    
    def get_indexed_files_summary(self) -> Dict[str, int]:
        """
        Get a summary of indexed files by type.
        
        Returns:
            Dict mapping file types to counts
        """
        summary = defaultdict(int)
        for file_info in self.file_index.values():
            summary[file_info['type']] += 1
            summary[f"ext_{file_info['extension']}"] += 1
        
        summary['total'] = len(self.file_index)
        return dict(summary)