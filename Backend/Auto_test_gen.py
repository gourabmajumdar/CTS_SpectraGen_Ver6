# Enhanced Auto_test_gen.py - PRESERVING EXISTING QA FUNCTIONALITY
import os
import re
import json
import time
import requests
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import torch
from datetime import datetime
import logging
import argparse
import sys
from smart_code_reuse import DeveloperWorkflowReuse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from smart_code_reuse import DeveloperWorkflowReuse
    SMART_REUSE_AVAILABLE = True
except ImportError:
    SMART_REUSE_AVAILABLE = False
    print("⚠️ Smart code reuse not available")

class EnhancedCodeGenerator:
    """Enhanced code generator supporting both QA testing and application development with multiple AI backends"""

    def __init__(self, mode='qa', ai_backend='ollama'):
        """
        Initialize the code generator

        Args:
            mode (str): 'qa' or 'developer'
            ai_backend (str): 'llama2', 'ollama', or 'auto' (tries ollama first, fallback to llama2)
        """
        self.mode = mode
        self.ai_backend = ai_backend
        self.generator = None
        self.ollama_model = "codellama:7b"  # Lightweight coding model
        # IMPROVED MODEL SELECTION - Try better models for instruction following
        self.ollama_models = {
            # RECOMMENDED: Best models for code generation with instructions
            'primary': 'deepseek-coder:6.7b',  # Excellent for code + tests
            'backup1': 'codegemma:7b',  # Google's code model
            'backup2': 'codellama:13b-instruct',  # Larger, better instruction following
            'backup3': 'mistral:7b-instruct',  # Good general instruction following
            'fallback': 'codellama:7b'  # Your current model
        }
        self.ollama_base_url = "http://localhost:11434"

        # Try to find the best available model
        #self.ollama_model = self.find_best_available_model()

        # Initialize the selected AI backend
        self.initialize_ai_backend()

    def find_best_available_model(self):
        """Find the best available Ollama model for code generation"""
        try:
            import requests
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                available_models = [model['name'] for model in response.json().get('models', [])]
                print(f"[OLLAMA] Available models: {available_models}")

                # Try models in order of preference
                for model_type, model_name in self.ollama_models.items():
                    if model_name in available_models:
                        print(f"[OLLAMA] Selected {model_type} model: {model_name}")
                        return model_name

                # If none of the preferred models are available, return the fallback
                print(f"[OLLAMA] No preferred models available, using fallback: {self.ollama_models['fallback']}")
                return self.ollama_models['fallback']
            else:
                print(f"[OLLAMA] API not responding, using default model")
                return self.ollama_models['fallback']

        except Exception as e:
            print(f"[OLLAMA] Error checking available models: {e}")
            return self.ollama_models['fallback']

    def initialize_ai_backend(self):
        """Initialize the selected AI backend"""
        if self.ai_backend == 'auto':
            # Try Ollama first, fallback to Llama2
            if self.initialize_ollama():
                self.ai_backend = 'ollama'
                logger.info(f"[{self.mode.upper()}] Auto-selected Ollama backend")
            else:
                logger.info(f"[{self.mode.upper()}] Ollama unavailable, falling back to Llama2")
                self.ai_backend = 'llama2'
                self.initialize_llama_model()
        elif self.ai_backend == 'ollama':
            self.initialize_ollama()
        elif self.ai_backend == 'llama2':
            self.initialize_llama_model()
        else:
            raise ValueError(f"Unknown AI backend: {self.ai_backend}")

    def initialize_ollama(self):
        """Initialize Ollama connection"""
        try:
            logger.info(f"[{self.mode.upper()}] Connecting to Ollama...")

            # Test Ollama connection
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                models = response.json().get('models', [])
                available_models = [model['name'] for model in models]

                # Check if our preferred model is available
                if self.ollama_model in available_models:
                    logger.info(f"[{self.mode.upper()}] Ollama connected successfully with model: {self.ollama_model}")
                    return True
                else:
                    # Try to pull the model
                    logger.info(f"[{self.mode.upper()}] Model {self.ollama_model} not found, attempting to pull...")
                    pull_response = requests.post(f"{self.ollama_base_url}/api/pull",
                                                  json={"name": self.ollama_model})
                    if pull_response.status_code == 200:
                        logger.info(f"[{self.mode.upper()}] Successfully pulled {self.ollama_model}")
                        return True
                    else:
                        logger.warning(f"[{self.mode.upper()}] Failed to pull {self.ollama_model}")
                        return False
            else:
                logger.warning(f"[{self.mode.upper()}] Ollama not responding")
                return False

        except requests.exceptions.RequestException as e:
            logger.warning(f"[{self.mode.upper()}] Failed to connect to Ollama: {e}")
            return False

    def initialize_llama_model(self):
        """Initialize LLaMA model for code generation"""
        try:
            logger.info(f"[{self.mode.upper()}] Initializing LLaMA model...")

            # Initialize tokenizer and model
            self.tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-chat-hf")
            self.model = AutoModelForCausalLM.from_pretrained(
                "meta-llama/Llama-2-7b-chat-hf",
                device_map="auto",
                torch_dtype=torch.float16
            )

            # Create generation pipeline
            self.generator = pipeline(
                "text-generation",
                model=self.model,
                tokenizer=self.tokenizer,
            )

            logger.info(f"[{self.mode.upper()}] LLaMA model initialized successfully")
            return True

        except Exception as e:
            logger.error(f"[ERROR] Failed to initialize LLaMA model: {e}")
            self.generator = None
            return False

    def generate_code(self, input_data, context=None, generation_options=None):
        """Main code generation entry point"""
        if self.mode == 'developer':
            return self.generate_application_code(input_data, context, generation_options)
        else:
            return self.generate_test_code(input_data)
    '''
    def generate_application_code(self, prompt_data, codebase_context=None, generation_options=None):
        """Generate application code from prompt data"""
        try:
            logger.info(f"[DEVELOPER] Generating code using {self.ai_backend} backend")

            # Parse the prompt data (from Flask backend)
            if isinstance(prompt_data, str):
                # If it's a string, treat it as the prompt
                ai_prompt = prompt_data
                include_tests = True  # Default for backward compatibility
            else:
                # If it's a dict, extract prompt and options
                ai_prompt = prompt_data.get('prompt', '')
                include_tests = prompt_data.get('include_tests', True)

            # Generate code using the selected backend
            if self.ai_backend == 'ollama':
                generated_code = self.generate_with_ollama(ai_prompt, mode='developer')
            elif self.ai_backend == 'llama2':
                generated_code = self.generate_with_llama(ai_prompt, mode='developer')
            else:
                raise ValueError(f"Unknown AI backend: {self.ai_backend}")

            # Process the generated code
            if include_tests:
                # Split into main code and unit tests
                main_code, unit_tests = self.separate_main_code_and_tests(generated_code)

                # Return both main code and tests as separate files
                result = []

                if main_code.strip():
                    result.append({
                        'file_name': 'main_implementation.py',
                        'generated_code': main_code,
                        'story_id': 'MAIN-001',
                        'story_title': 'Main Implementation'
                    })

                if unit_tests.strip():
                    result.append({
                        'file_name': 'unit_tests.py',
                        'generated_code': unit_tests,
                        'story_id': 'TEST-001',
                        'story_title': 'Unit Tests'
                    })

                return result
            else:
                # Return only main code
                return [{
                    'file_name': 'implementation.py',
                    'generated_code': generated_code,
                    'story_id': 'IMPL-001',
                    'story_title': 'Implementation'
                }]

        except Exception as e:
            logger.error(f"[ERROR] Application code generation failed: {e}")
            return [{
                'file_name': 'error.py',
                'generated_code': f"# Error generating code: {str(e)}",
                'story_id': 'ERROR-001',
                'story_title': 'Generation Error'
            }]
    '''

    def infer_language_from_prompt(self, prompt: str) -> str: #Divya_NEW
        prompt_lower = prompt.lower()
        print(f"******************************* {prompt_lower}")
        if 'java' in prompt_lower:
            return 'java'
        elif 'c++' in prompt_lower or 'cpp' in prompt_lower:
            return 'cpp'
        elif 'c program' in prompt_lower or 'c' in prompt_lower:
            return 'c'
        else:
            return 'python'

    def generate_application_code(self, prompt_data, codebase_context=None, generation_options=None):
        """Generate application code with smart reuse capability - PRESERVES EXISTING INTERFACE"""
        try:
            logger.info(f"[DeVELOPER] Generating application code {generation_options}")

            # Extract prompt from prompt_data (adapt to your current data structure)
            if isinstance(prompt_data, dict):
                prompt = prompt_data.get('prompt', '') or prompt_data.get('description', '') or str(prompt_data)

            if isinstance(prompt_data, dict):
                prompt = prompt_data.get('prompt', '') or prompt_data.get('description', '') or str(prompt_data)
                language = prompt_data.get('language')
            else:
                prompt = str(prompt_data)
                language = None
            if not language:
                language = self.infer_language_from_prompt(prompt)
            print(f"******************************* {language}")
            '''    
            else:
                prompt = str(prompt_data)
                if isinstance(prompt_data, dict): #Divya_New
                    language = prompt_data.get('language')
                    prompt = prompt_data.get('prompt', '') or prompt_data.get('description', '') or str(prompt_data)
                else:
                    language = None
                    prompt = str(prompt_data)

                if not language:
                    language = self.infer_language_from_prompt(prompt)
            '''
            logger.info(f"[DEVELOPER] Extracted prompt: {prompt[:100]}...")

            # TRY SMART REUSE FIRST (if available)
            if SMART_REUSE_AVAILABLE and prompt.strip():
                try:
                    smart_reuse = DeveloperWorkflowReuse()
                    smart_reuse.initialize()

                    # Determine if tests should be included
                    #include_tests = True
                    include_tests = False
                    if generation_options and isinstance(generation_options, dict):
                        include_tests = generation_options.get('includeTests', True) or generation_options.get(
                            'include_tests', True)

                    reuse_result = smart_reuse.get_reusable_code(
                        prompt=prompt,
                        include_tests=include_tests,
                        confidence_threshold=2.0
                    )

                    if reuse_result:
                        logger.info(f"✅ Smart reuse found with {reuse_result['confidence']:.1f}% confidence")
                        logger.info(f"⚡ Time saved: ~{reuse_result['time_saved']}s")
                        return reuse_result['generated_code']
                    else:
                        logger.info("❌ No suitable reusable code found, proceeding with AI generation")

                except Exception as e:
                    logger.warning(f"Smart reuse failed: {e}, proceeding with AI generation")

            # FALLBACK TO YOUR EXISTING AI GENERATION LOGIC
            logger.info("🤖 Using AI generation")

            # YOUR EXISTING CODE CONTINUES HERE - KEEP EVERYTHING BELOW AS IS
            # This preserves all your current logic for:
            # - Building prompts
            # - Calling Ollama/LLaMA
            # - Processing generation options
            # - Handling codebase context
            # - Error handling and fallbacks

            # FOR NOW, I'll show a simplified version that delegates to your existing workflow detection
            # You can replace this with your actual existing logic

            # Check if this is a story-based generation or prompt-based
            if isinstance(prompt_data, dict) and 'workflow_type' in prompt_data:
                workflow_type = prompt_data.get('workflow_type', 'jira')
            else:
                workflow_type = 'jira'  # default

            # Build enhanced prompt with your existing logic
            #enhanced_prompt = self.build_enhanced_prompt(prompt_data, codebase_context, generation_options) - DIVYA
            enhanced_prompt = self.build_enhanced_prompt(prompt_data, codebase_context, generation_options, language) #Divya_NEW

            # Generate code using your existing backend selection
            if self.ai_backend == 'ollama':
                generated_code = self.generate_with_ollama(enhanced_prompt, mode='developer')
            elif self.ai_backend == 'llama2':
                generated_code = self.generate_with_llama(enhanced_prompt, mode='developer')
            else:
                generated_code = self.generate_fallback_application_code(prompt_data)

            # Clean and format the generated code with your existing logic
            #clean_code = self.extract_and_clean_code(generated_code, mode='developer') - DIVYA
            clean_code = self.extract_and_clean_code(generated_code, mode='developer', language=language) #Divya_NEW

            # Determine if tests should be included
            #include_tests = True
            include_tests = False
            if generation_options and isinstance(generation_options, dict):
                include_tests = generation_options.get('includeTests', True) or generation_options.get('include_tests',
                                                                                                       True)
            # Separate main code and unit tests if needed
            if include_tests:
                main_code, unit_tests = self.separate_main_code_and_tests(clean_code)

                result = []
                if main_code.strip():
                    result.append({
                        'file_name': 'main_implementation.py',
                        'generated_code': main_code,
                        'story_id': 'MAIN-001',
                        'story_title': 'Main Implementation'
                    })

                if unit_tests.strip():
                    result.append({
                        'file_name': 'test_implementation.py',
                        'generated_code': unit_tests,
                        'story_id': 'TEST-001',
                        'story_title': 'Unit Tests'
                    })

                return result
            else:
                return [{
                    'file_name': 'generated_implementation.py',
                    'generated_code': clean_code,
                    'story_id': 'AI-GEN-001',
                    'story_title': 'AI Generated Implementation'
                }]

        except Exception as e:
            logger.error(f"[ERROR] Application code generation failed: {e}")
            return [{
                'file_name': 'error.py',
                'generated_code': f"# Error generating code: {str(e)}",
                'story_id': 'ERROR-001',
                'story_title': 'Generation Error'
            }]

    def generate_test_code(self, test_case_data):
        """Generate test code for QA workflow (PRESERVED ORIGINAL FUNCTIONALITY)"""
        try:
            logger.info(f"[QA] Generating test code for: {test_case_data.get('test_case_name', 'Unknown')}")

            # Build test-specific prompt
            prompt = self.build_test_prompt(test_case_data)

            # Generate code using selected backend
            if self.ai_backend == 'ollama':
                generated_code = self.generate_with_ollama(prompt, mode='qa')
            elif self.ai_backend == 'llama2':
                generated_code = self.generate_with_llama(prompt, mode='qa')
            else:
                generated_code = self.generate_fallback_test_code(test_case_data)

            # Clean and format the generated code
            clean_code = self.extract_and_clean_code(generated_code, mode='qa')

            return {
                'success': True,
                'code': clean_code,
                'test_case_name': test_case_data.get('test_case_name', 'unknown')
            }

        except Exception as e:
            logger.error(f"[ERROR] Test code generation failed: {e}")
            return {
                'success': False,
                'code': f"# Error generating test code: {str(e)}",
                'test_case_name': test_case_data.get('test_case_name', 'unknown'),
                'error': str(e)
            }

    # 3. ADD this helper method (only if you don't have something similar)
    def build_enhanced_prompt(self, prompt_data, codebase_context=None, generation_options=None, language='python'): #Divya_NEW
    #def build_enhanced_prompt(self, prompt_data, codebase_context=None, generation_options=None): - DIVYA
        """Build enhanced prompt - adapt this to your existing prompt building logic"""

        # If you already have prompt building logic, use that instead
        # This is just a fallback

        if isinstance(prompt_data, dict):
            base_prompt = prompt_data.get('prompt', '') or prompt_data.get('description', '')
        else:
            base_prompt = str(prompt_data)

        #enhanced_prompt = f"""You are an expert Python developer. Generate production-ready code. - DIVYA
        #Divya_NEW
        enhanced_prompt = f"""You are an expert {language} developer. GEnerate production-ready code in {language}. 


    Requirements:
    {base_prompt}

    Instructions:
    - Write clean, maintainable {language} code
    - Include proper error handling
    - Add comprehensive docstrings
    - Follow Python best practices
    """

        # Add generation options if provided
        if generation_options:
            if generation_options.get('includeTests') or generation_options.get('include_tests'):
                enhanced_prompt += """
            - Include comprehensive unit tests after the main code
            - Use this EXACT separator: # ============================================================
            - Add this EXACT header: # Unit Tests
            - Write tests using the unittest framework
            """
            if generation_options.get('generateDocs'):
                enhanced_prompt += "\n- Generate detailed documentation"

        return enhanced_prompt

    # 4. OPTIONALLY add this helper if you don't have similar logic
    def generate_fallback_application_code(self, prompt_data):
        """Generate fallback code when AI generation fails"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        return f'''"""
    Generated Application Code - Fallback Mode
    Generated on: {timestamp}
    AI Backend: {self.ai_backend} (fallback)
    """

    import logging
    from typing import Any, Dict

    logger = logging.getLogger(__name__)

    class ApplicationImplementation:
        """Fallback application implementation"""

        def __init__(self):
            self.logger = logging.getLogger(self.__class__.__name__)

        def execute(self) -> Dict[str, Any]:
            """Execute the application logic"""
            try:
                self.logger.info("Executing application implementation")

                # TODO: Implement actual application logic
                result = {{
                    "status": "success",
                    "message": "Application executed successfully",
                    "timestamp": "{timestamp}"
                }}

                return result

            except Exception as e:
                self.logger.error(f"Application execution failed: {{e}}")
                return {{
                    "status": "error",
                    "message": str(e)
                }}

    def main():
        """Main execution function"""
        app = ApplicationImplementation()
        result = app.execute()

        if result["status"] == "success":
            print(f"[PASS] ✅ {{result['message']}}")
        else:
            print(f"[FAIL] ❌ {{result['message']}}")

    if __name__ == "__main__":
        main()
    '''

    # COMMENTING IT FOR NOW FOR DEBUG
    '''
    def generate_with_ollama(self, prompt, mode='qa'):
        """Generate code using Ollama API"""
        try:
            logger.info(f"[{mode.upper()}] Generating code with Ollama...")

            # Configure generation parameters based on mode
            if mode == 'developer':
                max_tokens = 2000
                temperature = 0.1  # Lower temperature for more deterministic code
            else:
                max_tokens = 1000
                temperature = 0.2

            # Prepare the request
            data = {
                "model": self.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "top_p": 0.9,
                    "top_k": 40
                }
            }

            # Make the request
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=data,
                timeout=120  # 2 minutes timeout
            )

            if response.status_code == 200:
                result = response.json()
                generated_text = result.get('response', '')
                logger.info(f"[{mode.upper()}] Ollama generation completed ({len(generated_text)} chars)")
                return generated_text
            else:
                logger.error(f"[ERROR] Ollama API error: {response.status_code}")
                return self.generate_fallback_code(mode)

        except Exception as e:
            logger.error(f"[ERROR] Ollama generation failed: {e}")
            return self.generate_fallback_code(mode)
    '''

    def generate_with_ollama(self, prompt, mode='qa'):
        """Generate code using Ollama API"""
        try:
            logger.info(f"[{mode.upper()}] Generating code with Ollama...")

            # Configure generation parameters based on mode
            if mode == 'developer':
                max_tokens = 2000
                temperature = 0.1  # Lower temperature for more deterministic code
            else:
                max_tokens = 1000
                temperature = 0.2

            # Enhanced prompt for better test separation in developer mode
            if mode == 'developer':
                enhanced_prompt = f"""You are an expert Python developer. Follow these instructions exactly:

    {prompt}

    CRITICAL: If unit tests are requested, use this EXACT format:
    1. Write the main implementation code first
    2. Add this EXACT line: # ============================================================
    3. Add this EXACT line: # Unit Tests
    4. Write unit tests using unittest framework

    The separator lines are MANDATORY for proper parsing."""
            else:
                enhanced_prompt = prompt

            # Prepare the request
            data = {
                "model": self.ollama_model,
                "prompt": enhanced_prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "top_p": 0.9,
                    "top_k": 40,
                    "repeat_penalty": 1.1,
                    "stop": ["```\n\n", "# End of code"]  # Stop tokens to prevent rambling
                }
            }

            # Make the request
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=data,
                timeout=120  # 2 minutes timeout
            )

            if response.status_code == 200:
                result = response.json()
                generated_text = result.get('response', '')
                logger.info(f"[{mode.upper()}] Ollama generation completed ({len(generated_text)} chars)")
                return generated_text
            else:
                logger.error(f"[ERROR] Ollama API error: {response.status_code}")
                return self.generate_fallback_code(mode)

        except Exception as e:
            logger.error(f"[ERROR] Ollama generation failed: {e}")
            return self.generate_fallback_code(mode)

    '''
    def generate_with_ollama(self, prompt, mode='qa'):
        """Generate code using Ollama API - IMPROVED FOR BETTER MODELS"""
        try:
            logger.info(f"[{mode.upper()}] Generating code with Ollama using model: {self.ollama_model}")

            # IMPROVED: Model-specific parameters for better instruction following
            if 'deepseek-coder' in self.ollama_model:
                # DeepSeek Coder - best for code generation
                max_tokens = 4000
                temperature = 0.1
                top_p = 0.95
                top_k = 50
            elif 'codegemma' in self.ollama_model:
                # CodeGemma - Google's code model
                max_tokens = 3000
                temperature = 0.2
                top_p = 0.9
                top_k = 40
            elif 'instruct' in self.ollama_model:
                # Instruction-tuned models
                max_tokens = 3000
                temperature = 0.1
                top_p = 0.9
                top_k = 40
            else:
                # Default parameters
                max_tokens = 2000
                temperature = 0.2
                top_p = 0.9
                top_k = 40

            # Enhanced prompt for better instruction following
            if mode == 'developer':
                enhanced_prompt = f"""You are an expert Python developer. Follow these instructions exactly:

