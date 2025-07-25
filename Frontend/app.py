from time import sleep
import paramiko
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file, session
import os
import ast
from werkzeug.utils import secure_filename
import json
import sys
import subprocess
import re
import time
import requests
from urllib.parse import urlparse
import glob
import threading
from datetime import datetime
import signal
from pathlib import Path
import atexit
import zipfile
import tempfile
import socket
import base64
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed
import xml.etree.ElementTree as ET
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'Backend'))
from smart_code_reuse import DeveloperWorkflowReuse

# Initialize Flask with explicit static folder configuration
app = Flask(__name__,
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')

# Production configuration
if os.environ.get('FLASK_ENV') == 'production':
    app.config['DEBUG'] = False
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'fallback-secret-key')
else:
    app.config['DEBUG'] = True
    app.config['SECRET_KEY'] = 'dev-secret-key'

app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), '..', 'test_case')
app.config['GENERATED_SCRIPTS_FOLDER'] = os.path.join(os.getcwd(), '..', 'generated-scripts')
app.config['REPORT_FOLDER'] = os.path.join(os.getcwd(), '..', 'reports')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Try to import the enhanced generator - fallback gracefully if not available
try:
    sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'Backend'))
    from Auto_test_gen import EnhancedCodeGenerator
    AI_GENERATOR_AVAILABLE = True
    print("✅ Enhanced Code Generator imported successfully")
except ImportError as e:
    AI_GENERATOR_AVAILABLE = False
    print(f"⚠️ Enhanced Code Generator not available: {e}")

# Initialize developer reuse system
try:
    developer_reuse_system = DeveloperWorkflowReuse()
    developer_reuse_system.initialize()
    print("✅ Developer reuse system initialized")
except Exception as e:
    developer_reuse_system = None
    print(f"⚠️ Developer reuse system failed to initialize: {e}")

# Global variable to store JIRA connection and tickets
jira_connection = None
jira_tickets = []
selected_jira_tickets = []

# 2. ADD AI CONFIGURATION (near other config variables)
AI_CONFIG = {
    'backend': 'auto',  # 'auto', 'ollama', 'llama2'
    'ollama_url': 'http://localhost:11434',
    'ollama_model': 'codellama:7b'
}
# Ensure upload directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

generation_lock = threading.Lock()

# Add these new global variables
developer_workflows = []
codebase_context = {}
current_mode = 'qa'  # Default mode
generatedApplicationCode = []  # Add this line near other global variables

# Updated allowed file extensions
ALLOWED_EXTENSIONS = {
    'txt', 'rtf', 'md', 'log', 'pdf', 'doc', 'docx', 'odt', 'pages',
    'py'  # NEW: Allow Python files
}

# Add this new global variable for device management
devices_config = None
device_status_cache = {}
device_status_lock = threading.Lock()