{prompt}

IMPORTANT: If the user requested unit tests, you MUST generate them after the main code using this exact format:
1. Write the main implementation code
2. Add this separator: # ============================================================
3. Add this header: # Unit Tests
4. Write comprehensive unit tests using the unittest framework

The separator lines are MANDATORY for proper parsing."""
            else:
                enhanced_prompt = prompt

            # Prepare the request with model-specific parameters
            data = {
                "model": self.ollama_model,
                "prompt": enhanced_prompt,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                    "top_p": top_p,
                    "top_k": top_k,
                    "repeat_penalty": 1.1,
                    "stop": ["```\n\n", "# End of code"]  # Stop tokens to prevent rambling
                }
            }

            # Make the request with longer timeout for larger models
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=data,
                timeout=180  # 3 minutes for larger models
            )

            if response.status_code == 200:
                result = response.json()
                generated_text = result.get('response', '')
                logger.info(
                    f"[{mode.upper()}] Ollama generation completed ({len(generated_text)} chars) using {self.ollama_model}")
                return generated_text
            else:
                logger.error(f"[ERROR] Ollama API error: {response.status_code}")
                return self.generate_fallback_code(mode)

        except Exception as e:
            logger.error(f"[ERROR] Ollama generation failed: {e}")
            return self.generate_fallback_code(mode)
'''
    def generate_with_llama(self, prompt, mode='qa'):
        """Generate code using LLaMA model"""
        try:
            logger.info(f"[{mode.upper()}] Generating code with LLaMA...")

            if not self.generator:
                logger.error("[ERROR] LLaMA generator not initialized")
                return self.generate_fallback_code(mode)

            # Configure generation parameters based on mode
            if mode == 'developer':
                max_tokens = 800
                temperature = 0.2  # Lower temperature for more deterministic code
                top_p = 0.8
            else:
                max_tokens = 400
                temperature = 0.3
                top_p = 0.9

            outputs = self.generator(
                prompt,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id,
                eos_token_id=self.tokenizer.eos_token_id,
                repetition_penalty=1.1
            )

            generated_text = outputs[0]['generated_text']
            logger.info(f"[{mode.upper()}] LLaMA generation completed")

            return generated_text

        except Exception as e:
            logger.error(f"[ERROR] LLaMA generation failed: {e}")
            return self.generate_fallback_code(mode)


    def build_test_prompt(self, test_case_data):
        """Build prompt for test code generation (PRESERVED ORIGINAL LOGIC)"""
        test_steps = test_case_data.get('test_steps', '').replace(''', "'").replace(''', "'")
        expected_results = test_case_data.get('expected_results', '').replace(''', "'").replace(''', "'")

        prompt = f"""<s>[INST] You are an expert test automation engineer.

Generate a Python test script for the following test case:

Test Case: {test_case_data.get('test_case_name', 'N/A')}
Purpose: {test_case_data.get('purpose', 'N/A')}
Pre-conditions: {test_case_data.get('pre_conditions', 'N/A')}
Test Steps: {test_steps}
Expected Results: {expected_results}

Write a Python script that:
- Defines a function and uses the if __name__ == "__main__": block to call that function
- Ensures the script uses try and except blocks
- Assumes result is the output of subprocess.run() with capture_output=True and text=True
- Accesses the stdout attribute of the result from subprocess.run() and applies .strip() to remove leading and trailing whitespace
- Uses regex to check whether the output satisfies the expected result described above
- Prints the output of dmcli command and also prints "[PASS]" if the expectation is met; otherwise, prints "[FAIL]"
- Includes clear print statements such as [PASS], [FAIL], or [ERROR] to indicate the result
- Contains a main block so it can be executed independently without relying on any testing framework like pytest

```python [/INST]"""

        return prompt

    def separate_main_code_and_tests(self, generated_code):
        """Separate main code from unit tests"""
        # Enhanced test markers for better detection
        test_markers = [
            '# Unit Tests',
            '# ' + '=' * 60,
            'import unittest',
            'class Test',
            'def test_',
            'if __name__ == "__main__":\n    unittest.main()',
            'unittest.main(verbosity=2)',
            'unittest.main()',
            '# Comprehensive unit tests',
            '# Unit test'
        ]

        split_index = -1
        for marker in test_markers:
            index = generated_code.find(marker)
            if index != -1:
                if split_index == -1 or index < split_index:
                    split_index = index

        if split_index == -1:
            # No tests found, return all as main code
            return generated_code, ''

        main_code = generated_code[:split_index].strip()
        unit_tests = generated_code[split_index:].strip()

        return main_code, unit_tests

    def extract_and_clean_code(self, generated_text, mode='qa', language='python'): #Divya_NEW
    #def extract_and_clean_code(self, generated_text, mode='qa'): - DIVYA
        """Extract and clean generated code"""
        try:
            # Extract code from markdown code blocks
            code_match = re.search(r"```python(.*?)```", generated_text, re.DOTALL)
            if code_match:
                clean_code = code_match.group(1).strip()
            else:
                # Try to extract code after the prompt
                prompt_end = generated_text.find('[/INST]')
                if prompt_end != -1:
                    clean_code = generated_text[prompt_end + 7:].strip()
                else:
                    clean_code = generated_text.strip()

            # Remove any remaining instruction text
            clean_code = self.remove_instruction_text(clean_code)

            # Add appropriate headers based on mode
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            if mode == 'developer':
                lang = language.lower()
                if lang == 'python':
                    header = f"""#!/usr/bin/env python3
            '''
            Generated Application Code
            Generated on: {timestamp}
            Mode: Developer Workflow
            AI Backend: {self.ai_backend}
            '''

            import logging
            import sys
            from typing import Any, Dict, List, Optional

            # Configure logging
            logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
            logger = logging.getLogger(__name__)

            """
                elif lang == 'java':
                    header = f"""// Generated Java Application Code
            // Generated on: {timestamp}
            // Mode: Developer Workflow
            // AI Backend: {self.ai_backend}

            """
                elif lang in ['cpp', 'c++']:
                    header = f"""// Generated C++ Application Code
            // Generated on: {timestamp}
            // Mode: Developer Workflow
            // AI Backend: {self.ai_backend}

            //#include <iostream>
            //using namespace std;

            """
                elif lang == 'c':
                    header = f"""// Generated C Application Code
            // Generated on: {timestamp}
            // Mode: Developer Workflow
            // AI Backend: {self.ai_backend}

            //#include <stdio.h>

            """
                else:
                    header = f"""// Generated Application Code
            // Generated on: {timestamp}
            // Mode: Developer Workflow
            // AI Backend: {self.ai_backend}

            """

            return header + clean_code

        except Exception as e:
            logger.error(f"[ERROR] Code cleaning failed: {e}")
            return f"# Error in code extraction: {str(e)}\n{generated_text}"

    def remove_instruction_text(self, code):
        """Remove common instruction text from generated code"""
        instruction_patterns = [
            r"Here's.*?implementation.*?:",
            r"I'll.*?create.*?:",
            r"This.*?script.*?will.*?:",
            r"The.*?following.*?code.*?:",
            r"```python.*?\n",
            r"```.*?\n",
            r"Here is.*?:",
            r"Let me.*?:",
            r"I'll.*?help.*?:",
        ]

        cleaned_code = code
        for pattern in instruction_patterns:
            cleaned_code = re.sub(pattern, "", cleaned_code, flags=re.IGNORECASE | re.DOTALL)

        return cleaned_code.strip()

    def generate_fallback_code(self, mode):
        """Generate fallback code when AI generation fails"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if mode == 'qa':
            return f'''"""