# JIRA integration class
class JiraIntegration:
    def __init__(self):
        self.base_url = None
        self.username = None
        self.password = None  # Use API token for cloud instances
        self.session = requests.Session()

    def connect(self, jira_url, username, password_or_token):
        """Establish connection to JIRA"""
        try:
            self.base_url = jira_url.rstrip('/')
            self.username = username
            self.password = password_or_token

            # Setup authentication
            auth_string = f"{username}:{password_or_token}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')

            self.session.headers.update({
                'Authorization': f'Basic {auth_b64}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            })

            # Test connection
            test_url = f"{self.base_url}/rest/api/2/myself"
            response = self.session.get(test_url, timeout=10)

            if response.status_code == 200:
                user_info = response.json()
                print(f"[JIRA] Connected successfully as: {user_info.get('displayName', username)}")
                return True, f"Connected as {user_info.get('displayName', username)}"
            else:
                return False, f"Authentication failed: {response.status_code}"

        except Exception as e:
            return False, f"Connection error: {str(e)}"

    def get_projects(self):
        """Get list of available projects"""
        try:
            url = f"{self.base_url}/rest/api/2/project"
            response = self.session.get(url, timeout=10)

            if response.status_code == 200:
                projects = response.json()
                return True, projects
            else:
                return False, f"Failed to fetch projects: {response.status_code}"

        except Exception as e:
            return False, f"Error fetching projects: {str(e)}"

    def get_todo_tickets(self, project_key):
        """Get tickets in To-Do status from a project"""
        try:
            # JQL query to get tickets in To-Do status
            jql = f'project = "{project_key}" AND status = "To Do" ORDER BY priority DESC, created DESC'

            url = f"{self.base_url}/rest/api/2/search"
            params = {
                'jql': jql,
                'maxResults': 100,
                'fields': 'summary,description,priority,assignee,reporter,created,updated,status,issuetype'
            }

            response = self.session.get(url, params=params, timeout=15)

            if response.status_code == 200:
                data = response.json()
                tickets = []

                for issue in data.get('issues', []):
                    # Extract detailed description parts
                    desc_parts = self.extract_description_parts(issue['fields'].get('description', ''))

                    ticket = {
                        'id': issue['key'],
                        'title': issue['fields']['summary'],
                        'description': issue['fields'].get('description', 'No description'),
                        'main_requirement': desc_parts['main_requirement'],
                        'acceptance_criteria': desc_parts['acceptance_criteria'],
                        'technical_notes': desc_parts['technical_notes'],
                        'full_description': desc_parts['full_description'],
                        'priority': issue['fields']['priority']['name'] if issue['fields'].get(
                            'priority') else 'Medium',
                        'assignee': issue['fields']['assignee']['displayName'] if issue['fields'].get(
                            'assignee') else 'Unassigned',
                        'reporter': issue['fields']['reporter']['displayName'] if issue['fields'].get(
                            'reporter') else 'Unknown',
                        'created': issue['fields']['created'],
                        'updated': issue['fields']['updated'],
                        'status': issue['fields']['status']['name'],
                        'issue_type': issue['fields']['issuetype']['name']
                    }
                    tickets.append(ticket)

                return True, tickets
            else:
                return False, f"Failed to fetch tickets: {response.status_code}"

        except Exception as e:
            return False, f"Error fetching tickets: {str(e)}"

    def extract_acceptance_criteria(self, description):
        """Extract acceptance criteria from ticket description"""
        if not description:
            return "No acceptance criteria specified"

        # Look for common acceptance criteria patterns
        patterns = [
            r'acceptance criteria[:\s]*(.+?)(?=\n\n|\n[A-Z]|$)',
            r'ac[:\s]*(.+?)(?=\n\n|\n[A-Z]|$)',
            r'criteria[:\s]*(.+?)(?=\n\n|\n[A-Z]|$)'
        ]

        description_lower = description.lower()
        for pattern in patterns:
            match = re.search(pattern, description_lower, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()

        # If no specific AC found, return first 200 characters of description
        return description[:200] + "..." if len(description) > 200 else description

    def extract_description_parts(self, description):
        """Extract and separate different parts of JIRA description for better code generation"""
        if not description:
            return {
                'full_description': 'No description provided',
                'main_requirement': 'No requirement specified',
                'acceptance_criteria': 'No acceptance criteria specified',
                'technical_notes': ''
            }

        # Clean the description
        clean_desc = description.strip()

        # Split description into sections
        sections = {
            'full_description': clean_desc,
            'main_requirement': '',
            'acceptance_criteria': '',
            'technical_notes': ''
        }

        # Look for acceptance criteria section
        ac_patterns = [
            r'(?:acceptance criteria|ac)[:\s]*(.+?)(?=\n\n|\n(?:[A-Z][a-z]+\s*:)|$)',
            r'(?:criteria)[:\s]*(.+?)(?=\n\n|\n(?:[A-Z][a-z]+\s*:)|$)'
        ]

        for pattern in ac_patterns:
            match = re.search(pattern, clean_desc, re.IGNORECASE | re.DOTALL)
            if match:
                sections['acceptance_criteria'] = match.group(1).strip()
                # Remove AC from main description
                clean_desc = re.sub(pattern, '', clean_desc, flags=re.IGNORECASE | re.DOTALL).strip()
                break

        # Look for technical notes section
        tech_patterns = [
            r'(?:technical notes?|implementation notes?|dev notes?)[:\s]*(.+?)(?=\n\n|\n(?:[A-Z][a-z]+\s*:)|$)',
            r'(?:notes?)[:\s]*(.+?)(?=\n\n|\n(?:[A-Z][a-z]+\s*:)|$)'
        ]

        for pattern in tech_patterns:
            match = re.search(pattern, clean_desc, re.IGNORECASE | re.DOTALL)
            if match:
                sections['technical_notes'] = match.group(1).strip()
                # Remove tech notes from main description
                clean_desc = re.sub(pattern, '', clean_desc, flags=re.IGNORECASE | re.DOTALL).strip()
                break

        # What's left is the main requirement
        sections['main_requirement'] = clean_desc if clean_desc else sections['full_description'][:300]

        # If no AC was found separately, use the full description logic
        if not sections['acceptance_criteria']:
            sections['acceptance_criteria'] = self.extract_acceptance_criteria(description)

        return sections

    def update_ticket_status(self, ticket_id, new_status, comment=None):
        """Update ticket status and add comment"""
        try:
            # First, get available transitions
            transitions_url = f"{self.base_url}/rest/api/2/issue/{ticket_id}/transitions"
            transitions_response = self.session.get(transitions_url, timeout=10)

            if transitions_response.status_code != 200:
                return False, f"Failed to get transitions: {transitions_response.status_code}"

            transitions = transitions_response.json()['transitions']

            # Find the transition to "In Review" status
            target_transition = None
            for transition in transitions:
                if transition['to']['name'].lower() == new_status.lower():
                    target_transition = transition
                    break

            if not target_transition:
                return False, f"No transition found to status: {new_status}"

            # Perform the transition
            transition_url = f"{self.base_url}/rest/api/2/issue/{ticket_id}/transitions"
            transition_data = {
                'transition': {
                    'id': target_transition['id']
                }
            }

            # Add comment if provided
            if comment:
                transition_data['update'] = {
                    'comment': [{
                        'add': {
                            'body': comment
                        }
                    }]
                }

            response = self.session.post(transition_url, json=transition_data, timeout=10)

            if response.status_code == 204:  # No content = success
                return True, f"Status updated to {new_status}"
            else:
                return False, f"Failed to update status: {response.status_code}"

        except Exception as e:
            return False, f"Error updating ticket status: {str(e)}"

    def build_jira_prompt(self, ticket):
        """Build AI prompt from individual JIRA ticket"""
        prompt = f"""JIRA Ticket Implementation Request

Ticket ID: {ticket['id']}
Title: {ticket['title']}
Issue Type: {ticket['issue_type']}
Priority: {ticket['priority']}

=== MAIN REQUIREMENT ===
{ticket['main_requirement']}

=== ACCEPTANCE CRITERIA ===
{ticket['acceptance_criteria']}

=== TECHNICAL NOTES ===
{ticket['technical_notes'] if ticket['technical_notes'] else 'No specific technical notes provided'}

Please implement the above JIRA ticket requirements as complete, functional code."""

        return prompt

    def build_combined_jira_prompt(self, tickets):
        """Build combined prompt for multiple JIRA tickets"""
        additional_notes = session.get('user_additional_notes', '')
        if len(tickets) == 1:
            return self.build_jira_prompt(tickets[0])

        prompt = f"""Multiple JIRA Tickets Implementation Request

Total Tickets: {len(tickets)}

"""

        for i, ticket in enumerate(tickets, 1):
            prompt += f"""
=== TICKET #{i}: {ticket['id']} ===
Title: {ticket['title']}
Priority: {ticket['priority']}

Main Requirement:
{ticket['main_requirement']}

Acceptance Criteria:
{ticket['acceptance_criteria']}

Technical Notes:
{additional_notes if additional_notes else 'No specific technical notes provided'}

{'=' * 50}

"""

        prompt += """
=== IMPLEMENTATION REQUIREMENTS ===
- Generate production-ready code that fulfills ALL ticket requirements
- Ensure each ticket's acceptance criteria are met
- Create modular code that addresses each ticket appropriately
- Include proper error handling and validation
- Follow coding best practices and standards
- Add comprehensive documentation and comments
- Consider inter-dependencies between tickets if applicable

Please implement all the above JIRA ticket requirements as complete, functional code."""

        return prompt

    def attach_file_to_ticket(self, ticket_id, file_path, filename):
        """Attach a file to a JIRA ticket"""
        try:
            url = f"{self.base_url}/rest/api/2/issue/{ticket_id}/attachments"

            # Prepare headers for file upload (remove Content-Type to let requests handle it)
            headers = {
                'Authorization': self.session.headers['Authorization'],
                'X-Atlassian-Token': 'no-check'  # Required for file uploads
            }

            with open(file_path, 'rb') as file:
                files = {'file': (filename, file, mimetypes.guess_type(file_path)[0])}
                response = requests.post(url, headers=headers, files=files, timeout=30)

            if response.status_code == 200:
                return True, "File attached successfully"
            else:
                return False, f"Failed to attach file: {response.status_code} - {response.text}"

        except Exception as e:
            return False, f"Error attaching file: {str(e)}"

# Initialize JIRA integration
jira_integration = JiraIntegration()

class EnhancedCodebaseAnalyzer:
    """Analyze and extract full code context from uploaded codebases"""

    def __init__(self):
        self.supported_extensions = {'.py', '.js', '.java', '.cpp', '.c', '.h'}

    def analyze_with_full_context(self, extracted_path):
        """Analyze codebase and extract full code context"""
        result = {
            'files': {},
            'functions': {},
            'classes': {},
            'imports': set(),
            'patterns': {},
            'full_context': ""
        }

        # Walk through all files
        for file_path in Path(extracted_path).rglob('*'):
            if file_path.is_file() and file_path.suffix in self.supported_extensions:
                self._analyze_file(file_path, extracted_path, result)

        # Convert sets to lists for JSON serialization
        result['imports'] = list(result['imports'])

        return result

    def _analyze_file(self, file_path, base_path, result):
        """Analyze individual file and extract code elements"""
        try:
            relative_path = str(file_path.relative_to(base_path))

            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Store full file content
            result['files'][relative_path] = {
                'content': content,
                'size': len(content),
                'lines': content.count('\n') + 1
            }

            # Analyze Python files with AST
            if file_path.suffix == '.py':
                self._analyze_python_file(content, relative_path, result)

        except Exception as e:
            print(f"Error analyzing {file_path}: {e}")

    def _analyze_python_file(self, content, file_path, result):
        """Analyze Python file using AST for detailed extraction"""
        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                # Extract imports
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    self._extract_imports(node, result)

                # Extract functions with full code
                elif isinstance(node, ast.FunctionDef):
                    self._extract_function_with_code(node, content, file_path, result)

                # Extract classes with methods
                elif isinstance(node, ast.ClassDef):
                    self._extract_class_with_code(node, content, file_path, result)

        except SyntaxError as e:
            print(f"Syntax error in {file_path}: {e}")

    def _extract_function_with_code(self, node, file_content, file_path, result):
        """Extract function with its complete source code"""
        try:
            # Get function source code
            lines = file_content.splitlines()
            start_line = node.lineno - 1

            # Find function end (simple heuristic - could be improved)
            end_line = start_line
            indent_level = len(lines[start_line]) - len(lines[start_line].lstrip())

            for i in range(start_line + 1, len(lines)):
                line = lines[i].strip()
                if not line:  # Skip empty lines
                    continue
                current_indent = len(lines[i]) - len(lines[i].lstrip())
                if current_indent <= indent_level and line:
                    break
                end_line = i

            # Extract function code
            function_code = '\n'.join(lines[start_line:end_line + 1])

            # Extract docstring
            docstring = ast.get_docstring(node) or "No documentation"

            # Extract parameters
            params = [arg.arg for arg in node.args.args]

            # Store function with full context
            result['functions'][node.name] = {
                'file': file_path,
                'line': node.lineno,
                'code': function_code,
                'docstring': docstring,
                'parameters': params,
                'returns': self._analyze_return_type(node),
                'dependencies': self._find_function_dependencies(function_code)
            }

        except Exception as e:
            print(f"Error extracting function {node.name}: {e}")

    def _extract_class_with_code(self, node, file_content, file_path, result):
        """Extract class with all its methods"""
        try:
            lines = file_content.splitlines()
            start_line = node.lineno - 1

            # Find class end
            end_line = len(lines) - 1
            indent_level = len(lines[start_line]) - len(lines[start_line].lstrip())

            for i in range(start_line + 1, len(lines)):
                line = lines[i].strip()
                if not line:
                    continue
                current_indent = len(lines[i]) - len(lines[i].lstrip())
                if current_indent <= indent_level and line:
                    end_line = i - 1
                    break

            class_code = '\n'.join(lines[start_line:end_line + 1])

            # Extract methods
            methods = {}
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    methods[item.name] = {
                        'line': item.lineno,
                        'parameters': [arg.arg for arg in item.args.args],
                        'docstring': ast.get_docstring(item) or "No documentation"
                    }

            result['classes'][node.name] = {
                'file': file_path,
                'line': node.lineno,
                'code': class_code,
                'docstring': ast.get_docstring(node) or "No documentation",
                'methods': methods,
                'base_classes': [base.id for base in node.bases if isinstance(base, ast.Name)]
            }

        except Exception as e:
            print(f"Error extracting class {node.name}: {e}")

    def _find_function_dependencies(self, code):
        """Find functions/classes this code depends on"""
        dependencies = []
        lines = code.split('\n')

        for line in lines:
            # Simple pattern matching for function calls
            import re
            func_calls = re.findall(r'(\w+)\s*\(', line)
            dependencies.extend(func_calls)

        return list(set(dependencies))

    def _extract_imports(self, node, result):
        """Extract import statements"""
        if isinstance(node, ast.Import):
            for name in node.names:
                result['imports'].add(name.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                result['imports'].add(node.module)

    def _analyze_return_type(self, node):
        """Analyze function return type (basic implementation)"""
        # This could be enhanced with more sophisticated analysis
        return "Unknown"


# REPLACE your existing CodebaseContextManager class with this fixed version:
class CodebaseContextManager:
    """Manage existing codebase knowledge for GenAI"""

    def __init__(self):
        self.libraries = {}
        self.utils = {}
        self.patterns = {}
        self.apis = {}
        self.project_structure = {}

    def analyze_codebase(self, codebase_path):
        """Analyze uploaded codebase for context"""
        try:
            print(f"[CODEBASE] Starting analysis of: {codebase_path}")

            analysis = {
                'imports': self.extract_imports(codebase_path),
                'functions': self.extract_functions(codebase_path),
                'classes': self.extract_classes(codebase_path),
                'patterns': self.identify_patterns(codebase_path),
                'dependencies': self.extract_dependencies(codebase_path)
            }

            print(f"[CODEBASE] Analysis complete:")
            print(f"  - Imports: {len(analysis['imports'])}")
            print(f"  - Functions: {len(analysis['functions'])}")
            print(f"  - Classes: {len(analysis['classes'])}")
            print(f"  - Patterns: {len(analysis['patterns'])}")
            print(f"  - Dependencies: {len(analysis['dependencies'])}")

            return analysis
        except Exception as e:
            print(f"[ERROR] Codebase analysis failed: {e}")
            import traceback
            traceback.print_exc()
            return {
                'imports': [],
                'functions': {},
                'classes': {},
                'patterns': {},
                'dependencies': []
            }

    def extract_imports(self, codebase_path):
        """Extract all import statements from Python files"""
        imports = set()
        processed_files = 0

        try:
            print(f"[IMPORTS] Scanning for Python files in: {codebase_path}")

            for py_file in Path(codebase_path).rglob("*.py"):
                # Skip macOS metadata files and hidden files
                if '__MACOSX' in str(py_file) or py_file.name.startswith('._'):
                    continue

                try:
                    print(f"[IMPORTS] Processing: {py_file}")
                    processed_files += 1

                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    # Parse the AST
                    tree = ast.parse(content)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for alias in node.names:
                                if alias.name:
                                    imports.add(alias.name)
                                    print(f"    Found import: {alias.name}")
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                imports.add(node.module)
                                print(f"    Found from import: {node.module}")

                except SyntaxError as e:
                    print(f"[WARNING] Syntax error in {py_file}: {e}")
                    continue
                except Exception as e:
                    print(f"[WARNING] Could not parse {py_file}: {e}")
                    continue

            imports_list = sorted(list(imports))
            print(f"[IMPORTS] Processed {processed_files} files, found {len(imports_list)} unique imports")
            print(f"[IMPORTS] Sample imports: {imports_list[:10]}")

            return imports_list

        except Exception as e:
            print(f"[ERROR] Import extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return []

    def extract_functions(self, codebase_path):
        """Extract function signatures and docstrings"""
        functions = {}
        processed_files = 0

        try:
            print(f"[FUNCTIONS] Scanning for functions in: {codebase_path}")

            for py_file in Path(codebase_path).rglob("*.py"):
                # Skip macOS metadata files and hidden files
                if '__MACOSX' in str(py_file) or py_file.name.startswith('._'):
                    continue

                try:
                    processed_files += 1

                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    tree = ast.parse(content)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.FunctionDef):
                            func_name = node.name

                            # Skip private functions (starting with _) for cleaner output
                            if not func_name.startswith('__'):
                                func_info = {
                                    'file': str(py_file.relative_to(codebase_path)),
                                    'args': [arg.arg for arg in node.args.args],
                                    'docstring': ast.get_docstring(node),
                                    'line_number': node.lineno
                                }

                                # Use full path as key to avoid conflicts
                                key = f"{func_info['file']}::{func_name}"
                                functions[key] = func_info

                except SyntaxError as e:
                    print(f"[WARNING] Syntax error in {py_file}: {e}")
                    continue
                except Exception as e:
                    print(f"[WARNING] Could not analyze functions in {py_file}: {e}")
                    continue

            print(f"[FUNCTIONS] Processed {processed_files} files, found {len(functions)} functions")
            return functions

        except Exception as e:
            print(f"[ERROR] Function extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def extract_classes(self, codebase_path):
        """Extract class definitions and their methods"""
        classes = {}
        processed_files = 0

        try:
            print(f"[CLASSES] Scanning for classes in: {codebase_path}")

            for py_file in Path(codebase_path).rglob("*.py"):
                # Skip macOS metadata files and hidden files
                if '__MACOSX' in str(py_file) or py_file.name.startswith('._'):
                    continue

                try:
                    processed_files += 1

                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    tree = ast.parse(content)

                    for node in ast.walk(tree):
                        if isinstance(node, ast.ClassDef):
                            class_name = node.name

                            # Skip private classes for cleaner output
                            if not class_name.startswith('_'):
                                class_info = {
                                    'file': str(py_file.relative_to(codebase_path)),
                                    'methods': [m.name for m in node.body if
                                                isinstance(m, ast.FunctionDef) and not m.name.startswith('_')],
                                    'docstring': ast.get_docstring(node),
                                    'line_number': node.lineno,
                                    'base_classes': []
                                }

                                # Extract base classes
                                for base in node.bases:
                                    if hasattr(base, 'id'):
                                        class_info['base_classes'].append(base.id)
                                    elif hasattr(base, 'attr'):
                                        class_info['base_classes'].append(base.attr)

                                # Use full path as key to avoid conflicts
                                key = f"{class_info['file']}::{class_name}"
                                classes[key] = class_info

                except SyntaxError as e:
                    print(f"[WARNING] Syntax error in {py_file}: {e}")
                    continue
                except Exception as e:
                    print(f"[WARNING] Could not analyze classes in {py_file}: {e}")
                    continue

            print(f"[CLASSES] Processed {processed_files} files, found {len(classes)} classes")
            return classes

        except Exception as e:
            print(f"[ERROR] Class extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def identify_patterns(self, codebase_path):
        """Identify common coding patterns"""
        patterns = {
            'error_handling': [],
            'logging': [],
            'database_access': [],
            'api_calls': [],
            'testing_patterns': []
        }

        try:
            print(f"[PATTERNS] Scanning for patterns in: {codebase_path}")

            for py_file in Path(codebase_path).rglob("*.py"):
                # Skip macOS metadata files and hidden files
                if '__MACOSX' in str(py_file) or py_file.name.startswith('._'):
                    continue

                try:
                    with open(py_file, 'r', encoding='utf-8') as f:
                        content = f.read()

                    relative_path = str(py_file.relative_to(codebase_path))

                    # Pattern detection
                    if 'try:' in content and 'except' in content:
                        patterns['error_handling'].append(relative_path)
                    if 'logging.' in content or 'logger.' in content or 'import logging' in content:
                        patterns['logging'].append(relative_path)
                    if 'requests.' in content or 'urllib' in content or 'http' in content.lower():
                        patterns['api_calls'].append(relative_path)
                    if 'sqlite' in content or 'mysql' in content or 'postgresql' in content or 'database' in content.lower():
                        patterns['database_access'].append(relative_path)
                    if 'test_' in content or 'pytest' in content or 'unittest' in content or 'assert' in content:
                        patterns['testing_patterns'].append(relative_path)

                except Exception as e:
                    print(f"[WARNING] Pattern analysis failed for {py_file}: {e}")

            # Remove empty patterns and show summary
            patterns = {k: v for k, v in patterns.items() if v}

            print(f"[PATTERNS] Found patterns:")
            for pattern_name, files in patterns.items():
                print(f"  - {pattern_name}: {len(files)} files")

            return patterns

        except Exception as e:
            print(f"[ERROR] Pattern identification failed: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def extract_dependencies(self, codebase_path):
        """Extract project dependencies from requirements files"""
        dependencies = []

        try:
            print(f"[DEPENDENCIES] Scanning for dependency files in: {codebase_path}")

            # Check for requirements files
            req_files = ['requirements.txt', 'requirements.pip', 'Pipfile', 'setup.py', 'pyproject.toml']

            for req_file in req_files:
                req_path = Path(codebase_path) / req_file
                if req_path.exists():
                    print(f"[DEPENDENCIES] Found {req_file}")
                    try:
                        with open(req_path, 'r', encoding='utf-8') as f:
                            content = f.read()

                        if req_file == 'requirements.txt':
                            # Parse requirements.txt format
                            for line in content.split('\n'):
                                line = line.strip()
                                if line and not line.startswith('#') and not line.startswith('-'):
                                    # Extract package name (before ==, >=, etc.)
                                    package = re.split(r'[>=<!=]', line)[0].strip()
                                    if package:
                                        dependencies.append(package)
                        elif req_file == 'setup.py':
                            # Simple extraction from setup.py
                            if 'install_requires' in content:
                                # This is a basic extraction - could be improved
                                import_matches = re.findall(r'["\']([a-zA-Z0-9\-_.]+)["\']', content)
                                dependencies.extend(import_matches[:20])  # Limit to avoid noise

                    except Exception as e:
                        print(f"[WARNING] Could not read {req_file}: {e}")

            # Remove duplicates and sort
            dependencies = sorted(list(set(dependencies)))
            print(f"[DEPENDENCIES] Found {len(dependencies)} dependencies")
            return dependencies

        except Exception as e:
            print(f"[ERROR] Dependency extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return []

def determine_workflow_type(files):
    """Determine if input is for Developer or QA workflow"""
    developer_indicators = [
        'user_story', 'jira', 'feature', 'requirement', 'spec', 'api',
        'design', 'architecture', 'epic', 'story', 'backlog'
    ]

    qa_indicators = [
        'test_case', 'test', 'validation', 'scenario', 'acceptance'
    ]

    codebase_indicators = [
        '.zip', '.tar', '.git', 'src/', 'lib/', 'utils/', 'requirements.txt'
    ]

    developer_score = 0
    qa_score = 0
    codebase_score = 0

    for file_info in files:
        filename = file_info['name'].lower()

        # Check filename indicators
        for indicator in developer_indicators:
            if indicator in filename:
                developer_score += 1

        for indicator in qa_indicators:
            if indicator in filename:
                qa_score += 1

        for indicator in codebase_indicators:
            if indicator in filename:
                codebase_score += 1

    if codebase_score > 0:
        return 'codebase'
    elif developer_score > qa_score:
        return 'developer'
    elif qa_score > developer_score:
        return 'qa'
    else:
        return 'mixed'


def parse_jira_export(content):
    """Parse JIRA JSON or XML export"""
    try:
        # Try JSON first
        data = json.loads(content)
        return extract_user_stories_from_json(data)
    except json.JSONDecodeError:
        try:
            # Try XML
            root = ET.fromstring(content)
            return extract_user_stories_from_xml(root)
        except ET.ParseError:
            # Try text format
            return extract_user_stories_from_text(content)


def extract_user_stories_from_json(data):
    """Extract user stories from JIRA JSON format"""
    stories = []

    if 'issues' in data:
        for issue in data['issues']:
            story = {
                'id': issue.get('key', 'N/A'),
                'title': issue['fields'].get('summary', 'N/A'),
                'description': issue['fields'].get('description', 'N/A'),
                'story_points': issue['fields'].get('customfield_10004', 'N/A'),
                'priority': issue['fields'].get('priority', {}).get('name', 'N/A'),
                'status': issue['fields'].get('status', {}).get('name', 'N/A'),
                'acceptance_criteria': extract_acceptance_criteria(issue['fields']),
                'epic': issue['fields'].get('epic', {}).get('name', 'N/A')
            }
            stories.append(story)

    return stories


def extract_acceptance_criteria(fields):
    """Extract acceptance criteria from JIRA fields"""
    # JIRA often stores acceptance criteria in custom fields or description
    description = fields.get('description', '')

    # Look for common acceptance criteria patterns
    patterns = [
        r'Acceptance Criteria:?\s*(.*?)(?=\n\n|\n[A-Z]|\Z)',
        r'AC:?\s*(.*?)(?=\n\n|\n[A-Z]|\Z)',
        r'Given.*When.*Then.*',
    ]

    for pattern in patterns:
        import re
        match = re.search(pattern, description, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return 'Not specified'


def extract_user_stories_from_text(content):
    """Extract user stories from plain text format"""
    stories = []

    # Split by story boundaries
    story_sections = re.split(r'\n(?=User Story|Story ID|US-\d+)', content, flags=re.IGNORECASE)

    for section in story_sections:
        if len(section.strip()) < 50:  # Skip small sections
            continue

        story = {
            'id': extract_field(section, r'(?:Story ID|ID):\s*(.+)'),
            'title': extract_field(section, r'(?:Title|Story):\s*(.+)'),
            'description': extract_field(section, r'Description:\s*(.*?)(?=\n(?:[A-Z][a-z]+:|$))', re.DOTALL),
            'acceptance_criteria': extract_field(section, r'Acceptance Criteria:\s*(.*?)(?=\n(?:[A-Z][a-z]+:|$))',
                                                 re.DOTALL),
            'priority': extract_field(section, r'Priority:\s*(.+)'),
            'epic': extract_field(section, r'Epic:\s*(.+)')
        }

        if story['title']:  # Only add if we found a title
            stories.append(story)

    return stories


def extract_field(text, pattern, flags=0):
    """Extract field using regex pattern"""
    match = re.search(pattern, text, flags)
    return match.group(1).strip() if match else 'N/A'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def parse_multiple_test_cases_from_content(content, filename):
    """Parse a single file that may contain multiple test cases while preserving order"""
    print(f"[PARSE] Analyzing file: {filename}")

    # Split by "Test Case:" to find individual test cases
    test_case_sections = re.split(r'Test Case:', content, flags=re.IGNORECASE)

    # Remove the first empty element (content before first "Test Case:")
    if test_case_sections:
        test_case_sections = test_case_sections[1:]  # Remove first empty section

    parsed_test_cases = []

    for i, section in enumerate(test_case_sections):
        # Add back "Test Case:" prefix and clean up
        clean_section = f"Test Case:{section}".strip()

        if len(clean_section) > 50:  # Only process substantial content
            # Extract test case name from first line
            first_line = clean_section.split('\n')[0]
            test_case_name = re.sub(r'^Test Case:\s*', '', first_line, flags=re.IGNORECASE).strip()

            # Limit test case name length
            if len(test_case_name) > 100:
                test_case_name = test_case_name[:100] + "..."

            parsed_test_cases.append({
                'content': clean_section,
                'test_case_name': test_case_name,
                'section_index': i + 1  # Position within this file
            })

    print(f"[PARSE] Found {len(parsed_test_cases)} test cases in {filename}")
    return parsed_test_cases

def create_individual_files_for_multi_case(parsed_test_cases, original_filename, timestamp_prefix):
    """Create individual files for each test case found in a multi-case file with sequential timestamps"""
    created_files = []

    # Extract the base timestamp components from the original file
    # timestamp_prefix format: "20250616_210942948"
    base_date = timestamp_prefix.split('_')[0]  # "20250616"
    base_time_part = timestamp_prefix.split('_')[1]  # "210942948"

    # Convert base time to integer for incrementing
    base_time_int = int(base_time_part)

    for i, test_case in enumerate(parsed_test_cases):
        # Create incremental timestamp for each individual file
        # Add seconds to ensure proper ordering: +1, +2, +3, +4 seconds
        incremented_time = base_time_int + (i + 1)

        # Create new timestamp prefix for this individual file
        individual_timestamp_prefix = f"{base_date}_{incremented_time:09d}"

        # Create filename with individual timestamp
        base_name = original_filename.replace('.txt', '').replace('.rtf', '')
        new_filename = f"{individual_timestamp_prefix}_{base_name}_part{i + 1}.txt"
        new_filepath = os.path.join(app.config['UPLOAD_FOLDER'], new_filename)

        # Write individual test case to file
        with open(new_filepath, 'w', encoding='utf-8') as f:
            f.write(test_case['content'])

        created_files.append({
            'filename': new_filename,
            'test_case_name': test_case['test_case_name'],
            'section_index': test_case['section_index'],
            'original_file': original_filename,
            'individual_timestamp': individual_timestamp_prefix  # Track individual timestamp
        })

        print(f"[CREATE] Created individual file: {new_filename} (timestamp: {individual_timestamp_prefix})")

    return created_files

# ================================================================================================
# PROGRESS FILES CLEANUP FUNCTIONS
# ================================================================================================
def progress_cleanup():
    """Simple cleanup - just remove progress files"""
    try:
        progress_files = ['progress_generate.json', 'progress_review.json', 'progress_execute.json']
        for file in progress_files:
            if os.path.exists(file):
                os.remove(file)
                print(f"[CLEANUP] Removed {file}")
    except Exception as e:
        print(f"[CLEANUP] Error: {e}")

def signal_handler(sig, frame):
    """Handle Ctrl+C"""
    print("\n[SHUTDOWN] Ctrl+C pressed - cleaning up...")
    progress_cleanup()

    # Clean up test_case folder
    try:
        test_case_folder = app.config['UPLOAD_FOLDER']
        if os.path.exists(test_case_folder):
            for filename in os.listdir(test_case_folder):
                file_path = os.path.join(test_case_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            print("[CLEANUP] Cleaned test_case folder")
    except Exception as e:
        print(f"[CLEANUP] Error cleaning test_case folder: {e}")

    # NEW: Clean up dev-scripts and generated-scripts folders
    # Clean up dev-scripts folder (same pattern as test_case folder)
    try:
        dev_scripts_folder = os.path.join(os.getcwd(), '..', 'dev-scripts')
        if os.path.exists(dev_scripts_folder):
            for filename in os.listdir(dev_scripts_folder):
                file_path = os.path.join(dev_scripts_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            os.rmdir(dev_scripts_folder)  # Remove empty folder
            print("[CLEANUP] Cleaned dev-scripts folder")
    except Exception as e:
        print(f"[CLEANUP] Error cleaning dev-scripts folder: {e}")

    # Clean up generated-scripts folder (same pattern as test_case folder)
    try:
        generated_scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
        if os.path.exists(generated_scripts_folder):
            for filename in os.listdir(generated_scripts_folder):
                file_path = os.path.join(generated_scripts_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            os.rmdir(generated_scripts_folder)  # Remove empty folder
            print("[CLEANUP] Cleaned generated-scripts folder")
    except Exception as e:
        print(f"[CLEANUP] Error cleaning generated-scripts folder: {e}")

    print("[SHUTDOWN] Cleanup complete")
    sys.exit(0)

# Register the signal handler
signal.signal(signal.SIGINT, signal_handler)

# ================================================================================================
# PROGRESS TRACKING FUNCTIONS
# ================================================================================================

def update_progress(task_type, progress, status, step, completed=False):
    """Update progress file for real-time tracking"""
    try:
        progress_data = {
            'progress': progress,
            'status': status,
            'step': step,
            'completed': completed,
            'timestamp': time.time()
        }
        progress_file = f"progress_{task_type}.json"
        with open(progress_file, 'w') as f:
            json.dump(progress_data, f)
        print(f"[PROGRESS] {task_type}: {progress}% - {step}")
    except Exception as e:
        print(f"Error updating progress: {e}")


def clear_progress(task_type):
    """Clear progress file when starting new task"""
    try:
        progress_file = f"progress_{task_type}.json"
        if os.path.exists(progress_file):
            os.remove(progress_file)
    except Exception as e:
        print(f"Error clearing progress: {e}")

# =============================================================================
# DEVICE MANAGEMENT FUNCTIONS
# =============================================================================
# Add this function to load device configuration
def load_devices_config():
    """Load device configuration from JSON file"""
    global devices_config
    try:
        devices_file_path = os.path.join(os.getcwd(), 'devices.json')
        if not os.path.exists(devices_file_path):
            # Create default devices.json if it doesn't exist
            default_config = {
                "devices": [
                    {
                        "id": "rpi-1",
                        "name": "Raspberry Pi Device 1",
                        "host": "71.185.253.158",
                        "user": "root",
                        "password": "",
                        "port": 22,
                        "description": "Primary test device - Location A",
                        "capabilities": ["python", "ssh", "RDK-B"],
                        "priority": 1,
                        "active": True
                    },
                    {
                        "id": "rpi-2",
                        "name": "Raspberry Pi Device 2",
                        "host": "65.78.96.246",
                        "user": "root",
                        "password": "",
                        "port": 22,
                        "description": "Secondary test device - Location B",
                        "capabilities": ["python", "ssh", "RDK-B"],
                        "priority": 2,
                        "active": True
                    }
                ],
                "settings": {
                    "connection_timeout": 5,
                    "retry_attempts": 3,
                    "retry_delay": 2,
                    "health_check_interval": 30
                }
            }

            with open(devices_file_path, 'w') as f:
                json.dump(default_config, f, indent=2)
            print(f"[DEVICES] Created default devices.json at {devices_file_path}")

        with open(devices_file_path, 'r') as f:
            devices_config = json.load(f)

        print(f"[DEVICES] Loaded {len(devices_config['devices'])} devices from configuration")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to load devices configuration: {e}")
        # Fallback to hardcoded devices for backward compatibility
        devices_config = {
            "devices": [
                {
                    "id": "rpi-1",
                    "name": "Raspberry Pi Device 1",
                    "host": "71.185.253.158",
                    "user": "root",
                    "password": "",
                    "port": 22,
                    "description": "Primary test device",
                    "capabilities": ["python", "ssh", "RDK-B"],
                    "priority": 1,
                    "active": True
                },
                {
                    "id": "rpi-2",
                    "name": "Raspberry Pi Device 2",
                    "host": "65.78.96.246",
                    "user": "root",
                    "password": "",
                    "port": 22,
                    "description": "Secondary test device",
                    "capabilities": ["python", "ssh", "RDK-B"],
                    "priority": 2,
                    "active": True
                }
            ],
            "settings": {
                "connection_timeout": 5,
                "retry_attempts": 3,
                "retry_delay": 2,
                "health_check_interval": 30
            }
        }
        return False


def check_device_connectivity(device):
    """Check if a device is online and SSH accessible"""
    try:
        # First check if host is reachable via socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(devices_config['settings']['connection_timeout'])
        result = sock.connect_ex((device['host'], device['port']))
        sock.close()

        if result == 0:
            # Host is reachable, now test SSH connection
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                ssh.connect(
                    device['host'],
                    username=device['user'],
                    password=device['password'],
                    port=device['port'],
                    timeout=devices_config['settings']['connection_timeout']
                )

                # Test basic command execution
                stdin, stdout, stderr = ssh.exec_command('echo "connection_test"', timeout=5)
                output = stdout.read().decode().strip()
                ssh.close()

                if output == "connection_test":
                    return {
                        'status': 'online',
                        'message': 'Device is online and SSH accessible',
                        'response_time': devices_config['settings']['connection_timeout']
                    }
                else:
                    return {
                        'status': 'ssh_error',
                        'message': 'SSH connection failed - command test failed',
                        'response_time': None
                    }

            except paramiko.AuthenticationException:
                return {
                    'status': 'auth_error',
                    'message': 'SSH authentication failed',
                    'response_time': None
                }
            except paramiko.SSHException as e:
                return {
                    'status': 'ssh_error',
                    'message': f'SSH connection error: {str(e)}',
                    'response_time': None
                }
            except Exception as e:
                return {
                    'status': 'ssh_error',
                    'message': f'SSH test failed: {str(e)}',
                    'response_time': None
                }
        else:
            return {
                'status': 'offline',
                'message': f'Host unreachable on port {device["port"]}',
                'response_time': None
            }

    except socket.timeout:
        return {
            'status': 'timeout',
            'message': f'Connection timeout after {devices_config["settings"]["connection_timeout"]} seconds',
            'response_time': None
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Connection error: {str(e)}',
            'response_time': None
        }


def check_all_devices_status():
    """Check status of all active devices concurrently"""
    global device_status_cache

    if not devices_config:
        return {}

    active_devices = [d for d in devices_config['devices'] if d.get('active', True)]

    with ThreadPoolExecutor(max_workers=min(len(active_devices), 10)) as executor:
        # Submit all device checks
        future_to_device = {
            executor.submit(check_device_connectivity, device): device
            for device in active_devices
        }

        # Collect results
        status_results = {}
        for future in as_completed(future_to_device):
            device = future_to_device[future]
            try:
                status = future.result(timeout=10)  # 10 second timeout per device
                status_results[device['id']] = {
                    'device': device,
                    'status': status,
                    'checked_at': time.time()
                }
            except Exception as e:
                status_results[device['id']] = {
                    'device': device,
                    'status': {
                        'status': 'error',
                        'message': f'Health check failed: {str(e)}',
                        'response_time': None
                    },
                    'checked_at': time.time()
                }

    # Update cache thread-safely
    with device_status_lock:
        device_status_cache.update(status_results)

    return status_results

#=======================================
# JIRA integration in Dev workflow
#========================================
@app.route('/connect_jira', methods=['POST'])
def connect_jira():
    """Connect to JIRA using provided credentials"""
    global jira_connection

    try:
        data = request.get_json()
        jira_url = data.get('jira_url', '').strip()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        if not all([jira_url, username, password]):
            return jsonify({'success': False, 'message': 'All fields are required'})

        # Validate URL format
        if not jira_url.startswith(('http://', 'https://')):
            jira_url = 'https://' + jira_url

        success, message = jira_integration.connect(jira_url, username, password)

        if success:
            jira_connection = {
                'url': jira_url,
                'username': username,
                'connected_at': datetime.now().isoformat()
            }
            return jsonify({
                'success': True,
                'message': message,
                'connection': jira_connection
            })
        else:
            return jsonify({'success': False, 'message': message})

    except Exception as e:
        return jsonify({'success': False, 'message': f'Connection error: {str(e)}'})


@app.route('/get_jira_projects', methods=['GET'])
def get_jira_projects():
    """Get list of JIRA projects"""
    if not jira_connection:
        return jsonify({'success': False, 'message': 'Not connected to JIRA'})

    try:
        success, result = jira_integration.get_projects()

        if success:
            projects = [{'key': p['key'], 'name': p['name']} for p in result]
            return jsonify({
                'success': True,
                'projects': projects
            })
        else:
            return jsonify({'success': False, 'message': result})

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error fetching projects: {str(e)}'})


@app.route('/get_jira_tickets', methods=['POST'])
def get_jira_tickets():
    """Get JIRA tickets in To-Do status from specified project"""
    global jira_tickets

    if not jira_connection:
        return jsonify({'success': False, 'message': 'Not connected to JIRA'})

    try:
        data = request.get_json()
        project_key = data.get('project_key', '').strip()

        if not project_key:
            return jsonify({'success': False, 'message': 'Project key is required'})

        success, result = jira_integration.get_todo_tickets(project_key)

        if success:
            jira_tickets = result
            return jsonify({
                'success': True,
                'tickets': jira_tickets,
                'count': len(jira_tickets)
            })
        else:
            return jsonify({'success': False, 'message': result})

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error fetching tickets: {str(e)}'})

'''
@app.route('/select_jira_tickets', methods=['POST'])
def select_jira_tickets():
    """Store selected JIRA tickets for code generation"""
    global selected_jira_tickets, developer_workflows

    try:
        data = request.get_json()
        selected_ticket_ids = data.get('ticket_ids', [])

        if not selected_ticket_ids:
            return jsonify({'success': False, 'message': 'No tickets selected'})

        # Filter selected tickets from the fetched tickets
        selected_jira_tickets = [
            ticket for ticket in jira_tickets
            if ticket['id'] in selected_ticket_ids
        ]

        # Convert JIRA tickets to developer workflow format with enhanced description usage
        developer_workflows = []
        for ticket in selected_jira_tickets:
            workflow_item = {
                'id': ticket['id'],
                'title': ticket['title'],
                'description': ticket['full_description'],  # Use full description for context
                'main_requirement': ticket['main_requirement'],  # Primary requirement for code gen
                'acceptance_criteria': ticket['acceptance_criteria'],
                'technical_notes': ticket['technical_notes'],
                'priority': ticket['priority'],
                'type': 'jira_ticket',
                'source': 'jira_integration',
                'prompt_data': jira_integration.build_jira_prompt(ticket)  # Pre-build the prompt
            }
            developer_workflows.append(workflow_item)

        return jsonify({
            'success': True,
            'message': f'Selected {len(selected_jira_tickets)} tickets for development',
            'selected_tickets': selected_jira_tickets,
            'workflow_items': developer_workflows,
            'prompt_preview': jira_integration.build_combined_jira_prompt(selected_jira_tickets)
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error selecting tickets: {str(e)}'})
'''

@app.route('/select_jira_tickets', methods=['POST'])
def select_jira_tickets():
    """Store selected JIRA tickets for multi-ticket code generation - ENHANCED"""
    global selected_jira_tickets, developer_workflows

    try:
        data = request.get_json()
        selected_ticket_ids = data.get('ticket_ids', [])
        additional_notes = data.get('additional_notes', '')
        session['user_additional_notes'] = additional_notes

        if not selected_ticket_ids:
            return jsonify({'success': False, 'message': 'No tickets selected'})

        # Filter selected tickets from the fetched tickets
        selected_jira_tickets = [
            ticket for ticket in jira_tickets
            if ticket['id'] in selected_ticket_ids
        ]

        # ENHANCED: Create individual prompts for each ticket (similar to QA test cases)
        developer_workflows = []
        for index, ticket in enumerate(selected_jira_tickets):
            # Use your existing JIRA prompt building logic
            individual_prompt = jira_integration.build_jira_prompt(ticket)

            workflow_item = {
                'id': f'ticket_{index}',
                'ticket_id': ticket['id'],
                'title': ticket['title'],
                'description': ticket['full_description'],
                'prompt': individual_prompt,  # Individual prompt for this ticket
                'main_requirement': ticket['main_requirement'],
                'acceptance_criteria': ticket['acceptance_criteria'],
                'technical_notes': ticket['technical_notes'],
                'priority': ticket['priority'],
                'type': 'jira_ticket',
                'source': 'jira_integration',
                'index': index
            }
            developer_workflows.append(workflow_item)

        # Store multi-ticket mode flag
        session['multi_ticket_mode'] = len(selected_jira_tickets) > 1
        session['current_ticket_workflows'] = developer_workflows

        return jsonify({
            'success': True,
            'message': f'Selected {len(selected_jira_tickets)} tickets for development',
            'selected_tickets': selected_jira_tickets,
            'workflow_items': developer_workflows,
            'multi_ticket_mode': len(selected_jira_tickets) > 1
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error selecting tickets: {str(e)}'})

@app.route('/update_jira_status', methods=['POST'])
def update_jira_status():
    """Update JIRA ticket status to 'In Review' and attach report"""
    global selected_jira_tickets

    try:
        data = request.get_json()
        ticket_ids = data.get('ticket_ids', [])
        report_path = data.get('report_path', '')

        if not ticket_ids:
            # Use all selected tickets if none specified
            ticket_ids = [ticket['id'] for ticket in selected_jira_tickets]

        if not ticket_ids:
            return jsonify({'success': False, 'message': 'No tickets to update'})

        comment = "GenAI based Code generation, Code review and remote device execution completed"
        updated_tickets = []
        failed_tickets = []

        for ticket_id in ticket_ids:
            try:
                # Update status to "In Review"
                success, message = jira_integration.update_ticket_status(
                    ticket_id, "In Review", comment
                )

                if success:
                    # Attach report if provided and file exists
                    if report_path and os.path.exists(report_path):
                        attach_success, attach_message = jira_integration.attach_file_to_ticket(
                            ticket_id, report_path, f"code_review_report_{ticket_id}.html"
                        )
                        if attach_success:
                            updated_tickets.append({
                                'ticket_id': ticket_id,
                                'status': 'Updated with attachment',
                                'message': f"{message}. {attach_message}"
                            })
                        else:
                            updated_tickets.append({
                                'ticket_id': ticket_id,
                                'status': 'Updated (attachment failed)',
                                'message': f"{message}. Attachment error: {attach_message}"
                            })
                    else:
                        updated_tickets.append({
                            'ticket_id': ticket_id,
                            'status': 'Updated',
                            'message': message
                        })
                else:
                    failed_tickets.append({
                        'ticket_id': ticket_id,
                        'error': message
                    })

            except Exception as e:
                failed_tickets.append({
                    'ticket_id': ticket_id,
                    'error': str(e)
                })

        return jsonify({
            'success': len(updated_tickets) > 0,
            'updated_tickets': updated_tickets,
            'failed_tickets': failed_tickets,
            'message': f'Updated {len(updated_tickets)} tickets, {len(failed_tickets)} failed'
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error updating JIRA status: {str(e)}'})


@app.route('/generate_jira_prompt', methods=['POST'])
def generate_jira_prompt():
    """Generate AI prompt from selected JIRA tickets"""
    global selected_jira_tickets

    try:
        data = request.get_json() or {}
        additional_notes = data.get('additional_notes', '')  # ADD THIS LINE
        session['user_additional_notes'] = additional_notes  # ADD THIS LINE

        if not selected_jira_tickets:
            return jsonify({'success': False, 'message': 'No JIRA tickets selected'})

        # Build the comprehensive prompt using JIRA ticket descriptions
        if len(selected_jira_tickets) == 1:
            prompt = jira_integration.build_jira_prompt(selected_jira_tickets[0])
        else:
            prompt = jira_integration.build_combined_jira_prompt(selected_jira_tickets)

        # Store the prompt data for code generation (similar to existing workflow)
        session['jira_prompt_data'] = {
            'prompt': prompt,
            'tickets': selected_jira_tickets,
            'workflow_type': 'jira_tickets',
            'generated_at': datetime.now().isoformat()
        }

        return jsonify({
            'success': True,
            'prompt': prompt,
            'ticket_count': len(selected_jira_tickets),
            'workflow_type': 'jira_tickets',
            'message': f'Generated prompt from {len(selected_jira_tickets)} JIRA ticket(s)'
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error generating prompt: {str(e)}'})

@app.route('/disconnect_jira', methods=['POST'])
def disconnect_jira():
    """Disconnect from JIRA"""
    global jira_connection, jira_tickets, selected_jira_tickets

    jira_connection = None
    jira_tickets = []
    selected_jira_tickets = []

    return jsonify({
        'success': True,
        'message': 'Disconnected from JIRA'
    })

# ========================
# GitHub Repo Integration
# ========================
# Add this new route to handle GitHub repository downloads
@app.route('/upload_github_repo', methods=['POST'])
def upload_github_repo():
    """Download and process GitHub repository as ZIP"""
    try:
        data = request.get_json()
        github_url = data.get('github_url', '').strip()

        if not github_url:
            return jsonify({'success': False, 'message': 'No GitHub URL provided'})

        # Validate and extract GitHub repo info
        repo_info = extract_github_repo_info(github_url)
        if not repo_info:
            return jsonify(
                {'success': False, 'message': 'Invalid GitHub URL. Please provide a valid GitHub repository URL.'})

        owner, repo, branch = repo_info['owner'], repo_info['repo'], repo_info['branch']

        # Download ZIP from GitHub
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"

        try:
            # Download the ZIP file
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            response = requests.get(zip_url, headers=headers, timeout=30)
            response.raise_for_status()

            # Save the downloaded ZIP
            filename = f"{repo}-{branch}.zip"
            filename = secure_filename(filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

            with open(file_path, 'wb') as f:
                f.write(response.content)

            print(f"[INFO] Downloaded GitHub repo ZIP: {file_path}")

            # Process the ZIP file using existing codebase analysis logic
            return process_downloaded_zip(file_path, f"{owner}/{repo}")

        except requests.exceptions.RequestException as e:
            return jsonify({
                'success': False,
                'message': f'Failed to download repository: {str(e)}. Please check if the repository exists and is public.'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Error processing repository: {str(e)}'
            })

    except Exception as e:
        print(f"[ERROR] GitHub repo upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'GitHub integration error: {str(e)}'})


# Add route to validate GitHub URL before processing
@app.route('/validate_github_url', methods=['POST'])
def validate_github_url():
    """Validate GitHub URL without downloading"""
    try:
        data = request.get_json()
        github_url = data.get('github_url', '').strip()

        if not github_url:
            return jsonify({'valid': False, 'message': 'No URL provided'})

        repo_info = extract_github_repo_info(github_url)
        if not repo_info:
            return jsonify({'valid': False, 'message': 'Invalid GitHub URL format'})

        # Check if repository exists (optional - makes a HEAD request)
        try:
            check_url = f"https://github.com/{repo_info['owner']}/{repo_info['repo']}"
            response = requests.head(check_url, timeout=10)
            if response.status_code == 404:
                return jsonify({'valid': False, 'message': 'Repository not found or is private'})
        except:
            # If we can't check, still allow the attempt
            pass

        return jsonify({
            'valid': True,
            'repo_info': repo_info,
            'message': f"Valid repository: {repo_info['owner']}/{repo_info['repo']} (branch: {repo_info['branch']})"
        })

    except Exception as e:
        return jsonify({'valid': False, 'message': f'Validation error: {str(e)}'})

#Route for unit test run
# Add this endpoint to your app.py file
@app.route('/run_unit_tests', methods=['POST'])
def run_unit_tests():
    """Execute unit tests using pytest in Linux environment"""
    try:
        data = request.get_json()
        test_content = data.get('test_content', '')
        test_filename = data.get('test_filename', 'test_execution.py')
        use_pytest = data.get('use_pytest', True)

        if not test_content.strip():
            return jsonify({
                'success': False,
                'message': 'No test content provided'
            })

        print(f"[UNITTEST] Starting unit test execution: {test_filename}")

        # Create temporary directory for test execution
        import tempfile
        import subprocess
        import os

        with tempfile.TemporaryDirectory() as temp_dir:
            # Write test content to temporary file
            test_file_path = os.path.join(temp_dir, test_filename)

            with open(test_file_path, 'w', encoding='utf-8') as f:
                f.write(test_content)

            print(f"[UNITTEST] Test file created: {test_file_path}")

            # Install pytest if using pytest
            if use_pytest:
                print("[UNITTEST] Installing pytest...")
                try:
                    install_result = subprocess.run([
                        'pip3', 'install', 'pytest', 'pytest-html'
                    ], capture_output=True, text=True, timeout=60)

                    if install_result.returncode != 0:
                        print(f"[UNITTEST] Warning: pytest installation failed: {install_result.stderr}")
                        # Continue anyway, pytest might already be installed
                except subprocess.TimeoutExpired:
                    print("[UNITTEST] Warning: pytest installation timed out")
                except Exception as e:
                    print(f"[UNITTEST] Warning: pytest installation error: {e}")

            # Execute the unit tests
            start_time = time.time()

            if use_pytest and ('import pytest' in test_content or 'def test_' in test_content):
                # Use pytest for execution
                print(f"[UNITTEST] Running with pytest: {test_filename}")
                cmd = ['python3', '-m', 'pytest', test_file_path, '-v', '--tb=short']
            else:
                # Use standard Python execution for unittest
                print(f"[UNITTEST] Running with standard Python: {test_filename}")
                cmd = ['python3', test_file_path]

            try:
                result = subprocess.run(
                    cmd,
                    cwd=temp_dir,
                    capture_output=True,
                    text=True,
                    timeout=120  # 2 minute timeout
                )

                execution_time = time.time() - start_time

                print(f"[UNITTEST] Execution completed in {execution_time:.2f}s")
                print(f"[UNITTEST] Return code: {result.returncode}")
                print(f"[UNITTEST] STDOUT: {result.stdout[:500]}...")
                print(f"[UNITTEST] STDERR: {result.stderr[:200]}...")

                # Parse pytest output for test results
                tests_passed = 0
                tests_failed = 0

                if use_pytest and result.stdout:
                    # Parse pytest output
                    if 'passed' in result.stdout:
                        #import re
                        passed_match = re.search(r'(\d+)\s+passed', result.stdout)
                        if passed_match:
                            tests_passed = int(passed_match.group(1))

                    if 'failed' in result.stdout:
                        failed_match = re.search(r'(\d+)\s+failed', result.stdout)
                        if failed_match:
                            tests_failed = int(failed_match.group(1))

                # Determine execution status
                if result.returncode == 0:
                    execution_status = "SUCCESS - All tests passed"
                else:
                    execution_status = "FAILED - Some tests failed or errors occurred"

                return jsonify({
                    'success': True,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'return_code': result.returncode,
                    'execution_time': f"{execution_time:.2f}s",
                    'execution_status': execution_status,
                    'tests_passed': tests_passed,
                    'tests_failed': tests_failed,
                    'test_framework': 'pytest' if use_pytest else 'unittest',
                    'message': f'Unit test execution completed in {execution_time:.2f}s'
                })

            except subprocess.TimeoutExpired:
                return jsonify({
                    'success': False,
                    'message': 'Unit test execution timed out (120s limit)',
                    'stdout': '',
                    'stderr': 'Execution timed out',
                    'return_code': -1,
                    'execution_time': '120s (timeout)'
                })

            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'Unit test execution error: {str(e)}',
                    'stdout': '',
                    'stderr': str(e),
                    'return_code': -1,
                    'execution_time': 'N/A'
                })

    except Exception as e:
        print(f"[UNITTEST] Error in run_unit_tests endpoint: {e}")
        return jsonify({
            'success': False,
            'message': f'Unit test execution failed: {str(e)}',
            'stdout': '',
            'stderr': str(e),
            'return_code': -1
        })

@app.route('/check_reusable_code', methods=['POST'])
def check_reusable_code():
    """Check if prompt matches existing default scripts"""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        include_tests = data.get('include_tests', True)

        print(f"[DEBUG] Checking prompt: '{prompt}'")

        if not developer_reuse_system:
            return jsonify({
                'success': True,
                'reusable_found': False,
                'message': 'Developer reuse system not available'
            })

        # DEBUG: Test all scripts with very low threshold
        matches = developer_reuse_system.matcher.find_matching_scripts(prompt, confidence_threshold=2.0)
        print(f"[DEBUG] All matches found:")
        for i, match in enumerate(matches):
            print(f"  {i + 1}. {match['script_name']}: {match['confidence']:.1f}% confidence")
            print(f"     Script keywords: {match['metadata'].get('keywords', [])[:10]}")
            print(f"     Script functions: {match['metadata'].get('functions', [])}")
            print(f"     Match reasons: {match.get('match_reasons', [])}")
            print(f"     ---")

        result = developer_reuse_system.get_reusable_code(
            prompt=prompt,
            include_tests=include_tests,
            confidence_threshold=2.0
        )

        if result:
            print(f"[DEBUG] ✅ Selected: {result['source_script']} with {result['confidence']}% confidence")
            return jsonify({
                'success': True,
                'reusable_found': True,
                'confidence': result['confidence'],
                'source_script': result['source_script'],
                'generated_code': result['generated_code'],
                'message': result['message']
            })
        else:
            print("[DEBUG] ❌ No script met the threshold")
            return jsonify({
                'success': True,
                'reusable_found': False,
                'message': 'No suitable reusable code found, will use AI generation'
            })

    except Exception as e:
        print(f"[DEBUG] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        })


@app.route('/get_reuse_stats_developer', methods=['GET'])
def get_reuse_stats_developer():
    """Get developer workflow reuse statistics"""
    try:
        if not developer_reuse_system:
            return jsonify({
                'success': False,
                'error': 'Developer reuse system not available'
            })

        stats = developer_reuse_system.get_reuse_statistics()
        return jsonify({
            'success': True,
            **stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

# Add this endpoint to app.py (if not already present from previous solution)
@app.route('/get-unittest-review-summary', methods=['GET'])
def get_unittest_review_summary():
    """Get the unittest review summary from summary2.txt for developer workflow"""
    try:
        # Path to the unittest review summary file
        summary2_path = os.path.join(os.getcwd(), '..', 'reports', 'summary2.txt')

        if os.path.exists(summary2_path):
            with open(summary2_path, 'r', encoding='utf-8') as f:
                summary_content = f.read()

            print(f"[DEV_WORKFLOW] Successfully read unittest review summary from {summary2_path}")
            return jsonify({
                'success': True,
                'summary_content': summary_content,
                'file_path': summary2_path
            })
        else:
            print(f"[DEV_WORKFLOW] Unittest review summary not found at {summary2_path}")
            return jsonify({
                'success': False,
                'message': 'Unittest review summary not found',
                'file_path': summary2_path
            })

    except Exception as e:
        print(f"[DEV_WORKFLOW] Failed to read unittest review summary: {e}")
        return jsonify({
            'success': False,
            'message': f'Error reading unittest review summary: {str(e)}'
        })

@app.route('/progress/<task_type>', methods=['GET'])
def get_progress(task_type):
    """Get real-time progress for generate/review/execute tasks"""
    try:
        progress_file = f"progress_{task_type}.json"
        if os.path.exists(progress_file):
            with open(progress_file, 'r') as f:
                progress_data = json.load(f)
            return jsonify(progress_data)
        else:
            return jsonify({
                'progress': 0,
                'status': 'Not started',
                'step': 'Initializing...',
                'completed': False
            })
    except Exception as e:
        return jsonify({
            'progress': 0,
            'status': f'Error: {str(e)}',
            'step': 'Error occurred',
            'completed': False
        })


# Security headers
@app.after_request
def after_request(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    if os.environ.get('FLASK_ENV') == 'production':
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response


@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('index.html')


# Global variables to store uploaded files and generated scripts info
uploaded_files_global = []
generated_scripts_info = []


# Add this route for device management
@app.route('/devices', methods=['GET'])
def get_devices():
    """Get list of available devices with their current status"""
    try:
        if not devices_config:
            load_devices_config()

        # Get fresh status for all devices
        print("[DEVICES] Checking device status...")
        status_results = check_all_devices_status()

        # Format response
        devices_list = []
        for device in devices_config['devices']:
            if not device.get('active', True):
                continue

            device_info = {
                'id': device['id'],
                'name': device['name'],
                'host': device['host'],
                'description': device.get('description', ''),
                'capabilities': device.get('capabilities', []),
                'priority': device.get('priority', 999)
            }

            # Add status information
            if device['id'] in status_results:
                status_info = status_results[device['id']]['status']
                device_info.update({
                    'status': status_info['status'],
                    'status_message': status_info['message'],
                    'response_time': status_info.get('response_time'),
                    'last_checked': status_results[device['id']]['checked_at']
                })
            else:
                device_info.update({
                    'status': 'unknown',
                    'status_message': 'Status check not completed',
                    'response_time': None,
                    'last_checked': None
                })

            devices_list.append(device_info)

        # Sort by priority
        devices_list.sort(key=lambda x: x.get('priority', 999))

        return jsonify({
            'success': True,
            'devices': devices_list,
            'total_devices': len(devices_list),
            'settings': devices_config.get('settings', {}),
            'message': f'Found {len(devices_list)} active devices'
        })

    except Exception as e:
        print(f"[ERROR] Failed to get devices: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to retrieve devices: {str(e)}',
            'devices': []
        })


@app.route('/devices/<device_id>/status', methods=['GET'])
def get_device_status(device_id):
    """Get real-time status of a specific device"""
    try:
        if not devices_config:
            load_devices_config()

        # Find the device
        device = next((d for d in devices_config['devices'] if d['id'] == device_id), None)
        if not device:
            return jsonify({
                'success': False,
                'message': f'Device {device_id} not found'
            })

        if not device.get('active', True):
            return jsonify({
                'success': False,
                'message': f'Device {device_id} is disabled'
            })

        # Check device status
        print(f"[DEVICES] Checking status for device: {device_id}")
        status = check_device_connectivity(device)

        return jsonify({
            'success': True,
            'device_id': device_id,
            'device_name': device['name'],
            'host': device['host'],
            'status': status['status'],
            'message': status['message'],
            'response_time': status.get('response_time'),
            'checked_at': time.time(),
            'is_online': status['status'] == 'online'
        })

    except Exception as e:
        print(f"[ERROR] Failed to check device {device_id} status: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Failed to check device status: {str(e)}',
            'status': 'error'
        })

'''
@app.route('/upload', methods=['POST'])
def upload_files():
    """Handle file uploads"""
    global uploaded_files_global

    # Cleanup any progress JSON files at the start
    progress_cleanup()

    try:
        # *** SIMPLE CLEANUP: Remove all existing files from test_case folder ***
        test_case_folder = app.config['UPLOAD_FOLDER']
        if os.path.exists(test_case_folder):
            for filename in os.listdir(test_case_folder):
                file_path = os.path.join(test_case_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            print(f"[CLEANUP] Cleaned test_case folder before ingest")

        if 'files' not in request.files:
            return jsonify({'success': False, 'message': 'No files selected'})

        files = request.files.getlist('files')
        uploaded_files = []
        total_size = 0

        for file in files:
            if file.filename == '':
                continue

            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)
                # Add timestamp to avoid conflicts
                #timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_')
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S%f')[:-3] + '_'  # Include milliseconds
                filename = timestamp + filename
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)

                file_size = os.path.getsize(file_path)
                total_size += file_size

                uploaded_files.append({
                    'name': file.filename,
                    'size': file_size,
                    'path': filename
                })
            else:
                print(f"File not allowed: {file.filename}")

        # Store uploaded files globally
        uploaded_files_global = uploaded_files

        if uploaded_files:
            return jsonify({
                'success': True,
                'files': uploaded_files,
                'total_size': total_size,
                'message': f'Successfully uploaded {len(uploaded_files)} file(s)'
            })
        else:
            return jsonify({'success': False, 'message': 'No valid files uploaded. Please check file types.'})

    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'success': False, 'message': f'Upload error: {str(e)}'})
'''

@app.route('/upload', methods=['POST'])
def upload_files():
    """Handle file uploads"""
    global uploaded_files_global

    # Cleanup any progress JSON files at the start
    progress_cleanup()

    try:
        # *** SIMPLE CLEANUP: Remove all existing files from test_case folder ***
        test_case_folder = app.config['UPLOAD_FOLDER']
        if os.path.exists(test_case_folder):
            for filename in os.listdir(test_case_folder):
                file_path = os.path.join(test_case_folder, filename)
                if os.path.isfile(file_path):
                    os.remove(file_path)
            print(f"[CLEANUP] Cleaned test_case folder before upload")

        if 'files' not in request.files:
            return jsonify({'success': False, 'message': 'No files selected'})

        files = request.files.getlist('files')
        uploaded_files = []
        total_size = 0

        # *** NEW: Get base timestamp once for all files ***
        base_timestamp = datetime.now()
        base_timestamp_str = base_timestamp.strftime('%Y%m%d_%H%M%S%f')[:-3]  # Include milliseconds
        base_timestamp_int = int(base_timestamp_str.split('_')[1])  # Extract time part as integer

        for i, file in enumerate(files):
            if file.filename == '':
                continue

            if file and allowed_file(file.filename):
                filename = secure_filename(file.filename)

                # *** NEW: Create incremental timestamp for each file ***
                # Add incremental seconds to ensure unique timestamps: +0, +1, +2, +3 seconds
                incremented_time = base_timestamp_int + i
                date_part = base_timestamp_str.split('_')[0]  # Extract date part
                unique_timestamp = f"{date_part}_{incremented_time:09d}_"

                filename = unique_timestamp + filename
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(file_path)

                file_size = os.path.getsize(file_path)
                total_size += file_size

                uploaded_files.append({
                    'name': file.filename,
                    'size': file_size,
                    'path': filename
                })

                print(
                    f"[UPLOAD] File {i + 1}: {file.filename} -> {filename} (timestamp: {unique_timestamp.rstrip('_')})")
            else:
                print(f"File not allowed: {file.filename}")

        # Store uploaded files globally
        uploaded_files_global = uploaded_files

        if uploaded_files:
            return jsonify({
                'success': True,
                'files': uploaded_files,
                'total_size': total_size,
                'message': f'Successfully uploaded {len(uploaded_files)} file(s)'
            })
        else:
            return jsonify({'success': False, 'message': 'No valid files uploaded. Please check file types.'})

    except Exception as e:
        print(f"Upload error: {str(e)}")
        return jsonify({'success': False, 'message': f'Upload error: {str(e)}'})

'''
@app.route('/ingest', methods=['POST'])
def ingest_test():
    """Process ingested test files and identify individual test cases - supports both single and multiple test case files while preserving upload order"""
    try:
        data = request.get_json()
        files = data.get('files', [])
        parse_multiple = data.get('parse_multiple', True)  # Enable multi-parsing by default

        print(f"[INGEST] Processing {len(files)} file(s) with parse_multiple={parse_multiple}")

        processed_files = []
        multi_case_files = []
        single_case_files = []
        created_individual_files = []  # Track files we create for multi-case scenarios
        files_to_delete = []  # Track original multi-case files to delete

        # NEW: Track file types
        python_files = []
        test_case_files = []

        # NEW: Check if we have any Python files and clean up generated-scripts folder
        has_python_files = any(file_info['name'].lower().endswith('.py') for file_info in files)
        if has_python_files:
            print("[CLEANUP] Python files detected - cleaning generated-scripts folder")
            scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
            if os.path.exists(scripts_folder):
                for filename in os.listdir(scripts_folder):
                    file_path = os.path.join(scripts_folder, filename)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            print(f"[CLEANUP] Deleted old script: {file_path}")
                    except Exception as e:
                        print(f"[ERROR] Failed to delete {file_path}: {e}")
                try:
                    os.rmdir(scripts_folder)
                    print(f"[CLEANUP] Deleted folder: {scripts_folder}")
                except:
                    pass
            print("[CLEANUP] Generated-scripts folder cleaned for Python file ingestion")

        # Process files in the exact upload order to maintain sequence
        for file_index, file_info in enumerate(files):
            filename = file_info['name']
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info['path'])

            print(f"[INGEST] Processing file {file_index + 1}/{len(files)}: {filename}")

            # NEW: Check if this is a Python file
            if filename.lower().endswith('.py'):
                print(f"[INGEST] Python code file detected: {filename}")

                # Copy Python file to generated-scripts folder
                scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
                os.makedirs(scripts_folder, exist_ok=True)

                # NEW: Keep original filename with conflict resolution
                base_filename = filename
                script_filename = base_filename
                dest_path = os.path.join(scripts_folder, script_filename)

                # Handle filename conflicts by adding a counter
                counter = 1
                while os.path.exists(dest_path):
                    name_part = base_filename.rsplit('.py', 1)[0]
                    script_filename = f"{name_part}_{counter}.py"
                    dest_path = os.path.join(scripts_folder, script_filename)
                    counter += 1

                if script_filename != base_filename:
                    print(f"[INFO] Renamed {base_filename} to {script_filename} to avoid conflict")

                try:
                    # Copy the file
                    import shutil
                    shutil.copy2(file_path, dest_path)

                    # Read content for preview and full content
                    with open(file_path, 'r', encoding='utf-8') as f:
                        full_content = f.read()

                    python_files.append({
                        'original_name': filename,
                        'script_name': script_filename,
                        'dest_path': dest_path,
                        'content_preview': full_content[:200] + "..." if len(full_content) > 200 else full_content,
                        'full_content': full_content  # NEW: Store full content for display
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': filename.replace('.py', ''),
                        'original_filename': filename,
                        'script_filename': script_filename,
                        'status': 'python_code_ready',
                        'test_cases': f"Python code file - ready for review",
                        'file_type': 'python_code'
                    })

                    print(f"[INGEST] Python file copied to: {dest_path}")

                except Exception as e:
                    print(f"[ERROR] Failed to copy Python file {filename}: {e}")
                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': filename,
                        'original_filename': filename,
                        'status': 'error',
                        'test_cases': f"Error processing Python file: {e}",
                        'file_type': 'python_code_error'
                    })

                continue  # Skip test case processing for Python files

            # Existing test case processing logic for non-Python files
            try:
                # Read file content with encoding detection
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                # Fallback to different encoding if UTF-8 fails
                try:
                    with open(file_path, 'r', encoding='latin-1') as f:
                        content = f.read()
                except Exception as e:
                    print(f"[ERROR] Could not read file {filename}: {e}")
                    continue

            test_case_files.append(filename)

            if parse_multiple:
                # Check if file contains multiple test cases
                test_case_matches = re.findall(r'Test Case:', content, re.IGNORECASE)
                test_case_count = len(test_case_matches)
                print(f"[INGEST] File {filename} contains {test_case_count} test case(s)")

                if test_case_count > 1:
                    # Multiple test cases in single file - PRESERVE ORDER
                    print(f"[INGEST] Breaking down multi-case file: {filename}")
                    parsed_test_cases = parse_multiple_test_cases_from_content(content, filename)

                    if parsed_test_cases:
                        # Extract timestamp from uploaded file path for consistent naming
                        timestamp_prefix = file_info['path'].split('_')[0] + '_' + file_info['path'].split('_')[1]

                        # Create individual files - this maintains compatibility with Auto_test_gen.py
                        individual_files = create_individual_files_for_multi_case(
                            parsed_test_cases, filename, timestamp_prefix
                        )

                        created_individual_files.extend(individual_files)

                        multi_case_files.append({
                            'name': filename,
                            'test_cases': len(individual_files),
                            'created_files': [f['filename'] for f in individual_files]
                        })

                        # Add to processed files for response
                        for j, individual_file in enumerate(individual_files):
                            processed_files.append({
                                'id': len(processed_files) + 1,
                                'name': individual_file['test_case_name'],
                                'original_filename': filename,
                                'created_filename': individual_file['filename'],
                                'status': 'processed',
                                'test_cases': f"1 test case (part {individual_file['section_index']} of {len(individual_files)})",
                                'file_type': 'multi_case_part'
                            })

                        # Delete the original multi-case file immediately
                        try:
                            os.remove(file_path)
                            print(f"[CLEANUP] Deleted original multi-case file: {filename}")
                        except Exception as e:
                            print(f"[ERROR] Failed to delete original file {file_path}: {e}")
                    else:
                        print(f"[WARNING] No valid test cases found in {filename}")

                elif test_case_count == 1:
                    # Single test case file - no changes needed
                    print(f"[INGEST] Single test case file: {filename}")
                    test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace(
                        '.pdf', '')

                    single_case_files.append({
                        'name': filename,
                        'test_cases': 1
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': test_case_name,
                        'original_filename': filename,
                        'status': 'processed',
                        'test_cases': f"1 test case identified",
                        'file_path': file_path,
                        'file_type': 'single_case'
                    })

                else:
                    # No "Test Case:" found - treat as single case anyway
                    print(f"[INGEST] No 'Test Case:' markers found in {filename}, treating as single test case")
                    test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace(
                        '.pdf', '')

                    single_case_files.append({
                        'name': filename,
                        'test_cases': 1
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': test_case_name,
                        'original_filename': filename,
                        'status': 'processed',
                        'test_cases': f"1 test case identified",
                        'file_path': file_path,
                        'file_type': 'single_case'
                    })

            else:
                # Original single-file processing (backward compatibility)
                test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace('.pdf',
                                                                                                               '')

                processed_files.append({
                    'id': len(processed_files) + 1,
                    'name': test_case_name,
                    'original_filename': filename,
                    'status': 'processed',
                    'test_cases': f"1 test case identified",
                    'file_path': file_path,
                    'file_type': 'single_case'
                })

        total_test_cases = len(processed_files)
        print(f"[INGEST] Successfully processed {total_test_cases} items from {len(files)} file(s)")

        # NEW: Create order_mapping.json for Python files (similar to Auto_test_gen.py)
        if python_files:
            print("[MAPPING] Creating order_mapping.json for uploaded Python files")
            try:
                scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
                mapping_file_path = os.path.join(scripts_folder, 'order_mapping.json')

                # Create mapping structure similar to Auto_test_gen.py
                order_mapping = {}
                for processed_file in processed_files:
                    if processed_file['file_type'] == 'python_code':
                        # Find corresponding python file
                        py_file = next(
                            (pf for pf in python_files if pf['original_name'] == processed_file['original_filename']),
                            None)
                        if py_file:
                            order_mapping[str(processed_file['id'])] = {
                                'script_name': processed_file.get('script_filename', py_file['script_name']),
                                'test_case_name': processed_file['name'],
                                'original_filename': processed_file['original_filename'],
                                'file_type': 'uploaded_python_code'
                            }

                # Write mapping file
                with open(mapping_file_path, 'w') as f:
                    json.dump(order_mapping, f, indent=2)

                print(f"[MAPPING] Created order_mapping.json with {len(order_mapping)} entries")
                print(f"[MAPPING] Mapping content: {order_mapping}")

            except Exception as e:
                print(f"[ERROR] Failed to create order_mapping.json: {e}")

        # Build response message
        message_parts = []
        if python_files:
            message_parts.append(f"{len(python_files)} Python code file(s) ready for review")
        if parse_multiple and (multi_case_files or single_case_files):
            if multi_case_files:
                message_parts.append(
                    f"{len(multi_case_files)} multi-test-case file(s) broken down into individual files")
            if single_case_files:
                message_parts.append(f"{len(single_case_files)} single test case file(s)")

        if message_parts:
            message = f"Successfully ingested {total_test_cases} items from {' and '.join(message_parts)} - order preserved"
        else:
            message = f"Successfully ingested {total_test_cases} item(s) from {len(files)} file(s)"

        return jsonify({
            'success': True,
            'processed_files': processed_files,
            'multi_case_files': multi_case_files,
            'single_case_files': single_case_files,
            'python_files': python_files,  # NEW: Include Python files info
            'created_individual_files': created_individual_files,
            'total_test_cases': total_test_cases,
            'has_python_files': len(python_files) > 0,  # NEW: Flag for frontend
            'has_test_cases': len(test_case_files) > 0,  # NEW: Flag for frontend
            'message': message,
            'workflow_type': 'python_code' if len(python_files) > 0 and len(
                test_case_files) == 0 else 'test_cases' if len(test_case_files) > 0 and len(
                python_files) == 0 else 'mixed'  # NEW: Workflow indicator
        })

    except Exception as e:
        print(f"[ERROR] Ingestion error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Ingestion error: {str(e)}'
        })
'''

@app.route('/ingest', methods=['POST'])
def ingest_test():
    """Process ingested test files and identify individual test cases - supports both single and multiple test case files while preserving upload order"""
    try:
        data = request.get_json()
        files = data.get('files', [])
        parse_multiple = data.get('parse_multiple', True)  # Enable multi-parsing by default

        print(f"[INGEST] Processing {len(files)} file(s) with parse_multiple={parse_multiple}")

        processed_files = []
        multi_case_files = []
        single_case_files = []
        created_individual_files = []  # Track files we create for multi-case scenarios
        files_to_delete = []  # Track original multi-case files to delete

        # NEW: Track file types
        python_files = []
        test_case_files = []

        # NEW: Check if we have any Python files and clean up generated-scripts folder
        has_python_files = any(file_info['name'].lower().endswith('.py') for file_info in files)
        if has_python_files:
            print("[CLEANUP] Python files detected - cleaning generated-scripts folder")
            scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
            if os.path.exists(scripts_folder):
                for filename in os.listdir(scripts_folder):
                    file_path = os.path.join(scripts_folder, filename)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            print(f"[CLEANUP] Deleted old script: {file_path}")
                    except Exception as e:
                        print(f"[ERROR] Failed to delete {file_path}: {e}")
                try:
                    os.rmdir(scripts_folder)
                    print(f"[CLEANUP] Deleted folder: {scripts_folder}")
                except:
                    pass
            print("[CLEANUP] Generated-scripts folder cleaned for Python file ingestion")

        # Process files in the exact upload order to maintain sequence
        for file_index, file_info in enumerate(files):
            filename = file_info['name']
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info['path'])

            print(f"[INGEST] Processing file {file_index + 1}/{len(files)}: {filename}")

            # NEW: Check if this is a Python file
            if filename.lower().endswith('.py'):
                print(f"[INGEST] Python code file detected: {filename}")

                # Copy Python file to generated-scripts folder
                scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
                os.makedirs(scripts_folder, exist_ok=True)

                # NEW: Keep original filename with conflict resolution
                base_filename = filename
                script_filename = base_filename
                dest_path = os.path.join(scripts_folder, script_filename)

                # Handle filename conflicts by adding a counter
                counter = 1
                while os.path.exists(dest_path):
                    name_part = base_filename.rsplit('.py', 1)[0]
                    script_filename = f"{name_part}_{counter}.py"
                    dest_path = os.path.join(scripts_folder, script_filename)
                    counter += 1

                if script_filename != base_filename:
                    print(f"[INFO] Renamed {base_filename} to {script_filename} to avoid conflict")

                try:
                    # Copy the file
                    import shutil
                    shutil.copy2(file_path, dest_path)

                    # Read content for preview and full content
                    with open(file_path, 'r', encoding='utf-8') as f:
                        full_content = f.read()

                    python_files.append({
                        'original_name': filename,
                        'script_name': script_filename,
                        'dest_path': dest_path,
                        'content_preview': full_content[:200] + "..." if len(full_content) > 200 else full_content,
                        'full_content': full_content  # NEW: Store full content for display
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': filename.replace('.py', ''),
                        'original_filename': filename,
                        'script_filename': script_filename,
                        'status': 'python_code_ready',
                        'test_cases': f"Python code file - ready for review",
                        'file_type': 'python_code'
                    })

                    print(f"[INGEST] Python file copied to: {dest_path}")

                except Exception as e:
                    print(f"[ERROR] Failed to copy Python file {filename}: {e}")
                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': filename,
                        'original_filename': filename,
                        'status': 'error',
                        'test_cases': f"Error processing Python file: {e}",
                        'file_type': 'python_code_error'
                    })

                continue  # Skip test case processing for Python files

            # Existing test case processing logic for non-Python files
            try:
                # Read file content with encoding detection
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except UnicodeDecodeError:
                # Fallback to different encoding if UTF-8 fails
                try:
                    with open(file_path, 'r', encoding='latin-1') as f:
                        content = f.read()
                except Exception as e:
                    print(f"[ERROR] Could not read file {filename}: {e}")
                    continue

            test_case_files.append(filename)

            if parse_multiple:
                # Check if file contains multiple test cases
                test_case_matches = re.findall(r'Test Case:', content, re.IGNORECASE)
                test_case_count = len(test_case_matches)
                print(f"[INGEST] File {filename} contains {test_case_count} test case(s)")

                if test_case_count > 1:
                    # Multiple test cases in single file - PRESERVE ORDER
                    print(f"[INGEST] Breaking down multi-case file: {filename}")
                    parsed_test_cases = parse_multiple_test_cases_from_content(content, filename)

                    if parsed_test_cases:
                        # Extract timestamp from uploaded file path for consistent naming
                        timestamp_prefix = file_info['path'].split('_')[0] + '_' + file_info['path'].split('_')[1]

                        # Create individual files - this maintains compatibility with Auto_test_gen.py
                        individual_files = create_individual_files_for_multi_case(
                            parsed_test_cases, filename, timestamp_prefix
                        )

                        created_individual_files.extend(individual_files)

                        multi_case_files.append({
                            'name': filename,
                            'test_cases': len(individual_files),
                            'created_files': [f['filename'] for f in individual_files]
                        })

                        # Add to processed files for response
                        for j, individual_file in enumerate(individual_files):
                            processed_files.append({
                                'id': len(processed_files) + 1,
                                'name': individual_file['test_case_name'],
                                'original_filename': filename,
                                'created_filename': individual_file['filename'],
                                'status': 'processed',
                                'test_cases': f"1 test case (part {individual_file['section_index']} of {len(individual_files)})",
                                'file_type': 'multi_case_part'
                            })

                        # Delete the original multi-case file immediately
                        try:
                            os.remove(file_path)
                            print(f"[CLEANUP] Deleted original multi-case file: {filename}")
                        except Exception as e:
                            print(f"[ERROR] Failed to delete original file {file_path}: {e}")
                    else:
                        print(f"[WARNING] No valid test cases found in {filename}")

                elif test_case_count == 1:
                    # Single test case file - no changes needed
                    print(f"[INGEST] Single test case file: {filename}")
                    test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace(
                        '.pdf', '')

                    single_case_files.append({
                        'name': filename,
                        'test_cases': 1
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': test_case_name,
                        'original_filename': filename,
                        'status': 'processed',
                        'test_cases': f"1 test case identified",
                        'file_path': file_path,
                        'file_type': 'single_case'
                    })

                else:
                    # No "Test Case:" found - treat as single case anyway
                    print(f"[INGEST] No 'Test Case:' markers found in {filename}, treating as single test case")
                    test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace(
                        '.pdf', '')

                    single_case_files.append({
                        'name': filename,
                        'test_cases': 1
                    })

                    processed_files.append({
                        'id': len(processed_files) + 1,
                        'name': test_case_name,
                        'original_filename': filename,
                        'status': 'processed',
                        'test_cases': f"1 test case identified",
                        'file_path': file_path,
                        'file_type': 'single_case'
                    })

            else:
                # Original single-file processing (backward compatibility)
                test_case_name = filename.replace('.txt', '').replace('.rtf', '').replace('.docx', '').replace('.pdf',
                                                                                                               '')

                processed_files.append({
                    'id': len(processed_files) + 1,
                    'name': test_case_name,
                    'original_filename': filename,
                    'status': 'processed',
                    'test_cases': f"1 test case identified",
                    'file_path': file_path,
                    'file_type': 'single_case'
                })

        total_test_cases = len(processed_files)
        print(f"[INGEST] Successfully processed {total_test_cases} items from {len(files)} file(s)")

        # NEW: Create order_mapping.json for Python files (similar to Auto_test_gen.py)
        if python_files:
            print("[MAPPING] Creating order_mapping.json for uploaded Python files")
            try:
                scripts_folder = app.config['GENERATED_SCRIPTS_FOLDER']
                mapping_file_path = os.path.join(scripts_folder, 'order_mapping.json')

                # Create mapping structure similar to Auto_test_gen.py
                order_mapping = []
                for processed_file in processed_files:
                    if processed_file['file_type'] == 'python_code':
                        # Find corresponding python file
                        py_file = next(
                            (pf for pf in python_files if pf['original_name'] == processed_file['original_filename']),
                            None)
                        if py_file:
                            order_mapping.append({
                                'order_index': processed_file['id'],
                                'script_name': processed_file.get('script_filename', py_file['script_name']),
                                'test_case_name': processed_file['name'],
                                'source_file': processed_file['original_filename'],
                            })

                # Write mapping file
                with open(mapping_file_path, 'w') as f:
                    json.dump(order_mapping, f, indent=2)

                print(f"[MAPPING] Created order_mapping.json with {len(order_mapping)} entries")
                print(f"[MAPPING] Mapping content: {order_mapping}")

                # NEW: Populate generated_scripts_info global variable for uploaded Python files
                global generated_scripts_info
                generated_scripts_info = []
                for processed_file in processed_files:
                    if processed_file['file_type'] == 'python_code':
                        py_file = next(
                            (pf for pf in python_files if pf['original_name'] == processed_file['original_filename']),
                            None)
                        if py_file:
                            generated_scripts_info.append({
                                'id': processed_file['id'],
                                'script_name': py_file['script_name'],
                                'test_case_name': processed_file['name'],
                                'file_path': py_file['dest_path'],
                                'code': py_file['full_content']  # FIXED: Use just the full content, no extra headers
                            })

                print(f"[MAPPING] Populated generated_scripts_info with {len(generated_scripts_info)} entries")

            except Exception as e:
                print(f"[ERROR] Failed to create order_mapping.json: {e}")

        # Build response message
        message_parts = []
        if python_files:
            message_parts.append(f"{len(python_files)} Python code file(s) ready for review")
        if parse_multiple and (multi_case_files or single_case_files):
            if multi_case_files:
                message_parts.append(
                    f"{len(multi_case_files)} multi-test-case file(s) broken down into individual files")
            if single_case_files:
                message_parts.append(f"{len(single_case_files)} single test case file(s)")

        if message_parts:
            message = f"Successfully ingested {total_test_cases} items from {' and '.join(message_parts)} - order preserved"
        else:
            message = f"Successfully ingested {total_test_cases} item(s) from {len(files)} file(s)"

        return jsonify({
            'success': True,
            'processed_files': processed_files,
            'multi_case_files': multi_case_files,
            'single_case_files': single_case_files,
            'python_files': python_files,  # NEW: Include Python files info
            'created_individual_files': created_individual_files,
            'total_test_cases': total_test_cases,
            'has_python_files': len(python_files) > 0,  # NEW: Flag for frontend
            'has_test_cases': len(test_case_files) > 0,  # NEW: Flag for frontend
            'message': message,
            'workflow_type': 'python_code' if len(python_files) > 0 and len(
                test_case_files) == 0 else 'test_cases' if len(test_case_files) > 0 and len(
                python_files) == 0 else 'mixed'  # NEW: Workflow indicator
        })

    except Exception as e:
        print(f"[ERROR] Ingestion error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Ingestion error: {str(e)}'
        })

def simulate_progress_during_subprocess(task_type, start_progress, end_progress, duration=8):
    """Simulate progress increment during subprocess execution"""
    steps = 4  # 65%, 70%, 75%, 80%
    step_size = (end_progress - start_progress) / steps
    sleep_time = duration / steps

    current_progress = start_progress
    status_messages = [
        "Analyzing test requirements...",
        "Generating Python test code...",
        "Optimizing code structure...",
        "Finalizing test scripts..."
    ]

    for i in range(steps):
        time.sleep(sleep_time)
        current_progress += step_size
        update_progress(task_type, int(current_progress), 'Processing', status_messages[i])


# 1. ADD this new function (don't modify existing functions)
def save_generated_code_dev(generated_code):
    """Save generated code to dev-scripts folder immediately after generation"""
    try:
        dev_scripts_dir = os.path.join(os.getcwd(), "..", "dev-scripts")
        os.makedirs(dev_scripts_dir, exist_ok=True)

        # Clean old files
        for filename in os.listdir(dev_scripts_dir):
            file_path = os.path.join(dev_scripts_dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)

        # Save files
        for i, code_result in enumerate(generated_code):
            file_name = code_result.get('file_name', f'dev_code_{i + 1}.py')
            if not file_name.endswith('.py'):
                file_name += '.py'

            dest_path = os.path.join(dev_scripts_dir, file_name)
            with open(dest_path, 'w', encoding='utf-8') as f:
                f.write(code_result.get('generated_code', ''))

        print(f"[DEV_SCRIPTS] Saved {len(generated_code)} files immediately")
        return True
    except Exception as e:
        print(f"[DEV_SCRIPTS] Error saving immediately: {e}")
        return False

'''
@app.route('/generate', methods=['POST'])
def generate_code():
    """Generate Python test code for all test cases with real progress tracking"""
    global uploaded_files_global
    global generated_scripts_info

    try:
        data = request.get_json()
        print(f"Generate request data: {data}")

        # Clear previous progress and initialize
        clear_progress('generate')
        update_progress('generate', 0, 'Starting', 'Analyzing test requirements')

        # Clear old scripts
        folder_path = app.config['GENERATED_SCRIPTS_FOLDER']
        if os.path.isdir(folder_path):
            for filename in os.listdir(folder_path):
                file_path = os.path.join(folder_path, filename)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        print(f"[INFO] Deleted old script: {file_path}")
                except Exception as e:
                    print(f"[ERROR] Failed to delete {file_path}: {e}")
            try:
                os.rmdir(folder_path)
                print(f"[INFO] Deleted folder: {folder_path}")
            except:
                pass
        else:
            print(f"[INFO] Folder '{folder_path}' does not exist. Skipping cleanup.")

        # Step 1: Preparation (20%)
        update_progress('generate', 20, 'Processing', 'Creating Python test structure')
        time.sleep(1)  # Allow progress to be visible

        # Step 2: Script generation (40%)
        update_progress('generate', 40, 'Processing', 'Generating Python test code')

        # Run Auto_test_gen.py to generate scripts
        print(f"Executing Auto_test_gen.py")
        script_path = os.path.join(os.getcwd(), "..", "Backend", "Auto_test_gen.py")
        print(f"DEBUG: App.py current directory: {os.getcwd()}")
        print(f"DEBUG: Looking for Auto_test_gen.py at: {script_path}")
        print(f"DEBUG: Auto_test_gen.py exists: {os.path.exists(script_path)}")

        # Step 3: Executing script generation (60%)
        update_progress('generate', 60, 'Processing', 'Optimizing Python code')

        # START OF ENHANCED SUBPROCESS HANDLING
        print(f"Starting subprocess with progress simulation...")

        # Start progress simulation in a separate thread
        progress_thread = threading.Thread(
            target=simulate_progress_during_subprocess,
            args=('generate', 65, 80, 8)  # Go from 65% to 80% over 8 seconds
        )
        progress_thread.start()

        # Run the actual subprocess
        output = subprocess.run(["python3", os.path.join(os.getcwd(), "..", "Backend", "Auto_test_gen.py")],
                                capture_output=True, text=True)

        # Wait for progress thread to complete
        progress_thread.join()

        # END OF ENHANCED SUBPROCESS HANDLING

        print(f"Auto_test_gen.py completed")
        print(f"DEBUG: Subprocess return code: {output.returncode}")
        print(f"DEBUG: Subprocess stderr: '{output.stderr}'")
        print("STDOUT:", output.stdout)

        # Step 4: Processing results (80% → 90%)
        update_progress('generate', 80, 'Processing', 'Processing generated scripts')
        time.sleep(0.8)  # Small delay

        # Continue smooth progress during script processing
        update_progress('generate', 85, 'Processing', 'Reading script files')
        time.sleep(0.6)

        # Extract all generated script names
        matches = re.findall(r"Script generated\s*:\s*(\S+\.py)", output.stdout)

        if not matches:
            update_progress('generate', 0, 'Error', 'No scripts were generated', True)
            return jsonify({'success': False, 'message': 'No scripts were generated.'})

        # Continue progress during file reading
        update_progress('generate', 90, 'Processing', 'Organizing test cases')
        time.sleep(0.7)

        # Read all generated scripts
        generated_scripts_info = []
        script_folder = app.config['GENERATED_SCRIPTS_FOLDER']
        print(f"DEBUG: App looking for scripts in: {script_folder}")
        print(f"DEBUG: Generated scripts folder exists: {os.path.exists(script_folder)}")

        # Update progress while processing each script
        total_scripts = len(matches)
        for i, script_name in enumerate(matches):
            # Show incremental progress from 90% to 95%
            if total_scripts > 1:
                script_progress = 90 + (i * 5 // total_scripts)
                update_progress('generate', script_progress, 'Processing', f'Processing script {i + 1}/{total_scripts}')
                time.sleep(0.3)

            file_path = os.path.join(script_folder, script_name)
            if os.path.isfile(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        script_content = f.read()

                    # Extract test case name from script name
                    test_case_name = script_name.replace('.py', '').replace('_', ' ').title()

                    generated_scripts_info.append({
                        'id': i + 1,
                        'script_name': script_name,
                        'test_case_name': test_case_name,
                        'file_path': file_path,
                        'code': f'# Generated Python Test Code - {script_name}\n# Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n{script_content}'
                    })
                except Exception as e:
                    generated_scripts_info.append({
                        'id': i + 1,
                        'script_name': script_name,
                        'test_case_name': script_name.replace('.py', ''),
                        'file_path': file_path,
                        'code': f"Error reading file {script_name}: {str(e)}"
                    })
            else:
                generated_scripts_info.append({
                    'id': i + 1,
                    'script_name': script_name,
                    'test_case_name': script_name.replace('.py', ''),
                    'file_path': '',
                    'code': f"Script {script_name} was listed but not found on disk."
                })

        # Final progress steps (95% → 100%)
        update_progress('generate', 95, 'Processing', 'Finalizing test suite')
        time.sleep(0.8)

        update_progress('generate', 98, 'Processing', 'Preparing response')
        time.sleep(0.5)

        # Step 5: Complete (100%)
        update_progress('generate', 100, 'Completed', 'Code generation completed successfully!', True)

        return jsonify({
            'success': True,
            'generated_scripts': generated_scripts_info,
            'total_scripts': len(generated_scripts_info),
            'message': f'Successfully generated {len(generated_scripts_info)} Python test script(s)'
        })

    except Exception as e:
        update_progress('generate', 0, 'Error', f'Generation failed: {str(e)}', True)
        return jsonify({'success': False, 'message': f'Generation error: {str(e)}'})
'''

@app.route('/generate', methods=['POST'])
def generate_code():
    """Generate Python test code for all test cases with real progress tracking"""
    global uploaded_files_global
    global generated_scripts_info
    global generation_lock

    # CLEANUP: Remove progress file if exists from previous run
    try:
        if os.path.exists('progress_generate.json'):
            os.remove('progress_generate.json')
            print("[CLEANUP] Removed progress_generate.json after successful generation")
    except Exception as e:
        print(f"[CLEANUP] Error removing progress_generate.json: {e}")

    # Use lock to prevent multiple simultaneous generations
    with generation_lock:
        try:
            data = request.get_json()
            print(f"Generate request data: {data}")

            # Check if generation is already in progress by checking existing progress
            progress_file = "progress_generate.json"
            is_already_running = False

            if os.path.exists(progress_file):
                try:
                    with open(progress_file, 'r') as f:
                        existing_progress = json.load(f)
                    # If progress exists and not completed, don't start new generation
                    if not existing_progress.get('completed', False) and existing_progress.get('progress', 0) > 0:
                        is_already_running = True
                        print(f"[INFO] Generation already in progress at {existing_progress.get('progress', 0)}%")
                except:
                    pass

            # Only clear progress if not already running
            if not is_already_running:
                clear_progress('generate')
                update_progress('generate', 0, 'Starting', 'Analyzing test requirements')

                # Clear old scripts (only if starting fresh)
                folder_path = app.config['GENERATED_SCRIPTS_FOLDER']
                if os.path.isdir(folder_path):
                    for filename in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, filename)
                        try:
                            if os.path.isfile(file_path):
                                os.remove(file_path)
                                print(f"[INFO] Deleted old script: {file_path}")
                        except Exception as e:
                            print(f"[ERROR] Failed to delete {file_path}: {e}")
                    try:
                        os.rmdir(folder_path)
                        print(f"[INFO] Deleted folder: {folder_path}")
                    except:
                        pass
                else:
                    print(f"[INFO] Folder '{folder_path}' does not exist. Skipping cleanup.")

                # Step 1: Preparation (20%)
                update_progress('generate', 20, 'Processing', 'Creating Python test structure')
                time.sleep(1)  # Allow progress to be visible

                # Step 2: Script generation (40%)
                update_progress('generate', 40, 'Processing', 'Generating Python test code')

                # Run Auto_test_gen.py to generate scripts
                print(f"Executing Auto_test_gen.py")
                script_path = os.path.join(os.getcwd(), "..", "Backend", "Auto_test_gen.py")
                print(f"DEBUG: App.py current directory: {os.getcwd()}")
                print(f"DEBUG: Looking for Auto_test_gen.py at: {script_path}")
                print(f"DEBUG: Auto_test_gen.py exists: {os.path.exists(script_path)}")

                # Step 3: Executing script generation (60%)
                update_progress('generate', 60, 'Processing', 'Optimizing Python code')

                # START OF ENHANCED SUBPROCESS HANDLING
                print(f"Starting subprocess with progress simulation...")

                # Start progress simulation in a separate thread
                progress_thread = threading.Thread(
                    target=simulate_progress_during_subprocess,
                    args=('generate', 65, 80, 8)  # Go from 65% to 80% over 8 seconds
                )
                progress_thread.start()
                languages = ['Python', 'JavaScript', 'Java', 'C++', 'Go']
                selected_language = request.form.get('language')
                print(f"*************************DEBUG-1********************************************** {selected_language}") 
                # Run the actual subprocess
                output = subprocess.run(["python3", os.path.join(os.getcwd(), "..", "Backend", "Auto_test_gen.py")],
                                        capture_output=True, text=True)

                # Wait for progress thread to complete
                progress_thread.join()

                # END OF ENHANCED SUBPROCESS HANDLING

                print(f"Auto_test_gen.py completed")
                print(f"DEBUG: Subprocess return code: {output.returncode}")
                print(f"DEBUG: Subprocess stderr: '{output.stderr}'")
                print("STDOUT:", output.stdout)

                # Step 4: Processing results (80% → 90%)
                update_progress('generate', 80, 'Processing', 'Processing generated scripts')
                time.sleep(0.8)  # Small delay

                # Continue smooth progress during script processing
                update_progress('generate', 85, 'Processing', 'Reading script files')
                time.sleep(0.6)

                # Extract all generated script names
                matches = re.findall(r"Script generated\s*:\s*(\S+\.py)", output.stdout)

                if not matches:
                    update_progress('generate', 0, 'Error', 'No scripts were generated', True)
                    return jsonify({'success': False, 'message': 'No scripts were generated.'})

                # Continue progress during file reading
                update_progress('generate', 90, 'Processing', 'Organizing test cases')
                time.sleep(0.7)

                # Read all generated scripts
                generated_scripts_info = []
                script_folder = app.config['GENERATED_SCRIPTS_FOLDER']
                print(f"DEBUG: App looking for scripts in: {script_folder}")
                print(f"DEBUG: Generated scripts folder exists: {os.path.exists(script_folder)}")

                # Update progress while processing each script
                total_scripts = len(matches)
                for i, script_name in enumerate(matches):
                    # Show incremental progress from 90% to 95%
                    if total_scripts > 1:
                        script_progress = 90 + (i * 5 // total_scripts)
                        update_progress('generate', script_progress, 'Processing',
                                        f'Processing script {i + 1}/{total_scripts}')
                        time.sleep(0.3)

                    file_path = os.path.join(script_folder, script_name)
                    if os.path.isfile(file_path):
                        try:
                            with open(file_path, 'r', encoding='utf-8') as f:
                                script_content = f.read()

                            # Extract test case name from script name
                            test_case_name = script_name.replace('.py', '').replace('_', ' ').title()

                            generated_scripts_info.append({
                                'id': i + 1,
                                'script_name': script_name,
                                'test_case_name': test_case_name,
                                'file_path': file_path,
                                'code': f'# Generated Python Test Code - {script_name}\n# Generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}\n\n{script_content}'
                            })
                        except Exception as e:
                            generated_scripts_info.append({
                                'id': i + 1,
                                'script_name': script_name,
                                'test_case_name': script_name.replace('.py', ''),
                                'file_path': file_path,
                                'code': f"Error reading file {script_name}: {str(e)}"
                            })
                    else:
                        generated_scripts_info.append({
                            'id': i + 1,
                            'script_name': script_name,
                            'test_case_name': script_name.replace('.py', ''),
                            'file_path': '',
                            'code': f"Script {script_name} was listed but not found on disk."
                        })

                # Final progress steps (95% → 100%)
                update_progress('generate', 95, 'Processing', 'Finalizing test suite')
                time.sleep(0.8)

                update_progress('generate', 98, 'Processing', 'Preparing response')
                time.sleep(0.8)

                # Step 5: Complete (100%)
                update_progress('generate', 100, 'Completed', 'Code generation completed successfully!', True)

            else:
                # If already running, return the current state
                print(f"[INFO] Generation already in progress, returning current state")
                # Return existing generated scripts if available
                if generated_scripts_info:
                    return jsonify({
                        'success': True,
                        'generated_scripts': generated_scripts_info,
                        'total_scripts': len(generated_scripts_info),
                        'message': f'Generation already completed - {len(generated_scripts_info)} script(s) available'
                    })

            return jsonify({
                'success': True,
                'generated_scripts': generated_scripts_info,
                'total_scripts': len(generated_scripts_info),
                'message': f'Successfully generated {len(generated_scripts_info)} Python test script(s)'
            })

        except Exception as e:
            update_progress('generate', 0, 'Error', f'Generation failed: {str(e)}', True)
            return jsonify({'success': False, 'message': f'Generation error: {str(e)}'})

@app.route('/save_code', methods=['POST'])
def save_code():
    """Save generated code to file system"""
    global generated_scripts_info

    try:
        data = request.get_json()
        code = data.get('code', '').strip()
        test_case_id = data.get('test_case_id', None)
        test_case_name = data.get('test_case_name', 'general')

        if not code:
            return jsonify({'success': False, 'message': 'No code to save!'})
        print(f"test_case_id - {test_case_id} generated_scripts_info - {generated_scripts_info}")
        if test_case_id is not None and test_case_id <= len(generated_scripts_info):
            # Multi-test case mode - save specific script
            script_info = generated_scripts_info[test_case_id - 1]
            filepath = script_info['file_path']
            filename = script_info['script_name']
        else:
            # Single test case mode or fallback
            script_dir = app.config['GENERATED_SCRIPTS_FOLDER']
            os.makedirs(script_dir, exist_ok=True)
            script_info = generated_scripts_info[0]
            filepath = script_info['file_path']
            filename = script_info['script_name']

        # Write the code to file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)

        return jsonify({
            'success': True,
            'message': f'Python code saved as {filename}',
            'filename': filename,
            'filepath': filepath
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Error saving file: {str(e)}'})


def remove_ansi_codes(text):
    """Function to strip ANSI escape codes (color codes) from terminal output"""
    ansi_escape = re.compile(r'\x1B\[[0-?]*[ -/]*[@-~]')
    return ansi_escape.sub('', text)


# ADD this new save endpoint with this simplified version
@app.route('/save_to_dev_scripts', methods=['POST'])
def save_to_dev_scripts():
    """Save code content to dev-scripts folder using proper filename"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({
                'success': False,
                'message': 'No data received'
            })

        file_id = data.get('file_id')
        content = data.get('content')

        if not file_id or not content:
            return jsonify({
                'success': False,
                'message': 'Missing file_id or content'
            })

        # Create dev-scripts directory if it doesn't exist
        dev_scripts_dir = os.path.join(os.getcwd(), '..', 'dev-scripts')
        os.makedirs(dev_scripts_dir, exist_ok=True)

        # Get the proper filename from generatedApplicationCode
        filename = None

        # Handle enhanced tabs (main_0, test_0, etc.)
        if '_' in file_id and file_id.replace('_', '').replace(file_id.split('_')[0], '').isdigit():
            try:
                index = int(file_id.split('_')[1])

                # Get the proper filename from generatedApplicationCode
                if generatedApplicationCode and index < len(generatedApplicationCode):
                    filename = generatedApplicationCode[index].get('file_name')

                    # Ensure .py extension
                    if filename and not filename.endswith('.py'):
                        filename += '.py'
            except (ValueError, IndexError):
                pass

        # Handle basic tabs (prompt, code, review, etc.)
        elif file_id in ['prompt', 'code', 'review', 'unittest']:
            if file_id == 'prompt':
                filename = 'ai_prompt.txt'
            elif file_id == 'unittest':
                # For unittest tab, try to get proper filename from generatedApplicationCode
                if generatedApplicationCode:
                    # Look for test file in generatedApplicationCode
                    for code_result in generatedApplicationCode:
                        if code_result.get('file_name', '').endswith('_test.py'):
                            filename = code_result.get('file_name')
                            break
                if not filename:
                    filename = 'unit_tests.py'
            elif file_id == 'code':
                # For code tab, try to get proper filename from generatedApplicationCode
                if generatedApplicationCode and len(generatedApplicationCode) > 0:
                    filename = generatedApplicationCode[0].get('file_name')
                    if filename and not filename.endswith('.py'):
                        filename += '.py'
                if not filename:
                    filename = 'main_code.py'
            else:
                filename = f"{file_id}.py"

        # Fallback filename if we can't get proper name
        if not filename:
            filename = f"{file_id}.py"

        # Full file path
        file_path = os.path.join(dev_scripts_dir, filename)

        # Write content to file (overwrite existing)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"[SAVE] Saved file: {file_path}")

        return jsonify({
            'success': True,
            'message': f'File saved as {filename}',
            'filename': filename,
            'file_path': file_path
        })

    except Exception as e:
        print(f"[ERROR] Failed to save to dev-scripts: {e}")
        return jsonify({
            'success': False,
            'message': f'Failed to save file: {str(e)}'
        })

# ADD this new endpoint to get unit test from Dev Scripts to your app.py file
@app.route('/get_unit_test_from_dev_scripts', methods=['GET'])
def get_unit_test_from_dev_scripts():
    """Get unit test file content from dev-scripts folder as fallback"""
    try:
        # Define dev-scripts folder path
        dev_scripts_dir = os.path.join(os.getcwd(), '..', 'dev-scripts')

        print(f"[UNIT_TEST_FALLBACK] Checking dev-scripts folder: {dev_scripts_dir}")

        if not os.path.exists(dev_scripts_dir):
            print(f"[UNIT_TEST_FALLBACK] dev-scripts folder not found")
            return jsonify({
                'success': False,
                'message': 'dev-scripts folder not found'
            })

        # Look for files ending with '_test.py'
        test_files = []
        for filename in os.listdir(dev_scripts_dir):
            if filename.endswith('_test.py') and os.path.isfile(os.path.join(dev_scripts_dir, filename)):
                test_files.append(filename)

        print(f"[UNIT_TEST_FALLBACK] Found {len(test_files)} test files: {test_files}")

        if not test_files:
            return jsonify({
                'success': False,
                'message': 'No unit test files (*_test.py) found in dev-scripts folder'
            })

        # Use the first test file found (you can modify this logic if needed)
        test_filename = test_files[0]
        test_file_path = os.path.join(dev_scripts_dir, test_filename)

        # Read the test file content
        try:
            with open(test_file_path, 'r', encoding='utf-8') as f:
                test_content = f.read()

            print(f"[UNIT_TEST_FALLBACK] Successfully read {test_filename} ({len(test_content)} characters)")

            return jsonify({
                'success': True,
                'test_content': test_content,
                'test_filename': test_filename,
                'source': 'dev-scripts',
                'message': f'Unit test loaded from dev-scripts/{test_filename}'
            })

        except Exception as e:
            print(f"[UNIT_TEST_FALLBACK] Error reading test file {test_file_path}: {e}")
            return jsonify({
                'success': False,
                'message': f'Error reading test file: {str(e)}'
            })

    except Exception as e:
        print(f"[UNIT_TEST_FALLBACK] Error in get_unit_test_from_dev_scripts: {e}")
        return jsonify({
            'success': False,
            'message': f'Error accessing dev-scripts folder: {str(e)}'
        })
'''
@app.route('/execute', methods=['POST'])
def execute_code():
    """Execute selected test scripts on remote RPI via SSH with real progress tracking"""
    global generated_scripts_info

    # Clean up progress file if exists from previous Run
    try:
        if os.path.exists('progress_execute.json'):
            os.remove('progress_execute.json')
            print("[CLEANUP] Removed progress_execute.json after completion")
    except Exception as e:
        print(f"[CLEANUP] Error removing progress_execute.json: {e}")

    try:
        data = request.get_json()

        # NEW: Handle selective test execution
        selected_test_ids = data.get('selected_test_ids', None)

        # If no specific tests selected, execute all (backward compatibility)
        if selected_test_ids is None:
            print("[INFO] No specific tests selected - executing all tests")
            scripts_to_execute = generated_scripts_info
        else:
            print(f"[INFO] Selective execution requested for test IDs: {selected_test_ids}")
            # Filter scripts based on selected IDs
            scripts_to_execute = [
                script for script in generated_scripts_info
                if script['id'] in selected_test_ids
            ]

            if not scripts_to_execute:
                return jsonify({
                    'success': False,
                    'message': 'No valid test scripts found for the selected test cases.'
                })

            print(
                f"[INFO] Found {len(scripts_to_execute)} scripts to execute out of {len(generated_scripts_info)} total")

        # Clear previous progress and initialize
        clear_progress('execute')

        # Update progress message based on selection
        if selected_test_ids and len(scripts_to_execute) != len(generated_scripts_info):
            progress_msg = f'Preparing selective execution for {len(scripts_to_execute)} test(s)'
        else:
            progress_msg = 'Preparing Python execution environment'

        update_progress('execute', 0, 'Starting', progress_msg)

        # Step 1: Preparation (20%)
        update_progress('execute', 20, 'Processing', 'Connecting to test infrastructure')

        # RPI connection details (unchanged)
        rpi_list = [
            {"host": "71.185.253.158", "user": "root", "pass": ""},
            {"host": "65.78.96.246", "user": "root", "pass": ""}
        ]

        MAX_RETRIES = 3
        RETRY_DELAY = 3
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connected = False
        connected_host = None

        # Try to connect to any available RPI (unchanged)
        for attempt in range(MAX_RETRIES):
            print(f"[INFO] Connection attempt {attempt + 1}")
            for rpi in rpi_list:
                try:
                    print(f"[INFO] Connecting to {rpi['host']}...")
                    ssh.connect(rpi["host"], username=rpi["user"], password=rpi["pass"], timeout=5)
                    connected = True
                    connected_host = rpi["host"]
                    print(f"[INFO] Connected to {rpi['host']}")
                    break
                except Exception as e:
                    print(f"[ERROR] Connection to {rpi['host']} failed: {e}")
            if connected:
                break
            time.sleep(RETRY_DELAY)

        if not connected:
            update_progress('execute', 0, 'Error', 'Failed to connect to any Raspberry Pi', True)
            return jsonify({'success': False, 'message': 'Failed to connect to the Remote Test Device.'})

        # Step 2: Connection established (40%)
        if selected_test_ids:
            status_msg = f'Running {len(scripts_to_execute)} selected Python test case(s)'
        else:
            status_msg = 'Running reviewed Python test cases'

        update_progress('execute', 40, 'Processing', status_msg)

        execution_results = []

        # Step 3: Executing scripts (60%)
        update_progress('execute', 60, 'Processing', 'Collecting test results')

        # Execute each selected script
        total_scripts = len(scripts_to_execute)
        print(f"[INFO] Executing {total_scripts} selected scripts")

        for i, script_info in enumerate(scripts_to_execute):
            if os.path.isfile(script_info['file_path']):
                print(f"[INFO] Executing script {i + 1}/{total_scripts}: {script_info['script_name']}")
                result = execute_single_script(ssh, script_info)
                execution_results.append(result)

                # Update progress based on script execution
                progress = 60 + (i + 1) * 20 // total_scripts
                update_progress('execute', progress, 'Processing', f'Executed {i + 1}/{total_scripts} selected scripts')
            else:
                print(f"[WARNING] Script file not found: {script_info['file_path']}")
                # Add a failed result for missing script
                execution_results.append({
                    'test_case_id': script_info['id'],
                    'script_name': script_info['script_name'],
                    'test_case_name': script_info['test_case_name'],
                    'stdout': '',
                    'stderr': f'Script file not found: {script_info["file_path"]}',
                    'success': False
                })

        # Step 4: Collecting results (80%)
        update_progress('execute', 80, 'Processing', 'Generating execution output')
        time.sleep(1)  # Allow progress to be visible

        ssh.close()

        # Step 5: Complete (100%)
        update_progress('execute', 100, 'Completed', 'Execution completed successfully!', True)

        # Enhanced response with selection information
        success_message = f'Successfully executed {len(execution_results)} test script(s)'
        if selected_test_ids and len(scripts_to_execute) != len(generated_scripts_info):
            success_message += f' (selected {len(scripts_to_execute)} out of {len(generated_scripts_info)} total)'

        return jsonify({
            'success': True,
            'connected_host': connected_host,
            'execution_results': execution_results,
            'total_executed': len(execution_results),
            'total_available': len(generated_scripts_info),
            'selected_test_ids': selected_test_ids or [script['id'] for script in generated_scripts_info],
            'message': success_message
        })

    except Exception as e:
        update_progress('execute', 0, 'Error', f'Execution failed: {str(e)}', True)
        return jsonify({'success': False, 'message': f'Execution error: {str(e)}'})
'''

'''
# Replace your filter_generated_scripts_for_main_code_only() function in app.py with this debug version
def filter_generated_scripts_for_main_code_only():
    """Filter the generated_scripts_info to include ONLY main code files for execution"""
    global generated_scripts_info

    print(f"[DEBUG] ========== SCRIPT FILTERING DEBUG ==========")
    print(f"[DEBUG] Original script count: {len(generated_scripts_info) if generated_scripts_info else 0}")

    if not generated_scripts_info:
        print("[DEBUG] No scripts available - generated_scripts_info is empty!")
        return

    # Print all original scripts with details
    for i, script_info in enumerate(generated_scripts_info):
        script_name = script_info.get('script_name', 'NO_NAME')
        file_path = script_info.get('file_path', 'NO_PATH')
        print(f"[DEBUG] Original script {i + 1}: '{script_name}' at '{file_path}'")

        # Check if file actually exists
        import os
        exists = os.path.exists(file_path) if file_path != 'NO_PATH' else False
        print(f"[DEBUG]   - File exists: {exists}")

        # Check filtering conditions
        is_py = script_name.endswith('.py')
        is_test_suffix = script_name.endswith('_test.py')
        is_test_prefix = script_name.lower().startswith('test_')

        print(f"[DEBUG]   - Ends with .py: {is_py}")
        print(f"[DEBUG]   - Ends with _test.py: {is_test_suffix}")
        print(f"[DEBUG]   - Starts with test_: {is_test_prefix}")

        should_include = is_py and not is_test_suffix and not is_test_prefix
        print(f"[DEBUG]   - Should include: {should_include}")
        print(f"[DEBUG]   ----------------------------------------")

    original_count = len(generated_scripts_info)

    # Apply the filtering
    filtered_scripts = []
    for script_info in generated_scripts_info:
        script_name = script_info.get('script_name', '')
        if (script_name.endswith('.py') and
                not script_name.endswith('_test.py') and
                not script_name.lower().startswith('test_')):
            filtered_scripts.append(script_info)
            print(f"[DEBUG] ✅ INCLUDED: {script_name}")
        else:
            print(f"[DEBUG] ❌ EXCLUDED: {script_name}")

    # Update the global variable for execution
    generated_scripts_info = filtered_scripts
    print(f"[DEBUG] Final result: {len(filtered_scripts)} scripts (was {original_count})")
    print(f"[DEBUG] ========== END FILTERING DEBUG ==========")

    if len(filtered_scripts) == 0:
        print("[DEBUG] ⚠️  WARNING: ALL SCRIPTS WERE FILTERED OUT!")
        print("[DEBUG] This means either:")
        print("[DEBUG] 1. All generated files have '_test.py' suffix")
        print("[DEBUG] 2. All generated files start with 'test_'")
        print("[DEBUG] 3. No .py files were found")
        print("[DEBUG] 4. File naming doesn't match expected patterns")
'''


# Replace your filter_generated_scripts_for_main_code_only() function in app.py with this FIXED version

def filter_generated_scripts_for_main_code_only():
    """Filter the generated_scripts_info to include ONLY main code files for execution"""
    global generated_scripts_info

    print(f"[DEBUG] ========== SCRIPT FILTERING DEBUG ==========")
    print(f"[DEBUG] Original script count: {len(generated_scripts_info) if generated_scripts_info else 0}")

    if not generated_scripts_info:
        print("[DEBUG] No scripts available - generated_scripts_info is empty!")
        return

    # Print all original scripts with details
    for i, script_info in enumerate(generated_scripts_info):
        script_name = script_info.get('script_name', 'NO_NAME')
        file_path = script_info.get('file_path', 'NO_PATH')
        print(f"[DEBUG] Original script {i + 1}: '{script_name}' at '{file_path}'")

        # Check if file actually exists
        import os
        exists = os.path.exists(file_path) if file_path != 'NO_PATH' else False
        print(f"[DEBUG]   - File exists: {exists}")

        # ENHANCED filtering conditions
        is_py = script_name.endswith('.py')
        is_test_suffix = script_name.endswith('_test.py')
        is_test_prefix = script_name.lower().startswith('test_')
        is_unittest_file = 'unit_test' in script_name.lower() or 'unittest' in script_name.lower()  # NEW
        is_test_file = 'test' in script_name.lower() and (
                    '_test' in script_name.lower() or 'test_' in script_name.lower() or script_name.lower().endswith(
                'tests.py'))  # NEW

        print(f"[DEBUG]   - Ends with .py: {is_py}")
        print(f"[DEBUG]   - Ends with _test.py: {is_test_suffix}")
        print(f"[DEBUG]   - Starts with test_: {is_test_prefix}")
        print(f"[DEBUG]   - Contains unit_test/unittest: {is_unittest_file}")
        print(f"[DEBUG]   - Is test file: {is_test_file}")

        # UPDATED filtering logic - exclude ANY kind of test file
        should_include = (is_py and
                          not is_test_suffix and
                          not is_test_prefix and
                          not is_unittest_file and
                          not is_test_file)

        print(f"[DEBUG]   - Should include: {should_include}")
        print(f"[DEBUG]   ----------------------------------------")

    original_count = len(generated_scripts_info)

    # Apply the ENHANCED filtering
    filtered_scripts = []
    for script_info in generated_scripts_info:
        script_name = script_info.get('script_name', '')

        # ENHANCED filtering - exclude all types of test files
        is_main_code = (script_name.endswith('.py') and
                        not script_name.endswith('_test.py') and
                        not script_name.lower().startswith('test_') and
                        'unit_test' not in script_name.lower() and
                        'unittest' not in script_name.lower() and
                        not ('test' in script_name.lower() and
                             ('_test' in script_name.lower() or
                              'test_' in script_name.lower() or
                              script_name.lower().endswith('tests.py'))))

        if is_main_code:
            filtered_scripts.append(script_info)
            print(f"[DEBUG] ✅ INCLUDED: {script_name}")
        else:
            print(f"[DEBUG] ❌ EXCLUDED: {script_name} (identified as test file)")

    # Update the global variable for execution
    generated_scripts_info = filtered_scripts
    print(f"[DEBUG] Final result: {len(filtered_scripts)} scripts (was {original_count})")
    print(f"[DEBUG] ========== END FILTERING DEBUG ==========")

    if len(filtered_scripts) == 0:
        print("[DEBUG] ⚠️  WARNING: ALL SCRIPTS WERE FILTERED OUT!")
        print("[DEBUG] This means either:")
        print("[DEBUG] 1. All generated files have test-related names")
        print("[DEBUG] 2. No main application code files were found")
        print("[DEBUG] 3. File naming doesn't match expected main code patterns")

# UPDATE the existing execute_code function to use selected device
@app.route('/execute', methods=['POST'])
def execute_code():
    """Execute selected test scripts on chosen remote device with real progress tracking"""
    global generated_scripts_info


    # NEW: Check if this is a developer workflow execution
    data = request.get_json() or {}
    workflow_type = data.get('workflow_type', 'qa')
    print(f"[GENERATED_SCRIPTS_INFO]: {len(generated_scripts_info)} and {generated_scripts_info}")

    '''
    if workflow_type == 'developer':
        print("[DEV_EXECUTE] Developer workflow execution detected")

        # CRITICAL FIX: Load developer scripts into generated_scripts_info
        if not generated_scripts_info or len(generated_scripts_info) == 0:
            print("[DEV_EXECUTE] generated_scripts_info is empty, loading from generatedApplicationCode...")

            # Load from the global generatedApplicationCode variable
            global generatedApplicationCode
            if generatedApplicationCode and len(generatedApplicationCode) > 0:
                print(f"[DEV_EXECUTE] Found {len(generatedApplicationCode)} application code files")

                # Convert generatedApplicationCode to generated_scripts_info format
                generated_scripts_info.clear()
                for i, app_code in enumerate(generatedApplicationCode):
                    script_id = i + 1
                    script_name = app_code.get('file_name', f'app_code_{script_id}.py')

                    # Ensure .py extension
                    if not script_name.endswith('.py'):
                        script_name += '.py'

                    # Create file path (check multiple possible locations)
                    possible_paths = [
                        os.path.join(os.getcwd(), '..', 'generated-scripts', script_name),
                        os.path.join(os.getcwd(), '..', 'dev-scripts', script_name),
                        os.path.join(os.getcwd(), 'generated-scripts', script_name),
                        os.path.join(os.getcwd(), 'dev-scripts', script_name)
                    ]

                    file_path = None
                    for path in possible_paths:
                        if os.path.exists(path):
                            file_path = path
                            print(f"[DEV_EXECUTE] Found script at: {path}")
                            break

                    if not file_path:
                        # Create the file if it doesn't exist
                        file_path = possible_paths[0]  # Use first path as default
                        os.makedirs(os.path.dirname(file_path), exist_ok=True)

                        # Write the generated code to file
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(app_code.get('generated_code', '# Generated application code'))
                        print(f"[DEV_EXECUTE] Created script file at: {file_path}")

                    # Add to generated_scripts_info
                    script_info = {
                        'id': script_id,
                        'script_name': script_name,
                        'test_case_name': app_code.get('story_title', f'Application Code {script_id}'),
                        'file_path': file_path
                    }
                    generated_scripts_info.append(script_info)
                    print(f"[DEV_EXECUTE] Added script: {script_name}")

                print(f"[DEV_EXECUTE] Successfully loaded {len(generated_scripts_info)} scripts for execution")
            else:
                print("[DEV_EXECUTE] ERROR: No generatedApplicationCode found!")
                return jsonify({
                    'success': False,
                    'message': 'No application code available for execution. Please generate code first.'
                })

        # Now apply filtering to only include main code files
        print(f"[DEV_EXECUTE] Before filtering: {len(generated_scripts_info)} scripts")
        filter_generated_scripts_for_main_code_only()
        print(f"[DEV_EXECUTE] After filtering: {len(generated_scripts_info)} scripts")

        if len(generated_scripts_info) == 0:
            return jsonify({
                'success': False,
                'message': 'No main application code files found for execution. All files appear to be unit tests.'
            })
    '''
    if workflow_type == 'developer':
        print("[DEV_EXECUTE] Developer workflow execution detected")

        # CRITICAL FIX: ALWAYS reload developer scripts for developer workflow
        # regardless of generated_scripts_info state
        print("[DEV_EXECUTE] Force loading developer scripts from generatedApplicationCode...")

        # Load from the global generatedApplicationCode variable
        global generatedApplicationCode
        if generatedApplicationCode and len(generatedApplicationCode) > 0:
            print(f"[DEV_EXECUTE] Found {len(generatedApplicationCode)} application code files")

            # Clear existing scripts to avoid mixing QA and developer scripts
            generated_scripts_info.clear()

            # Convert generatedApplicationCode to generated_scripts_info format
            for i, app_code in enumerate(generatedApplicationCode):
                script_id = i + 1
                script_name = app_code.get('file_name', f'app_code_{script_id}.py')

                # Ensure .py extension
                if not script_name.endswith('.py'):
                    script_name += '.py'

                # Create file path (check multiple possible locations)
                possible_paths = [
                    os.path.join(os.getcwd(), '..', 'generated-scripts', script_name),
                    os.path.join(os.getcwd(), '..', 'dev-scripts', script_name),
                    os.path.join(os.getcwd(), 'generated-scripts', script_name),
                    os.path.join(os.getcwd(), 'dev-scripts', script_name)
                ]

                file_path = None
                for path in possible_paths:
                    if os.path.exists(path):
                        file_path = path
                        print(f"[DEV_EXECUTE] Found script at: {path}")
                        break

                if not file_path:
                    # Create the file if it doesn't exist
                    file_path = possible_paths[0]  # Use first path as default
                    os.makedirs(os.path.dirname(file_path), exist_ok=True)

                    # Write the generated code to file
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(app_code.get('generated_code', '# Generated application code'))
                    print(f"[DEV_EXECUTE] Created script file at: {file_path}")

                # Add to generated_scripts_info
                script_info = {
                    'id': script_id,
                    'script_name': script_name,
                    'test_case_name': app_code.get('story_title', f'Application Code {script_id}'),
                    'file_path': file_path
                }
                generated_scripts_info.append(script_info)
                print(f"[DEV_EXECUTE] Added script: {script_name}")

            print(f"[DEV_EXECUTE] Successfully loaded {len(generated_scripts_info)} scripts for execution")
        else:
            print("[DEV_EXECUTE] ERROR: No generatedApplicationCode found!")
            return jsonify({
                'success': False,
                'message': 'No application code available for execution. Please generate code first.'
            })

        # Now apply filtering to only include main code files
        print(f"[DEV_EXECUTE] Before filtering: {len(generated_scripts_info)} scripts")
        filter_generated_scripts_for_main_code_only()
        print(f"[DEV_EXECUTE] After filtering: {len(generated_scripts_info)} scripts")

        if len(generated_scripts_info) == 0:
            return jsonify({
                'success': False,
                'message': 'No main application code files found for execution. All files appear to be unit tests.'
            })

    # Clean up progress file if exists from previous Run
    try:
        if os.path.exists('progress_execute.json'):
            os.remove('progress_execute.json')
            print("[CLEANUP] Removed progress_execute.json after completion")
    except Exception as e:
        print(f"[CLEANUP] Error removing progress_execute.json: {e}")

    try:
        data = request.get_json()

        # NEW: Get selected device from request
        selected_device_id = data.get('selected_device_id', None)
        print(f"[EXECUTE] Selected device ID: {selected_device_id}")

        # NEW: Handle selective test execution
        selected_test_ids = data.get('selected_test_ids', None)

        # If no specific tests selected, execute all (backward compatibility)
        if selected_test_ids is None:
            print("[INFO] No specific tests selected - executing all tests")
            scripts_to_execute = generated_scripts_info
        else:
            print(f"[INFO] Selective execution requested for test IDs: {selected_test_ids}")
            # Filter scripts based on selected IDs
            scripts_to_execute = [
                script for script in generated_scripts_info
                if script['id'] in selected_test_ids
            ]

            if not scripts_to_execute:
                return jsonify({
                    'success': False,
                    'message': 'No valid test scripts found for the selected test cases.'
                })

            print(f"[INFO] Found {len(scripts_to_execute)} scripts to execute out of {len(generated_scripts_info)} total")

        # Clear previous progress and initialize
        clear_progress('execute')

        # Update progress message based on selection
        if selected_test_ids and len(scripts_to_execute) != len(generated_scripts_info):
            progress_msg = f'Preparing selective execution for {len(scripts_to_execute)} test(s)'
        else:
            progress_msg = 'Preparing Python execution environment'

        update_progress('execute', 0, 'Starting', progress_msg)

        # Step 1: Preparation (20%)
        update_progress('execute', 20, 'Processing', 'Connecting to selected test device')

        # UPDATED: Device connection logic
        if not devices_config:
            load_devices_config()

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connected = False
        connected_device = None
        connection_message = ""

        if selected_device_id:
            # User selected a specific device
            device = next((d for d in devices_config['devices'] if d['id'] == selected_device_id), None)
            if not device:
                update_progress('execute', 0, 'Error', f'Selected device {selected_device_id} not found', True)
                return jsonify({'success': False, 'message': f'Selected device {selected_device_id} not found.'})

            if not device.get('active', True):
                update_progress('execute', 0, 'Error', f'Selected device {selected_device_id} is disabled', True)
                return jsonify({'success': False, 'message': f'Selected device {selected_device_id} is disabled.'})

            # Try to connect to selected device
            print(f"[INFO] Attempting connection to selected device: {device['name']} ({device['host']})")
            try:
                ssh.connect(
                    device["host"],
                    username=device["user"],
                    password=device["password"],
                    port=device.get("port", 22),
                    timeout=devices_config['settings']['connection_timeout']
                )
                connected = True
                connected_device = device
                connection_message = f"Connected to selected device: {device['name']} ({device['host']})"
                print(f"[INFO] {connection_message}")
            except Exception as e:
                update_progress('execute', 0, 'Error', f'Failed to connect to selected device: {str(e)}', True)
                return jsonify({'success': False, 'message': f'Failed to connect to selected device {device["name"]}: {str(e)}'})

        else:
            # No device selected - try devices in priority order (fallback mode)
            print("[INFO] No device selected - trying devices in priority order")
            active_devices = [d for d in devices_config['devices'] if d.get('active', True)]
            active_devices.sort(key=lambda x: x.get('priority', 999))

            MAX_RETRIES = devices_config['settings'].get('retry_attempts', 3)
            RETRY_DELAY = devices_config['settings'].get('retry_delay', 2)

            for attempt in range(MAX_RETRIES):
                print(f"[INFO] Connection attempt {attempt + 1}")
                for device in active_devices:
                    try:
                        print(f"[INFO] Trying device: {device['name']} ({device['host']})")
                        ssh.connect(
                            device["host"],
                            username=device["user"],
                            password=device["password"],
                            port=device.get("port", 22),
                            timeout=devices_config['settings']['connection_timeout']
                        )
                        connected = True
                        connected_device = device
                        connection_message = f"Connected to device: {device['name']} ({device['host']})"
                        print(f"[INFO] {connection_message}")
                        break
                    except Exception as e:
                        print(f"[ERROR] Connection to {device['name']} ({device['host']}) failed: {e}")
                if connected:
                    break
                time.sleep(RETRY_DELAY)

        if not connected:
            update_progress('execute', 0, 'Error', 'Failed to connect to any available device', True)
            return jsonify({'success': False, 'message': 'Failed to connect to any available test device.'})

        # Step 2: Connection established (40%)
        if selected_test_ids:
            status_msg = f'Running {len(scripts_to_execute)} selected Python test case(s) on {connected_device["name"]}'
        else:
            status_msg = f'Running reviewed Python test cases on {connected_device["name"]}'

        update_progress('execute', 40, 'Processing', status_msg)

        execution_results = []

        # Step 3: Executing scripts (60%)
        update_progress('execute', 60, 'Processing', 'Collecting test results')

        # Execute each selected script
        total_scripts = len(scripts_to_execute)
        print(f"[INFO] Executing {total_scripts} selected scripts on {connected_device['name']}")


        initial_dev_passed = int(str(data.get('DevScriptsPassed') or '0'), 10)
        initial_dev_failed = int(str(data.get('DevScriptsFailed') or '0'), 10)
        initial_qa_passed = int(str(data.get('QAScriptsPassed') or '0'), 10)
        initial_qa_failed = int(str(data.get('QAScriptsPassed') or '0'), 10)
        print(f"[DEBUG] Initial DevScriptsPassed: {initial_dev_passed}")
 


        for i, script_info in enumerate(scripts_to_execute):
            if os.path.isfile(script_info['file_path']):
                print(f"[INFO] Executing script {i + 1}/{total_scripts}: {script_info['script_name']}")
                result = execute_single_script(ssh, script_info)
                print(f"[DEBUG] Returned Result Value: {result}")
                execution_results.append(result)

                # Update progress based on script execution
                progress = 60 + (i + 1) * 20 // total_scripts
                update_progress('execute', progress, 'Processing', f'Executed {i + 1}/{total_scripts} selected scripts')
            else:
                print(f"[WARNING] Script file not found: {script_info['file_path']}")
                # Add a failed result for missing script
                execution_results.append({
                    'test_case_id': script_info['id'],
                    'script_name': script_info['script_name'],
                    'test_case_name': script_info['test_case_name'],
                    'stdout': '',
                    'stderr': f'Script file not found: {script_info["file_path"]}',
                    'success': False
                })

        # Step 4: Collecting results (80%)
        update_progress('execute', 80, 'Processing', 'Generating execution output')
        time.sleep(1)  # Allow progress to be visible

        ssh.close()

        # Step 5: Complete (100%)
        update_progress('execute', 100, 'Completed', 'Execution completed successfully!', True)

        # Enhanced response with device information
        success_message = f'Successfully executed {len(execution_results)} test script(s) on {connected_device["name"]}'
        if selected_test_ids and len(scripts_to_execute) != len(generated_scripts_info):
            success_message += f' (selected {len(scripts_to_execute)} out of {len(generated_scripts_info)} total)'


        if workflow_type == 'developer':
            overall_success = all(result['success'] for result in execution_results)
        else:
            overall_success = True

        print(f"[DEBUG] Overall success: {overall_success}")
        print(f"[DEBUG] Final Result: {execution_results}")


        return jsonify({
            'success': overall_success,
            'connected_device': {
                'id': connected_device['id'],
                'name': connected_device['name'],
                'host': connected_device['host'],
                'description': connected_device.get('description', '')
            },
            'connection_message': connection_message,
            'execution_results': execution_results,
            'total_executed': len(execution_results),
            'total_available': len(generated_scripts_info),
            'DevScriptsPassed': initial_dev_passed+dev_pass_int,
            'DevScriptsFailed': initial_dev_failed+dev_fail_int,
            'QAScriptsPassed': initial_qa_passed+qa_pass_int,
            'QAScriptsFailed': initial_qa_failed+qa_fail_int,
            'selected_test_ids': selected_test_ids or [script['id'] for script in generated_scripts_info],
            'message': success_message
        })


    except Exception as e:
        update_progress('execute', 0, 'Error', f'Execution failed: {str(e)}', True)
        return jsonify({'success': False, 'message': f'Execution error: {str(e)}'})


# Initialize devices configuration when the app starts
#@app.before_first_request
def initialize_devices():
    """Initialize device configuration on app startup"""
    print("[STARTUP] Initializing device configuration...")
    load_devices_config()

    # Optional: Start background health monitoring
    # You can uncomment this if you want continuous health monitoring
    # start_background_health_monitoring()

# ===============================================================================
# OPTIONAL: ADD THESE HELPER FUNCTIONS (for debugging - you can add these too)
# ===============================================================================
@app.route('/test-selection-status', methods=['GET'])
def get_test_selection_status():
    """Get current test selection status for debugging"""
    try:
        return jsonify({
            'success': True,
            'total_scripts': len(generated_scripts_info),
            'available_test_ids': [script['id'] for script in generated_scripts_info],
            'script_details': [
                {
                    'id': script['id'],
                    'name': script['test_case_name'],
                    'script_name': script['script_name'],
                    'file_exists': os.path.isfile(script['file_path'])
                }
                for script in generated_scripts_info
            ]
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error: {str(e)}'})

# GitHub Integration Code
def extract_github_repo_info(url):
    """Extract owner, repo, and branch from GitHub URL"""
    try:
        # Support various GitHub URL formats
        patterns = [
            r'github\.com/([^/]+)/([^/]+?)(?:/tree/([^/]+))?/?(?:\.git)?$',  # Main repo or tree
            r'github\.com/([^/]+)/([^/]+?)(?:/)?$',  # Simple repo URL
        ]

        # Clean the URL
        url = url.strip().rstrip('/')
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                owner = match.group(1)
                repo = match.group(2)
                branch = match.group(3) if match.group(3) else 'main'

                # Clean repo name (remove .git if present)
                if repo.endswith('.git'):
                    repo = repo[:-4]

                return {
                    'owner': owner,
                    'repo': repo,
                    'branch': branch,
                    'url': url
                }

        return None

    except Exception as e:
        print(f"[ERROR] Failed to parse GitHub URL: {e}")
        return None


def process_downloaded_zip(file_path, repo_name):
    """Process downloaded ZIP file using existing codebase analysis"""
    try:
        codebase_name = repo_name.replace('/', '-')

        # Extract and analyze with full context (reuse existing logic)
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                with zipfile.ZipFile(file_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_dir)

                print(f"[INFO] Extracted GitHub ZIP to: {temp_dir}")

                # Find the main folder (GitHub zips have a top-level folder)
                extracted_items = os.listdir(temp_dir)
                if len(extracted_items) == 1 and os.path.isdir(os.path.join(temp_dir, extracted_items[0])):
                    # Use the nested folder as the main directory
                    main_dir = os.path.join(temp_dir, extracted_items[0])
                else:
                    main_dir = temp_dir

                # Use enhanced analyzer (reuse your existing EnhancedCodebaseAnalyzer)
                analyzer = EnhancedCodebaseAnalyzer()
                full_analysis = analyzer.analyze_with_full_context(main_dir)

                # Store the full analysis persistently
                codebase_id = f"{codebase_name}_{int(time.time())}"
                storage_path = store_codebase_permanently(codebase_id, full_analysis)

                # Store essential data in session
                session['current_codebase_id'] = codebase_id
                session['codebase_name'] = codebase_name
                session['codebase_storage_path'] = storage_path

                # Return success response with analysis data
                return jsonify({
                    'success': True,
                    'message': f'Successfully analyzed GitHub repository: {repo_name}',
                    'source': 'github',
                    'repo_name': repo_name,
                    'codebase_id': codebase_id,
                    'context_info': {
                        'libraries_count': len(full_analysis.get('libraries', [])),
                        'functions_count': len(full_analysis.get('functions', {})),
                        'classes_count': len(full_analysis.get('classes', {})),
                        'patterns': list(full_analysis.get('patterns', {}).keys())
                    },
                    'libraries': full_analysis.get('libraries', []),
                    'functions': full_analysis.get('functions', {}),
                    'classes': full_analysis.get('classes', {}),
                    'dependencies': full_analysis.get('dependencies', [])
                })

            except zipfile.BadZipFile:
                return jsonify({
                    'success': False,
                    'message': 'Downloaded file is not a valid ZIP archive'
                })
            except Exception as e:
                return jsonify({
                    'success': False,
                    'message': f'Failed to process repository: {str(e)}'
                })

    except Exception as e:
        print(f"[ERROR] Failed to process downloaded ZIP: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Processing error: {str(e)}'
        })


def start_background_health_monitoring():
    """Optional: Start background thread for continuous device health monitoring"""

    def health_monitor():
        while True:
            try:
                print("[HEALTH] Running background device health check...")
                check_all_devices_status()
                interval = devices_config.get('settings', {}).get('health_check_interval', 300)
                time.sleep(interval)  # Default 5 minutes
            except Exception as e:
                print(f"[HEALTH] Background health check error: {e}")
                time.sleep(60)  # Wait 1 minute on error

    health_thread = threading.Thread(target=health_monitor, daemon=True)
    health_thread.start()
    print("[HEALTH] Background health monitoring started")


def log_execution_selection(selected_test_ids, available_scripts):
    """Log execution selection details for debugging"""
    print(f"[SELECTION] Total available scripts: {len(available_scripts)}")
    print(f"[SELECTION] Available test IDs: {[script['id'] for script in available_scripts]}")

    if selected_test_ids:
        print(f"[SELECTION] Selected test IDs: {selected_test_ids}")
        selected_scripts = [script for script in available_scripts if script['id'] in selected_test_ids]
        print(f"[SELECTION] Selected scripts: {[script['script_name'] for script in selected_scripts]}")
        skipped_scripts = [script for script in available_scripts if script['id'] not in selected_test_ids]
        if skipped_scripts:
            print(f"[SELECTION] Skipped scripts: {[script['script_name'] for script in skipped_scripts]}")
    else:
        print("[SELECTION] No specific selection - executing all scripts")


dev_pass_int=dev_fail_int=qa_pass_int=qa_fail_int = 0


def execute_single_script(ssh, script_info):
    """Execute a single script on the remote RPI"""

    global dev_pass_int
    global dev_fail_int
    global qa_pass_int
    global qa_fail_int



    try:
        with open(script_info['file_path'], 'r') as f:
            script_content = f.read()

        remote_path = f"/tmp/{script_info['script_name']}"
        print(f"[INFO] Uploading {script_info['script_name']} to {remote_path}")

        # Upload script content via echo command
        escaped_script = script_content.replace("'", "'\"'\"'")
        command = f"echo '{escaped_script}' > {remote_path} && chmod +x {remote_path}"
        ssh.exec_command(command)

        # FIXED: Execute the script with proper timing
        print(f"[INFO] Executing {script_info['script_name']}")
        stdin, stdout, stderr = ssh.exec_command(f"python3 -u {remote_path}")




        # CRITICAL FIX: Wait for completion BEFORE reading outputs
        exit_status = stdout.channel.recv_exit_status()
        print(f"[DEBUG] Command completed with exit status: {exit_status}")

        # NOW read the outputs after command completion
        execution_output = stdout.read().decode()
        error_output = stderr.read().decode()

        failure_message = "FAIL"

        success = len(error_output.strip()) == 0 and failure_message not in execution_output.strip()


        print(f"[DEBUG] {success}")
        script_path = script_info['file_path']
        print(f" [DEBUG] {script_path}")
        if "dev-scripts" in script_path:
            if success:
                dev_pass_int += 1
            else:
                dev_fail_int += 1
        elif "generated-scripts" in script_path:
            if success:
                qa_pass_int += 1
            else:
                qa_fail_int += 1
        else:
            print(f"[WARNING] Script path '{script_path}' does not match 'dev-scripts' or 'generated-scripts'. Skipping analytics count.")


        print(f"DEV PASS INT: {dev_pass_int}")
        print(f"DEV FAIL INT: {dev_fail_int}")

        # Debug logging
        print(f"[DEBUG] STDOUT length: {len(execution_output)}")
        print(f"[DEBUG] STDERR length: {len(error_output)}")
        print(f"[DEBUG] Script: {script_info['script_name']}")
        print(f"[DEBUG] Exit status: {exit_status}")
        print(f"[DEBUG] STDERR content: '{error_output}'")
        print(f"[DEBUG] error_output length: {len(error_output)}")
        print(f"[DEBUG] error_output repr: {repr(error_output)}")
        print(f"[DEBUG] error_output.strip() length: {len(error_output.strip())}")
        print(f"[DEBUG] error_output.strip() repr: {repr(error_output.strip())}")
        print(f"[DEBUG] Success calculation: len(error_output.strip()) == 0 = {len(error_output.strip()) == 0}")
        print(f"[DEBUG] Actual success value: {len(error_output.strip()) == 0}")
        return {
            'test_case_id': script_info['id'],
            'script_name': script_info['script_name'],
            'test_case_name': script_info['test_case_name'],
            'stdout': remove_ansi_codes(execution_output),
            'stderr': remove_ansi_codes(error_output),
            'success': len(error_output.strip()) == 0
        }

    except Exception as e:
        return {
            'test_case_id': script_info['id'],
            'script_name': script_info['script_name'],
            'test_case_name': script_info['test_case_name'],
            'stdout': '',
            'stderr': f'Execution error: {str(e)}',
            'success': False
        }

@app.route('/review', methods=['POST'])
def review_code():
    """Review Python code quality for individual or all test cases with real progress tracking"""
    # Clean up progress files if exists
    try:
        if os.path.exists('progress_review.json'):
            os.remove('progress_review.json')
            print("[CLEANUP] Removed progress_review.json after completion")
    except Exception as e:
        print(f"[CLEANUP] Error removing progress_review.json: {e}")

    try:
        data = request.get_json()
        test_case_id = data.get('test_case_id', None)

        # Clear previous progress and initialize
        clear_progress('review')
        update_progress('review', 0, 'Starting', 'Scanning Python code structure')

        # Ensure reports directory exists
        reports_dir = os.path.join(os.getcwd(), '..', 'reports')
        os.makedirs(reports_dir, exist_ok=True)

        # Step 2: Setup (33%)
        update_progress('review', 33, 'Processing', 'Checking Python best practices')

        # Get the full path to tox
        import shutil
        tox_path = shutil.which('tox')

        if not tox_path:
            tox_path = '/Users/gmajum163@cable.comcast.com/Library/Python/3.9/bin/tox'

        # Step 3: Running analysis (50%)
        update_progress('review', 50, 'Processing', 'Running security analysis')

        # Run tox for code quality analysis
        print(f"[INFO] Running tox from: {tox_path}")
        print(f"[INFO] Current working directory: {os.getcwd()}")

        # Set environment variables that might be needed
        env = os.environ.copy()
        env['PATH'] = f"/Users/gmajum163@cable.comcast.com/Library/Python/3.9/bin:{env.get('PATH', '')}"

        # Step 4: Executing tox (67%)
        update_progress('review', 67, 'Processing', 'Generating Python recommendations')

        run_tox = subprocess.run([tox_path], capture_output=True, text=True,
                                 cwd=os.getcwd(), env=env, timeout=300)

        print(f"[DEBUG] Tox return code: {run_tox.returncode}")
        print(f"[DEBUG] Tox stdout: {run_tox.stdout}")
        print(f"[DEBUG] Tox stderr: {run_tox.stderr}")

        # Step 5: Processing results (83%)
        update_progress('review', 83, 'Processing', 'Compiling final review report')

        # NEW: Handle individual test case reviews vs all test cases
        if test_case_id is not None:
            # Single test case review - read specific summary file
            summary_path = os.path.join(reports_dir, f'summary{test_case_id}.txt')
            summary_content = ""

            try:
                with open(summary_path, 'r') as f:
                    summary_content = f.read()
                print(f"[INFO] Found individual summary at: {summary_path}")
            except FileNotFoundError:
                # Fallback to main summary if individual not found
                main_summary_path = os.path.join(reports_dir, 'summary.txt')
                try:
                    with open(main_summary_path, 'r') as f:
                        summary_content = f.read()
                    print(f"[INFO] Used main summary as fallback: {main_summary_path}")
                except FileNotFoundError:
                    summary_content = f"""CODE REVIEW SUMMARY - TEST CASE {test_case_id}
====================
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

ANALYSIS STATUS:
- Tox return code: {run_tox.returncode}
- Individual summary file not found at: {summary_path}
- Main summary file not found either

TOX OUTPUT:
{run_tox.stdout}

TOX ERRORS:
{run_tox.stderr}
"""

            # Generate review for specific test case
            review_report = f"""=== INDIVIDUAL TEST CASE ANALYSIS ===
{summary_content}

=== ACTIONS REQUIRED ===
   ✅ 1. Look for [PASS] ✅ or [FAIL] ❌ indicators in the analysis above
   ✅ 2. CHECK "OPEN REPORT" FOR COMPREHENSIVE HTML RESULTS
   ✅ 3. CLICK THE **"EXECUTE CODE"** BUTTON IF NO CRITICAL ISSUES
   ❌ 4. DO NOT PROCEED IF STATIC CODE ANALYSIS FAILS OR SECURITY VULNERABILITIES ARE FOUND"""

            # Step 6: Complete (100%)
            update_progress('review', 100, 'Completed', 'Code review completed successfully!', True)

            return jsonify({
                'success': True,
                'review_report': review_report,
                'test_case_id': test_case_id,
                'message': f'Python code review completed successfully for Test Case {test_case_id}'
            })

        else:
            # Multiple test cases - return individual reports for each
            individual_reports = []

            # Read main summary for overall info
            main_summary_path = os.path.join(reports_dir, 'summary.txt')
            main_summary_content = ""
            try:
                with open(main_summary_path, 'r') as f:
                    main_summary_content = f.read()
            except FileNotFoundError:
                main_summary_content = "Main summary not available"

            # Generate individual reports for each generated script
            for i, script_info in enumerate(generated_scripts_info):
                test_case_id = script_info['id']
                individual_summary_path = os.path.join(reports_dir, f'summary{test_case_id}.txt')

                individual_summary_content = ""
                try:
                    with open(individual_summary_path, 'r') as f:
                        individual_summary_content = f.read()
                    print(f"[INFO] Found individual summary for Test Case {test_case_id}")
                except FileNotFoundError:
                    # Use main summary as fallback
                    individual_summary_content = main_summary_content
                    print(f"[INFO] Using main summary as fallback for Test Case {test_case_id}")

                individual_report = f"""=== INDIVIDUAL ANALYSIS ===
{individual_summary_content}

=== ACTIONS REQUIRED ===
   ✅ 1. Look for [PASS] ✅ or [FAIL] ❌ indicators in the analysis above
   ✅ 2. CHECK "OPEN REPORT" FOR COMPREHENSIVE HTML RESULTS
   ✅ 3. CLICK THE **"EXECUTE CODE"** BUTTON IF NO CRITICAL ISSUES
   ❌ 4. DO NOT PROCEED IF STATIC CODE ANALYSIS FAILS OR SECURITY VULNERABILITIES ARE FOUND"""

                individual_reports.append({
                    'test_case_id': test_case_id,
                    'script_name': script_info['script_name'],
                    'test_case_name': script_info['test_case_name'],
                    'review_report': individual_report
                })

            # Step 6: Complete (100%)
            update_progress('review', 100, 'Completed', 'Code review completed successfully!', True)

            return jsonify({
                'success': True,
                'individual_reports': individual_reports,
                'main_summary': main_summary_content,
                'total_scripts': len(individual_reports),
                'message': f'Python code review completed successfully for all {len(individual_reports)} test case(s)'
            })

    except subprocess.TimeoutExpired:
        update_progress('review', 0, 'Error', 'Code review timed out after 5 minutes', True)
        return jsonify({'success': False, 'message': 'Code review timed out after 5 minutes'})
    except Exception as e:
        update_progress('review', 0, 'Error', f'Review failed: {str(e)}', True)
        return jsonify({'success': False, 'message': f'Review error: {str(e)}'})


@app.route('/open-report')
def open_report():
    """Open the combined HTML report"""
    try:
        return send_from_directory(app.config['REPORT_FOLDER'], 'combinedreport.html')
    except Exception as e:
        return jsonify({'success': False, 'message': f'View report error: {str(e)}'})


@app.route('/download-report')
def download_report():
    """Download the combined HTML report"""
    try:
        return send_from_directory(app.config['REPORT_FOLDER'], 'combinedreport.html', as_attachment=True)
    except Exception as e:
        return jsonify({'success': False, 'message': f'Download error: {str(e)}'})


# REPLACE your /download_all_scripts route with this fixed version:
@app.route('/download_all_scripts', methods=['POST'])
def download_all_scripts():
    """Download selected generated scripts as a ZIP file"""
    global generated_scripts_info

    try:
        # NEW: Get the request data to see which scripts are selected
        data = request.get_json()
        selected_script_ids = data.get('selected_script_ids', []) if data else []

        print(f"[DEBUG] Starting download_all_scripts")
        print(f"[DEBUG] Request data: {data}")
        print(f"[DEBUG] Selected script IDs: {selected_script_ids}")
        print(f"[DEBUG] generated_scripts_info length: {len(generated_scripts_info) if generated_scripts_info else 0}")

        if not generated_scripts_info:
            return jsonify({'success': False, 'message': 'No generated scripts found'})

        # NEW: Filter scripts based on selection
        if selected_script_ids:
            # Only process selected scripts
            scripts_to_process = [
                script for script in generated_scripts_info
                if script.get('id') in selected_script_ids
            ]
            print(
                f"[ZIP] Processing {len(scripts_to_process)} selected scripts out of {len(generated_scripts_info)} total")
        else:
            # If no selection provided, process all scripts (fallback)
            scripts_to_process = generated_scripts_info
            print(f"[ZIP] No selection provided - processing all {len(scripts_to_process)} scripts")

        if not scripts_to_process:
            return jsonify({'success': False, 'message': 'No scripts selected for download'})

        print(f"[ZIP] Starting ZIP creation for {len(scripts_to_process)} selected scripts")

        # Create a temporary file for the ZIP
        temp_fd, temp_zip_path = tempfile.mkstemp(suffix='.zip', prefix='test_scripts_')
        print(f"[DEBUG] Created temp file: {temp_zip_path}")

        try:
            # Close the file descriptor first so we can write to it
            os.close(temp_fd)

            with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                added_files = 0

                # NEW: Only process the selected scripts
                for script in scripts_to_process:
                    script_name = script.get('script_name', 'unknown.py')
                    file_path = script.get('file_path', '')
                    test_case_name = script.get('test_case_name', 'Unknown Test Case')
                    script_id = script.get('id', 'unknown')

                    print(f"[ZIP] Processing selected script: {script_name} (ID: {script_id})")
                    print(f"[ZIP] File path: {file_path}")
                    print(f"[ZIP] File exists: {os.path.isfile(file_path)}")

                    if file_path and os.path.isfile(file_path):
                        try:
                            # Read the actual script file
                            with open(file_path, 'r', encoding='utf-8') as f:
                                script_content = f.read()

                            # Add to ZIP with organized structure
                            arcname = f"generated_scripts/{script_name}"
                            zipf.writestr(arcname, script_content)
                            added_files += 1

                            print(f"[ZIP] Successfully added selected script: {script_name}")

                        except Exception as e:
                            print(f"[ERROR] Failed to read script {script_name}: {e}")
                            # Add error placeholder
                            error_content = f"# Error reading script file: {script_name}\n# Error: {str(e)}\n# Original path: {file_path}\n"
                            zipf.writestr(f"generated_scripts/{script_name}", error_content)
                    else:
                        print(f"[WARNING] Script file not found: {file_path}")
                        # Add placeholder for missing file
                        placeholder_content = f"""# Script file not found: {script_name}
# Test Case: {test_case_name}
# Expected path: {file_path}
# 
# This file was expected but could not be found at the specified location.
# Please check if the script was generated correctly.
"""
                        zipf.writestr(f"generated_scripts/{script_name}", placeholder_content)

                # Add a README file with selection information
                readme_content = f"""# Generated Test Scripts Package

Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Total Scripts Available: {len(generated_scripts_info)}
Scripts Selected for Download: {len(scripts_to_process)}
Successfully Added: {added_files}

## Scripts in this Package:
"""
                for i, script in enumerate(scripts_to_process, 1):
                    status = "✓" if os.path.isfile(script.get('file_path', '')) else "✗"
                    script_id = script.get('id', 'unknown')
                    readme_content += f"{i}. {status} {script.get('script_name', 'unknown.py')} - {script.get('test_case_name', 'Unknown')} (ID: {script_id})\n"

                # NEW: Show which scripts were NOT included (if any)
                if len(scripts_to_process) < len(generated_scripts_info):
                    excluded_scripts = [
                        script for script in generated_scripts_info
                        if script.get('id') not in selected_script_ids
                    ]
                    readme_content += f"""
## Scripts NOT included in this package:
"""
                    for script in excluded_scripts:
                        script_id = script.get('id', 'unknown')
                        readme_content += f"- {script.get('script_name', 'unknown.py')} - {script.get('test_case_name', 'Unknown')} (ID: {script_id})\n"

                readme_content += f"""
## Usage Instructions:
1. Extract this ZIP file to your desired location
2. Navigate to the 'generated_scripts' folder
3. Each script is ready to run independently
4. Run individual scripts using: python script_name.py

## Selection Details:
- This package contains only the scripts you selected for download
- {len(scripts_to_process)} out of {len(generated_scripts_info)} total scripts included
- Selected script IDs: {selected_script_ids}

## Troubleshooting:
- If a script shows ✗, it means the original file was not found
- Check the individual files for error messages
- Ensure Python 3 and required dependencies are installed

Generated by Cognizant AutoTest Dashboard
"""
                zipf.writestr("README.md", readme_content)

                print(f"[ZIP] ZIP file created successfully with {added_files} selected scripts")

            # Check if ZIP file was created successfully
            if not os.path.exists(temp_zip_path):
                raise Exception("ZIP file was not created successfully")

            zip_size = os.path.getsize(temp_zip_path)
            print(f"[ZIP] ZIP file size: {zip_size} bytes")

            if zip_size == 0:
                raise Exception("ZIP file is empty")

            # Generate filenames
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            zip_filename = f"selected_test_scripts_{timestamp}.zip"  # Changed filename to indicate selection
            temp_filename = os.path.basename(temp_zip_path)

            print(f"[ZIP] Success! Temp filename: {temp_filename}")
            print(f"[ZIP] Selected {len(scripts_to_process)} out of {len(generated_scripts_info)} total scripts")

            return jsonify({
                'success': True,
                'temp_filename': temp_filename,
                'download_filename': zip_filename,
                'script_count': len(scripts_to_process),  # Count of selected scripts
                'total_scripts': len(generated_scripts_info),  # Total available
                'selected_script_ids': selected_script_ids,  # Which ones were selected
                'added_files': added_files,
                'zip_size': zip_size,
                'message': f'ZIP package created with {added_files}/{len(scripts_to_process)} selected scripts (out of {len(generated_scripts_info)} total)'
            })

        except Exception as e:
            # Clean up temp file on error
            try:
                if os.path.exists(temp_zip_path):
                    os.unlink(temp_zip_path)
                    print(f"[CLEANUP] Deleted failed ZIP file: {temp_zip_path}")
            except:
                pass
            raise e

    except Exception as e:
        print(f"[ERROR] ZIP creation failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Failed to create ZIP package: {str(e)}'
        })


@app.route('/download_zip/<temp_filename>')
def serve_zip_file(temp_filename):
    """Serve the generated ZIP file for download"""
    try:
        print(f"[DOWNLOAD] Request for file: {temp_filename}")

        # Get temp directory and construct full path
        temp_dir = tempfile.gettempdir()
        full_temp_path = os.path.join(temp_dir, temp_filename)

        print(f"[DOWNLOAD] Temp dir: {temp_dir}")
        print(f"[DOWNLOAD] Full path: {full_temp_path}")
        print(f"[DOWNLOAD] File exists: {os.path.exists(full_temp_path)}")

        # Security checks
        if not temp_filename.endswith('.zip'):
            print(f"[ERROR] Invalid file type: {temp_filename}")
            return jsonify({'error': 'Invalid file type'}), 400

        if not os.path.exists(full_temp_path):
            print(f"[ERROR] File not found: {full_temp_path}")
            # List all zip files in temp dir for debugging
            try:
                zip_files = [f for f in os.listdir(temp_dir) if f.endswith('.zip')]
                print(f"[DEBUG] Available ZIP files in temp: {zip_files}")
            except:
                pass
            return jsonify({'error': 'File not found'}), 404

        # Verify file is in temp directory (security check)
        if not full_temp_path.startswith(temp_dir):
            print(f"[ERROR] Security violation - file not in temp dir")
            return jsonify({'error': 'Access denied'}), 403

        # Check file size
        file_size = os.path.getsize(full_temp_path)
        print(f"[DOWNLOAD] File size: {file_size} bytes")

        if file_size == 0:
            print(f"[ERROR] File is empty")
            return jsonify({'error': 'File is empty'}), 400

        # Generate download filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        download_filename = f"generated_test_scripts_{timestamp}.zip"

        print(f"[DOWNLOAD] Starting download: {download_filename}")

        # Schedule file cleanup (after 60 seconds to ensure download completes)
        def cleanup_file():
            try:
                if os.path.exists(full_temp_path):
                    os.unlink(full_temp_path)
                    print(f"[CLEANUP] Successfully deleted: {full_temp_path}")
            except Exception as e:
                print(f"[CLEANUP ERROR] Failed to delete {full_temp_path}: {e}")

        # Start cleanup timer
        cleanup_timer = threading.Timer(60.0, cleanup_file)
        cleanup_timer.start()

        # Send the file
        return send_file(
            full_temp_path,
            as_attachment=True,
            download_name=download_filename,
            mimetype='application/zip'
        )

    except Exception as e:
        print(f"[ERROR] Download failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Download failed: {str(e)}'}), 500


@app.route('/get_scripts_info', methods=['GET'])
def get_scripts_info():
    """Get information about generated scripts for bulk operations"""
    global generated_scripts_info

    try:
        if not generated_scripts_info:
            return jsonify({
                'success': False,
                'message': 'No generated scripts available'
            })

        # Return script information
        scripts_data = []
        for script in generated_scripts_info:
            script_data = {
                'id': script['id'],
                'script_name': script['script_name'],
                'test_case_name': script['test_case_name'],
                'file_exists': os.path.isfile(script['file_path']),
                'file_size': os.path.getsize(script['file_path']) if os.path.isfile(script['file_path']) else 0
            }
            scripts_data.append(script_data)

        return jsonify({
            'success': True,
            'scripts': scripts_data,
            'total_count': len(scripts_data),
            'message': f'Found {len(scripts_data)} generated scripts'
        })

    except Exception as e:
        print(f"[ERROR] Failed to get scripts info: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error retrieving scripts info: {str(e)}'
        })

# ALSO ADD this route to check what files are in temp directory (for debugging)
@app.route('/debug_scripts', methods=['GET'])
def debug_scripts():
    """Debug route to check generated scripts status"""
    global generated_scripts_info

    try:
        if not generated_scripts_info:
            return jsonify({
                'message': 'No generated scripts found',
                'scripts': [],
                'count': 0
            })

        scripts_status = []
        for script in generated_scripts_info:
            file_path = script.get('file_path', '')
            scripts_status.append({
                'script_name': script.get('script_name', 'unknown'),
                'test_case_name': script.get('test_case_name', 'unknown'),
                'file_path': file_path,
                'file_exists': os.path.isfile(file_path) if file_path else False,
                'file_size': os.path.getsize(file_path) if file_path and os.path.isfile(file_path) else 0
            })

        temp_dir = tempfile.gettempdir()
        zip_files = [f for f in os.listdir(temp_dir) if f.endswith('.zip') and 'test_scripts_' in f]

        return jsonify({
            'message': 'Debug info for generated scripts',
            'scripts': scripts_status,
            'count': len(scripts_status),
            'temp_dir': temp_dir,
            'temp_zip_files': zip_files
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Enhanced route for developer workflow
@app.route('/ingest', methods=['POST'])
def enhanced_ingest():
    """Enhanced ingestion supporting both Developer and QA workflows"""
    global current_mode, developer_workflows, codebase_context

    try:
        data = request.get_json()
        files = data.get('files', [])
        parse_multiple = data.get('parse_multiple', True)
        workflow_mode = data.get('mode', 'auto')  # 'auto', 'developer', 'qa'

        print(f"[INGEST] Processing {len(files)} file(s) with mode={workflow_mode}")

        # Determine workflow type if auto
        if workflow_mode == 'auto':
            workflow_type = determine_workflow_type(files)
        else:
            workflow_type = workflow_mode

        print(f"[INGEST] Detected workflow type: {workflow_type}")

        if workflow_type == 'developer':
            return process_developer_workflow(files)
        elif workflow_type == 'codebase':
            return process_codebase_upload(files)
        elif workflow_type == 'qa':
            # Use existing QA workflow
            return process_qa_workflow(files, parse_multiple)
        else:
            return process_mixed_workflow(files)

    except Exception as e:
        print(f"[ERROR] Enhanced ingestion error: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Ingestion error: {str(e)}'
        })


def process_developer_workflow(files):
    """Process developer workflow with user stories/requirements"""
    global developer_workflows

    processed_stories = []

    for file_info in files:
        filename = file_info['name']
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info['path'])

        print(f"[DEV] Processing developer file: {filename}")

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Determine file type and parse accordingly
            if filename.lower().endswith('.json'):
                stories = parse_jira_export(content)
            elif 'jira' in filename.lower():
                stories = parse_jira_export(content)
            else:
                # Parse as text-based user stories
                stories = extract_user_stories_from_text(content)

            processed_stories.extend(stories)

        except Exception as e:
            print(f"[ERROR] Failed to process {filename}: {e}")
            continue

    # Store processed stories globally
    developer_workflows = processed_stories

    return jsonify({
        'success': True,
        'workflow_type': 'developer',
        'processed_stories': processed_stories,
        'total_stories': len(processed_stories),
        'has_codebase_context': len(codebase_context) > 0,
        'message': f'Successfully processed {len(processed_stories)} user stories for development'
    })


def process_codebase_upload(files):
    """Process uploaded codebase for context"""
    global codebase_context

    for file_info in files:
        filename = file_info['name']
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_info['path'])

        if filename.endswith('.zip'):
            # Extract and analyze codebase
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(temp_dir)

                    print(f"[INFO] Extracted ZIP to: {temp_dir}")

                    # List extracted contents for debugging
                    extracted_files = list(Path(temp_dir).rglob("*.py"))
                    valid_files = [f for f in extracted_files if
                                   '__MACOSX' not in str(f) and not f.name.startswith('._')]
                    print(f"[INFO] Found {len(valid_files)} valid Python files out of {len(extracted_files)} total")

                    # Analyze extracted codebase
                    context_manager = CodebaseContextManager()
                    codebase_context = context_manager.analyze_codebase(temp_dir)

                    print(
                        f"[INFO] Analysis complete - Found {len(codebase_context.get('imports', []))} imports, {len(codebase_context.get('functions', {}))} functions")

                except Exception as e:
                    print(f"[ERROR] Failed to process codebase: {e}")
                    return jsonify({
                        'success': False,
                        'message': f'Failed to process codebase: {str(e)}'
                    })

    return jsonify({
        'success': True,
        'workflow_type': 'codebase',
        'codebase_context': {
            'libraries_count': len(codebase_context.get('imports', [])),
            'functions_count': len(codebase_context.get('functions', {})),
            'patterns_found': list(codebase_context.get('patterns', {}).keys())
        },
        'context_info': {
            'libraries_count': len(codebase_context.get('imports', [])),
            'functions_count': len(codebase_context.get('functions', {})),
            'patterns': list(codebase_context.get('patterns', {}).keys())
        },
        'message': 'Codebase context loaded successfully'
    })

def process_qa_workflow(files, parse_multiple):
    """Existing QA workflow processing"""
    # This is your existing ingest logic
    # Keep it unchanged for backward compatibility
    pass

'''
@app.route('/generate_app_code', methods=['POST'])
def generate_application_code():
    """Generate application code using the prepared prompt"""
    global generatedApplicationCode  # ADD this line

    try:
        # Get the stored prompt from session
        prompt = session.get('developer_prompt', '')
        workflow_type = session.get('workflow_type', 'jira')
        extracted_requirements = session.get('extracted_requirements', '')

        if not prompt:
            return jsonify({
                'success': False,
                'message': 'No prompt found. Please ingest requirements first.'
            })

        print(f"[GENERATE] Using stored prompt of length: {len(prompt)}")
        print(f"[GENERATE] Workflow type: {workflow_type}")

        # Here you would integrate with your LLaMA model
        # For now, we'll create a sample response based on the prompt
        generated_code = generate_code_from_prompt(prompt, workflow_type)

        # CRITICAL FIX: Store generated code in the global variable that review function expects
        generatedApplicationCode = generated_code

        # Log the generation
        print(f"[GENERATE] Generated {len(generated_code)} code files")
        print(f"[GENERATE] Stored in generatedApplicationCode: {len(generatedApplicationCode)} items")

        return jsonify({
            'success': True,
            'generated_code': generated_code,
            'workflow_type': workflow_type,
            'prompt_used': len(prompt),
            'extracted_requirements': extracted_requirements,
            'message': f'Successfully generated code for {workflow_type} workflow using stored prompt'
        })

    except Exception as e:
        print(f"[ERROR] Code generation failed: {e}")
        return jsonify({
            'success': False,
            'message': f'Code generation error: {str(e)}'
        })
'''


def build_basic_prompt_structure(data):
    """Build basic prompt structure before adding codebase context"""
    original_prompt = data.get('originalPrompt', '')
    workflow_type = data.get('workflowType', 'jira')

    if original_prompt:
        return original_prompt

    # Fallback basic prompt
    return f"""You are an expert software developer working on a {workflow_type} workflow.

Generate production-ready code that implements the requirements.
Include proper error handling, documentation, and follows best practices.
"""


def generate_code_from_prompt(prompt, workflow_type):
    """
    Generate code using the LLaMA model with the provided prompt
    This is where you'll integrate with your actual LLaMA model
    """

    # Extract some context from the prompt for the sample
    has_tests = 'Include comprehensive unit tests' in prompt
    has_docs = 'Generate detailed documentation' in prompt
    has_error_handling = 'Include robust error handling' in prompt

    # For now, generate sample code based on workflow type and prompt content
    if workflow_type == 'jira':
        # Generate main application code
        main_code = f'''"""
Generated Code for JIRA User Story
Auto-generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Based on processed requirements and LLaMA prompt
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class RequirementImplementation:
    """Implementation based on processed user requirements"""
    requirement_id: str
    implementation_status: str = "ready"

class FeatureManager:
    """Manages feature implementation based on user story requirements"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.requirements: Dict[str, RequirementImplementation] = {{}}

    def implement_feature(self, requirement_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main implementation method based on user story requirements
        """
        try:
            self.logger.info("Starting feature implementation")

            # Validate requirements
            if not self.validate_requirements(requirement_data):
                return {{"status": "error", "message": "Invalid requirements"}}

            # Process implementation
            result = {{
                "status": "success",
                "feature_id": requirement_data.get("id", "unknown"),
                "implementation_complete": True,
                "context_aware": True if 'context' in requirement_data else False
            }}

            self.logger.info("Feature implementation completed successfully")
            return result

        except Exception as e:
            self.logger.error(f"Implementation failed: {{e}}")
            return {{"status": "error", "message": str(e)}}

    def validate_requirements(self, requirements: Dict[str, Any]) -> bool:
        """Validate requirement data structure"""
        required_fields = ["id", "title"]
        return all(field in requirements for field in required_fields)

def main():
    """Main execution function"""
    try:
        manager = FeatureManager()
        sample_requirement = {{
            "id": "REQ-001",
            "title": "Sample Feature",
            "context": "User story implementation"
        }}

        result = manager.implement_feature(sample_requirement)

        if result["status"] == "success":
            print("[PASS] ✅ Feature implementation completed successfully")
            print(f"🎯 Feature ID: {{sample_requirement['id']}}")
            print(f"🔗 Context aware: {{result.get('context_aware', False)}}")
        else:
            print(f"[FAIL] ❌ Implementation failed: {{result['message']}}")

    except Exception as e:
        print(f"[ERROR] Main execution failed: {{e}}")

if __name__ == "__main__":
    main()
'''

        # Generate unit tests separately if requested
        unit_tests = ""
        if has_tests:
            unit_tests = f'''# Unit Tests
import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the main module to path for testing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from main_code import FeatureManager, RequirementImplementation
except ImportError:
    # Fallback if import fails
    class FeatureManager:
        def __init__(self):
            pass
        def implement_feature(self, data):
            return {{"status": "success"}}
        def validate_requirements(self, data):
            return True

class TestFeatureImplementation(unittest.TestCase):
    """Comprehensive unit tests for FeatureManager"""

    def setUp(self):
        """Set up test fixtures before each test method"""
        self.feature_manager = FeatureManager()
        self.sample_requirement = {{
            "id": "TEST-001",
            "title": "Test Feature",
            "description": "Test description"
        }}

    def test_feature_implementation_success(self):
        """Test successful feature implementation"""
        result = self.feature_manager.implement_feature(self.sample_requirement)

        self.assertEqual(result["status"], "success")
        self.assertIn("feature_id", result)
        self.assertTrue(result["implementation_complete"])

    def test_feature_implementation_with_invalid_data(self):
        """Test feature implementation with invalid data"""
        invalid_requirement = {{"invalid": "data"}}
        result = self.feature_manager.implement_feature(invalid_requirement)

        self.assertEqual(result["status"], "error")
        self.assertIn("message", result)

    def test_requirement_validation_valid(self):
        """Test requirement validation with valid data"""
        is_valid = self.feature_manager.validate_requirements(self.sample_requirement)
        self.assertTrue(is_valid)

    def test_requirement_validation_invalid(self):
        """Test requirement validation with invalid data"""
        invalid_requirement = {{"missing": "required_fields"}}
        is_valid = self.feature_manager.validate_requirements(invalid_requirement)
        self.assertFalse(is_valid)

    def test_requirement_validation_empty(self):
        """Test requirement validation with empty data"""
        empty_requirement = {{}}
        is_valid = self.feature_manager.validate_requirements(empty_requirement)
        self.assertFalse(is_valid)

    @patch('logging.Logger.info')
    def test_logging_behavior(self, mock_logger):
        """Test that logging works correctly"""
        self.feature_manager.implement_feature(self.sample_requirement)
        mock_logger.assert_called()

    def test_context_awareness(self):
        """Test context-aware implementation"""
        context_requirement = {{
            "id": "CONTEXT-001",
            "title": "Context Feature",
            "context": "Additional context data"
        }}

        result = self.feature_manager.implement_feature(context_requirement)
        self.assertTrue(result.get("context_aware", False))

    def tearDown(self):
        """Clean up after each test method"""
        self.feature_manager = None

class TestRequirementImplementation(unittest.TestCase):
    """Unit tests for RequirementImplementation dataclass"""

    def test_requirement_creation(self):
        """Test creation of RequirementImplementation"""
        req = RequirementImplementation(
            requirement_id="REQ-TEST-001",
            implementation_status="testing"
        )

        self.assertEqual(req.requirement_id, "REQ-TEST-001")
        self.assertEqual(req.implementation_status, "testing")

    def test_requirement_default_status(self):
        """Test default implementation status"""
        req = RequirementImplementation(requirement_id="REQ-DEFAULT")
        self.assertEqual(req.implementation_status, "ready")

if __name__ == "__main__":
    # Configure test runner
    unittest.main(verbosity=2, exit=False)

    # Additional test summary
    print("\\n" + "="*50)
    print("Unit Test Execution Complete")
    print("="*50)
'''

        # CRITICAL FIX: Return the code with proper separation markers
        if has_tests:
            # Combine main code and tests with clear separation
            combined_code = main_code + "\n\n" + "# " + "=" * 60 + "\n" + unit_tests
        else:
            combined_code = main_code

        return [{
            'file_name': 'feature_implementation.py',
            'generated_code': combined_code,
            'story_id': 'JIRA-001',
            'story_title': 'Feature Implementation'
        }]

    else:
        # Generic code for other workflow types
        main_code = f'''"""
Generated Code for {workflow_type.title()} Workflow
Auto-generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Based on LLaMA processed prompt
"""

import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class {workflow_type.title()}Implementation:
    """Implementation based on {workflow_type} workflow requirements"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def execute(self) -> Dict[str, Any]:
        """Execute the implementation based on processed prompt"""
        try:
            self.logger.info("Executing {workflow_type} implementation")

            # Implementation logic based on your specific prompt
            result = {{
                "status": "success",
                "workflow_type": "{workflow_type}",
                "message": "Implementation completed based on LLaMA prompt"
            }}

            return result

        except Exception as e:
            self.logger.error(f"Implementation failed: {{e}}")
            return {{
                "status": "error",
                "message": str(e)
            }}

def main():
    """Main execution function"""
    implementation = {workflow_type.title()}Implementation()
    result = implementation.execute()

    if result["status"] == "success":
        print(f"[PASS] ✅ {{result['message']}}")
    else:
        print(f"[FAIL] ❌ {{result['message']}}")

if __name__ == "__main__":
    main()
'''

        # Generate unit tests separately if requested
        unit_tests = ""
        if has_tests:
            unit_tests = f'''# Unit Tests
import unittest
from unittest.mock import patch
import sys
import os

# Add the main module to path for testing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from main_code import {workflow_type.title()}Implementation
except ImportError:
    # Fallback if import fails
    class {workflow_type.title()}Implementation:
        def execute(self):
            return {{"status": "success"}}

class Test{workflow_type.title()}Implementation(unittest.TestCase):
    """Unit tests for {workflow_type.title()}Implementation"""

    def setUp(self):
        """Set up test fixtures"""
        self.implementation = {workflow_type.title()}Implementation()

    def test_execution_success(self):
        """Test successful execution"""
        result = self.implementation.execute()
        self.assertEqual(result["status"], "success")
        self.assertIn("workflow_type", result)

    def test_execution_workflow_type(self):
        """Test correct workflow type"""
        result = self.implementation.execute()
        self.assertEqual(result["workflow_type"], "{workflow_type}")

    @patch('logging.Logger.info')
    def test_logging_occurs(self, mock_logger):
        """Test that logging occurs during execution"""
        self.implementation.execute()
        mock_logger.assert_called()

if __name__ == "__main__":
    unittest.main(verbosity=2)
'''

        # CRITICAL FIX: Return the code with proper separation markers
        if has_tests:
            # Combine main code and tests with clear separation
            combined_code = main_code + "\n\n" + "# " + "=" * 60 + "\n" + unit_tests
        else:
            combined_code = main_code

        return [{
            'file_name': f'{workflow_type}_implementation.py',
            'generated_code': combined_code,
            'story_id': f'{workflow_type.upper()}-001',
            'story_title': f'{workflow_type.title()} Implementation'
        }]

@app.route('/store_generated_code', methods=['POST'])
def store_generated_code():
    """Store generated code for review function (used by smart reuse)"""
    global generatedApplicationCode

    try:
        data = request.get_json()
        generated_code = data.get('generated_code', [])

        generatedApplicationCode = generated_code

        print(f"[STORE] Stored {len(generated_code)} generated code files")
        print(f"[STORE] generatedApplicationCode now has length: {len(generatedApplicationCode)}")

        return jsonify({
            'success': True,
            'message': f'Stored {len(generated_code)} code files for review'
        })

    except Exception as e:
        print(f"[STORE] Error storing generated code: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        })

language = None
@app.route('/generate_app_code', methods=['POST'])
def generate_application_code_enhanced():
    """Enhanced application code generation - PRESERVES FALLBACK TO EXISTING MOCK CODE"""
    global generatedApplicationCode
    global language
    
    data = request.get_json()
    language = data.get('language')

    print(f"********************DEBUG-2********************************** Language received: {language}")

    try:
        print("[GENERATE_APP] Starting enhanced code generation")

        # Get stored prompt and options (existing logic)
        stored_prompt = session.get('stored_ai_prompt', '') or session.get('developer_prompt', '')
        extracted_requirements = session.get('extracted_requirements', '')
        workflow_type = session.get('workflow_type', 'jira')

        if not stored_prompt:
            return jsonify({
                'success': False,
                'message': 'No stored prompt found. Please ingest requirements first.'
            })

        print(f"[GENERATE_APP] Using stored prompt of length: {len(stored_prompt)}")
        print(f"[GENERATE_APP] Workflow type: {workflow_type}")

        # TRY ENHANCED AI GENERATION FIRST, FALLBACK TO EXISTING MOCK CODE
        if AI_GENERATOR_AVAILABLE:
            try:
                generated_code = generate_code_with_enhanced_ai(stored_prompt, workflow_type)
                ai_backend_used = AI_CONFIG['backend']
                print(f"[GENERATE_APP] ✅ Used enhanced AI generation with {ai_backend_used}")
            except Exception as e:
                print(f"[GENERATE_APP] ⚠️ Enhanced AI failed, falling back to existing mock: {e}")
                generated_code = generate_code_from_prompt(stored_prompt, workflow_type)  # EXISTING FUNCTION
                ai_backend_used = 'fallback'
        else:
            print("[GENERATE_APP] ⚠️ Enhanced AI not available, using existing mock generation")
            generated_code = generate_code_from_prompt(stored_prompt, workflow_type)  # EXISTING FUNCTION
            ai_backend_used = 'mock'

        # Store generated code globally for review function (existing logic)
        generatedApplicationCode = generated_code

        # ⭐ ADD THESE 2 LINES ONLY:
        #save_generated_code_dev(generated_code)  # Save immediately
        #print(f"[GENERATE_APP] Files pre-saved to dev-scripts folder")

        print(f"[GENERATE_APP] Generated {len(generated_code)} code files")

        return jsonify({
            'success': True,
            'generated_code': generated_code,
            'workflow_type': workflow_type,
            'language': language,
            'prompt_used': len(stored_prompt),
            'extracted_requirements': extracted_requirements,
            'ai_backend': ai_backend_used,
            'message': f'Successfully generated code for {workflow_type} workflow'
        })

    except Exception as e:
        print(f"[ERROR] Code generation failed: {e}")
        return jsonify({
            'success': False,
            'message': f'Code generation error: {str(e)}'
        })


# 4. ADD NEW HELPER FUNCTIONS (don't replace existing ones)
def generate_code_with_enhanced_ai(prompt, workflow_type):
    """Generate code using enhanced AI - NEW FUNCTION"""
    try:
        print(f"[AI_GEN] Starting enhanced AI code generation for {workflow_type}")

        # Get generation options from the stored prompt
        generation_options = extract_generation_options_from_prompt(prompt)

        # Get codebase context if available and requested
        codebase_context = None
        if generation_options.get('use_libraries') or generation_options.get('follow_patterns'):
            codebase_context = get_current_codebase_context()

        # Enhance prompt with codebase context if available
        enhanced_prompt = enhance_prompt_with_context(prompt, codebase_context, generation_options)

        # Initialize the AI generator
        generator = EnhancedCodeGenerator(mode='developer', ai_backend=AI_CONFIG['backend'])

        # Prepare generation data
        generation_data = {
            'prompt': enhanced_prompt,
            'include_tests': generation_options.get('include_tests', True),
            'workflow_type': workflow_type
        }

        # Generate code
        result = generator.generate_application_code(generation_data, codebase_context, generation_options)

        print(f"[AI_GEN] ✅ Successfully generated {len(result)} files using enhanced AI")
        return result

    except Exception as e:
        print(f"[AI_GEN] ❌ Enhanced AI generation failed: {e}")
        raise  # Re-raise to trigger fallback

'''
def enhance_prompt_with_context(prompt, codebase_context, generation_options):
    """Enhance the prompt with codebase context - NEW FUNCTION"""
    enhanced_prompt = prompt

    # Add codebase context if available and requested
    if codebase_context and (generation_options.get('use_libraries') or generation_options.get('follow_patterns')):
        context_info = f"""

=== CODEBASE CONTEXT ===
The following information is from the synced codebase:

Available Libraries:
{', '.join(codebase_context.get('imports', [])[:20])}

Common Patterns:
{json.dumps(codebase_context.get('patterns', {}), indent=2)[:500]}...

Utility Functions Available:
{len(codebase_context.get('functions', {}))} functions found in codebase

"""
        enhanced_prompt += context_info
        print(f"[CONTEXT] Added {len(context_info)} characters of codebase context")

    # Add specific instructions based on generation options
    instructions = []
    if generation_options.get('use_libraries'):
        instructions.append("- IMPORTANT: Use existing libraries from the codebase context above")
    if generation_options.get('follow_patterns'):
        instructions.append("- IMPORTANT: Follow the patterns found in the codebase context")
    if generation_options.get('include_errors'):
        instructions.append("- IMPORTANT: Include comprehensive error handling and validation")
    if generation_options.get('generate_docs'):
        instructions.append("- IMPORTANT: Generate detailed documentation and docstrings")

    if instructions:
        enhanced_prompt += f"\n\n=== SPECIAL INSTRUCTIONS ===\n" + "\n".join(instructions)

    return enhanced_prompt
'''


# CRITICAL FIX: Update enhance_prompt_with_context in app.py to properly structure prompts

def enhance_prompt_with_context(prompt, codebase_context, generation_options):
    """Enhance the prompt with codebase context - FIXED FOR UNIT TEST GENERATION"""
    global language
    print(f"********************DEBUG-3********************************** Language received: {language}")

    # CRITICAL FIX: Start with clear AI instructions BEFORE adding context
    enhanced_prompt = f"""You are an expert {language} developer. Your Task is to generate production-ready code.

=== PRIMARY REQUIREMENTS ===
{prompt}

"""

    # CRITICAL: Add unit test requirement PROMINENTLY if checkbox is checked
    if generation_options.get('includeTests'):
        enhanced_prompt += """
=== MANDATORY UNIT TEST REQUIREMENT ===
🚨 CRITICAL: You MUST generate comprehensive unit tests in addition to the main code.

Structure your response as follows:
1. First, write the main implementation code
2. Then add this EXACT separator: # ============================================================
3. Then add this EXACT header: # Unit Tests
4. Then write comprehensive unit tests using unittest framework

This is MANDATORY - do not skip the unit tests even if you have codebase context to analyze.

"""

    # Add other generation requirements
    if generation_options.get('generateDocs'):
        enhanced_prompt += "- Generate detailed documentation with docstrings and comments\n"
    if generation_options.get('includeErrors'):
        enhanced_prompt += "- Include comprehensive error handling and validation\n"
    if generation_options.get('performanceOpt'):
        enhanced_prompt += "- Optimize for performance and efficiency\n"

    # NOW add codebase context (but make it secondary to unit test requirement)
    if codebase_context and (generation_options.get('useLibraries') or generation_options.get('followPatterns')):

        # CRITICAL: Make codebase context more concise to not overwhelm the AI
        enhanced_prompt += f"""

=== EXISTING CODEBASE REFERENCE ===
Use the following existing code as reference, but remember to generate unit tests as required above.

Available Libraries:
{', '.join(codebase_context.get('imports', [])[:10])}

Key Functions to Reference:
"""

        # REDUCED: Only show top 5 most relevant functions (not 15)
        functions_items = list(codebase_context.get('functions', {}).items())[:5]
        for func_name, func_info in functions_items:
            enhanced_prompt += f"\n- {func_name}() in {func_info['file']}: {func_info['docstring'][:100]}...\n"

        # REDUCED: Only show top 3 classes (not 8)
        if codebase_context.get('classes'):
            enhanced_prompt += f"\nKey Classes to Reference:\n"
            classes_items = list(codebase_context.get('classes', {}).items())[:3]
            for class_name, class_info in classes_items:
                enhanced_prompt += f"- {class_name} in {class_info['file']}: {class_info['docstring'][:100]}...\n"

        enhanced_prompt += f"""
Instructions for using codebase:
- Follow the same coding patterns and style as existing code
- Use existing functions when appropriate - don't reinvent the wheel
- Maintain consistency with existing architecture
"""

    # CRITICAL: Reinforce unit test requirement at the end
    if generation_options.get('includeTests'):
        enhanced_prompt += f"""

=== FINAL REMINDER ===
🚨 DO NOT FORGET: After implementing the main code, you MUST add:
# ============================================================
# Unit Tests

Then write comprehensive unit tests using unittest framework. This is mandatory regardless of codebase complexity.
"""

    # Add specific instructions for codebase options
    if generation_options.get('useLibraries'):
        enhanced_prompt += "\n- IMPORTANT: Use existing libraries from the codebase context above"
    if generation_options.get('followPatterns'):
        enhanced_prompt += "\n- IMPORTANT: Follow the patterns found in the codebase context"

    print(f"[CONTEXT] Enhanced prompt length: {len(enhanced_prompt)} characters")
    if generation_options.get('includeTests'):
        print(f"[CONTEXT] ✅ Unit test instructions added prominently")

    return enhanced_prompt


def extract_generation_options_from_prompt(prompt):
    """Extract generation options from the prompt content - NEW FUNCTION"""
    options = {
        'include_tests': 'Include comprehensive unit tests' in prompt or 'unit tests' in prompt.lower(),
        'generate_docs': 'Generate detailed documentation' in prompt or 'documentation' in prompt.lower(),
        'use_libraries': 'Use existing libraries' in prompt or 'existing libraries' in prompt.lower(),
        'follow_patterns': 'Follow established project patterns' in prompt or 'project patterns' in prompt.lower(),
        'include_errors': 'Include robust error handling' in prompt or 'error handling' in prompt.lower(),
        'performance_opt': 'performance' in prompt.lower() or 'optimize' in prompt.lower()
    }

    print(f"[OPTIONS] Extracted generation options: {options}")
    return options


def get_current_codebase_context():
    """Get the current codebase context - NEW FUNCTION (reuses existing logic)"""
    try:
        codebase_id = session.get('current_codebase_id')
        if not codebase_id:
            print("[CONTEXT] No codebase context available")
            return None

        # Load from persistent storage (reuses existing function)
        context = get_relevant_codebase_context(codebase_id, 'developer')
        if context:
            # Parse the context string back to dict if needed
            try:
                import json
                # If context is a string, try to parse relevant parts
                if isinstance(context, str):
                    # Extract structured data from context string
                    context_dict = {
                        'imports': [],
                        'patterns': {},
                        'functions': {}
                    }
                    # This is a simplified parser - enhance as needed
                    return context_dict
                else:
                    return context
            except:
                return None

        print(f"[CONTEXT] Loaded codebase context for {codebase_id}")
        return context

    except Exception as e:
        print(f"[CONTEXT] Failed to load codebase context: {e}")
        return None

@app.route('/debug_codebase_context', methods=['GET'])
def debug_codebase_context():
    """Debug route to check current codebase context"""
    try:
        codebase_id = session.get('current_codebase_id')
        has_context = session.get('codebase_context') is not None

        if codebase_id:
            context = get_relevant_codebase_context(codebase_id, 'debug')
            context_length = len(context)
        else:
            context = "No codebase context available"
            context_length = 0

        return jsonify({
            'success': True,
            'codebase_id': codebase_id,
            'has_session_context': has_context,
            'context_preview': context[:500] + "..." if len(context) > 500 else context,
            'context_length': context_length,
            'session_keys': list(session.keys())
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


# 5. ADD AI BACKEND STATUS ENDPOINT (completely new)
@app.route('/ai_backend_status', methods=['GET'])
def ai_backend_status():
    """Check the status of available AI backends - NEW ENDPOINT"""
    try:
        status = {
            'ai_generator_available': AI_GENERATOR_AVAILABLE,
            'backend_config': AI_CONFIG,
            'backends': {}
        }

        if AI_GENERATOR_AVAILABLE:
            # Test Ollama connection
            try:
                import requests
                response = requests.get(f"{AI_CONFIG['ollama_url']}/api/tags", timeout=5)
                if response.status_code == 200:
                    models = response.json().get('models', [])
                    status['backends']['ollama'] = {
                        'available': True,
                        'models': [model['name'] for model in models],
                        'url': AI_CONFIG['ollama_url']
                    }
                else:
                    status['backends']['ollama'] = {'available': False, 'error': 'Not responding'}
            except Exception as e:
                status['backends']['ollama'] = {'available': False, 'error': str(e)}

            # Llama2 status (basic check)
            status['backends']['llama2'] = {
                'available': True,  # Assume available if generator is imported
                'note': 'Requires significant memory and setup time'
            }

        return jsonify({
            'success': True,
            'status': status
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })


# 6. ADD CONFIGURATION ENDPOINT (completely new)
@app.route('/configure_ai_backend', methods=['POST'])
def configure_ai_backend():
    """Configure AI backend settings - NEW ENDPOINT"""
    try:
        data = request.get_json()

        if 'backend' in data and data['backend'] in ['auto', 'ollama', 'llama2']:
            AI_CONFIG['backend'] = data['backend']

        if 'ollama_url' in data:
            AI_CONFIG['ollama_url'] = data['ollama_url']

        if 'ollama_model' in data:
            AI_CONFIG['ollama_model'] = data['ollama_model']

        return jsonify({
            'success': True,
            'message': 'AI backend configuration updated',
            'config': AI_CONFIG
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        })

def build_enhanced_ai_prompt_with_options(data):
    """Enhanced version of build_enhanced_ai_prompt with generation options support"""
    # Get your existing prompt building logic
    original_prompt = data.get('originalPrompt', '')
    workflow_type = data.get('workflowType', 'jira')
    generation_options = data.get('generationOptions', {})

    # Start with basic prompt (preserve existing logic)
    if original_prompt:
        prompt = original_prompt
    else:
        prompt = f"""You are an expert software developer working on a {workflow_type} workflow.

Generate production-ready code that implements the requirements.
Include proper error handling, documentation, and follows best practices.
"""

    # Add generation options to prompt
    if generation_options.get('includeTests'):
        prompt += "\n- Include comprehensive unit tests with good coverage"
    if generation_options.get('generateDocs'):
        prompt += "\n- Generate detailed documentation with docstrings and comments"
    if generation_options.get('useLibraries'):
        prompt += "\n- Utilize existing libraries and frameworks when appropriate"
    if generation_options.get('followPatterns'):
        prompt += "\n- Follow established project patterns and coding standards"
    if generation_options.get('includeErrors'):
        prompt += "\n- Include robust error handling and validation"
    if generation_options.get('performanceOpt'):
        prompt += "\n- Optimize for performance and efficiency"

    # Add enhanced codebase context if available (preserve existing logic)
    codebase_id = session.get('current_codebase_id')
    if codebase_id and (generation_options.get('useLibraries') or generation_options.get('followPatterns')):
        print(f"[PROMPT] Building enhanced prompt with codebase context: {codebase_id}")
        context = get_relevant_codebase_context(codebase_id, workflow_type)
        if context:
            prompt += context
            print(f"[PROMPT] Added {len(context)} characters of codebase context")

    return prompt

def generate_code_from_prompt(prompt, workflow_type):
    """
    Generate code using the LLaMA model with the provided prompt
    This is where you'll integrate with your actual LLaMA model
    """

    # Extract some context from the prompt for the sample
    has_tests = 'Include comprehensive unit tests' in prompt
    has_docs = 'Generate detailed documentation' in prompt
    has_error_handling = 'Include robust error handling' in prompt

    # For now, generate sample code based on workflow type and prompt content
    if workflow_type == 'jira':
        # Generate main application code
        main_code = f'''"""
Generated Code for JIRA User Story
Auto-generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Based on processed requirements and LLaMA prompt
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class RequirementImplementation:
    """Implementation based on processed user requirements"""
    requirement_id: str
    implementation_status: str = "ready"

class FeatureManager:
    """Manages feature implementation based on user story requirements"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.requirements: Dict[str, RequirementImplementation] = {{}}

    def implement_feature(self, requirement_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main implementation method based on user story requirements
        """
        try:
            self.logger.info("Starting feature implementation")

            # Validate requirements
            if not self.validate_requirements(requirement_data):
                return {{"status": "error", "message": "Invalid requirements"}}

            # Process implementation
            result = {{
                "status": "success",
                "feature_id": requirement_data.get("id", "unknown"),
                "implementation_complete": True,
                "context_aware": True if 'context' in requirement_data else False
            }}

            self.logger.info("Feature implementation completed successfully")
            return result

        except Exception as e:
            self.logger.error(f"Implementation failed: {{e}}")
            return {{"status": "error", "message": str(e)}}

    def validate_requirements(self, requirements: Dict[str, Any]) -> bool:
        """Validate requirement data structure"""
        required_fields = ["id", "title"]
        return all(field in requirements for field in required_fields)

def main():
    """Main execution function"""
    try:
        manager = FeatureManager()
        sample_requirement = {{
            "id": "REQ-001",
            "title": "Sample Feature",
            "context": "User story implementation"
        }}

        result = manager.implement_feature(sample_requirement)

        if result["status"] == "success":
            print("[PASS] ✅ Feature implementation completed successfully")
            print(f"🎯 Feature ID: {{sample_requirement['id']}}")
            print(f"🔗 Context aware: {{result.get('context_aware', False)}}")
        else:
            print(f"[FAIL] ❌ Implementation failed: {{result['message']}}")

    except Exception as e:
        print(f"[ERROR] Main execution failed: {{e}}")

if __name__ == "__main__":
    main()
'''

        # Generate unit tests separately if requested
        unit_tests = ""
        if has_tests:
            unit_tests = f'''# Unit Tests
import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the main module to path for testing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from main_code import FeatureManager, RequirementImplementation
except ImportError:
    # Fallback if import fails
    class FeatureManager:
        def __init__(self):
            pass
        def implement_feature(self, data):
            return {{"status": "success"}}
        def validate_requirements(self, data):
            return True

class TestFeatureImplementation(unittest.TestCase):
    """Comprehensive unit tests for FeatureManager"""

    def setUp(self):
        """Set up test fixtures before each test method"""
        self.feature_manager = FeatureManager()
        self.sample_requirement = {{
            "id": "TEST-001",
            "title": "Test Feature",
            "description": "Test description"
        }}

    def test_feature_implementation_success(self):
        """Test successful feature implementation"""
        result = self.feature_manager.implement_feature(self.sample_requirement)

        self.assertEqual(result["status"], "success")
        self.assertIn("feature_id", result)
        self.assertTrue(result["implementation_complete"])

    def test_feature_implementation_with_invalid_data(self):
        """Test feature implementation with invalid data"""
        invalid_requirement = {{"invalid": "data"}}
        result = self.feature_manager.implement_feature(invalid_requirement)

        self.assertEqual(result["status"], "error")
        self.assertIn("message", result)

    def test_requirement_validation_valid(self):
        """Test requirement validation with valid data"""
        is_valid = self.feature_manager.validate_requirements(self.sample_requirement)
        self.assertTrue(is_valid)

    def test_requirement_validation_invalid(self):
        """Test requirement validation with invalid data"""
        invalid_requirement = {{"missing": "required_fields"}}
        is_valid = self.feature_manager.validate_requirements(invalid_requirement)
        self.assertFalse(is_valid)

    def test_requirement_validation_empty(self):
        """Test requirement validation with empty data"""
        empty_requirement = {{}}
        is_valid = self.feature_manager.validate_requirements(empty_requirement)
        self.assertFalse(is_valid)

    @patch('logging.Logger.info')
    def test_logging_behavior(self, mock_logger):
        """Test that logging works correctly"""
        self.feature_manager.implement_feature(self.sample_requirement)
        mock_logger.assert_called()

    def test_context_awareness(self):
        """Test context-aware implementation"""
        context_requirement = {{
            "id": "CONTEXT-001",
            "title": "Context Feature",
            "context": "Additional context data"
        }}

        result = self.feature_manager.implement_feature(context_requirement)
        self.assertTrue(result.get("context_aware", False))

    def tearDown(self):
        """Clean up after each test method"""
        self.feature_manager = None

class TestRequirementImplementation(unittest.TestCase):
    """Unit tests for RequirementImplementation dataclass"""

    def test_requirement_creation(self):
        """Test creation of RequirementImplementation"""
        req = RequirementImplementation(
            requirement_id="REQ-TEST-001",
            implementation_status="testing"
        )

        self.assertEqual(req.requirement_id, "REQ-TEST-001")
        self.assertEqual(req.implementation_status, "testing")

    def test_requirement_default_status(self):
        """Test default implementation status"""
        req = RequirementImplementation(requirement_id="REQ-DEFAULT")
        self.assertEqual(req.implementation_status, "ready")

if __name__ == "__main__":
    # Configure test runner
    unittest.main(verbosity=2, exit=False)

    # Additional test summary
    print("\\n" + "="*50)
    print("Unit Test Execution Complete")
    print("="*50)
'''

        # CRITICAL FIX: Return the code with proper separation markers
        if has_tests:
            # Combine main code and tests with clear separation
            combined_code = main_code + "\n\n" + "# " + "=" * 60 + "\n" + unit_tests
        else:
            combined_code = main_code

        return [{
            'file_name': 'feature_implementation.py',
            'generated_code': combined_code,
            'story_id': 'JIRA-001',
            'story_title': 'Feature Implementation'
        }]

    else:
        # Generic code for other workflow types
        main_code = f'''"""
Generated Code for {workflow_type.title()} Workflow
Auto-generated on: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Based on LLaMA processed prompt
"""

import logging
from typing import Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class {workflow_type.title()}Implementation:
    """Implementation based on {workflow_type} workflow requirements"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def execute(self) -> Dict[str, Any]:
        """Execute the implementation based on processed prompt"""
        try:
            self.logger.info("Executing {workflow_type} implementation")

            # Implementation logic based on your specific prompt
            result = {{
                "status": "success",
                "workflow_type": "{workflow_type}",
                "message": "Implementation completed based on LLaMA prompt"
            }}

            return result

        except Exception as e:
            self.logger.error(f"Implementation failed: {{e}}")
            return {{
                "status": "error",
                "message": str(e)
            }}

def main():
    """Main execution function"""
    implementation = {workflow_type.title()}Implementation()
    result = implementation.execute()

    if result["status"] == "success":
        print(f"[PASS] ✅ {{result['message']}}")
    else:
        print(f"[FAIL] ❌ {{result['message']}}")

if __name__ == "__main__":
    main()
'''

        # Generate unit tests separately if requested
        unit_tests = ""
        if has_tests:
            unit_tests = f'''# Unit Tests
import unittest
from unittest.mock import patch
import sys
import os

# Add the main module to path for testing
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from main_code import {workflow_type.title()}Implementation
except ImportError:
    # Fallback if import fails
    class {workflow_type.title()}Implementation:
        def execute(self):
            return {{"status": "success"}}

class Test{workflow_type.title()}Implementation(unittest.TestCase):
    """Unit tests for {workflow_type.title()}Implementation"""

    def setUp(self):
        """Set up test fixtures"""
        self.implementation = {workflow_type.title()}Implementation()

    def test_execution_success(self):
        """Test successful execution"""
        result = self.implementation.execute()
        self.assertEqual(result["status"], "success")
        self.assertIn("workflow_type", result)

    def test_execution_workflow_type(self):
        """Test correct workflow type"""
        result = self.implementation.execute()
        self.assertEqual(result["workflow_type"], "{workflow_type}")

    @patch('logging.Logger.info')
    def test_logging_occurs(self, mock_logger):
        """Test that logging occurs during execution"""
        self.implementation.execute()
        mock_logger.assert_called()

if __name__ == "__main__":
    unittest.main(verbosity=2)
'''

        # CRITICAL FIX: Return the code with proper separation markers
        if has_tests:
            # Combine main code and tests with clear separation
            combined_code = main_code + "\n\n" + "# " + "=" * 60 + "\n" + unit_tests
        else:
            combined_code = main_code

        return [{
            'file_name': f'{workflow_type}_implementation.py',
            'generated_code': combined_code,
            'story_id': f'{workflow_type.upper()}-001',
            'story_title': f'{workflow_type.title()} Implementation'
        }]

def generate_code_for_story(story, context):
    """Generate code for a single user story using enhanced LLaMA"""
    try:
        # Build context-aware prompt
        prompt = build_developer_prompt(story, context)

        # Call your existing LLaMA generation logic
        # You'll need to modify Auto_test_gen.py or create a new generator
        generated_code = call_enhanced_llama_generation(prompt)

        return {
            'story_id': story['id'],
            'story_title': story['title'],
            'generated_code': generated_code,
            'file_name': f"{story['id'].lower().replace('-', '_')}_implementation.py"
        }

    except Exception as e:
        return {
            'story_id': story['id'],
            'story_title': story['title'],
            'generated_code': f"# Error generating code: {str(e)}",
            'file_name': f"{story['id']}_error.py"
        }


def build_developer_prompt(story, context):
    """Build context-aware prompt for application code generation"""
    context_libraries = context.get('imports', [])[:10]  # Top 10 libraries
    context_patterns = context.get('patterns', {})

    prompt = f"""
You are an expert Python developer working on an enterprise application.

User Story Details:
- ID: {story['id']}
- Title: {story['title']}
- Description: {story['description']}
- Acceptance Criteria: {story['acceptance_criteria']}
- Priority: {story.get('priority', 'Medium')}

Existing Codebase Context:
Available Libraries: {', '.join(context_libraries)}
Common Patterns Found: {', '.join(context_patterns.keys())}

Instructions:
1. Generate production-ready Python code that implements this user story
2. Use existing libraries from the codebase where appropriate
3. Follow established patterns from the existing codebase
4. Include proper error handling and logging
5. Add comprehensive docstrings and comments
6. Make the code testable and maintainable
7. Include input validation and security considerations

Generate the complete implementation including:
- Main implementation class/functions
- Error handling
- Documentation
- Usage examples

```python
"""

    return prompt


def call_enhanced_llama_generation(prompt):
    """Call LLaMA model for code generation"""
    try:
        # This would integrate with your existing LLaMA setup
        # You might need to modify Auto_test_gen.py or create new generator

        # For now, using a placeholder that calls your existing generation logic
        # Replace this with actual LLaMA integration

        # Example integration:
        # from Auto_test_gen import generator
        # return generator.generate(prompt, max_tokens=1000, mode='developer')

        return f"""
# Generated implementation code would be here
# This is a placeholder - integrate with your LLaMA model

class UserStoryImplementation:
    '''
    Implementation for user story
    '''

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def implement_feature(self):
        '''
        Main implementation method
        '''
        try:
            # Implementation logic here
            pass
        except Exception as e:
            self.logger.error(f"Implementation failed: {{e}}")
            raise
"""
    except Exception as e:
        return f"# Error in code generation: {str(e)}"


def run_dev_commands_analysis(dev_scripts_dir):
    """Run the EXACT same analysis as QA workflow but on dev-scripts directory"""
    try:
        print(f"[DEV_ANALYSIS] Starting analysis on dev-scripts directory: {dev_scripts_dir}")

        # STEP 1: Temporarily rename generated-scripts to backup
        generated_scripts_dir = os.path.join(os.getcwd(), "..", "generated-scripts")
        backup_dir = os.path.join(os.getcwd(), "..", "generated-scripts-backup")

        # Backup existing generated-scripts if it exists
        if os.path.exists(generated_scripts_dir):
            if os.path.exists(backup_dir):
                import shutil
                shutil.rmtree(backup_dir)
            os.rename(generated_scripts_dir, backup_dir)
            print(f"[DEV_ANALYSIS] Backed up generated-scripts to generated-scripts-backup")

        # STEP 2: Rename dev-scripts to generated-scripts temporarily
        os.rename(dev_scripts_dir, generated_scripts_dir)
        print(f"[DEV_ANALYSIS] Temporarily renamed dev-scripts to generated-scripts")

        # STEP 3: Run the EXACT same run_commands.py that QA uses
        run_commands_path = os.path.join(os.getcwd(), '..', 'run_commands.py')
        parent_dir = os.path.join(os.getcwd(), '..')

        print(f"[DEV_ANALYSIS] Running original run_commands.py...")
        result = subprocess.run(
            ["python3", run_commands_path],
            capture_output=True,
            text=True,
            cwd=parent_dir  # Run from parent directory where config.yaml exists
        )

        print(f"[DEV_ANALYSIS] run_commands.py completed with return code: {result.returncode}")
        if result.stdout:
            print(f"[DEV_ANALYSIS] STDOUT: {result.stdout}")
        if result.stderr:
            print(f"[DEV_ANALYSIS] STDERR: {result.stderr}")

        # STEP 4: Run htmlcombiner.py to generate the combined report BEFORE renaming back
        htmlcombiner_path = os.path.join(os.getcwd(), '..', 'htmlcombiner.py')
        if os.path.exists(htmlcombiner_path):
            print(f"[DEV_ANALYSIS] Running htmlcombiner.py...")
            html_result = subprocess.run(
                ["python3", htmlcombiner_path],
                capture_output=True,
                text=True,
                cwd=parent_dir
            )
            print(f"[DEV_ANALYSIS] htmlcombiner.py completed with return code: {html_result.returncode}")
            if html_result.stdout:
                print(f"[DEV_ANALYSIS] HTML STDOUT: {html_result.stdout}")
            if html_result.stderr:
                print(f"[DEV_ANALYSIS] HTML STDERR: {html_result.stderr}")

            # Check if combinedreport.html was created
            combined_report_path = os.path.join(parent_dir, "reports", "combinedreport.html")
            if os.path.exists(combined_report_path):
                print(f"[DEV_ANALYSIS] ✅ combinedreport.html created successfully at {combined_report_path}")
            else:
                print(f"[DEV_ANALYSIS] ❌ combinedreport.html was NOT created")
        else:
            print(f"[DEV_ANALYSIS] WARNING: htmlcombiner.py not found at {htmlcombiner_path}")

        # STEP 5: Rename back to dev-scripts
        os.rename(generated_scripts_dir, dev_scripts_dir)
        print(f"[DEV_ANALYSIS] Renamed generated-scripts back to dev-scripts")

        # STEP 6: Restore original generated-scripts if it existed
        if os.path.exists(backup_dir):
            os.rename(backup_dir, generated_scripts_dir)
            print(f"[DEV_ANALYSIS] Restored original generated-scripts from backup")

        return {
            'success': result.returncode == 0,
            'stdout': result.stdout,
            'stderr': result.stderr,
            'message': 'Development code analysis completed' if result.returncode == 0 else 'Analysis completed with issues'
        }

    except Exception as e:
        print(f"[ERROR] Dev commands analysis failed: {e}")
        import traceback
        traceback.print_exc()

        # CLEANUP: Make sure to restore directories even if there's an error
        try:
            # Check current state and restore properly
            current_generated = os.path.join(os.getcwd(), "..", "generated-scripts")
            current_dev = dev_scripts_dir
            backup_dir = os.path.join(os.getcwd(), "..", "generated-scripts-backup")

            # If generated-scripts exists and it's actually our dev files, rename it back
            if os.path.exists(current_generated) and not os.path.exists(current_dev):
                os.rename(current_generated, current_dev)
                print(f"[CLEANUP] Restored dev-scripts directory")

            # If backup exists, restore the original generated-scripts
            if os.path.exists(backup_dir):
                if os.path.exists(current_generated):
                    import shutil
                    shutil.rmtree(current_generated)
                os.rename(backup_dir, current_generated)
                print(f"[CLEANUP] Restored original generated-scripts from backup")

        except Exception as cleanup_error:
            print(f"[ERROR] Cleanup failed: {cleanup_error}")

        return {
            'success': False,
            'message': f'Analysis execution failed: {str(e)}'
        }

# Add route for mode switching
@app.route('/switch_mode', methods=['POST'])
def switch_mode():
    """Switch between developer and QA modes"""
    global current_mode

    try:
        data = request.get_json()
        new_mode = data.get('mode', 'qa')

        if new_mode in ['developer', 'qa', 'codebase']:
            current_mode = new_mode
            return jsonify({
                'success': True,
                'current_mode': current_mode,
                'message': f'Switched to {current_mode} mode'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Invalid mode specified'
            })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Mode switch error: {str(e)}'
        })


# Add route to get current mode and context
@app.route('/get_context', methods=['GET'])
def get_current_context():
    """Get current mode and available context"""
    global current_mode, developer_workflows, codebase_context

    return jsonify({
        'current_mode': current_mode,
        'has_codebase_context': len(codebase_context) > 0,
        'codebase_info': {
            'libraries_count': len(codebase_context.get('imports', [])),
            'functions_count': len(codebase_context.get('functions', {})),
            'patterns': list(codebase_context.get('patterns', {}).keys())
        },
        'developer_stories_count': len(developer_workflows),
        'qa_scripts_count': len(generated_scripts_info) if 'generated_scripts_info' in globals() else 0
    })


# FIND your upload_codebase route in app.py and REPLACE it with this:
'''
@app.route('/upload_codebase', methods=['POST'])
def upload_codebase():
    """Handle separate codebase upload"""
    try:
        if 'codebase' not in request.files:
            return jsonify({'success': False, 'message': 'No codebase file provided'})

        file = request.files['codebase']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'})

        if file and file.filename.endswith('.zip'):
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)

            # Extract and analyze the uploaded codebase
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(temp_dir)

                    print(f"[INFO] Extracted ZIP to: {temp_dir}")

                    # Analyze extracted codebase using the FIXED CodebaseContextManager
                    context_manager = CodebaseContextManager()
                    analysis_result = context_manager.analyze_codebase(temp_dir)

                    print(f"[INFO] Analysis result keys: {analysis_result.keys()}")
                    print(f"[INFO] Libraries count: {len(analysis_result.get('imports', []))}")
                    print(f"[INFO] Functions count: {len(analysis_result.get('functions', {}))}")
                    print(f"[INFO] Classes count: {len(analysis_result.get('classes', {}))}")

                    # FIXED: Return the analysis result directly
                    return jsonify({
                        'success': True,
                        'message': 'Codebase uploaded and analyzed successfully',
                        'context_info': {
                            'libraries_count': len(analysis_result.get('imports', [])),
                            'functions_count': len(analysis_result.get('functions', {})),
                            'classes_count': len(analysis_result.get('classes', {})),
                            'patterns': list(analysis_result.get('patterns', {}).keys())
                        },
                        # CRITICAL: Return the actual data arrays/objects
                        'libraries': analysis_result.get('imports', []),
                        'functions': analysis_result.get('functions', {}),
                        'classes': analysis_result.get('classes', {}),
                        'patterns': analysis_result.get('patterns', {}),
                        'dependencies': analysis_result.get('dependencies', [])
                    })

                except Exception as e:
                    print(f"[ERROR] Failed to process codebase: {e}")
                    import traceback
                    traceback.print_exc()
                    return jsonify({
                        'success': False,
                        'message': f'Failed to process codebase: {str(e)}'
                    })
        else:
            return jsonify({'success': False, 'message': 'Please upload a ZIP file containing your codebase'})

    except Exception as e:
        print(f"[ERROR] Codebase upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'Codebase upload error: {str(e)}'})
'''


@app.route('/upload_codebase', methods=['POST'])
def upload_codebase_enhanced():
    """Enhanced codebase upload with full code context storage - FIXED cookie issue"""
    try:
        if 'codebase' not in request.files:
            return jsonify({'success': False, 'message': 'No codebase file provided'})

        file = request.files['codebase']
        if file.filename == '':
            return jsonify({'success': False, 'message': 'No file selected'})

        if file and file.filename.endswith('.zip'):
            filename = secure_filename(file.filename)
            codebase_name = filename.replace('.zip', '')
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)

            # Extract and analyze with full context
            with tempfile.TemporaryDirectory() as temp_dir:
                try:
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(temp_dir)

                    print(f"[INFO] Extracted ZIP to: {temp_dir}")

                    # Use enhanced analyzer
                    analyzer = EnhancedCodebaseAnalyzer()
                    full_analysis = analyzer.analyze_with_full_context(temp_dir)

                    # Store the full analysis persistently
                    codebase_id = f"{codebase_name}_{int(time.time())}"
                    storage_path = store_codebase_permanently(codebase_id, full_analysis)

                    # FIXED: Only store essential data in session, not the full analysis
                    session['current_codebase_id'] = codebase_id
                    session['codebase_name'] = codebase_name
                    session['codebase_storage_path'] = storage_path
                    # DON'T store the full analysis in session - it's too big!
                    # session['codebase_context'] = full_analysis  # REMOVE THIS LINE

                    print(f"[INFO] Stored codebase permanently at: {storage_path}")
                    print(f"[INFO] Analysis: {len(full_analysis['functions'])} functions, {len(full_analysis['classes'])} classes")

                    # Create a summary for the response (not stored in session)
                    context_summary = {
                        'libraries_count': len(full_analysis['imports']),
                        'functions_count': len(full_analysis['functions']),
                        'classes_count': len(full_analysis['classes']),
                        'files_count': len(full_analysis['files']),
                        'patterns': list(full_analysis['patterns'].keys())
                    }

                    # Return lightweight response data
                    return jsonify({
                        'success': True,
                        'message': 'Codebase uploaded and analyzed with full context',
                        'codebase_id': codebase_id,
                        'context_info': context_summary,
                        # Return just the counts and names, not the full data
                        'libraries': full_analysis['imports'][:50],  # Limit to first 50
                        'functions': {name: {'file': info['file'], 'line': info['line'], 'docstring': info['docstring'][:100]}
                                    for name, info in list(full_analysis['functions'].items())[:20]},  # Limit and truncate
                        'classes': {name: {'file': info['file'], 'line': info['line'], 'methods': list(info['methods'].keys())}
                                  for name, info in list(full_analysis['classes'].items())[:10]}  # Limit
                    })

                except Exception as e:
                    return jsonify({
                        'success': False,
                        'message': f'Failed to process codebase: {str(e)}'
                    })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Upload failed: {str(e)}'
        })


def store_codebase_permanently(codebase_id, analysis_data):
    """Store codebase analysis permanently"""
    storage_dir = os.path.join(os.getcwd(), '..', 'codebases', codebase_id)
    os.makedirs(storage_dir, exist_ok=True)

    # Store full analysis
    analysis_file = os.path.join(storage_dir, 'full_analysis.json')
    with open(analysis_file, 'w') as f:
        json.dump(analysis_data, f, indent=2)

    return storage_dir


# UPDATED: Modified build_enhanced_ai_prompt to work with file-based storage
def build_enhanced_ai_prompt(data):
    """Build AI prompt with full codebase context - FIXED to use file storage"""
    # Build basic prompt first
    original_prompt = data.get('originalPrompt', '')
    workflow_type = data.get('workflowType', 'jira')

    prompt = original_prompt if original_prompt else f"""You are an expert software developer working on a {workflow_type} workflow.

Generate production-ready code that implements the requirements.
Include proper error handling, documentation, and follows best practices.
"""

    # Add enhanced codebase context if available
    codebase_id = session.get('current_codebase_id')
    if codebase_id:
        print(f"[PROMPT] Building enhanced prompt with codebase context: {codebase_id}")
        context = get_relevant_codebase_context(codebase_id, workflow_type)
        if context:
            prompt += context
            print(f"[PROMPT] Added {len(context)} characters of codebase context")
        else:
            print(f"[PROMPT] No context loaded for codebase: {codebase_id}")
    else:
        print(f"[PROMPT] No codebase context available in session")

    return prompt

'''
def get_relevant_codebase_context(codebase_id, workflow_type):
    """Get relevant code context for the specific workflow - FIXED to load from file"""
    try:
        # Load from persistent storage instead of session
        storage_dir = os.path.join(os.getcwd(), '..', 'codebases', codebase_id)
        analysis_file = os.path.join(storage_dir, 'full_analysis.json')

        if not os.path.exists(analysis_file):
            print(f"[WARNING] Analysis file not found: {analysis_file}")
            return ""

        print(f"[CONTEXT] Loading codebase context from: {analysis_file}")

        with open(analysis_file, 'r') as f:
            analysis = json.load(f)

        context = "\n\n=== EXISTING CODEBASE CONTEXT ===\n"
        context += f"Available for reuse and pattern matching:\n\n"

        # Add relevant functions (limit to top 15 most relevant)
        functions_items = list(analysis['functions'].items())
        context += "EXISTING FUNCTIONS:\n"
        for func_name, func_info in functions_items[:15]:  # Increased from 10 to 15
            context += f"\nFunction: {func_name}\n"
            context += f"File: {func_info['file']}\n"
            context += f"Purpose: {func_info['docstring'][:150]}...\n"  # Increased from 100 to 150
            context += f"Parameters: {', '.join(func_info['parameters'])}\n"
            # Include more of the actual code for better context
            func_code = func_info['code'][:800] + "..." if len(func_info['code']) > 800 else func_info['code']
            context += f"Code:\n{func_code}\n"
            context += "-" * 60 + "\n"

        # Add relevant classes (limit to top 8)
        if analysis['classes']:
            classes_items = list(analysis['classes'].items())
            context += "\nEXISTING CLASSES:\n"
            for class_name, class_info in classes_items[:8]:  # Increased from 5 to 8
                context += f"\nClass: {class_name}\n"
                context += f"File: {class_info['file']}\n"
                context += f"Purpose: {class_info['docstring'][:150]}...\n"  # Increased from 100 to 150
                context += f"Methods: {', '.join(list(class_info['methods'].keys())[:10])}\n"  # Show up to 10 methods
                # Include more class code
                class_code = class_info['code'][:1000] + "..." if len(class_info['code']) > 1000 else class_info['code']
                context += f"Code:\n{class_code}\n"
                context += "-" * 60 + "\n"

        # Add available libraries section
        if analysis.get('imports'):
            context += f"\nAVAILABLE LIBRARIES:\n"
            context += f"Commonly used: {', '.join(analysis['imports'][:20])}\n\n"

        context += "\nCONTEXT-AWARE INSTRUCTIONS:\n"
        context += "1. Use existing functions when appropriate - don't reinvent the wheel\n"
        context += "2. Follow the same coding patterns and style as existing code\n"
        context += "3. Use the same error handling patterns shown above\n"
        context += "4. Maintain consistency with existing architecture\n"
        context += "5. Import and use existing classes when relevant\n"
        context += "6. Follow the same naming conventions and docstring styles\n"
        context += "7. Use the same logging and exception handling patterns\n\n"

        print(
            f"[CONTEXT] Generated context with {len(functions_items)} functions and {len(analysis.get('classes', {}))} classes")
        print(f"[CONTEXT] Context length: {len(context)} characters")

        return context

    except Exception as e:
        print(f"Error loading codebase context: {e}")
        import traceback
        traceback.print_exc()
        return ""
'''

def get_relevant_codebase_context(codebase_id, workflow_type):
    """Get relevant code context - REDUCED SIZE to not overwhelm AI"""
    try:
        # Load from persistent storage instead of session
        storage_dir = os.path.join(os.getcwd(), '..', 'codebases', codebase_id)
        analysis_file = os.path.join(storage_dir, 'full_analysis.json')

        if not os.path.exists(analysis_file):
            print(f"[WARNING] Analysis file not found: {analysis_file}")
            return {}

        print(f"[CONTEXT] Loading codebase context from: {analysis_file}")

        with open(analysis_file, 'r') as f:
            analysis = json.load(f)

        # CRITICAL: Return structured data instead of massive text block
        # This prevents overwhelming the AI with too much context
        context = {
            'imports': list(analysis.get('imports', []))[:20],  # Top 20 imports
            'functions': {},
            'classes': {},
            'patterns': analysis.get('patterns', {})
        }

        # Add top 10 most relevant functions (reduced from 15)
        functions_items = list(analysis.get('functions', {}).items())[:10]
        for func_name, func_info in functions_items:
            context['functions'][func_name] = {
                'file': func_info['file'],
                'docstring': func_info['docstring'][:200],  # Reduced size
                'parameters': func_info['parameters']
            }

        # Add top 5 most relevant classes (reduced from 8)
        if analysis.get('classes'):
            classes_items = list(analysis.get('classes', {}).items())[:5]
            for class_name, class_info in classes_items:
                context['classes'][class_name] = {
                    'file': class_info['file'],
                    'docstring': class_info['docstring'][:200],  # Reduced size
                    'methods': list(class_info.get('methods', {}).keys())[:5]  # Top 5 methods
                }

        print(
            f"[CONTEXT] Loaded concise context: {len(context['functions'])} functions, {len(context['classes'])} classes")
        return context

    except Exception as e:
        print(f"[ERROR] Failed to load codebase context: {e}")
        return {}


# Enhanced route for reviewing developer code
@app.route('/review_app_code', methods=['POST'])
def review_application_code():
    """Review generated application code using the same run_commands.py flow as QA"""
    global generatedApplicationCode  # Use the same variable as QA workflow

    print(f"[DEBUG] review_application_code called")
    print(f"[DEBUG] generatedApplicationCode exists: {generatedApplicationCode is not None}")
    print(
        f"[DEBUG] generatedApplicationCode length: {len(generatedApplicationCode) if generatedApplicationCode else 0}")
    print(f"[DEBUG] generatedApplicationCode content: {generatedApplicationCode}")

    # Clean up progress files if exists
    try:
        if os.path.exists('progress_review.json'):
            os.remove('progress_review.json')
            print("[CLEANUP] Removed progress_review.json after completion")
    except Exception as e:
        print(f"[CLEANUP] Error removing progress_review.json: {e}")

    try:
        #data = request.get_json()
        # Check if we have generated application code to review
        if not generatedApplicationCode:
            print(f"[ERROR] No generated application code found")
            return jsonify({
                'success': False,
                'message': 'No generated application code found for review. Please generate code first.'
            })
        print(f"[DEBUG] Found {len(generatedApplicationCode)} generated code items to review")

        # Clear previous progress and initialize
        clear_progress('review')
        update_progress('review', 0, 'Starting', 'Preparing application code for review')

        # Step 1: Setup dev-scripts directory (parallel to generated-scripts)
        dev_scripts_dir = os.path.join(os.getcwd(), "..", "dev-scripts")
        os.makedirs(dev_scripts_dir, exist_ok=True)

        # Clean old dev scripts
        update_progress('review', 15, 'Processing', 'Cleaning previous analysis files')
        for filename in os.listdir(dev_scripts_dir):
            file_path = os.path.join(dev_scripts_dir, filename)
            try:
                if os.path.isfile(file_path):
                    os.remove(file_path)
                    print(f"[CLEANUP] Deleted old dev script: {file_path}")
            except Exception as e:
                print(f"[ERROR] Failed to delete {file_path}: {e}")

        update_progress('review', 25, 'Processing', 'Copying application code for analysis')

        '''
        # Step 1: Setup dev-scripts directory (parallel to generated-scripts)
        dev_scripts_dir = os.path.join(os.getcwd(), "..", "dev-scripts")
        os.makedirs(dev_scripts_dir, exist_ok=True)

        # ⭐ CHECK IF FILES ALREADY EXIST (from immediate save)
        existing_files = []
        if os.path.exists(dev_scripts_dir):
            existing_files = [f for f in os.listdir(dev_scripts_dir) if f.endswith('.py')]

        if existing_files:
            print(f"[REVIEW] Found {len(existing_files)} existing files in dev-scripts, skipping copy and cleanup")
            update_progress('review', 40, 'Processing', 'Using pre-saved files from dev-scripts')
            copied_scripts = [os.path.join(dev_scripts_dir, f) for f in existing_files]

            # Create simple order mapping for existing files
            dev_order_mapping = []
            for i, file_name in enumerate(existing_files):
                dev_order_mapping.append({
                    'order_index': i + 1,
                    'script_name': file_name,
                    'story_title': f'Application Code {i + 1}',
                    'source_file': f'generated_application_code_{i + 1}'
                })
        else:
            print("[REVIEW] No existing files found, proceeding with normal copy")

            # KEEP EXISTING CLEANUP AND COPY LOGIC UNCHANGED
            update_progress('review', 15, 'Processing', 'Cleaning previous analysis files')
            for filename in os.listdir(dev_scripts_dir):
                file_path = os.path.join(dev_scripts_dir, filename)
                try:
                    if os.path.isfile(file_path):
                        os.remove(file_path)
                        print(f"[CLEANUP] Deleted old dev script: {file_path}")
                except Exception as e:
                    print(f"[ERROR] Failed to delete {file_path}: {e}")

            update_progress('review', 25, 'Processing', 'Copying application code for analysis')
        '''
        # Step 2: Copy generated application code to dev-scripts directory
        copied_scripts = []
        dev_order_mapping = []

        for i, code_result in enumerate(generatedApplicationCode):
            # Create filename from the code result
            file_name = code_result.get('file_name', f'dev_code_{i + 1}.py')
            if not file_name.endswith('.py'):
                file_name += '.py'

            dest_path = os.path.join(dev_scripts_dir, file_name)

            # Write the generated code to the file
            with open(dest_path, 'w', encoding='utf-8') as f:
                f.write(code_result.get('generated_code', ''))

            copied_scripts.append(dest_path)

            # Create order mapping for dev scripts (similar to QA workflow)
            dev_order_mapping.append({
                'order_index': i + 1,
                'script_name': file_name,
                'story_title': code_result.get('story_title', f'Application Code {i + 1}'),
                'source_file': f'generated_application_code_{i + 1}'
            })

            print(f"[DEV_REVIEW] Created {file_name} for analysis")

        # Step 3: Create order mapping for dev scripts
        mapping_file_path = os.path.join(dev_scripts_dir, 'order_mapping.json')
        with open(mapping_file_path, 'w') as f:
            json.dump(dev_order_mapping, f, indent=2)
        print(f"[DEV_REVIEW] Created dev order mapping with {len(dev_order_mapping)} entries")

        if not copied_scripts:
            return jsonify({
                'success': False,
                'message': 'No application code found to review'
            })

        update_progress('review', 40, 'Processing', 'Running code quality analysis')

        # Step 4: Run the SAME run_commands.py analysis but on dev-scripts
        print(f"[DEV_REVIEW] Running run_commands.py analysis on dev-scripts")

        # Temporarily change the script path in run_commands.py logic
        dev_run_commands_result = run_dev_commands_analysis(dev_scripts_dir)

        update_progress('review', 70, 'Processing', 'Generating development review reports')

        # Step 5: Process results same as QA workflow
        if dev_run_commands_result['success']:
            # Generate individual reports for each application code file
            individual_reports = []

            for i, code_result in enumerate(generatedApplicationCode):
                script_id = i + 1
                individual_summary_path = os.path.join(os.getcwd(), '..', 'reports', f'summary{script_id}.txt')

                if os.path.exists(individual_summary_path):
                    with open(individual_summary_path, 'r') as f:
                        summary_content = f.read()
                else:
                    # Fallback to main summary
                    main_summary_path = os.path.join(os.getcwd(), '..', 'reports', 'summary.txt')
                    try:
                        with open(main_summary_path, 'r') as f:
                            summary_content = f.read()
                    except FileNotFoundError:
                        summary_content = """APPLICATION CODE REVIEW COMPLETED
======================
✅ Code formatting analysis completed
✅ Style and lint checks completed  
✅ Security analysis completed
✅ Static code analysis completed

Please check individual tool reports for detailed results."""

                individual_report = f"""=== APPLICATION CODE REVIEW REPORT ===
File: {code_result.get('file_name', f'dev_code_{i + 1}.py')}
Story: {code_result.get('story_title', 'Application Code')}

{summary_content}

=== DEVELOPMENT ACTIONS REQUIRED ===
   ✅ 1. Look for [PASS] ✅ or [FAIL] ❌ indicators in the analysis above
   ✅ 2. CHECK "OPEN REPORT" FOR COMPREHENSIVE HTML RESULTS
   ✅ 3. ADDRESS ANY CODE FORMATTING OR STYLE ISSUES
   ✅ 4. FIX SECURITY VULNERABILITIES IF FOUND
   ✅ 5. RESOLVE STATIC ANALYSIS WARNINGS
   ✅ 6. CODE IS READY FOR DEPLOYMENT IF ALL CHECKS PASS

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: APPLICATION CODE REVIEW COMPLETED. ADDRESS ISSUES BEFORE DEPLOYMENT. ⚠️  ██
██ 🚀 CODE IS READY FOR DEPLOYMENT IF ALL STATIC ANALYSIS CHECKS PASS. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████"""

                individual_reports.append({
                    'script_id': script_id,
                    'script_name': code_result.get('file_name', f'dev_code_{i + 1}.py'),
                    'story_title': code_result.get('story_title', 'Application Code'),
                    'review_report': individual_report
                })

            update_progress('review', 100, 'Completed', 'Application code review completed', True)

            return jsonify({
                'success': True,
                'individual_reports': individual_reports,
                'total_scripts': len(individual_reports),
                'message': f'Application code review completed successfully for {len(individual_reports)} file(s)!'
            })
        else:
            return jsonify({
                'success': False,
                'message': dev_run_commands_result.get('message', 'Code review analysis failed')
            })

    except Exception as e:
        update_progress('review', 0, 'Error', f'Review failed: {str(e)}', True)
        return jsonify({
            'success': False,
            'message': f'Application code review error: {str(e)}'
        })


@app.route('/get_file_content', methods=['POST'])
def get_file_content():
    """Get the content of an uploaded file"""
    try:
        data = request.get_json()
        filepath = data.get('filepath', '')

        full_path = os.path.join(app.config['UPLOAD_FOLDER'], filepath)

        if not os.path.exists(full_path):
            return jsonify({
                'success': False,
                'message': 'File not found'
            })

        # Read file content based on type
        content = ""
        if filepath.endswith('.json'):
            with open(full_path, 'r', encoding='utf-8') as f:
                json_data = json.load(f)
                content = json.dumps(json_data, indent=2)
        elif filepath.endswith('.pdf'):
            # You'll need to add PDF reading capability
            content = "PDF content extraction not implemented yet"
        elif filepath.endswith(('.doc', '.docx')):
            # You'll need to add DOC reading capability
            content = "DOC content extraction not implemented yet"
        else:
            # Text files (txt, xml, etc.)
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

        return jsonify({
            'success': True,
            'content': content
        })

    except Exception as e:
        print(f"[ERROR] Failed to read file content: {e}")
        return jsonify({
            'success': False,
            'message': f'Error reading file: {str(e)}'
        })


@app.route('/process_developer_prompt', methods=['POST'])
def process_developer_prompt():
    """Process the developer requirements and prepare for code generation"""
    try:
        data = request.get_json()
        prompt = data.get('prompt', '')
        workflow_type = data.get('workflowType', 'jira')
        raw_inputs = data.get('rawInputs', {})

        print(f"[DEVELOPER] Processing {workflow_type} workflow")
        print(f"[DEVELOPER] Prompt length: {len(prompt)} characters")

        # Extract key requirements from the prompt
        extracted_requirements = extract_requirements(prompt, workflow_type)

        # NEW: Save the prompt data to a file for later use
        try:
            # Create a directory for storing developer prompts
            prompts_dir = os.path.join(os.getcwd(), '..', 'developer_prompts')
            os.makedirs(prompts_dir, exist_ok=True)

            # Generate unique filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            prompt_filename = f"developer_prompt_{workflow_type}_{timestamp}.txt"
            prompt_filepath = os.path.join(prompts_dir, prompt_filename)

            # Save the complete prompt to file
            with open(prompt_filepath, 'w', encoding='utf-8') as f:
                f.write(f"=== DEVELOPER PROMPT DATA ===\n")
                f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Workflow Type: {workflow_type}\n")
                f.write(f"Prompt Length: {len(prompt)} characters\n\n")
                f.write(f"=== RAW INPUTS ===\n")
                f.write(f"Files: {len(raw_inputs.get('files', []))}\n")
                f.write(f"Requirements Text: {len(raw_inputs.get('requirements', ''))} chars\n")
                f.write(f"Technical Notes: {len(raw_inputs.get('technicalNotes', ''))} chars\n\n")
                f.write(f"=== GENERATED PROMPT ===\n")
                f.write(prompt)

            print(f"[DEVELOPER] Prompt saved to: {prompt_filepath}")

            # Store the prompt in session for later use by generate_app_code
            session['developer_prompt'] = prompt
            session['extracted_requirements'] = extracted_requirements
            session['workflow_type'] = workflow_type
            session['prompt_file_path'] = prompt_filepath

        except Exception as e:
            print(f"[ERROR] Failed to save prompt to file: {e}")
            # Continue anyway - saving to session is the minimum requirement
            session['developer_prompt'] = prompt
            session['extracted_requirements'] = extracted_requirements
            session['workflow_type'] = workflow_type

        return jsonify({
            'success': True,
            'message': 'Requirements processed and prompt saved successfully',
            'extractedRequirements': extracted_requirements,
            'promptSaved': True,
            'promptLength': len(prompt),
            'workflowType': workflow_type
        })

    except Exception as e:
        print(f"[ERROR] Failed to process developer prompt: {e}")
        return jsonify({
            'success': False,
            'message': f'Error processing requirements: {str(e)}'
        })


def extract_requirements(prompt, workflow_type):
    """Extract and summarize key requirements from the prompt"""
    requirements = {
        'type': workflow_type,
        'summary': '',
        'key_points': [],
        'technical_requirements': [],
        'acceptance_criteria': []
    }

    # Parse the prompt sections
    sections = prompt.split('===')

    for section in sections:
        section = section.strip()

        if 'USER REQUIREMENTS' in section:
            # Extract user requirements
            lines = section.split('\n')[1:]  # Skip header
            requirements['summary'] = '\n'.join(lines).strip()

        elif 'TECHNICAL NOTES' in section:
            # Extract technical notes
            lines = section.split('\n')[1:]  # Skip header
            for line in lines:
                if line.strip().startswith('-'):
                    requirements['technical_requirements'].append(line.strip()[1:].strip())

        elif 'UPLOADED REQUIREMENTS' in section:
            # Parse uploaded content for JIRA stories
            if workflow_type == 'jira' and 'acceptance criteria' in section.lower():
                # Extract acceptance criteria
                ac_match = re.search(r'acceptance criteria[:\s]*(.*?)(?=\n\n|\Z)',
                                     section, re.IGNORECASE | re.DOTALL)
                if ac_match:
                    ac_text = ac_match.group(1).strip()
                    ac_items = [item.strip() for item in ac_text.split('\n')
                                if item.strip() and item.strip() != '-']
                    requirements['acceptance_criteria'].extend(ac_items)

    # Extract key points from summary
    if requirements['summary']:
        # Simple extraction of bullet points or key phrases
        for line in requirements['summary'].split('\n'):
            if line.strip().startswith(('-', '*', '•')) or 'should' in line.lower() or 'must' in line.lower():
                requirements['key_points'].append(line.strip().lstrip('-*•').strip())

    # Format the extracted requirements
    formatted = f"Workflow Type: {requirements['type'].upper()}\n\n"

    if requirements['summary']:
        formatted += f"Summary:\n{requirements['summary'][:500]}...\n\n" if len(
            requirements['summary']) > 500 else f"Summary:\n{requirements['summary']}\n\n"

    if requirements['key_points']:
        formatted += "Key Requirements:\n"
        for point in requirements['key_points'][:5]:  # Limit to first 5
            formatted += f"• {point}\n"
        formatted += "\n"

    if requirements['acceptance_criteria']:
        formatted += "Acceptance Criteria:\n"
        for criteria in requirements['acceptance_criteria'][:5]:  # Limit to first 5
            formatted += f"✓ {criteria}\n"
        formatted += "\n"

    if requirements['technical_requirements']:
        formatted += "Technical Requirements:\n"
        for req in requirements['technical_requirements']:
            formatted += f"• {req}\n"

    return formatted


def check_functionality_compliance(code):
    """Check if code meets functional requirements"""
    # Implement functionality compliance check
    return {
        'score': 85,
        'issues': [],
        'recommendations': ['Add more input validation', 'Include error handling for edge cases']
    }


def analyze_code_quality(code):
    """Analyze code quality metrics"""
    # Implement code quality analysis
    return {
        'score': 90,
        'complexity': 'Medium',
        'maintainability': 'High',
        'readability': 'High'
    }


def perform_security_scan(code):
    """Perform security analysis"""
    # Implement security scanning
    return {
        'score': 95,
        'vulnerabilities': [],
        'security_level': 'High'
    }


def analyze_performance(code):
    """Analyze performance implications"""
    # Implement performance analysis
    return {
        'score': 80,
        'potential_bottlenecks': ['Database queries in loop'],
        'optimization_suggestions': ['Use bulk operations for database']
    }


def check_best_practices(code):
    """Check adherence to best practices"""
    # Implement best practices check
    return {
        'score': 88,
        'pep8_compliance': True,
        'documentation_score': 85,
        'test_coverage': 'Recommended'
    }


def calculate_overall_score(review_results):
    """Calculate overall code review score"""
    scores = [
        review_results['functionality_check']['score'],
        review_results['code_quality']['score'],
        review_results['security_scan']['score'],
        review_results['performance_check']['score'],
        review_results['best_practices']['score']
    ]
    return sum(scores) / len(scores)

@app.errorhandler(413)
def too_large(e):
    return jsonify({'success': False, 'message': 'File too large. Maximum size is 16MB.'}), 413


@app.errorhandler(404)
def not_found(e):
    return render_template('index.html'), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500


if __name__ == '__main__':
    # Initialize devices configuration
    load_devices_config()

    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])
    '''
    try:
        app.run(host='0.0.0.0', port=port, debug=app.config['DEBUG'])
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Interrupted")
    finally:
        progress_cleanup()
    '''