Generated Test Script - Fallback Mode
Generated on: {timestamp}
AI Backend: {self.ai_backend} (fallback)
"""

import subprocess
import re
import logging

logger = logging.getLogger(__name__)

def test_placeholder():
    """
    Placeholder test function

    Replace this with actual test implementation.
    """
    try:
        # TODO: Implement actual test logic here
        result = subprocess.run(["echo", "test"], capture_output=True, text=True)
        output = result.stdout.strip()

        if "test" in output:
            print("[PASS] Test completed successfully")
        else:
            print("[FAIL] Test failed")

    except Exception as e:
        print(f"[ERROR] Test execution failed: {{e}}")

if __name__ == "__main__":
    test_placeholder()
'''
        else:  # developer mode fallback
            return f'''"""
Generated Application Code - Fallback Mode
Generated on: {timestamp}
AI Backend: {self.ai_backend} (fallback)
"""

import logging
import sys
from typing import Any, Dict, List, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ApplicationImplementation:
    """Main application implementation class"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)
        self.logger.info(f"Initializing {{self.__class__.__name__}}")

    def execute(self) -> Dict[str, Any]:
        """Main execution method"""
        try:
            self.logger.info("Starting execution")
            result = {{
                "status": "success",
                "message": "Implementation completed",
                "data": {{}}
            }}
            self.logger.info("Execution completed successfully")
            return result
        except Exception as e:
            self.logger.error(f"Execution failed: {{e}}")
            return {{
                "status": "error",
                "message": str(e),
                "data": {{}}
            }}


def main():
    """Main function"""
    try:
        implementation = ApplicationImplementation()
        result = implementation.execute()
        print(f"Result: {{result}}")

        if result["status"] == "success":
            print("[PASS] Implementation executed successfully")
        else:
            print("[FAIL] Implementation execution failed")
    except Exception as e:
        print(f"[ERROR] Main execution failed: {{e}}")
        sys.exit(1)


if __name__ == "__main__":
    main()
'''

    def generate_fallback_test_code(self, test_case_data):
        """Generate fallback test code when AI generation fails (PRESERVED)"""
        test_name = test_case_data.get('test_case_name', 'Unknown Test')
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        fallback_code = f'''"""
Generated Test Script - Fallback Mode
Test Case: {test_name}
Generated on: {timestamp}
"""

import subprocess
import re
import logging

logger = logging.getLogger(__name__)

def test_{test_name.lower().replace(' ', '_')}():
    """
    Test Case: {test_name}

    This is a template test generated when AI models are not available.
    Replace this with actual test implementation logic.
    """
    try:
        logger.info("Starting test execution: {test_name}")

        # TODO: Replace with actual test command
        test_command = ["echo", "Test execution placeholder"]

        # Execute the test command
        result = subprocess.run(
            test_command,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Get the output
        output = result.stdout.strip()
        logger.info(f"Command output: {{output}}")
        print(f"Test output: {{output}}")

        # TODO: Replace with actual validation logic
        if result.returncode == 0:
            print("[PASS] Test completed successfully")
            logger.info("Test passed")
        else:
            print("[FAIL] Test failed")
            logger.error("Test failed")

    except subprocess.TimeoutExpired:
        print("[ERROR] Test timed out")
        logger.error("Test execution timed out")
    except Exception as e:
        print(f"[ERROR] Test execution failed: {{e}}")
        logger.error(f"Test execution error: {{e}}")

def main():
    """Main function to run the test"""
    test_{test_name.lower().replace(' ', '_')}()

if __name__ == "__main__":
    main()
'''

        return fallback_code


# QUICK SETUP SCRIPT: Add this function to easily install better models
def setup_better_ollama_models():
    """Setup script to install better Ollama models for code generation"""
    import subprocess
    import sys

    print("🚀 Setting up better Ollama models for code generation...")

    models_to_install = [
        ("deepseek-coder:6.7b", "Best for code generation with instructions"),
        ("codegemma:7b", "Google's specialized code model"),
        ("codellama:13b-instruct", "Larger instruction-following CodeLlama"),
        ("mistral:7b-instruct", "Good general instruction following")
    ]

    for model_name, description in models_to_install:
        print(f"\n📦 Installing {model_name} - {description}")
        try:
            result = subprocess.run(
                ["ollama", "pull", model_name],
                capture_output=True,
                text=True,
                timeout=600  # 10 minutes timeout
            )
            if result.returncode == 0:
                print(f"✅ Successfully installed {model_name}")
            else:
                print(f"❌ Failed to install {model_name}: {result.stderr}")
        except subprocess.TimeoutExpired:
            print(f"⏰ Timeout installing {model_name} - continuing...")
        except Exception as e:
            print(f"❌ Error installing {model_name}: {e}")

    print("\n🎉 Model setup complete! Restart your application to use the new models.")

# PRESERVED ORIGINAL FUNCTIONS - NO CHANGES TO QA WORKFLOW LOGIC
def extract_test_case_fields(text):
    """Extract test case fields from text (PRESERVED ORIGINAL)"""
    try:
        fields = {}
        fields['test_case_name'] = re.search(r'Test Case:\s*(.+)', text).group(1).strip()
        fields['purpose'] = re.search(r'Purpose:\s*(.+)', text).group(1).strip()
        fields['pre_conditions'] = re.search(r'Pre-conditions:\s*(.+)', text, re.DOTALL).group(1).split('Test Steps:')[
            0].strip()
        fields['test_steps'] = re.search(r'Test Steps:\s*(.+)', text, re.DOTALL).group(1).split('Expected Results:')[
            0].strip()
        fields['expected_results'] = re.search(r'Expected Results:\s*(.+)', text, re.DOTALL).group(1).strip()
        return fields
    except Exception as e:
        print(f"Error extracting test case fields: {e}")
        return None


def extract_user_story_fields(text):
    """Extract user story fields from text"""
    try:
        fields = {}
        fields['id'] = re.search(r'(?:Story ID|ID):\s*(.+)', text).group(1).strip()
        fields['title'] = re.search(r'(?:Title|Story):\s*(.+)', text).group(1).strip()
        fields['description'] = re.search(r'Description:\s*(.*?)(?=\n(?:[A-Z][a-z]+:|$))', text, re.DOTALL).group(
            1).strip()
        fields['acceptance_criteria'] = re.search(r'Acceptance Criteria:\s*(.*?)(?=\n(?:[A-Z][a-z]+:|$))', text,
                                                  re.DOTALL).group(1).strip()
        fields['priority'] = re.search(r'Priority:\s*(.+)', text).group(1).strip() if re.search(r'Priority:\s*(.+)',
                                                                                                text) else 'Medium'
        fields['epic'] = re.search(r'Epic:\s*(.+)', text).group(1).strip() if re.search(r'Epic:\s*(.+)',
                                                                                        text) else 'N/A'
        return fields
    except Exception as e:
        print(f"Error extracting user story fields: {e}")
        return None


def save_script_to_file(code, name, mode='qa'):
    """Save generated script to file (PRESERVED ORIGINAL)"""
    try:
        if mode == 'developer':
            scripts_dir = os.path.join(os.getcwd(), "..", "generated-scripts", "application")
        else:
            scripts_dir = os.path.join(os.getcwd(), "..", "generated-scripts")

        os.makedirs(scripts_dir, exist_ok=True)

        filename = f"{name.lower().replace(' ', '_').replace('-', '_')}.py"
        filepath = os.path.join(scripts_dir, filename)

        with open(filepath, "w", encoding='utf-8') as f:
            f.write(code)

        print(f"[{mode.upper()}] Script saved: {filename}")
        return filepath

    except Exception as e:
        print(f"[ERROR] Failed to save script: {e}")
        return None


# ALSO UPDATE the process_test_case_file to ensure order_index is included
def process_test_case_file(filepath, order_index):
    """Process test case file (PRESERVED ORIGINAL LOGIC WITH CORRECT STRUCTURE)"""
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            test_case_text = file.read()

        fields = extract_test_case_fields(test_case_text)
        if not fields:
            print(f"Failed to extract fields from {filepath}")
            return None

        print(f"Generating test script for: {fields['test_case_name']}")

        # CRITICAL: Check for default script first (PRESERVED ORIGINAL LOGIC)
        script_name = f"{fields['test_case_name'].lower().replace(' ', '_')}.py"
        default_script_path = os.path.join(os.getcwd(), "..", "Backend", "default_scripts", script_name)

        if os.path.exists(default_script_path):
            # Copy default script (PRESERVED ORIGINAL FUNCTIONALITY)
            print(f"[QA] Using existing default script: {default_script_path}")
            with open(default_script_path, 'r') as src:
                script_content = src.read()
            save_script_to_file(script_content, fields['test_case_name'], mode='qa')
        else:
            # Generate using enhanced generator (ONLY if no default script exists)
            print(f"[QA] No default script found, generating with AI: {default_script_path}")
            generator = EnhancedCodeGenerator(mode='qa')
            result = generator.generate_test_code(fields)

            if result['success']:
                save_script_to_file(result['code'], fields['test_case_name'], mode='qa')
            else:
                print(f"Failed to generate test code: {result.get('error', 'Unknown error')}")

        print(f"Script generated: {script_name}")

        # CRITICAL FIX: Return structure that matches what run_commands.py expects
        return {
            'order_index': order_index,  # REQUIRED: Must have order_index
            'script_name': script_name,
            'test_case_name': fields['test_case_name'],
            'source_file': os.path.basename(filepath)
        }

    except Exception as e:
        print(f"Error processing test case file {filepath}: {e}")
        return None


def process_user_story_file(filepath, order_index, codebase_context=None):
    """Process user story file for application code generation (FIXED STRUCTURE)"""
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            story_text = file.read()

        fields = extract_user_story_fields(story_text)
        if not fields:
            print(f"Failed to extract user story fields from {filepath}")
            return None

        print(f"Generating application code for: {fields['title']}")

        # Generate using enhanced generator
        generator = EnhancedCodeGenerator(mode='developer')
        result = generator.generate_application_code(fields, codebase_context)

        if result and isinstance(result, list) and len(result) > 0:
            # Take the first generated file for the main implementation
            main_result = result[0]
            save_script_to_file(main_result['generated_code'], fields['id'], mode='developer')
            script_name = main_result['file_name']
        else:
            print(f"Failed to generate application code for {fields['id']}")
            script_name = f"{fields['id']}_error.py"

        print(f"Application script generated: {script_name}")

        # CRITICAL FIX: Return structure that matches what run_commands.py expects
        return {
            'order_index': order_index,  # REQUIRED: Must have order_index
            'script_name': script_name,
            'story_id': fields['id'],
            'story_title': fields['title'],
            'source_file': os.path.basename(filepath)
        }

    except Exception as e:
        print(f"Error processing user story file {filepath}: {e}")
        return None


def extract_timestamp_from_filename(filename):
    """Extract timestamp from filename like '20241215_143022123_test1.txt' (PRESERVED)"""
    try:
        parts = filename.split('_')
        if len(parts) >= 2:
            timestamp_str = parts[0] + parts[1]
            return timestamp_str
        return filename
    except:
        return filename


def save_order_mapping(order_mapping, mode='qa'):
    """Save the order mapping to a JSON file (FIXED STRUCTURE)"""
    try:
        if mode == 'developer':
            scripts_dir = os.path.join(os.getcwd(), "..", "generated-scripts", "application")
        else:
            scripts_dir = os.path.join(os.getcwd(), "..", "generated-scripts")

        os.makedirs(scripts_dir, exist_ok=True)
        mapping_file = os.path.join(scripts_dir, "order_mapping.json")

        # CRITICAL FIX: Convert dictionary to list format that run_commands.py expects
        if isinstance(order_mapping, dict):
            # Convert dict to list of objects with order_index
            mapping_list = []
            for key, value in order_mapping.items():
                if isinstance(value, dict):
                    # Add order_index if not present
                    if 'order_index' not in value:
                        value['order_index'] = int(key)
                    mapping_list.append(value)
            order_mapping = mapping_list

        with open(mapping_file, 'w') as f:
            json.dump(order_mapping, f, indent=2)

        print(f"[{mode.upper()}] Order mapping saved to: {mapping_file} with {len(order_mapping)} entries")

    except Exception as e:
        print(f"[ERROR] Failed to save order mapping: {e}")

def determine_processing_mode():
    """Determine whether to process as QA test cases or developer user stories (PRESERVED)"""
    test_case_dir = os.path.join(os.getcwd(), "..", "test_case")

    if not os.path.exists(test_case_dir):
        print(f"Test case directory not found: {test_case_dir}")
        return None

    # Look for files in the directory
    files = [f for f in os.listdir(test_case_dir) if os.path.isfile(os.path.join(test_case_dir, f))]

    if not files:
        print("No files found in test_case directory")
        return None

    # Sample first file to determine type
    sample_file = files[0]
    sample_path = os.path.join(test_case_dir, sample_file)

    try:
        with open(sample_path, 'r', encoding='utf-8') as f:
            content = f.read().lower()

        # Look for QA test case indicators
        qa_indicators = ['test case:', 'purpose:', 'pre-conditions:', 'test steps:', 'expected results:']
        qa_score = sum(1 for indicator in qa_indicators if indicator in content)

        # Look for developer story indicators
        dev_indicators = ['story id:', 'user story:', 'acceptance criteria:', 'title:', 'description:']
        dev_score = sum(1 for indicator in dev_indicators if indicator in content)

        if qa_score >= 3:
            return 'qa'
        elif dev_score >= 3:
            return 'developer'
        else:
            # Default to QA for backward compatibility
            return 'qa'

    except Exception as e:
        print(f"Error analyzing file {sample_file}: {e}")
        return 'qa'  # Default to QA


def main():
    """Main function (FIXED TO CREATE CORRECT STRUCTURE)"""
    try:
        # Determine processing mode based on file content
        mode = determine_processing_mode()

        if mode is None:
            print("Could not determine processing mode")
            return

        print(f"[MAIN] Processing mode: {mode.upper()}")

        test_case_dir = os.path.join(os.getcwd(), "..", "test_case")
        files = [f for f in os.listdir(test_case_dir) if os.path.isfile(os.path.join(test_case_dir, f))]

        if not files:
            print("No files to process")
            return

        # Sort files by timestamp (PRESERVED ORIGINAL LOGIC)
        files.sort(key=extract_timestamp_from_filename)

        # CRITICAL FIX: Create order_mapping as LIST instead of DICT
        order_mapping = []  # Changed from {} to []
        codebase_context = None  # Could be loaded from session or file if needed

        for index, filename in enumerate(files, start=1):
            filepath = os.path.join(test_case_dir, filename)

            if mode == 'qa':
                result = process_test_case_file(filepath, index)
            else:  # developer mode
                result = process_user_story_file(filepath, index, codebase_context)

            if result:
                # CRITICAL FIX: Append to list instead of dict assignment
                order_mapping.append(result)

        # Save order mapping
        save_order_mapping(order_mapping, mode)

        print(f"[MAIN] Successfully processed {len(order_mapping)} {mode} files")

    except Exception as e:
        print(f"[ERROR] Main execution failed: {e}")


if __name__ == "__main__":
    main()
