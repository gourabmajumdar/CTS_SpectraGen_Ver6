// ================================================================================================
// COGNIZANT AUTO TEST DASHBOARD - COMPLETE JAVASCRIPT WITH REAL PROGRESS TRACKING
// Multi-Test Case Support with Dynamic UI Generation + New Workflow + Real Progress
// ================================================================================================

// Global Variables
let uploadedFiles = [];
let currentOperation = null;
let ingestedTestCases = [];
let generatedScripts = [];
let executionResults = [];
// 1. ADD THESE NEW GLOBAL VARIABLES (add to existing global variables section)
let selectedTestCases = new Set(); // Track which test cases are selected for execution

// Progress tracking variables
let progressPollingInterval = null;
let currentTaskType = null;

// Add these new global variables for device management
let availableDevices = [];
let selectedDeviceId = null;
let deviceStatusPolling = null;

let currentMode = 'qa'; // Track current mode
let developerWorkflows = [];
let codebaseContext = {};
let generatedApplicationCode = [];
let selectedUserStories = new Set();

// Global variables for codebase management
let savedCodebases = [];
let currentCodebaseId = null;

// DOM Elements Cache
const elements = {
    uploadArea: null,
    fileInput: null,
    fileInfo: null,
    textArea: null,
    charCount: null,
    codeActions: null,
    progressContainer: null,
    progressTitle: null,
    progressStatus: null,
    progressBar: null,
    progressPercentage: null,
    progressSteps: null,
    toast: null,
    toastMessage: null
};

// Analytics Data Store
let analyticsData = {
    qaTestsGenerated: 0,
    qaTestsReviewed: 0,
    devCodeReviewed: 0,
    devUnittestsReviewed: 0,
    devscriptspassed: 0,
    devscriptsfailed: 0,
    qascriptspassed: 0,
    qascriptsfailed: 0,
    timeline: []
};



// Chart instances
let barChart, pieChart, lineChart;

let validationTimeout;

// Global variables for JIRA integration
let jiraConnection = null;
let jiraTickets = [];
let selectedJiraTickets = new Set();

// Global variables for multi-ticket support
let multiTicketMode = false;
let currentTicketIndex = 0;
let ticketResults = [];

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ================================================================================================
// INITIALIZATION AND SETUP
// ================================================================================================
// Initialize codebase management when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSavedCodebases();
    updateCodebaseSelector();
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Cognizant AutoTest Dashboard Loading...');

    // Cache DOM elements
    cacheElements();

    // Setup event listeners
    initializeEventListeners();
    setupNavigationListeners();

    // Initialize UI state
    updateCharCount();
    initializeHomePage();

    // Initialize analytics when page loads
    loadAnalyticsData();
    initializeCharts();
    updateAnalyticsDisplay();

    console.log('✅ Dashboard initialized successfully');
});

function cacheElements() {
    elements.uploadArea = document.querySelector('.upload-area');
    elements.fileInput = document.getElementById('fileInput');
    elements.developerFileInput = document.getElementById('developerFileInput'); // Add this
    elements.codebaseFileInput = document.getElementById('codebaseFileInput'); // Add this
    elements.fileInfo = document.getElementById('fileInfo');
    elements.textArea = document.getElementById('textArea');
    elements.charCount = document.getElementById('charCount');
    elements.codeActions = document.getElementById('codeActions');
    elements.progressContainer = document.getElementById('progressContainer');
    elements.progressTitle = document.getElementById('progressTitle');
    elements.progressStatus = document.getElementById('progressStatus');
    elements.progressBar = document.getElementById('progressBar');
    elements.progressPercentage = document.getElementById('progressPercentage');
    elements.progressSteps = document.getElementById('progressSteps');
    elements.toast = document.getElementById('toast');
    elements.toastMessage = document.getElementById('toastMessage');
}

function hideSaveButtons() {
    console.log('🔒 Hiding save buttons after review/execution');

    // Hide save buttons in multi-test areas
    const saveButtons = document.querySelectorAll('.save-btn');
    saveButtons.forEach(button => {
        button.style.display = 'none';
        console.log('🔒 Hidden save button in multi-test area');
    });

    // Hide save button in single text area (main code actions)
    const codeActions = document.getElementById('codeActions');
    if (codeActions) {
        const singleSaveButton = codeActions.querySelector('button[onclick="saveCode()"]');
        if (singleSaveButton) {
            singleSaveButton.style.display = 'none';
            console.log('🔒 Hidden save button in single text area');
        }
    }
}

function showSaveButtons() {
    console.log('🔓 Showing save buttons');

    // Show save buttons in multi-test areas
    const saveButtons = document.querySelectorAll('.save-btn');
    saveButtons.forEach(button => {
        button.style.display = 'flex';
        console.log('🔓 Showed save button in multi-test area');
    });

    // Show save button in single text area
    const codeActions = document.getElementById('codeActions');
    if (codeActions) {
        const singleSaveButton = codeActions.querySelector('button[onclick="saveCode()"]');
        if (singleSaveButton) {
            singleSaveButton.style.display = 'inline-flex';
            console.log('🔓 Showed save button in single text area');
        }
    }
}

// Simplified modal with just one OK button
function showErrorModal(title, message, details = null) {
    console.log(`🚨 Error Modal: ${title} - ${message}`);

    // Create modal HTML with single OK button
    const modalHTML = `
        <div id="errorModal" class="error-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(3px);
        ">
            <div class="error-modal-content" style="
                background: white;
                border-radius: 15px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                animation: modalSlideIn 0.3s ease-out;
            ">
                <div class="error-modal-header" style="
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    color: white;
                    padding: 20px;
                    border-radius: 15px 15px 0 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                ">
                    <div style="
                        font-size: 24px;
                        width: 40px;
                        height: 40px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">🚨</div>
                    <div>
                        <h3 style="margin: 0; font-size: 1.3rem; font-weight: 600;">${title}</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.9rem;">Connection Error</p>
                    </div>
                </div>
                
                <div class="error-modal-body" style="
                    padding: 25px;
                    line-height: 1.6;
                ">
                    <div style="
                        background: #fef2f2;
                        border: 1px solid #fecaca;
                        border-radius: 10px;
                        padding: 15px;
                        margin-bottom: 20px;
                        color: #991b1b;
                    ">
                        <strong>Error Details:</strong><br>
                        ${message}
                    </div>
                    
                    ${details ? `
                        <div style="
                            background: #f9fafb;
                            border: 1px solid #e5e7eb;
                            border-radius: 10px;
                            padding: 15px;
                            margin-bottom: 20px;
                            font-family: 'Courier New', monospace;
                            font-size: 0.85rem;
                            color: #374151;
                            white-space: pre-wrap;
                        ">
                            <strong>Technical Details:</strong><br>
                            ${details}
                        </div>
                    ` : ''}
                    
                    <div style="
                        background: #eff6ff;
                        border: 1px solid #bfdbfe;
                        border-radius: 10px;
                        padding: 15px;
                        color: #1e40af;
                    ">
                        <strong>💡 Suggested Actions:</strong><br>
                        • Check your network connection<br>
                        • Verify Remote Device is powered on and accessible<br>
                        • Try executing the test again using the Execute Code button<br>
                        • Contact system administrator if problem persists
                    </div>
                </div>
                
                <div class="error-modal-footer" style="
                    padding: 20px 25px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: center;
                ">
                    <button onclick="closeErrorModal()" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 12px 32px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 1rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 3px 8px rgba(59, 130, 246, 0.3);
                    " onmouseover="this.style.background='#2563eb'; this.style.transform='translateY(-2px)'"
                       onmouseout="this.style.background='#3b82f6'; this.style.transform='translateY(0)'">
                        ✓ OK
                    </button>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .error-modal-overlay {
                animation: fadeIn 0.3s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        </style>
    `;

    // Remove any existing modal
    const existingModal = document.getElementById('errorModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Focus the OK button
    const modal = document.getElementById('errorModal');
    const okButton = modal.querySelector('button');
    okButton.focus();

    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeErrorModal();
        }
    };

    document.addEventListener('keydown', handleEscape);

    // Store cleanup function
    modal._cleanup = () => {
        document.removeEventListener('keydown', handleEscape);
    };
}

function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) {
        // Cleanup event listeners
        if (modal._cleanup) {
            modal._cleanup();
        }

        // Animate out
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    // Note: Execute button remains enabled - user can retry manually
    console.log('✓ Modal closed - Execute button remains enabled for manual retry');
}

// Make functions globally available
window.showErrorModal = showErrorModal;
window.closeErrorModal = closeErrorModal;
/*
function initializeEventListeners() {
    console.log('🔧 Setting up event listeners...');

    // File upload events
    if (elements.uploadArea) {
        elements.uploadArea.addEventListener('dragover', handleDragOver);
        elements.uploadArea.addEventListener('dragleave', handleDragLeave);
        elements.uploadArea.addEventListener('drop', handleDrop);
        elements.uploadArea.addEventListener('click', () => {
            if (elements.fileInput) elements.fileInput.click();
        });
    }

    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', handleFileSelect);
    }

    // Text area events
    if (elements.textArea) {
        elements.textArea.addEventListener('input', handleTextAreaInput);
    }

    // Prevent default drag behaviors
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    console.log('✅ Event listeners attached');
}
*/

function initializeEventListeners() {
    console.log('🔧 Setting up event listeners...');

    // ✅ PREVENT MULTIPLE INITIALIZATION
    if (window.eventListenersInitialized) {
        console.log('⚠️ Event listeners already initialized, skipping...');
        return;
    }

    // QA Mode File upload events
    const qaUploadArea = document.querySelector('#qaContent .upload-area');
    const qaFileInput = document.getElementById('fileInput');

    if (qaUploadArea) {
        qaUploadArea.addEventListener('dragover', handleDragOver);
        qaUploadArea.addEventListener('dragleave', handleDragLeave);
        qaUploadArea.addEventListener('drop', handleDrop);
        qaUploadArea.addEventListener('click', () => {
            if (qaFileInput) qaFileInput.click();
        });
    }

    if (qaFileInput) {
        qaFileInput.addEventListener('change', handleFileSelect);
    }

    // Developer Mode File upload events
    const devUploadArea = document.querySelector('#developerContent .upload-area');
    const devFileInput = document.getElementById('developerFileInput');

    if (devUploadArea) {
        devUploadArea.addEventListener('dragover', handleDragOver);
        devUploadArea.addEventListener('dragleave', handleDragLeave);
        devUploadArea.addEventListener('drop', handleDrop);
        devUploadArea.addEventListener('click', () => {
            if (devFileInput) devFileInput.click();
        });
    }

    if (devFileInput) {
        devFileInput.addEventListener('change', handleFileSelect);
    }

    // Codebase Manager File upload events
    const codebaseUploadArea = document.querySelector('#codebaseManagerContent .upload-area');
    const codebaseFileInput = document.getElementById('codebaseFileInput');

    if (codebaseUploadArea) {
        codebaseUploadArea.addEventListener('dragover', handleDragOver);
        codebaseUploadArea.addEventListener('dragleave', handleDragLeave);
        codebaseUploadArea.addEventListener('drop', handleDrop);
        codebaseUploadArea.addEventListener('click', () => {
            if (codebaseFileInput) codebaseFileInput.click();
        });
    }

    if (codebaseFileInput) {
        codebaseFileInput.addEventListener('change', handleFileSelect);
    }

    // Text area events
    const textArea = document.getElementById('textArea');
    if (textArea) {
        textArea.addEventListener('input', handleTextAreaInput);
    }

    // Prevent default drag behaviors
    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', preventDefault);

    // ✅ MARK AS INITIALIZED
    window.eventListenersInitialized = true;
    console.log('✅ Event listeners attached');
}

function setupNavigationListeners() {
    console.log('🧭 Setting up navigation...');

    const navItems = document.querySelectorAll('.nav-item');

    if (navItems.length >= 2) {
        // Home navigation
        navItems[0].addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🏠 Home navigation clicked');
            showHome();
        });

        // AutoTest navigation
        /*
        navItems[1].addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🧪 AutoTest navigation clicked');
            showAutoTest();
        });
        */
        console.log('✅ Navigation listeners attached');
    } else {
        console.error('❌ Navigation items not found!');
    }
}

function initializeHomePage() {
    console.log('🏠 Initializing home page...');

    // Reset navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const homeNavItem = document.querySelectorAll('.nav-item')[0];
    if (homeNavItem) {
        homeNavItem.classList.add('active');
    }

    // Set initial content state
    const dashboardTitle = document.getElementById('dashboardTitle');
    const welcomeMessage = document.getElementById('welcomeMessage');
    //const autoTestContent = document.getElementById('autoTestContent');
    const autoTestContent = document.getElementById('qaContent');

    if (dashboardTitle) dashboardTitle.textContent = 'Home';

    if (welcomeMessage) {
        welcomeMessage.classList.remove('hide');
        welcomeMessage.classList.add('show');
        welcomeMessage.style.display = 'block';
    }

    if (autoTestContent) {
        autoTestContent.classList.remove('show');
        autoTestContent.classList.add('hide');
        autoTestContent.style.display = 'none';
    }

    console.log('✅ Home page initialized');
}
/*
async function uploadCodebase() {
    console.log('📤 Starting codebase upload...');

    const codebaseFileInput = document.getElementById('codebaseFileInput');
    if (!codebaseFileInput || codebaseFileInput.files.length === 0) {
        showToast('Please select a codebase ZIP file first!', 'warning');
        return;
    }

    const uploadBtn = document.getElementById('uploadCodebaseBtn');
    if (!uploadBtn) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading Codebase...';

    try {
        const formData = new FormData();
        const file = codebaseFileInput.files[0];
        formData.append('codebase', file);

        showProgress('Uploading Codebase', [
            'Uploading ZIP file',
            'Extracting codebase files',
            'Analyzing code structure',
            'Building context database',
            'Indexing functions and patterns'
        ]);

        updateProgress(20, 'Uploading file to server', 0);

        const response = await fetch('/upload_codebase', {
            method: 'POST',
            body: formData
        });

        updateProgress(40, 'Processing codebase', 1);

        const result = await response.json();

        if (result.success) {
            updateProgress(60, 'Analyzing code structure', 2);
            await delay(1000);

            updateProgress(80, 'Building context', 3);
            await delay(1000);

            updateProgress(100, 'Codebase loaded successfully', 4);

            // ADD DEBUG OUTPUT
            debugCodebaseData(result);

            // FIXED: Create complete context info with all data
            const completeContextInfo = {
                libraries_count: result.context_info.libraries_count,
                functions_count: result.context_info.functions_count,
                classes_count: result.context_info.classes_count || (result.classes ? Object.keys(result.classes).length : 0), // FIXED: Add classes_count
                patterns: result.context_info.patterns,
                libraries: result.libraries || [],
                functions: result.functions || {},
                classes: result.classes || {},
                dependencies: result.dependencies || []
            };

            console.log('📚 Complete context info being passed:', completeContextInfo);
            updateCodebaseStatus(completeContextInfo);

            // Enable the clear button
            const clearBtn = document.getElementById('clearCodebaseBtn');
            if (clearBtn) {
                clearBtn.disabled = false;
            }

            showToast(result.message, 'success');

            // Clear the file input
            codebaseFileInput.value = '';

        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Codebase upload error:', error);
        showToast('Failed to upload codebase: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Codebase';
        hideProgress();
    }
}
*/


// Save codebase to localStorage
function saveCodebaseToStorage(codebaseData) {
    try {
        const codebaseId = generateCodebaseId(codebaseData.name);
        const savedCodebase = {
            id: codebaseId,
            name: codebaseData.name || `Codebase-${Date.now()}`,
            syncTime: new Date().toISOString(),
            data: codebaseData,
            active: true
        };

        // Load existing codebases
        const existing = JSON.parse(localStorage.getItem('savedCodebases') || '[]');

        // Remove existing codebase with same ID if present
        const filtered = existing.filter(cb => cb.id !== codebaseId);

        // Add new codebase
        filtered.unshift(savedCodebase); // Add to beginning

        // Keep only last 10 codebases
        const trimmed = filtered.slice(0, 10);

        localStorage.setItem('savedCodebases', JSON.stringify(trimmed));
        savedCodebases = trimmed;

        console.log(`💾 Saved codebase: ${savedCodebase.name}`);
        updateCodebaseSelector();
        setCurrentCodebase(codebaseId);

        return codebaseId;
    } catch (error) {
        console.error('❌ Failed to save codebase:', error);
        showToast('Failed to save codebase locally', 'error');
        return null;
    }
}

// Load saved codebases from localStorage
function loadSavedCodebases() {
    try {
        const saved = localStorage.getItem('savedCodebases');
        savedCodebases = saved ? JSON.parse(saved) : [];
        console.log(`📚 Loaded ${savedCodebases.length} saved codebases`);
    } catch (error) {
        console.error('❌ Failed to load saved codebases:', error);
        savedCodebases = [];
    }
}

// Generate unique ID for codebase
function generateCodebaseId(name) {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const timestamp = Date.now();
    return `${cleanName}_${timestamp}`;
}

var globalLanguage;
function switchLanguage(language) {
	globalLanguage = language;
        console.log("Selected language:", language);
    }
// Update codebase selector dropdown
function updateCodebaseSelector() {
    const selector = document.getElementById('codebaseSelector');
    if (!selector) return;

    selector.innerHTML = '<option value="">Select Codebase...</option>';

    savedCodebases.forEach(codebase => {
        const option = document.createElement('option');
        option.value = codebase.id;
        option.textContent = `${codebase.name} (${formatSyncTime(codebase.syncTime)})`;
        selector.appendChild(option);
    });

    // Set current selection
    if (currentCodebaseId) {
        selector.value = currentCodebaseId;
    }
}

// Format sync time for display
function formatSyncTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
}

// Switch to a different codebase
function switchCodebase(codebaseId) {
    if (!codebaseId) {
        clearCurrentCodebaseDisplay();
        currentCodebaseId = null;
        return;
    }

    const codebase = savedCodebases.find(cb => cb.id === codebaseId);
    if (codebase) {
        setCurrentCodebase(codebaseId);
        displayCodebaseInSidebar(codebase.data);
        showToast(`Switched to: ${codebase.name}`, 'success');
    }
}

// Set current active codebase
function setCurrentCodebase(codebaseId) {
    currentCodebaseId = codebaseId;
    const selector = document.getElementById('codebaseSelector');
    if (selector) {
        selector.value = codebaseId;
    }
}

// Display codebase data in the sidebar
function displayCodebaseInSidebar(contextInfo) {
    console.log('📊 Displaying codebase in sidebar:', contextInfo);

    // Update current codebase status
    const statusDiv = document.getElementById('currentCodebaseStatus');
    if (statusDiv) {
        statusDiv.style.display = 'block';
    }

    // Update codebase name and sync time
    const codebase = savedCodebases.find(cb => cb.id === currentCodebaseId);
    if (codebase) {
        const nameElement = document.getElementById('currentCodebaseName');
        const timeElement = document.getElementById('syncTime');

        if (nameElement) nameElement.textContent = codebase.name;
        if (timeElement) timeElement.textContent = `Synced ${formatSyncTime(codebase.syncTime)}`;
    }

    // Update status indicator
    const statusIndicator = document.getElementById('statusIndicator');
    if (statusIndicator) {
        statusIndicator.className = 'status-indicator';
    }

    // Update stats
    updateSidebarStats(contextInfo);

    // Update expandable sections
    updateSidebarSections(contextInfo);
}

// Update sidebar statistics
function updateSidebarStats(contextInfo) {
    const stats = {
        libraries: contextInfo.libraries_count || (contextInfo.libraries ? contextInfo.libraries.length : 0),
        functions: contextInfo.functions_count || (contextInfo.functions ? Object.keys(contextInfo.functions).length : 0),
        classes: contextInfo.classes_count || (contextInfo.classes ? Object.keys(contextInfo.classes).length : 0),
        patterns: contextInfo.patterns ? (Array.isArray(contextInfo.patterns) ? contextInfo.patterns.length : Object.keys(contextInfo.patterns).length) : 0
    };

    document.getElementById('sidebarLibrariesCount').textContent = stats.libraries;
    document.getElementById('sidebarFunctionsCount').textContent = stats.functions;
    document.getElementById('sidebarClassesCount').textContent = stats.classes;
    document.getElementById('sidebarPatternsCount').textContent = stats.patterns;
}

// Update expandable sections content
function updateSidebarSections(contextInfo) {
    // Libraries
    const librariesList = document.getElementById('librariesList');
    if (librariesList && contextInfo.libraries) {
        librariesList.innerHTML = '';
        contextInfo.libraries.slice(0, 15).forEach(lib => {
            const span = document.createElement('span');
            span.className = 'compact-item';
            span.textContent = lib;
            librariesList.appendChild(span);
        });
        if (contextInfo.libraries.length > 15) {
            const more = document.createElement('span');
            more.className = 'compact-item';
            more.textContent = `+${contextInfo.libraries.length - 15} more`;
            more.style.background = '#f3f4f6';
            more.style.color = '#6b7280';
            librariesList.appendChild(more);
        }
    }

    // Functions
    const functionsList = document.getElementById('functionsList');
    if (functionsList && contextInfo.functions) {
        functionsList.innerHTML = '';
        const functions = Object.entries(contextInfo.functions).slice(0, 8);
        functions.forEach(([name, info]) => {
            const div = document.createElement('div');
            div.className = 'compact-function-item';
            div.innerHTML = `
                <span class="compact-function-name">${name.split('::').pop()}</span>
                <span class="compact-file-path">${info.file || 'Unknown file'}</span>
            `;
            functionsList.appendChild(div);
        });
    }

    // Classes
    const classesList = document.getElementById('classesList');
    if (classesList && contextInfo.classes) {
        classesList.innerHTML = '';
        const classes = Object.entries(contextInfo.classes).slice(0, 6);
        classes.forEach(([name, info]) => {
            const div = document.createElement('div');
            div.className = 'compact-class-item';
            div.innerHTML = `
                <span class="compact-class-name">${name.split('::').pop()}</span>
                <span class="compact-file-path">${info.file || 'Unknown file'}</span>
            `;
            classesList.appendChild(div);
        });
    }

    // Patterns
    const patternsList = document.getElementById('patternsList');
    if (patternsList && contextInfo.patterns) {
        patternsList.innerHTML = '';
        let patternsToShow = [];

        if (Array.isArray(contextInfo.patterns)) {
            patternsToShow = contextInfo.patterns;
        } else if (typeof contextInfo.patterns === 'object') {
            patternsToShow = Object.entries(contextInfo.patterns)
                .filter(([key, value]) => Array.isArray(value) && value.length > 0)
                .map(([key, value]) => `${key} (${value.length})`);
        }

        patternsToShow.forEach(pattern => {
            const span = document.createElement('span');
            span.className = 'compact-item';
            span.textContent = pattern;
            patternsList.appendChild(span);
        });
    }
}

// Toggle expandable sections
function toggleSection(sectionId) {
    const content = document.getElementById(`${sectionId}-content`);
    const toggle = document.getElementById(`${sectionId}-toggle`);

    if (content && toggle) {
        const isExpanded = content.classList.contains('expanded');

        if (isExpanded) {
            content.classList.remove('expanded');
            toggle.classList.remove('expanded');
            content.style.maxHeight = '0';
        } else {
            content.classList.add('expanded');
            toggle.classList.add('expanded');
            content.style.maxHeight = '200px';
        }
    }
}

// Clear current codebase display
function clearCurrentCodebaseDisplay() {
    const statusDiv = document.getElementById('currentCodebaseStatus');
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
}

// Resync current codebase
function resyncCurrentCodebase() {
    if (!currentCodebaseId) {
        showToast('No codebase selected to resync', 'warning');
        return;
    }

    const codebase = savedCodebases.find(cb => cb.id === currentCodebaseId);
    if (codebase) {
        showToast(`Resyncing ${codebase.name}...`, 'info');
        // You can add logic here to re-analyze the codebase
        // For now, just update the sync time
        codebase.syncTime = new Date().toISOString();
        localStorage.setItem('savedCodebases', JSON.stringify(savedCodebases));
        updateCodebaseSelector();
        displayCodebaseInSidebar(codebase.data);
    }
}

// Clear current codebase
function clearCurrentCodebase() {
    if (!currentCodebaseId) {
        showToast('No codebase selected to clear', 'warning');
        return;
    }

    const codebase = savedCodebases.find(cb => cb.id === currentCodebaseId);
    if (codebase && confirm(`Are you sure you want to remove "${codebase.name}" from saved codebases?`)) {
        // Remove from saved codebases
        savedCodebases = savedCodebases.filter(cb => cb.id !== currentCodebaseId);
        localStorage.setItem('savedCodebases', JSON.stringify(savedCodebases));

        // Clear current selection
        currentCodebaseId = null;
        clearCurrentCodebaseDisplay();
        updateCodebaseSelector();

        showToast(`Removed ${codebase.name}`, 'success');
    }
}

//===============================================
// JIRA integration code new functions
// ==============================================
// Toggle between file upload and JIRA integration
function toggleDeveloperInputMethod() {
    const fileSection = document.getElementById('fileUploadSection');
    const jiraSection = document.getElementById('jiraIntegrationSection');
    const toggleBtn = document.getElementById('developerInputToggle');

    if (fileSection.style.display === 'none') {
        // Show file upload, hide JIRA
        fileSection.style.display = 'block';
        jiraSection.style.display = 'none';
        toggleBtn.textContent = '🎫 Use JIRA Integration Instead';
        toggleBtn.title = 'Switch to JIRA ticket integration';
    } else {
        // Show JIRA, hide file upload
        fileSection.style.display = 'none';
        jiraSection.style.display = 'block';
        toggleBtn.textContent = '📁 Upload Files Instead';
        toggleBtn.title = 'Switch to file upload';
    }
}

// Connect to JIRA
async function connectToJira() {
    const jiraUrl = document.getElementById('jiraUrlInput').value.trim();
    const username = document.getElementById('jiraUsernameInput').value.trim();
    const password = document.getElementById('jiraPasswordInput').value.trim();
    const connectBtn = document.getElementById('connectJiraBtn');

    if (!jiraUrl || !username || !password) {
        showToast('Please fill in all JIRA connection fields', 'error');
        return;
    }

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';

    try {
        const response = await fetch('/connect_jira', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jira_url: jiraUrl,
                username: username,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            jiraConnection = result.connection;
            showToast(result.message, 'success');

            // Show project selection section
            document.getElementById('jiraConnectionSection').style.display = 'none';
            document.getElementById('jiraProjectSection').style.display = 'block';

            // Load projects
            await loadJiraProjects();
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('JIRA connection error:', error);
        showToast('Failed to connect to JIRA: ' + error.message, 'error');
    } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect to JIRA';
    }
}

// Load JIRA projects
async function loadJiraProjects() {
    try {
        const response = await fetch('/get_jira_projects');
        const result = await response.json();

        if (result.success) {
            const projectSelect = document.getElementById('jiraProjectSelect');
            projectSelect.innerHTML = '<option value="">Select a project...</option>';

            result.projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.key;
                option.textContent = `${project.key} - ${project.name}`;
                projectSelect.appendChild(option);
            });

            showToast(`Loaded ${result.projects.length} projects`, 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('Error loading projects:', error);
        showToast('Failed to load projects: ' + error.message, 'error');
    }
}

// Load JIRA tickets for selected project
async function loadJiraTickets() {
    const projectKey = document.getElementById('jiraProjectSelect').value;
    const loadBtn = document.getElementById('loadTicketsBtn');

    if (!projectKey) {
        showToast('Please select a project first', 'warning');
        return;
    }

    loadBtn.disabled = true;
    loadBtn.textContent = 'Loading Tickets...';

    try {
        const response = await fetch('/get_jira_tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ project_key: projectKey })
        });

        const result = await response.json();

        if (result.success) {
            jiraTickets = result.tickets;
            displayJiraTickets(jiraTickets);

            // Show ticket selection section
            document.getElementById('jiraProjectSection').style.display = 'none';
            document.getElementById('jiraTicketsSection').style.display = 'block';

            showToast(`Loaded ${result.count} tickets in To-Do status`, 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('Error loading tickets:', error);
        showToast('Failed to load tickets: ' + error.message, 'error');
    } finally {
        loadBtn.disabled = false;
        loadBtn.textContent = 'Load To-Do Tickets';
    }
}

// Display JIRA tickets in a selectable list
function displayJiraTickets(tickets) {
    const container = document.getElementById('jiraTicketsContainer');

    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="no-tickets">
                <h3>🎫 No tickets found</h3>
                <p>No tickets in "To Do" status found for this project.</p>
            </div>
        `;
        return;
    }

    const ticketsHtml = tickets.map(ticket => `
        <div class="jira-ticket-item" data-ticket-id="${ticket.id}">
            <div class="ticket-header">
                <label class="ticket-checkbox">
                    <input type="checkbox" value="${ticket.id}" onchange="toggleJiraTicketSelection('${ticket.id}')">
                    <span class="ticket-id">${ticket.id}</span>
                    <span class="ticket-priority priority-${ticket.priority.toLowerCase()}">${ticket.priority}</span>
                </label>
            </div>
            <div class="ticket-content">
                <h4 class="ticket-title">${ticket.title}</h4>
                <div class="ticket-meta">
                    <span class="ticket-type">${ticket.issue_type}</span>
                    <span class="ticket-assignee">👤 ${ticket.assignee}</span>
                    <span class="ticket-created">📅 ${new Date(ticket.created).toLocaleDateString()}</span>
                </div>
                <div class="ticket-description">
                    <div class="description-section">
                        <strong>Main Requirement:</strong>
                        <div class="main-requirement">${ticket.main_requirement || ticket.description}</div>
                    </div>
                    ${ticket.technical_notes ? `
                        <div class="description-section">
                            <strong>Technical Notes:</strong>
                            <div class="technical-notes">${ticket.technical_notes}</div>
                        </div>
                    ` : ''}
                </div>
                <div class="ticket-acceptance-criteria">
                    <strong>Acceptance Criteria:</strong>
                    <div class="acceptance-text">${ticket.acceptance_criteria}</div>
                </div>
            </div>
        </div>
    `).join('');

    container.innerHTML = `
        <div class="tickets-header">
            <h3>🎫 Select JIRA Tickets (${tickets.length} found)</h3>
            <div class="tickets-actions">
                <button onclick="selectAllJiraTickets()" class="btn-secondary">Select All</button>
                <button onclick="deselectAllJiraTickets()" class="btn-secondary">Deselect All</button>
            </div>
        </div>
        <div class="tickets-list">
            ${ticketsHtml}
        </div>
        <div class="tickets-footer">
            <button onclick="proceedWithSelectedTickets()" id="proceedWithTicketsBtn" 
                    class="ingest-btn developer" disabled>
                Proceed with Selected Tickets (0)
            </button>
        </div>
    `;
}

// Toggle JIRA ticket selection
function toggleJiraTicketSelection(ticketId) {
    if (selectedJiraTickets.has(ticketId)) {
        selectedJiraTickets.delete(ticketId);
    } else {
        selectedJiraTickets.add(ticketId);
    }

    updateJiraTicketSelectionUI();
}

// Select all JIRA tickets
function selectAllJiraTickets() {
    jiraTickets.forEach(ticket => {
        selectedJiraTickets.add(ticket.id);
        const checkbox = document.querySelector(`input[value="${ticket.id}"]`);
        if (checkbox) checkbox.checked = true;
    });
    updateJiraTicketSelectionUI();
}

// Deselect all JIRA tickets
function deselectAllJiraTickets() {
    selectedJiraTickets.clear();
    const checkboxes = document.querySelectorAll('#jiraTicketsContainer input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
    updateJiraTicketSelectionUI();
}

// Update UI based on ticket selection
function updateJiraTicketSelectionUI() {
    const proceedBtn = document.getElementById('proceedWithTicketsBtn');
    const count = selectedJiraTickets.size;

    if (count === 0) {
        proceedBtn.disabled = true;
        proceedBtn.textContent = 'Proceed with Selected Tickets (0)';
    } else {
        proceedBtn.disabled = false;
        proceedBtn.textContent = `Proceed with Selected Tickets (${count})`;
    }

    // Update visual selection
    document.querySelectorAll('.jira-ticket-item').forEach(item => {
        const ticketId = item.dataset.ticketId;
        if (selectedJiraTickets.has(ticketId)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

/*
// Proceed with selected JIRA tickets
async function proceedWithSelectedTickets() {
    if (selectedJiraTickets.size === 0) {
        showToast('Please select at least one ticket', 'warning');
        return;
    }

    const proceedBtn = document.getElementById('proceedWithTicketsBtn');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Processing Tickets...';

    try {
        // First, select the tickets
        const selectResponse = await fetch('/select_jira_tickets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_ids: Array.from(selectedJiraTickets)
            })
        });

        const selectResult = await selectResponse.json();

        if (!selectResult.success) {
            showToast(selectResult.message, 'error');
            return;
        }

        // Generate prompt from JIRA tickets
        const promptResponse = await fetch('/generate_jira_prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        const promptResult = await promptResponse.json();

        if (promptResult.success) {
            // Display the generated prompt in the developer workflow
            displayJiraPromptInWorkflow(promptResult);

            // Hide JIRA integration and show developer workflow
            document.getElementById('jiraIntegrationSection').style.display = 'none';
            document.getElementById('fileUploadSection').style.display = 'block';

            // Update developer workflow display
            displayDeveloperWorkflow(selectResult.workflow_items);

            // Show generation options
            showDeveloperGenerationOptions();

            showToast(`${promptResult.message} - Ready for code generation!`, 'success');
        } else {
            showToast(promptResult.message, 'error');
        }

    } catch (error) {
        console.error('Error processing tickets:', error);
        showToast('Failed to process tickets: ' + error.message, 'error');
    } finally {
        proceedBtn.disabled = false;
        proceedBtn.textContent = `Proceed with Selected Tickets (${selectedJiraTickets.size})`;
    }
}
*/

// Enhanced proceed with selected tickets - REUSES EXISTING LOGIC
async function proceedWithSelectedTickets() {
    if (selectedJiraTickets.size === 0) {
        showToast('Please select at least one JIRA ticket', 'warning');
        return;
    }

    const proceedBtn = document.getElementById('proceedWithTicketsBtn');
    proceedBtn.disabled = true;
    proceedBtn.textContent = 'Processing...';

    try {
        const requirementTextElement = document.getElementById('requirementText');
        const additionalNotes = requirementTextElement ? requirementTextElement.value.trim() : '';

        // Use your existing ticket selection logic
        const selectResponse = await fetch('/select_jira_tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket_ids: Array.from(selectedJiraTickets)
            })
        });

        const selectResult = await selectResponse.json();

        if (selectResult.success) {
            multiTicketMode = selectResult.multi_ticket_mode;

            if (multiTicketMode) {
                // Store data for multi-ticket mode
                ticketResults = selectResult.workflow_items;

                // Hide JIRA integration and show developer workflow (your existing logic)
                document.getElementById('jiraIntegrationSection').style.display = 'none';
                document.getElementById('fileUploadSection').style.display = 'block';
                showDeveloperGenerationOptions();
            } else {
                // Use your EXISTING single-ticket logic (copy from your working code)
                const promptResponse = await fetch('/generate_jira_prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                const promptResult = await promptResponse.json();

                if (promptResult.success) {
                    displayJiraPromptInWorkflow(promptResult);
                    document.getElementById('jiraIntegrationSection').style.display = 'none';
                    document.getElementById('fileUploadSection').style.display = 'block';
                    showDeveloperGenerationOptions();
                    showToast(`${promptResult.message} - Ready for code generation!`, 'success');
                } else {
                    showToast(promptResult.message, 'error');
                }
            }

            // Hide JIRA integration and show developer workflow
            document.getElementById('jiraIntegrationSection').style.display = 'none';
            document.getElementById('fileUploadSection').style.display = 'block';

            showToast(`${selectResult.message} - Ready for code generation!`, 'success');
        } else {
            showToast(selectResult.message, 'error');
        }

    } catch (error) {
        console.error('Error processing tickets:', error);
        showToast('Failed to process tickets: ' + error.message, 'error');
    } finally {
        proceedBtn.disabled = false;
        proceedBtn.textContent = `Proceed with Selected Tickets (${selectedJiraTickets.size})`;
    }
}

// Initialize multi-ticket workflow - FOLLOWS QA PATTERN
function initializeMultiTicketWorkflow(selectResult) {
    console.log('🎫 Initializing multi-ticket workflow');

    // Store workflow data
    ticketResults = selectResult.workflow_items;

    // Create multi-ticket UI similar to QA test cases
    createMultiTicketUI(selectResult.workflow_items);
}

// REUSE your existing generateApplicationCode function for each ticket
async function generateSelectedTicketCode() {
    const selectedTickets = getSelectedTickets();

    if (selectedTickets.length === 0) {
        showToast('Please select at least one ticket for code generation', 'warning');
        return;
    }

    showProgress('Generating code for selected tickets...', 0);

    try {
        for (let i = 0; i < selectedTickets.length; i++) {
            const ticketId = selectedTickets[i];
            const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);

            if (ticketIndex === -1) continue;

            const ticket = ticketResults[ticketIndex];

            // Update status
            updateTicketStatus(ticketIndex, 'Generating...', '#3b82f6');

            // Store this ticket's prompt in session (reuse existing logic)
            await storeTicketPromptForGeneration(ticket);

            // Use your EXISTING generateApplicationCode function!
            const success = await generateSingleTicketCode(ticketIndex);

            if (success) {
                updateTicketStatus(ticketIndex, 'Generated ✓', '#22c55e');
            } else {
                updateTicketStatus(ticketIndex, 'Failed ✗', '#ef4444');
            }

            // Update progress
            const progress = ((i + 1) / selectedTickets.length) * 100;
            updateProgress(progress, `Generated ${i + 1}/${selectedTickets.length} tickets`);
        }

        showToast(`Generated code for ${selectedTickets.length} tickets!`, 'success');

    } catch (error) {
        console.error('Multi-ticket generation error:', error);
        showToast('Code generation failed: ' + error.message, 'error');
    } finally {
        hideProgress();
    }
}

// Generate code for a single ticket using EXISTING logic
async function generateSingleTicketCode(ticketIndex) {
    try {
        // Store the current ticket's prompt (reuse existing session logic)
        const ticket = ticketResults[ticketIndex];

        // Use your existing backend endpoint with individual prompt
        const response = await fetch('/process_developer_prompt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: ticket.prompt,
                workflowType: 'jira',
                rawInputs: {
                    files: [],
                    requirements: ticket.description,
                    technicalNotes: ticket.technical_notes || ''
                }
            })
        });

        const promptResult = await response.json();

        if (promptResult.success) {
            // Now use your EXISTING /generate_app_code route with smart reuse!
            const generateResponse = await fetch('/generate_app_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    generate_from_prompt: true,
                    ticket_context: {
                        ticket_id: ticket.ticket_id,
                        ticket_index: ticketIndex
                    }
                })
            });

            const generateResult = await generateResponse.json();

            if (generateResult.success) {
                // Display in ticket-specific areas
                displayTicketCode(ticketIndex, generateResult.generated_code);
                return true;
            }
        }

        return false;

    } catch (error) {
        console.error(`Error generating code for ticket ${ticketIndex}:`, error);
        return false;
    }
}

// Display generated code in ticket-specific UI areas
function displayTicketCode(ticketIndex, generatedCode) {
    // Parse the code (reuse your existing parseGeneratedCodeFiles logic)
    const parsedFiles = parseGeneratedCodeFiles(generatedCode);

    // Update main code area
    const mainFile = parsedFiles.find(f => f.type === 'main');
    if (mainFile) {
        const mainTextarea = document.getElementById(`mainArea${ticketIndex}`);
        if (mainTextarea) {
            mainTextarea.value = mainFile.content;
            updateTicketCharCount(ticketIndex, 'main');
        }
    }

    // Update unit test area if tests were generated
    const testFile = parsedFiles.find(f => f.type === 'test');
    if (testFile) {
        const testTextarea = document.getElementById(`testArea${ticketIndex}`);
        if (testTextarea) {
            testTextarea.value = testFile.content;
            updateTicketCharCount(ticketIndex, 'test');
            // ADD THIS LINE: Store original unit test code
            const ticket = ticketResults[ticketIndex];
            if (ticket) {
                storeOriginalUnitTestCode(ticket.ticket_id, testFile.content);
            }
        }
    }
}

// REUSE existing review logic for multi-ticket
async function reviewSelectedTicketCode() {
    const selectedTickets = getSelectedTickets();

    if (selectedTickets.length === 0) {
        showToast('Please select at least one ticket for review', 'warning');
        return;
    }

    showProgress('Reviewing selected tickets...', [
        'Preparing code for review',
        'Analyzing selected tickets',
        'Generating review reports'
    ]);

    try {
        for (let i = 0; i < selectedTickets.length; i++) {
            const ticketId = selectedTickets[i];
            const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);

            if (ticketIndex === -1) continue;

            // Get the generated code for this ticket
            const mainTextarea = document.getElementById(`mainArea${ticketIndex}`);
            const testTextarea = document.getElementById(`testArea${ticketIndex}`);

            if (!mainTextarea || !mainTextarea.value.trim()) continue;

            // Store the code temporarily for review (reuse existing logic)
            await fetch('/store_generated_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    generated_code: [{
                        file_name: `${ticketId}_implementation.py`,
                        generated_code: mainTextarea.value,
                        story_id: ticketId,
                        story_title: ticketResults[ticketIndex].title
                    }]
                })
            });

            // Use your EXISTING review endpoint!
            const reviewResponse = await fetch('/review_app_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticket_context: {
                        ticket_id: ticketId,
                        ticket_index: ticketIndex
                    }
                })
            });

            const reviewResult = await reviewResponse.json();

            if (reviewResult.success) {
                // Display review results in the main code area
                mainTextarea.value = reviewResult.review_report || mainTextarea.value;
                updateTicketCharCount(ticketIndex, 'main');
                updateTicketStatus(ticketIndex, 'Reviewed ✓', '#10b981');
            }

            // Update progress
            const progress = ((i + 1) / selectedTickets.length) * 100;
            updateProgress(progress, `Reviewed ${i + 1}/${selectedTickets.length} tickets`);
        }

        showToast(`Reviewed ${selectedTickets.length} tickets!`, 'success');

    } catch (error) {
        console.error('Multi-ticket review error:', error);
        showToast('Review failed: ' + error.message, 'error');
    } finally {
        hideProgress();
    }
}

// UI Creation - SAME AS BEFORE
function createMultiTicketUI(workflowItems) {
    const container = document.getElementById('generatedCodeContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="multi-ticket-container">
            <div class="multi-ticket-header">
                <h3>🎫 Multi-Ticket Development Workflow</h3>
                <p>Selected ${workflowItems.length} JIRA tickets for code generation</p>
            </div>
            
            <!-- Ticket Selection Controls -->
            <div class="ticket-controls">
                <button class="control-btn" onclick="selectAllTickets()">Select All</button>
                <button class="control-btn" onclick="deselectAllTickets()">Deselect All</button>
                <button class="control-btn" onclick="generateSelectedTicketCode()">Generate Code</button>
                <button class="control-btn" onclick="reviewSelectedTicketCode()">Review Code</button>
                <button class="control-btn" onclick="runSelectedTicketCode()">Run Code</button>
            </div>

            <!-- Individual Ticket Areas -->
            <div id="multiTicketAreas" class="multi-ticket-areas">
                ${workflowItems.map((item, index) => createTicketArea(item, index)).join('')}
            </div>
        </div>
    `;

    container.style.display = 'block';
}

// Individual ticket area creation - SAME AS BEFORE
function createTicketArea(workflowItem, index) {
    return `
        <div class="ticket-area-group" data-ticket-id="${workflowItem.ticket_id}">
            <div class="ticket-area-header">
                <div class="header-left">
                    <label class="ticket-checkbox">
                        <input type="checkbox" 
                               value="${workflowItem.ticket_id}" 
                               checked 
                               onchange="toggleTicketSelection('${workflowItem.ticket_id}')">
                        <span class="ticket-info">
                            <strong>${workflowItem.ticket_id}</strong> - ${workflowItem.title}
                        </span>
                    </label>
                </div>
                <div class="header-right">
                    <span class="generation-status" id="status_${index}">Ready</span>
                </div>
            </div>

            <!-- Ticket Tabs -->
            <div class="ticket-tab-container">
                <div class="ticket-tab-headers">
                    <button class="ticket-tab-header active" 
                            data-tab="main_${index}" 
                            onclick="switchTicketTab('main_${index}', ${index})">
                        🚀 Main Code
                    </button>
                    <button class="ticket-tab-header" 
                            data-tab="test_${index}" 
                            onclick="switchTicketTab('test_${index}', ${index})">
                        🧪 Unit Tests
                    </button>
                </div>

                <div class="ticket-tab-contents">
                    <!-- Main Code Content -->
                    <div class="ticket-tab-content active" data-tab="main_${index}">
                        <div class="tab-toolbar">
                            <div class="toolbar-left">
                                <h4>🚀 Main Implementation - ${workflowItem.ticket_id}</h4>
                            </div>
                            <div class="toolbar-right">
                                <button class="toolbar-btn" onclick="saveTicketTabContent('main_${index}')">💾 Save</button>
                                <button class="toolbar-btn" onclick="downloadTicketTabContent('main_${index}')">📥 Download</button>
                                <button class="toolbar-btn" onclick="runTicketCode(${index})">▶️ Run</button>
                            </div>
                        </div>
                        <textarea 
                            id="mainArea${index}" 
                            class="tab-textarea code-editor"
                            placeholder="Main application code for ${workflowItem.ticket_id} will appear here..."
                            oninput="updateTicketCharCount(${index}, 'main')"
                        ></textarea>
                        <div class="tab-footer">
                            <span class="char-count" id="mainCharCount${index}">0 characters</span>
                        </div>
                    </div>

                    <!-- Unit Tests Content -->
                    <div class="ticket-tab-content" data-tab="test_${index}">
                        <div class="tab-toolbar">
                            <div class="toolbar-left">
                                <h4>🧪 Unit Tests - ${workflowItem.ticket_id}</h4>
                            </div>
                            <div class="toolbar-right">
                                <button class="toolbar-btn" onclick="saveTicketTabContent('test_${index}')">💾 Save</button>
                                <button class="toolbar-btn" onclick="downloadTicketTabContent('test_${index}')">📥 Download</button>
                                <button class="toolbar-btn" onclick="runTicketTests(${index})">🧪 Run Tests</button>
                            </div>
                        </div>
                        <textarea 
                            id="testArea${index}" 
                            class="tab-textarea code-editor"
                            placeholder="Unit tests for ${workflowItem.ticket_id} will appear here..."
                            oninput="updateTicketCharCount(${index}, 'test')"
                        ></textarea>
                        <div class="tab-footer">
                            <span class="char-count" id="testCharCount${index}">0 characters</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Save content for multi-ticket tabs
async function saveTicketTabContent(tabId) {
    console.log(`💾 Saving content for tab: ${tabId}`);

    // Parse the tabId to get the correct textarea
    let textareaId, contentType, ticketId;

    if (tabId.startsWith('main_')) {
        const index = tabId.replace('main_', '');
        textareaId = `mainArea${index}`;
        contentType = 'main';
        ticketId = ticketResults[index]?.ticket_id || `ticket_${index}`;
    } else if (tabId.startsWith('test_')) {
        const index = tabId.replace('test_', '');
        textareaId = `testArea${index}`;
        contentType = 'test';
        ticketId = ticketResults[index]?.ticket_id || `ticket_${index}`;
    } else {
        // Fallback for other tab types
        textareaId = `${tabId}TabTextarea`;
        contentType = tabId;
        ticketId = tabId;
    }

    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        console.error(`❌ Textarea not found: ${textareaId}`);
        showToast('Save failed - textarea not found', 'error');
        return;
    }

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No content to save for ${ticketId}!`, 'warning');
        return;
    }

    try {
        // Save to localStorage as backup
        const storageKey = `ticket_${ticketId}_${contentType}`;
        localStorage.setItem(storageKey, content);
        localStorage.setItem(`${storageKey}_timestamp`, new Date().toISOString());

        showToast(`${ticketId} ${contentType} code saved successfully!`, 'success');
        console.log(`✅ Saved ${ticketId} ${contentType} code to localStorage`);

    } catch (error) {
        console.error(`❌ Error saving ${ticketId} ${contentType}:`, error);
        showToast(`Failed to save ${ticketId} ${contentType} code`, 'error');
    }
}

// Download content for multi-ticket tabs
function downloadTicketTabContent(tabId) {
    console.log(`📥 Downloading content for tab: ${tabId}`);

    // Parse the tabId to get the correct textarea
    let textareaId, contentType, ticketId;

    if (tabId.startsWith('main_')) {
        const index = tabId.replace('main_', '');
        textareaId = `mainArea${index}`;
        contentType = 'main';
        ticketId = ticketResults[index]?.ticket_id || `ticket_${index}`;
    } else if (tabId.startsWith('test_')) {
        const index = tabId.replace('test_', '');
        textareaId = `testArea${index}`;
        contentType = 'test';
        ticketId = ticketResults[index]?.ticket_id || `ticket_${index}`;
    } else {
        // Fallback for other tab types
        textareaId = `${tabId}TabTextarea`;
        contentType = tabId;
        ticketId = tabId;
    }

    const textarea = document.getElementById(textareaId);
    if (!textarea) {
        console.error(`❌ Textarea not found: ${textareaId}`);
        showToast('Download failed - textarea not found', 'error');
        return;
    }

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No content to download for ${ticketId}!`, 'warning');
        return;
    }

    // Create filename
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${ticketId}_${contentType}_${timestamp}.py`;

    // Create and trigger download
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/x-python' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${filename} downloaded successfully!`, 'success');
    console.log(`✅ Downloaded ${filename}`);
}

// New function to run specific ticket's unit tests
async function runTicketTests(ticketIndex) {
    console.log(`🧪 Running tests for ticket ${ticketIndex}`);

    // Get the specific ticket's test code
    const testTextarea = document.getElementById(`testArea${ticketIndex}`);
    if (!testTextarea || !testTextarea.value.trim()) {
        showToast(`No unit tests found for ticket ${ticketIndex}. Please generate tests first!`, 'warning');
        return;
    }

    // Create a temporary textarea with the ID format that runTests() expects
    const tempTextarea = document.createElement('textarea');
    tempTextarea.id = `ticket_${ticketIndex}_testTextarea`;
    tempTextarea.value = testTextarea.value;
    tempTextarea.style.display = 'none';
    document.body.appendChild(tempTextarea);

    try {
        // Now call runTests with the expected fileId format
        await runTests(`ticket_${ticketIndex}_test`);

        // IMPORTANT: Copy the results back to the original textarea
        const updatedContent = tempTextarea.value;
        testTextarea.value = updatedContent;

        // Update character count if you have that function
        updateTicketCharCount(ticketIndex, 'test');

    } finally {
        // Clean up the temporary textarea
        document.body.removeChild(tempTextarea);
    }
}

// New function to run specific ticket code
async function runTicketCode(ticketIndex) {
    console.log(`▶️ Running code for ticket ${ticketIndex}`);

    // Get the specific ticket's main code
    const mainTextarea = document.getElementById(`mainArea${ticketIndex}`);
    if (!mainTextarea || !mainTextarea.value.trim()) {
        showToast(`No code found for ticket ${ticketIndex}. Please generate code first!`, 'warning');
        return;
    }

    // Store the specific ticket's code temporarily in the global variable
    // so your existing execution flow works
    window.generatedApplicationCode = [{
        generated_code: mainTextarea.value.trim(),
        file_name: `ticket_${ticketIndex}_code.py`
    }];

    // Now call your existing runCode() function
    await runCode();
}

// Utility functions - SAME AS BEFORE
function getSelectedTickets() {
    const checkboxes = document.querySelectorAll('.ticket-checkbox input:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

function selectAllTickets() {
    document.querySelectorAll('.ticket-checkbox input').forEach(cb => cb.checked = true);
}

function deselectAllTickets() {
    document.querySelectorAll('.ticket-checkbox input').forEach(cb => cb.checked = false);
}

function updateTicketCharCount(index, type) {
    const textarea = document.getElementById(`${type}Area${index}`);
    const charCount = document.getElementById(`${type}CharCount${index}`);

    if (textarea && charCount) {
        charCount.textContent = `${textarea.value.length} characters`;
    }
}

function updateTicketStatus(index, status, color) {
    const statusElement = document.getElementById(`status_${index}`);
    if (statusElement) {
        statusElement.textContent = status;
        statusElement.style.background = color;
    }
}

function switchTicketTab(tabId, ticketIndex) {
    console.log(`🔄 Switching ticket tab: ${tabId}, ticketIndex: ${ticketIndex}`);

    // Find ALL ticket area groups and use the index directly
    const allTicketGroups = document.querySelectorAll('.ticket-area-group');
    console.log(`Found ${allTicketGroups.length} ticket groups`);

    if (ticketIndex >= allTicketGroups.length) {
        console.error(`❌ Invalid ticket index: ${ticketIndex}, only ${allTicketGroups.length} groups found`);
        return;
    }

    const ticketGroup = allTicketGroups[ticketIndex];
    console.log(`✅ Using ticket group at index ${ticketIndex}`);

    // Debug: Check what tabs exist in this group
    const existingHeaders = ticketGroup.querySelectorAll('.ticket-tab-header');
    const existingContents = ticketGroup.querySelectorAll('.ticket-tab-content');

    console.log('Available tab headers:', Array.from(existingHeaders).map(h => h.getAttribute('data-tab')));
    console.log('Available tab contents:', Array.from(existingContents).map(c => c.getAttribute('data-tab')));

    // Remove active class from all headers in this group
    existingHeaders.forEach(header => header.classList.remove('active'));

    // Find and activate the target header
    const targetHeader = ticketGroup.querySelector(`[data-tab="${tabId}"]`);
    if (!targetHeader) {
        console.error(`❌ Tab header not found for: ${tabId}`);
        return;
    }
    targetHeader.classList.add('active');

    // Remove active class from all contents in this group
    existingContents.forEach(content => content.classList.remove('active'));

    // Find and activate the target content
    const targetContent = ticketGroup.querySelector(`.ticket-tab-content[data-tab="${tabId}"]`);
    if (!targetContent) {
        console.error(`❌ Tab content not found for: ${tabId}`);
        return;
    }
    targetContent.classList.add('active');

    console.log(`✅ Successfully switched to ${tabId}`);
}

// Display JIRA-generated prompt in the developer workflow
function displayJiraPromptInWorkflow(promptResult) {
    // Update the requirement text area with the JIRA-based prompt
    const requirementText = document.getElementById('requirementText');
    if (requirementText) {
        requirementText.value = promptResult.prompt;
        requirementText.style.minHeight = '300px'; // Expand to show more content
    }

    // Add a label to indicate this is from JIRA
    const existingLabel = document.querySelector('.jira-prompt-label');
    if (existingLabel) existingLabel.remove();

    const label = document.createElement('div');
    label.className = 'jira-prompt-label';
    label.innerHTML = `
        <span class="jira-indicator">🎫 JIRA Integration Active</span>
        <span class="ticket-count">${promptResult.ticket_count} ticket(s) selected</span>
    `;
    label.style.cssText = `
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: white;
        padding: 8px 15px;
        border-radius: 6px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        font-weight: 500;
    `;

    if (requirementText && requirementText.parentNode) {
        requirementText.parentNode.insertBefore(label, requirementText);
    }
}

// Display developer workflow items
function displayDeveloperWorkflow(workflowItems) {
    // Update the existing developer stories display
    const storiesContainer = document.getElementById('userStoriesContainer');
    if (storiesContainer) {
        const storiesHtml = workflowItems.map((story, index) => `
            <div class="user-story-item" data-story-id="${story.id}">
                <div class="story-header">
                    <label class="story-checkbox">
                        <input type="checkbox" value="${story.id}" 
                               onchange="toggleStorySelection('${story.id}')" checked>
                        <span class="story-id">${story.id}</span>
                        <span class="story-priority priority-${story.priority.toLowerCase()}">${story.priority}</span>
                    </label>
                </div>
                <div class="story-content">
                    <h4 class="story-title">${story.title}</h4>
                    <div class="story-description">${story.description}</div>
                    <div class="story-acceptance-criteria">
                        <strong>Acceptance Criteria:</strong>
                        <div class="acceptance-text">${story.acceptance_criteria}</div>
                    </div>
                </div>
            </div>
        `).join('');

        storiesContainer.innerHTML = storiesHtml;
    }

    // Initialize selected stories
    selectedUserStories.clear();
    workflowItems.forEach(story => selectedUserStories.add(story.id));
    updateStorySelectionStatus();
}

// Show developer generation options
function showDeveloperGenerationOptions() {
    const optionsSection = document.getElementById('developerGenerationOptions');
    if (optionsSection) {
        optionsSection.style.display = 'block';
    }
}

// Disconnect from JIRA
async function disconnectFromJira() {
    try {
        await fetch('/disconnect_jira', { method: 'POST' });

        // Reset UI state
        jiraConnection = null;
        jiraTickets = [];
        selectedJiraTickets.clear();

        document.getElementById('jiraConnectionSection').style.display = 'block';
        document.getElementById('jiraProjectSection').style.display = 'none';
        document.getElementById('jiraTicketsSection').style.display = 'none';

        // Clear input fields
        document.getElementById('jiraUrlInput').value = '';
        document.getElementById('jiraUsernameInput').value = '';
        document.getElementById('jiraPasswordInput').value = '';

        showToast('Disconnected from JIRA', 'info');

    } catch (error) {
        console.error('Error disconnecting:', error);
    }
}

// Update JIRA ticket status after code review and execution
async function updateJiraTicketStatus() {
    if (selectedJiraTickets.size === 0) {
        console.log('No JIRA tickets to update');
        return;
    }

    try {
        showToast('Updating JIRA ticket status...', 'info');

        // Find the latest review report path
        const reportPath = getLatestReviewReportPath();

        const response = await fetch('/update_jira_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ticket_ids: Array.from(selectedJiraTickets),
                report_path: reportPath
            })
        });

        const result = await response.json();

        if (result.success) {
            const updated = result.updated_tickets.length;
            const failed = result.failed_tickets.length;

            if (failed === 0) {
                showToast(`✅ Updated ${updated} JIRA tickets to "In Review" status`, 'success');
            } else {
                showToast(`⚠️ Updated ${updated} tickets, ${failed} failed. Check console for details.`, 'warning');
                console.log('Failed ticket updates:', result.failed_tickets);
            }

            // Log detailed results
            console.log('JIRA Update Results:', result);
        } else {
            showToast(`❌ Failed to update JIRA tickets: ${result.message}`, 'error');
        }

    } catch (error) {
        console.error('Error updating JIRA status:', error);
        showToast('Error updating JIRA tickets: ' + error.message, 'error');
    }
}

// Get the latest review report path (you may need to adjust this based on your setup)
function getLatestReviewReportPath() {
    // This should return the path to the generated HTML review report
    // Adjust based on where your reports are generated
    return '../reports/developer_review_report.html';
}

// Enhanced run code function to include JIRA status update
async function runCodeWithJiraUpdate() {
    // First run the existing code execution
    await runCode();

    // Then update JIRA status if execution was successful
    setTimeout(async () => {
        if (selectedJiraTickets.size > 0) {
            await updateJiraTicketStatus();
        }
    }, 2000); // Wait 2 seconds for execution to complete
}

// ===========================
// GitHub Integration code new functions
// =========================
// Toggle between ZIP upload and GitHub URL input
function toggleCodebaseInputMethod() {
    const zipSection = document.getElementById('zipUploadSection');
    const githubSection = document.getElementById('githubUrlSection');
    const toggleBtn = document.getElementById('inputMethodToggle');

    if (zipSection.style.display === 'none') {
        // Show ZIP upload, hide GitHub
        zipSection.style.display = 'block';
        githubSection.style.display = 'none';
        toggleBtn.textContent = '🔗 Use GitHub URL Instead';
        toggleBtn.title = 'Switch to GitHub repository URL input';
    } else {
        // Show GitHub, hide ZIP upload
        zipSection.style.display = 'none';
        githubSection.style.display = 'block';
        toggleBtn.textContent = '📁 Upload ZIP Instead';
        toggleBtn.title = 'Switch to ZIP file upload';
    }
}

// Validate GitHub URL as user types
async function validateGithubUrl() {
    const urlInput = document.getElementById('githubUrlInput');
    const validationMsg = document.getElementById('githubUrlValidation');
    const analyzeBtn = document.getElementById('analyzeGithubBtn');

    const url = urlInput.value.trim();

    if (!url) {
        validationMsg.textContent = '';
        validationMsg.className = 'github-validation';
        analyzeBtn.disabled = true;
        return;
    }

    // Basic client-side validation
    const githubPattern = /github\.com\/[^\/]+\/[^\/]+/;
    if (!githubPattern.test(url)) {
        validationMsg.textContent = '❌ Please enter a valid GitHub repository URL';
        validationMsg.className = 'github-validation error';
        analyzeBtn.disabled = true;
        return;
    }

    // Server-side validation
    try {
        const response = await fetch('/validate_github_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ github_url: url })
        });

        const result = await response.json();

        if (result.valid) {
            validationMsg.textContent = `✅ ${result.message}`;
            validationMsg.className = 'github-validation success';
            analyzeBtn.disabled = false;
        } else {
            validationMsg.textContent = `❌ ${result.message}`;
            validationMsg.className = 'github-validation error';
            analyzeBtn.disabled = true;
        }
    } catch (error) {
        validationMsg.textContent = '⚠️ Unable to validate URL (network error)';
        validationMsg.className = 'github-validation warning';
        analyzeBtn.disabled = false; // Allow attempt even if validation fails
    }
}

// Analyze GitHub repository
async function analyzeGithubRepo() {
    console.log('🔍 Starting GitHub repository analysis...');

    const urlInput = document.getElementById('githubUrlInput');
    const analyzeBtn = document.getElementById('analyzeGithubBtn');

    const githubUrl = urlInput.value.trim();

    if (!githubUrl) {
        showToast('Please enter a GitHub repository URL', 'error');
        return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Downloading Repository...';

    try {
        showProgress('Analyzing GitHub Repository', [
            'Validating repository URL',
            'Downloading repository ZIP',
            'Extracting codebase files',
            'Analyzing code structure',
            'Building context database'
        ]);

        updateProgress(20, 'Validating repository', 0);

        const response = await fetch('/upload_github_repo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ github_url: githubUrl })
        });

        updateProgress(40, 'Downloading repository', 1);
        await delay(1000);

        const result = await response.json();

        if (result.success) {
            updateProgress(60, 'Extracting files', 2);
            await delay(1000);

            updateProgress(80, 'Analyzing code structure', 3);
            await delay(1000);

            updateProgress(100, 'Repository analysis complete', 4);

            // Create complete context info
            const completeContextInfo = {
                libraries_count: result.context_info.libraries_count,
                functions_count: result.context_info.functions_count,
                classes_count: result.context_info.classes_count,
                patterns: result.context_info.patterns,
                libraries: result.libraries || [],
                functions: result.functions || {},
                classes: result.classes || {},
                dependencies: result.dependencies || []
            };

            console.log('📚 GitHub repository context:', completeContextInfo);

            // Save codebase for future use
            const codebaseToSave = {
                name: result.repo_name || result.codebase_id,
                source: 'github',
                url: githubUrl,
                ...completeContextInfo
            };

            saveCodebaseToStorage(codebaseToSave);
            displayCodebaseInSidebar(completeContextInfo);

            // Enable the clear button
            const clearBtn = document.getElementById('clearCodebaseBtn');
            if (clearBtn) {
                clearBtn.disabled = false;
            }

            showToast(`Successfully analyzed repository: ${result.repo_name}`, 'success');

            // Clear the URL input
            urlInput.value = '';
            document.getElementById('githubUrlValidation').textContent = '';

            // Hide the codebase manager after successful analysis
            setTimeout(() => {
                showDeveloperMode(); // Return to developer mode with loaded codebase
            }, 1000);

        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ GitHub repository analysis error:', error);
        showToast('Failed to analyze repository: ' + error.message, 'error');
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = 'Analyze Repository';
        hideProgress();
    }
}

function onGithubUrlInput() {
    clearTimeout(validationTimeout);
    validationTimeout = setTimeout(validateGithubUrl, 500);
}

/*
// REPLACE your existing uploadCodebase function with this version that includes persistence:
async function uploadCodebase() {
    console.log('📤 Starting codebase upload...');

    const codebaseFileInput = document.getElementById('codebaseFileInput');
    if (!codebaseFileInput || codebaseFileInput.files.length === 0) {
        showToast('Please select a codebase ZIP file first!', 'warning');
        return;
    }

    const uploadBtn = document.getElementById('uploadCodebaseBtn');
    if (!uploadBtn) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading Codebase...';

    try {
        const formData = new FormData();
        const file = codebaseFileInput.files[0];
        formData.append('codebase', file);

        showProgress('Uploading Codebase', [
            'Uploading ZIP file',
            'Extracting codebase files',
            'Analyzing code structure',
            'Building context database',
            'Indexing functions and patterns'
        ]);

        updateProgress(20, 'Uploading file to server', 0);

        const response = await fetch('/upload_codebase', {
            method: 'POST',
            body: formData
        });

        updateProgress(40, 'Processing codebase', 1);

        const result = await response.json();

        if (result.success) {
            updateProgress(60, 'Analyzing code structure', 2);
            await delay(1000);

            updateProgress(80, 'Building context', 3);
            await delay(1000);

            updateProgress(100, 'Codebase loaded successfully', 4);

            // Create complete context info
            const completeContextInfo = {
                libraries_count: result.context_info.libraries_count,
                functions_count: result.context_info.functions_count,
                classes_count: result.context_info.classes_count || (result.classes ? Object.keys(result.classes).length : 0),
                patterns: result.context_info.patterns,
                libraries: result.libraries || [],
                functions: result.functions || {},
                classes: result.classes || {},
                dependencies: result.dependencies || []
            };

            console.log('📚 Complete context info:', completeContextInfo);

            // NEW: Save codebase for future use
            const codebaseToSave = {
                name: file.name.replace('.zip', ''),
                ...completeContextInfo
            };

            saveCodebaseToStorage(codebaseToSave);
            displayCodebaseInSidebar(completeContextInfo);

            // Enable the clear button
            const clearBtn = document.getElementById('clearCodebaseBtn');
            if (clearBtn) {
                clearBtn.disabled = false;
            }

            showToast(result.message, 'success');

            // Clear the file input
            codebaseFileInput.value = '';

            // Hide the codebase manager after successful upload
            setTimeout(() => {
                showDeveloperMode(); // Return to developer mode with loaded codebase
            }, 1000);

        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Codebase upload error:', error);
        showToast('Failed to upload codebase: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Codebase';
        hideProgress();
    }
}
*/

// Update your existing uploadCodebase function to handle both methods
async function uploadCodebase() {
    const zipSection = document.getElementById('zipUploadSection');

    if (zipSection.style.display !== 'none') {
        // ZIP upload method
        return uploadCodebaseZip();
    } else {
        // GitHub URL method
        return analyzeGithubRepo();
    }
}

// Rename your existing uploadCodebase function
async function uploadCodebaseZip() {
    console.log('📤 Starting codebase ZIP upload...');

    const codebaseFileInput = document.getElementById('codebaseFileInput');
    if (!codebaseFileInput || codebaseFileInput.files.length === 0) {
        showToast('Please select a codebase ZIP file first!', 'warning');
        return;
    }

    const uploadBtn = document.getElementById('uploadCodebaseBtn');
    if (!uploadBtn) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading Codebase...';

    try {
        const formData = new FormData();
        const file = codebaseFileInput.files[0];
        formData.append('codebase', file);

        showProgress('Uploading Codebase', [
            'Uploading ZIP file',
            'Extracting codebase files',
            'Analyzing code structure',
            'Building context database',
            'Indexing functions and patterns'
        ]);

        updateProgress(20, 'Uploading file to server', 0);

        const response = await fetch('/upload_codebase', {
            method: 'POST',
            body: formData
        });

        updateProgress(40, 'Processing codebase', 1);

        const result = await response.json();

        if (result.success) {
            updateProgress(60, 'Analyzing code structure', 2);
            await delay(1000);

            updateProgress(80, 'Building context', 3);
            await delay(1000);

            updateProgress(100, 'Codebase loaded successfully', 4);

            // Create complete context info
            const completeContextInfo = {
                libraries_count: result.context_info.libraries_count,
                functions_count: result.context_info.functions_count,
                classes_count: result.context_info.classes_count || 0,
                patterns: result.context_info.patterns,
                libraries: result.libraries || [],
                functions: result.functions || {},
                classes: result.classes || {},
                dependencies: result.dependencies || []
            };

            console.log('📚 Complete context info:', completeContextInfo);

            // Save codebase for future use
            const codebaseToSave = {
                name: file.name.replace('.zip', ''),
                source: 'upload',
                ...completeContextInfo
            };

            saveCodebaseToStorage(codebaseToSave);
            displayCodebaseInSidebar(completeContextInfo);

            // Enable the clear button
            const clearBtn = document.getElementById('clearCodebaseBtn');
            if (clearBtn) {
                clearBtn.disabled = false;
            }

            showToast(result.message, 'success');

            // Clear the file input
            codebaseFileInput.value = '';

            // Hide the codebase manager after successful upload
            setTimeout(() => {
                showDeveloperMode(); // Return to developer mode with loaded codebase
            }, 1000);

        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Codebase upload error:', error);
        showToast('Failed to upload codebase: ' + error.message, 'error');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = 'Upload Codebase';
        hideProgress();
    }
}

async function clearCodebase() {
    console.log('🧹 Clearing codebase context...');

    if (!confirm('Are you sure you want to clear the loaded codebase context? This action cannot be undone.')) {
        return;
    }

    const clearBtn = document.getElementById('clearCodebaseBtn');
    if (!clearBtn) return;

    clearBtn.disabled = true;
    clearBtn.textContent = 'Clearing...';

    try {
        const response = await fetch('/clear_codebase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

        if (result.success) {
            // Reset the codebase status display
            updateCodebaseStatus({
                libraries_count: 0,
                functions_count: 0,
                patterns: []
            });

            // Clear file input
            const codebaseFileInput = document.getElementById('codebaseFileInput');
            if (codebaseFileInput) {
                codebaseFileInput.value = '';
            }

            clearBtn.disabled = true;
            clearBtn.textContent = 'Clear Context';

            showToast('Codebase context cleared successfully', 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Clear codebase error:', error);
        showToast('Failed to clear codebase: ' + error.message, 'error');
    } finally {
        clearBtn.textContent = 'Clear Context';
    }
}

async function searchCodebase() {
    console.log('🔍 Searching codebase...');

    const searchInput = document.getElementById('codebaseSearchInput');
    const searchBtn = document.getElementById('searchCodebaseBtn');
    const resultsContainer = document.getElementById('codebaseSearchResults');

    if (!searchInput || !searchBtn || !resultsContainer) return;

    const query = searchInput.value.trim();
    if (!query) {
        showToast('Please enter a search query', 'warning');
        return;
    }

    searchBtn.disabled = true;
    searchBtn.textContent = 'Searching...';

    try {
        const response = await fetch('/search_codebase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query })
        });

        const result = await response.json();

        if (result.success) {
            displaySearchResults(result.results);
            showToast(`Found ${result.results.length} matches`, 'success');
        } else {
            resultsContainer.innerHTML = '<p class="no-results">No results found</p>';
            showToast(result.message, 'warning');
        }

    } catch (error) {
        console.error('❌ Search error:', error);
        showToast('Search failed: ' + error.message, 'error');
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = 'Search';
    }
}

function displaySearchResults(results) {
    const resultsContainer = document.getElementById('codebaseSearchResults');
    if (!resultsContainer) return;

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">No results found</p>';
        return;
    }

    resultsContainer.innerHTML = '';

    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';
        resultItem.innerHTML = `
            <div class="result-header">
                <span class="result-type">${result.type}</span>
                <span class="result-file">${result.file_path}</span>
            </div>
            <div class="result-content">
                <div class="result-name">${result.name}</div>
                ${result.snippet ? `<pre class="result-snippet">${result.snippet}</pre>` : ''}
                ${result.line_number ? `<span class="result-line">Line ${result.line_number}</span>` : ''}
            </div>
        `;
        resultsContainer.appendChild(resultItem);
    });
}

// ================================================================================================
// MODE MANAGEMENT FUNCTIONS
// ================================================================================================
/*
function displayCodebaseDetails(contextInfo) {
    console.log('📋 Displaying codebase details:', contextInfo);

    // Find or create a container for codebase details
    let detailsContainer = document.getElementById('codebaseDetails');
    if (!detailsContainer) {
        // Create the container if it doesn't exist
        detailsContainer = document.createElement('div');
        detailsContainer.id = 'codebaseDetails';
        detailsContainer.className = 'codebase-details';

        // Insert it after the codebase status
        const statusElement = document.getElementById('codebaseStatus');
        if (statusElement && statusElement.parentNode) {
            statusElement.parentNode.insertBefore(detailsContainer, statusElement.nextSibling);
        }
    }

    // Build the details HTML
    let detailsHTML = '';

    // Libraries section
    if (contextInfo.libraries && contextInfo.libraries.length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>📚 Available Libraries</h3>
                <div class="libraries-list">
                    ${contextInfo.libraries.map(lib => `<span class="library-item">${lib}</span>`).join('')}
                </div>
            </div>
        `;
    }

    // Functions section
    if (contextInfo.functions && Object.keys(contextInfo.functions).length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>⚡ Available Functions</h3>
                <div class="functions-list">
                    ${Object.entries(contextInfo.functions).map(([name, info]) => `
                        <div class="function-item">
                            <strong>${name}</strong>
                            ${info.file ? `<span class="file-path">${info.file}</span>` : ''}
                            ${info.docstring ? `<p class="docstring">${info.docstring}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Classes section
    if (contextInfo.classes && Object.keys(contextInfo.classes).length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>🏗️ Available Classes</h3>
                <div class="classes-list">
                    ${Object.entries(contextInfo.classes).map(([name, info]) => `
                        <div class="class-item">
                            <strong>${name}</strong>
                            ${info.file ? `<span class="file-path">${info.file}</span>` : ''}
                            ${info.methods && info.methods.length > 0 ?
                                `<div class="methods">Methods: ${info.methods.join(', ')}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Patterns section
    if (contextInfo.patterns && contextInfo.patterns.length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>🔍 Detected Patterns</h3>
                <div class="patterns-list">
                    ${contextInfo.patterns.map(pattern => `<span class="pattern-item">${pattern}</span>`).join('')}
                </div>
            </div>
        `;
    }

    detailsContainer.innerHTML = detailsHTML || '<p>No codebase details available.</p>';
}
*/

function displayCodebaseDetails(contextInfo) {
    console.log('📋 Displaying codebase details:', contextInfo);

    // Find or create a container for codebase details
    let detailsContainer = document.getElementById('codebaseDetails');
    if (!detailsContainer) {
        // Create the container if it doesn't exist
        detailsContainer = document.createElement('div');
        detailsContainer.id = 'codebaseDetails';
        detailsContainer.className = 'codebase-details';

        // Insert it after the codebase status
        const statusElement = document.getElementById('codebaseStatus');
        if (statusElement && statusElement.parentNode) {
            statusElement.parentNode.insertBefore(detailsContainer, statusElement.nextSibling);
        }
    }

    // Build the details HTML
    let detailsHTML = '';

    // Libraries section - FIXED to handle array of library names
    if (contextInfo.libraries && Array.isArray(contextInfo.libraries) && contextInfo.libraries.length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>📚 Available Libraries (${contextInfo.libraries.length})</h3>
                <div class="libraries-list">
                    ${contextInfo.libraries.slice(0, 20).map(lib => `<span class="library-item">${lib}</span>`).join('')}
                    ${contextInfo.libraries.length > 20 ? `<span class="library-item">... and ${contextInfo.libraries.length - 20} more</span>` : ''}
                </div>
            </div>
        `;
    }

    // Functions section - FIXED to handle object of functions
    if (contextInfo.functions && typeof contextInfo.functions === 'object' && Object.keys(contextInfo.functions).length > 0) {
        const functionEntries = Object.entries(contextInfo.functions);
        detailsHTML += `
            <div class="codebase-section">
                <h3>⚡ Available Functions (${functionEntries.length})</h3>
                <div class="functions-list">
                    ${functionEntries.slice(0, 10).map(([name, info]) => `
                        <div class="function-item">
                            <strong>${name}</strong>
                            ${info.file ? `<span class="file-path">📁 ${info.file}</span>` : ''}
                            ${info.docstring ? `<p class="docstring">"${info.docstring.substring(0, 100)}${info.docstring.length > 100 ? '...' : ''}"</p>` : ''}
                            ${info.args ? `<p class="function-args">Args: ${info.args.join(', ')}</p>` : ''}
                        </div>
                    `).join('')}
                    ${functionEntries.length > 10 ? `<div class="function-item"><strong>... and ${functionEntries.length - 10} more functions</strong></div>` : ''}
                </div>
            </div>
        `;
    }

    // Classes section - FIXED to handle object of classes
    if (contextInfo.classes && typeof contextInfo.classes === 'object' && Object.keys(contextInfo.classes).length > 0) {
        const classEntries = Object.entries(contextInfo.classes);
        detailsHTML += `
            <div class="codebase-section">
                <h3>🏗️ Available Classes (${classEntries.length})</h3>
                <div class="classes-list">
                    ${classEntries.slice(0, 8).map(([name, info]) => `
                        <div class="class-item">
                            <strong>${name}</strong>
                            ${info.file ? `<span class="file-path">📁 ${info.file}</span>` : ''}
                            ${info.methods && info.methods.length > 0 ? 
                                `<div class="methods">Methods: ${info.methods.slice(0, 5).join(', ')}${info.methods.length > 5 ? '...' : ''}</div>` : ''}
                            ${info.docstring ? `<p class="docstring">"${info.docstring.substring(0, 80)}${info.docstring.length > 80 ? '...' : ''}"</p>` : ''}
                        </div>
                    `).join('')}
                    ${classEntries.length > 8 ? `<div class="class-item"><strong>... and ${classEntries.length - 8} more classes</strong></div>` : ''}
                </div>
            </div>
        `;
    }

    // Patterns section - FIXED to handle both array and object
    if (contextInfo.patterns) {
        let patternsToShow = [];

        if (Array.isArray(contextInfo.patterns)) {
            patternsToShow = contextInfo.patterns;
        } else if (typeof contextInfo.patterns === 'object') {
            // If patterns is an object, extract keys that have non-empty arrays
            patternsToShow = Object.entries(contextInfo.patterns)
                .filter(([key, value]) => Array.isArray(value) && value.length > 0)
                .map(([key, value]) => `${key} (${value.length} files)`);
        }

        if (patternsToShow.length > 0) {
            detailsHTML += `
                <div class="codebase-section">
                    <h3>🔍 Detected Patterns (${patternsToShow.length})</h3>
                    <div class="patterns-list">
                        ${patternsToShow.map(pattern => `<span class="pattern-item">${pattern}</span>`).join('')}
                    </div>
                </div>
            `;
        }
    }

    // Dependencies section (if available)
    if (contextInfo.dependencies && Array.isArray(contextInfo.dependencies) && contextInfo.dependencies.length > 0) {
        detailsHTML += `
            <div class="codebase-section">
                <h3>📦 Dependencies (${contextInfo.dependencies.length})</h3>
                <div class="dependencies-list">
                    ${contextInfo.dependencies.slice(0, 15).map(dep => `<span class="library-item">${dep}</span>`).join('')}
                    ${contextInfo.dependencies.length > 15 ? `<span class="library-item">... and ${contextInfo.dependencies.length - 15} more</span>` : ''}
                </div>
            </div>
        `;
    }

    if (!detailsHTML) {
        detailsHTML = '<p>No detailed codebase information available. The codebase may not contain analyzable Python files.</p>';
    }

    detailsContainer.innerHTML = detailsHTML;
    console.log('✅ Codebase details displayed successfully');
}

/*
// Add this function for codebase status updates
function updateCodebaseStatus(contextInfo) {
    console.log('📚 Updating codebase status');

    // Default empty context if not provided
    if (!contextInfo) {
        contextInfo = {
            libraries_count: 0,
            functions_count: 0,
            patterns: []
        };
    }

    const statusElement = document.getElementById('codebaseStatus');
    if (!statusElement) return;

    // Update the counts
    statusElement.innerHTML = `
        <div class="codebase-info">
            <span>📚 Libraries: ${contextInfo.libraries_count || 0}</span>
            <span>⚡ Functions: ${contextInfo.functions_count || 0}</span>
            <span>🔍 Patterns: ${contextInfo.patterns ? contextInfo.patterns.length : 0}</span>
        </div>
    `;

    // Update status indicator
    const statusPanel = document.getElementById('codebaseContextPanel');
    if (statusPanel) {
        if (contextInfo.libraries_count > 0) {
            statusPanel.classList.add('context-loaded');
        } else {
            statusPanel.classList.remove('context-loaded');
        }
    }
    // Display detailed codebase structure
    displayCodebaseDetails(contextInfo);
}
*/

function updateCodebaseStatus(contextInfo) {
    console.log('📚 Updating codebase status with data:', contextInfo);

    // Default empty context if not provided
    if (!contextInfo) {
        contextInfo = {
            libraries_count: 0,
            functions_count: 0,
            patterns: []
        };
    }

    const statusElement = document.getElementById('codebaseStatus');
    if (!statusElement) {
        console.error('❌ codebaseStatus element not found');
        return;
    }

    // FIXED: Extract the correct counts from contextInfo
    const librariesCount = contextInfo.libraries_count || (contextInfo.libraries ? contextInfo.libraries.length : 0);
    const functionsCount = contextInfo.functions_count || (contextInfo.functions ? Object.keys(contextInfo.functions).length : 0);
    const classesCount = contextInfo.classes_count || (contextInfo.classes ? Object.keys(contextInfo.classes).length : 0);
    const patternsCount = contextInfo.patterns ? (Array.isArray(contextInfo.patterns) ? contextInfo.patterns.length : Object.keys(contextInfo.patterns).length) : 0;

    console.log('📊 Extracted counts:', {
        libraries: librariesCount,
        functions: functionsCount,
        classes: classesCount,
        patterns: patternsCount
    });

    // FIXED: Update the status display with correct information
    statusElement.innerHTML = `
        <div class="codebase-info">
            <span>📚 Libraries: ${librariesCount}</span>
            <span>⚡ Functions: ${functionsCount}</span>
            <span>🏗️ Classes: ${classesCount}</span>
            <span>🔍 Patterns: ${patternsCount}</span>
        </div>
    `;

    // Update status indicator
    const statusPanel = document.getElementById('codebaseContextPanel');
    if (statusPanel) {
        if (librariesCount > 0 || functionsCount > 0 || classesCount > 0) {
            statusPanel.classList.add('context-loaded');
        } else {
            statusPanel.classList.remove('context-loaded');
        }
    }

    // Display detailed codebase structure
    displayCodebaseDetails(contextInfo);

    console.log('✅ Codebase status updated successfully');
}

// ALSO ADD this debug function to check what data is being received:
function debugCodebaseData(result) {
    console.log('🔍 DEBUG: Full backend response:', result);
    console.log('🔍 DEBUG: Context info:', result.context_info);
    console.log('🔍 DEBUG: Libraries array length:', result.libraries ? result.libraries.length : 'undefined');
    console.log('🔍 DEBUG: Functions object keys:', result.functions ? Object.keys(result.functions).length : 'undefined');
    console.log('🔍 DEBUG: Classes object keys:', result.classes ? Object.keys(result.classes).length : 'undefined');
    console.log('🔍 DEBUG: Patterns:', result.patterns);
}

async function loadCurrentContext() {
    try {
        const response = await fetch('/get_context');
        const context = await response.json();

        currentMode = context.current_mode;
        updateModeIndicator(currentMode);
        updateCodebaseStatus(context.codebase_info);

        console.log('✅ Context loaded:', context);
    } catch (error) {
        console.error('❌ Failed to load context:', error);
    }
}

function updateModeIndicator(mode) {
    const modeDisplay = document.getElementById('currentModeDisplay');
    if (modeDisplay) {
        const modeNames = {
            'qa': 'QA Testing',
            'developer': 'Code Development',
            'codebase': 'Codebase Manager'
        };
        modeDisplay.textContent = modeNames[mode] || mode;
    }
}

async function switchMode(newMode) {
    try {
        const response = await fetch('/switch_mode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ mode: newMode })
        });

        const result = await response.json();

        if (result.success) {
            currentMode = newMode;
            updateModeIndicator(newMode);
            showToast(result.message, 'success');
        } else {
            showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('❌ Mode switch error:', error);
        showToast('Failed to switch mode', 'error');
    }
}


// ================================================================================================
// NAVIGATION FUNCTIONS
// ================================================================================================

function resetDeveloperElements() {
    // Clear developer-specific data
    const developerFileInput = document.getElementById('developerFileInput');
    if (developerFileInput) developerFileInput.value = '';

    const developerFileInfo = document.getElementById('developerFileInfo');
    if (developerFileInfo) developerFileInfo.textContent = '';

    // Hide user stories container
    const userStoriesContainer = document.getElementById('userStoriesContainer');
    if (userStoriesContainer) userStoriesContainer.style.display = 'none';

    // Reset developer buttons
    const generateAppBtn = document.getElementById('generateAppBtn');
    const reviewAppBtn = document.getElementById('reviewAppBtn');
    const deployAppBtn = document.getElementById('deployAppBtn');

    if (generateAppBtn) generateAppBtn.disabled = true;
    if (reviewAppBtn) reviewAppBtn.disabled = true;
    if (deployAppBtn) deployAppBtn.disabled = true;
}

function resetQAElements() {
    // Clear any generated scripts info
    if (window.generatedScripts) {
        window.generatedScripts = [];
    }

    // Reset buttons
    const generateBtn = document.getElementById('generateBtn');
    const reviewBtn = document.getElementById('reviewBtn');
    const executeBtn = document.getElementById('executeBtn');

    if (generateBtn) generateBtn.disabled = true;
    if (reviewBtn) reviewBtn.disabled = true;
    if (executeBtn) executeBtn.disabled = true;

    // Clear text areas
    const textArea = document.getElementById('textArea');
    if (textArea) textArea.value = '';

    // Remove any dynamically created test areas
    const multiTestContainer = document.getElementById('multiTestContainer');
    if (multiTestContainer) {
        multiTestContainer.remove();
    }

    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';

    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) fileInfo.textContent = '';
}

function showDeveloperMode() {
    console.log('👨‍💻 Showing Developer Mode');

    hideAllModeContent();
    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const devNavItem = document.querySelectorAll('.nav-item')[1]; // Developer nav item
    if (devNavItem) devNavItem.classList.add('active');

    // Update content visibility
    const developerContent = document.getElementById('developerContent');
    if (developerContent) {
        developerContent.classList.remove('hide');
        developerContent.classList.add('show');
        developerContent.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = '';

    // Switch mode on backend
    switchMode('developer');

    // Reset any QA-specific elements
    resetQAElements();

    // SHOW current mode indicator on Developer page
    updateModeIndicatorVisibility(true);

    console.log('✅ Developer mode displayed');
}

function showQAMode() {
    console.log('🧪 Showing QA Mode');

    hideAllModeContent();
    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const qaNavItem = document.querySelectorAll('.nav-item')[2]; // QA nav item
    if (qaNavItem) qaNavItem.classList.add('active');

    // Update content visibility
    const qaContent = document.getElementById('qaContent');
    if (qaContent) {
        qaContent.classList.remove('hide');
        qaContent.classList.add('show');
        qaContent.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = '';

    // Switch mode on backend
    switchMode('qa');

    // Reset any developer-specific elements
    resetDeveloperElements();

    // SHOW current mode indicator on QA page
    updateModeIndicatorVisibility(true);

    console.log('✅ QA mode displayed');
}

function showCodebaseManager() {
    console.log('📚 Showing Codebase Manager');

    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const codebaseNavItem = document.querySelectorAll('.nav-item')[3]; // Codebase nav item
    if (codebaseNavItem) codebaseNavItem.classList.add('active');

    // Update content visibility
    hideAllModeContent();
    const codebaseContent = document.getElementById('codebaseManagerContent');
    if (codebaseContent) {
        codebaseContent.classList.remove('hide');
        codebaseContent.classList.add('show');
        codebaseContent.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = '';

    // Switch mode on backend
    switchMode('codebase');

    // SHOW current mode indicator on Developer page
    updateModeIndicatorVisibility(true);

    console.log('✅ Codebase manager displayed');
}

function hideAllModeContent() {
    console.log('🔄 Hiding all mode content...');

    // Hide welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.classList.remove('show');
        welcomeMessage.classList.add('hide');
        welcomeMessage.style.display = 'none';
    }

    // Hide QA content
    const qaContent = document.getElementById('qaContent');
    if (qaContent) {
        qaContent.classList.remove('show');
        qaContent.classList.add('hide');
        qaContent.style.display = 'none';
    }

    // Hide Developer content
    const developerContent = document.getElementById('developerContent');
    if (developerContent) {
        developerContent.classList.remove('show');
        developerContent.classList.add('hide');
        developerContent.style.display = 'none';
    }

    // Hide Codebase Manager content
    const codebaseManagerContent = document.getElementById('codebaseManagerContent');
    if (codebaseManagerContent) {
        codebaseManagerContent.classList.remove('show');
        codebaseManagerContent.classList.add('hide');
        codebaseManagerContent.style.display = 'none';
    }

    // ADD THIS SECTION: Hide Analytics content
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.classList.remove('show');
        analyticsContent.classList.add('hide');
        analyticsContent.style.display = 'none';
    }

    // Hide any multi-test areas that might have been created
    const multiTestContainer = document.getElementById('multiTestContainer');
    if (multiTestContainer) {
        multiTestContainer.style.display = 'none';
    }

    // Hide single text area container
    const singleTextAreaContainer = document.getElementById('singleTextAreaContainer');
    if (singleTextAreaContainer) {
        singleTextAreaContainer.style.display = 'none';
    }

    // Hide any progress containers
    //const progressContainer = document.getElementById('progressContainer');
    //if (progressContainer) {
    //    progressContainer.style.display = 'none';
    //}

    const developerProgressContainer = document.getElementById('developerProgressContainer');
    if (developerProgressContainer) {
        developerProgressContainer.style.display = 'none';
    }

    console.log('✅ All mode content hidden');
}

/*
function showHome() {
    console.log('🏠 Showing Home page');

    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const homeNavItem = document.querySelectorAll('.nav-item')[0];
    if (homeNavItem) homeNavItem.classList.add('active');

    // Update content visibility
    const dashboardTitle = document.getElementById('dashboardTitle');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const autoTestContent = document.getElementById('autoTestContent');

    if (dashboardTitle) dashboardTitle.textContent = '';

    if (welcomeMessage) {
        welcomeMessage.classList.remove('hide');
        welcomeMessage.classList.add('show');
        welcomeMessage.style.display = 'block';
    }

    if (autoTestContent) {
        autoTestContent.classList.remove('show');
        autoTestContent.classList.add('hide');
        autoTestContent.style.display = 'none';
    }

    console.log('✅ Home page displayed');
}
*/

function updateModeIndicatorVisibility(showIndicator) {
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) {
        modeIndicator.style.display = showIndicator ? 'flex' : 'none';
    }
}

// Override existing showHome function to work with new structure
function showHome() {
    console.log('🏠 Showing Home page');

    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const homeNavItem = document.querySelectorAll('.nav-item')[0];
    if (homeNavItem) homeNavItem.classList.add('active');

    // Hide all mode content
    hideAllModeContent();

    // Show welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    if (welcomeMessage) {
        welcomeMessage.classList.remove('hide');
        welcomeMessage.classList.add('show');
        welcomeMessage.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = '';

    // HIDE current mode indicator on Home page
    updateModeIndicatorVisibility(false);

    console.log('✅ Home page displayed');
}

function showAutoTest() {
    console.log('🧪 Showing AutoTest page');

    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const autoTestNavItem = document.querySelectorAll('.nav-item')[1];
    if (autoTestNavItem) autoTestNavItem.classList.add('active');

    // Update content visibility
    const dashboardTitle = document.getElementById('dashboardTitle');
    const welcomeMessage = document.getElementById('welcomeMessage');
    //const autoTestContent = document.getElementById('autoTestContent');
    const autoTestContent = document.getElementById('qaContent');

    if (dashboardTitle) dashboardTitle.textContent = 'Auto Test';

    if (welcomeMessage) {
        welcomeMessage.classList.remove('show');
        welcomeMessage.classList.add('hide');
        welcomeMessage.style.display = 'none';
    }

    if (autoTestContent) {
        autoTestContent.classList.remove('hide');
        autoTestContent.classList.add('show');
        autoTestContent.style.display = 'block';
    }

    console.log('✅ AutoTest page displayed');
}

// ===============================================
// ANALYTICS FUNCTIONS
// ===============================================

// Load analytics data from localStorage
function loadAnalyticsData() {
    const savedData = localStorage.getItem('analyticsData');
    if (savedData) {
        analyticsData = JSON.parse(savedData);
    }
}

// Save analytics data to localStorage
function saveAnalyticsData() {
    localStorage.setItem('analyticsData', JSON.stringify(analyticsData));
}

// Update analytics counters
function updateAnalyticsCounter(type, count = 1) {
    console.log(`📊 Updating analytics counter: ${type}`);

    if (analyticsData.hasOwnProperty(type)) {
        //analyticsData[type]++;
        // Use the provided count or default to 1
        analyticsData[type] += count;

        // Add to timeline
        analyticsData.timeline.push({
            type: type,
            timestamp: new Date().toISOString(),
            count: analyticsData[type],
            increment: count // Track how much was added this time
        });

        // Keep only last 50 timeline entries
        if (analyticsData.timeline.length > 50) {
            analyticsData.timeline = analyticsData.timeline.slice(-50);
        }

        saveAnalyticsData();
        updateAnalyticsDisplay();
        updateCharts();

        console.log(`✅ ${type} updated by ${count} to total: ${analyticsData[type]}`);
    } else {
        console.warn(`⚠️ Unknown analytics type: ${type}`);
    }
}

// Update all display elements
function updateAnalyticsDisplay() {
    // Update stat cards
    document.getElementById('qaTestsGenerated').textContent = analyticsData.qaTestsGenerated;
    document.getElementById('qaTestsReviewed').textContent = analyticsData.qaTestsReviewed;
    document.getElementById('devCodeGenerated').textContent = analyticsData.devCodeGenerated;
    document.getElementById('devUnittestsGenerated').textContent = analyticsData.devUnittestsGenerated;
    document.getElementById('devCodeReviewed').textContent = analyticsData.devCodeReviewed;
    document.getElementById('devUnittestsReviewed').textContent = analyticsData.devUnittestsReviewed;

    //document.getElementById('DevScriptsPassed').textContent = analyticsData.devscriptspassed;
    //document.getElementById('DevScriptsFailed').textContent = analyticsData.devscriptsfailed;
    //document.getElementById('QAScriptsPassed').textContent = analyticsData.qascriptspassed;
    //document.getElementById('QAScriptsFailed').textContent = analyticsData.qascriptsfailed;
    //const devpass = document.getElementById('DevScriptsPassed').textContent = analyticsData.devscriptspassed;
	//console.log(devpass)
	console.log('Printing Analytics Data')	
	console.log(analyticsData)
	

    // Update summary statistics
    const totalGenerated = analyticsData.qaTestsGenerated + analyticsData.devCodeGenerated + analyticsData.devUnittestsGenerated;
    const totalReviewed = analyticsData.qaTestsReviewed + analyticsData.devCodeReviewed + analyticsData.devUnittestsReviewed;
    const reviewPercentage = totalGenerated > 0 ? Math.round((totalReviewed / totalGenerated) * 100) : 0;

    document.getElementById('totalGenerated').textContent = totalGenerated;
    document.getElementById('totalReviewed').textContent = totalReviewed;
    document.getElementById('reviewPercentage').textContent = reviewPercentage + '%';

    // Determine most active workflow
    const qaTotal = analyticsData.qaTestsGenerated + analyticsData.qaTestsReviewed;
    const devTotal = analyticsData.devCodeGenerated + analyticsData.devUnittestsGenerated +
                    analyticsData.devCodeReviewed + analyticsData.devUnittestsReviewed;

    const mostActive = qaTotal > devTotal ? 'QA Testing' : devTotal > qaTotal ? 'Development' : 'Equal';
    document.getElementById('mostActiveWorkflow').textContent = mostActive;
}

// Show analytics content
function showAnalytics() {
    hideAllModeContent();
    console.log('📊 Showing Analytics Dashboard');

    // Hide all other content
    document.querySelectorAll('.welcome-message, .developer-content, .qa-content, .codebase-content').forEach(content => {
        content.classList.remove('show');
        content.classList.add('hide');
        content.style.display = 'none';
    });

    // Update navigation state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const analyticsNavItem = document.querySelectorAll('.nav-item')[4]; // Analytics nav item
    if (analyticsNavItem) analyticsNavItem.classList.add('active');

    // Show analytics content
    const analyticsContent = document.getElementById('analyticsContent');
    if (analyticsContent) {
        analyticsContent.classList.remove('hide');
        analyticsContent.classList.add('show');
        analyticsContent.style.display = 'block';
    }

    // Update dashboard title
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = '';

    // Hide mode indicator on analytics page
    const modeIndicator = document.getElementById('modeIndicator');
    if (modeIndicator) modeIndicator.style.display = 'none';

    // Refresh data and charts
    loadAnalyticsData();
    updateAnalyticsDisplay();
    updateCharts();

    console.log('✅ Analytics dashboard displayed');
}

// Reset all analytics data
function resetAnalytics() {
    if (confirm('Are you sure you want to reset all analytics data? This action cannot be undone.')) {
        analyticsData = {
            qaTestsGenerated: 0,
            qaTestsReviewed: 0,
            devCodeGenerated: 0,
            devUnittestsGenerated: 0,
            devCodeReviewed: 0,
            devUnittestsReviewed: 0,
            devscriptspassed: 0,
            devscriptsfailed: 0,
            qascriptspassed: 0,
            qascriptsfailed: 0,
            timeline: []
        };

        document.getElementById('DevScriptsPassed').textContent = '0';

        saveAnalyticsData();
        updateAnalyticsDisplay();
        updateCharts();
	console.log(analyticsData.qascriptsfailed);
        console.log('🔄 Analytics data reset successfully');
        alert('Analytics data has been reset successfully!');
    }
}

// Initialize all charts
function initializeCharts() {
    initializeBarChart();
    initializePieChart();
    initializeLineChart();
}

// Initialize bar chart
function initializeBarChart() {
    const ctx = document.getElementById('barChart').getContext('2d');
    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['QA Tests', 'Dev Code', 'Unit Tests'],
            datasets: [{
                label: 'Generated',
                data: [analyticsData.qaTestsGenerated, analyticsData.devCodeGenerated, analyticsData.devUnittestsGenerated],
                backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6'],
                borderColor: ['#059669', '#2563eb', '#7c3aed'],
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Initialize pie chart
function initializePieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['QA Reviews', 'Code Reviews', 'Unit Test Reviews'],
            datasets: [{
                data: [analyticsData.qaTestsReviewed, analyticsData.devCodeReviewed, analyticsData.devUnittestsReviewed],
                backgroundColor: ['#f59e0b', '#ef4444', '#06b6d4'],
                borderColor: ['#d97706', '#dc2626', '#0891b2'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Initialize line chart
function initializeLineChart() {
    const ctx = document.getElementById('lineChart').getContext('2d');

    // Process timeline data for line chart
    const timelineData = processTimelineData();

    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timelineData.labels,
            datasets: [
                {
                    label: 'Code Generated',
                    data: timelineData.generated,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Code Reviewed',
                    data: timelineData.reviewed,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top'
                }
            }
        }
    });
}

// Process timeline data for charts
function processTimelineData() {
    const last24Hours = [];
    const now = new Date();

    // Create labels for last 24 hours (every 2 hours)
    for (let i = 23; i >= 0; i -= 2) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000);
        last24Hours.push(time.getHours().toString().padStart(2, '0') + ':00');
    }

    // Initialize data arrays
    const generatedData = new Array(last24Hours.length).fill(0);
    const reviewedData = new Array(last24Hours.length).fill(0);

    // Process timeline events
    analyticsData.timeline.forEach(event => {
        const eventTime = new Date(event.timestamp);
        const hoursDiff = Math.floor((now - eventTime) / (1000 * 60 * 60));
        const index = Math.floor((23 - hoursDiff) / 2);

        if (index >= 0 && index < last24Hours.length) {
            if (event.type.includes('Generated')) {
                generatedData[index]++;
            } else if (event.type.includes('Reviewed')) {
                reviewedData[index]++;
            }
        }
    });

    return {
        labels: last24Hours,
        generated: generatedData,
        reviewed: reviewedData
    };
}

// Update all charts
function updateCharts() {
    // Update bar chart
    if (barChart) {
        barChart.data.datasets[0].data = [
            analyticsData.qaTestsGenerated,
            analyticsData.devCodeGenerated,
            analyticsData.devUnittestsGenerated
        ];
        barChart.update();
    }

    // Update pie chart
    if (pieChart) {
        pieChart.data.datasets[0].data = [
            analyticsData.qaTestsReviewed,
            analyticsData.devCodeReviewed,
            analyticsData.devUnittestsReviewed
        ];
        pieChart.update();
    }

    // Update line chart
    if (lineChart) {
        const timelineData = processTimelineData();
        lineChart.data.labels = timelineData.labels;
        lineChart.data.datasets[0].data = timelineData.generated;
        lineChart.data.datasets[1].data = timelineData.reviewed;
        lineChart.update();
    }
}


// ================================================================================================
// DEVELOPER MODE FUNCTIONS
// ================================================================================================

async function ingestDeveloperRequirementsOriginal() {
    console.log('📥 Starting developer requirements ingestion...');

    // Check if we're in multi-ticket mode
    if (multiTicketMode && ticketResults && ticketResults.length > 0) {
        // Multi-ticket mode - create UI and skip normal ingestion
        console.log('🎫 Multi-ticket mode detected, creating multi-ticket UI');

        const ingestBtn = document.getElementById('ingestDevBtn');
        if (ingestBtn) {
            ingestBtn.disabled = true;
            ingestBtn.textContent = 'Processing Multi-Ticket Requirements...';
        }

        try {
            showProgress('Processing Multi-Ticket Requirements', [
                'Generating combined AI prompt',
                'Processing ticket requirements',
                'Saving prompt data'
            ]);

            updateProgress(25, 'Generating combined AI prompt', 0);

            // Generate combined prompt from all tickets
            const requirementTextElement = document.getElementById('requirementText');
            const additionalNotes = requirementTextElement ? requirementTextElement.value.trim() : '';

            const promptResponse = await fetch('/generate_jira_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    additional_notes: additionalNotes  // ADD THIS
                })
            });

            const promptResult = await promptResponse.json();

            if (!promptResult.success) {
                throw new Error(promptResult.message);
            }

            updateProgress(75, 'Displaying combined prompt', 1);

            // ✅ DISPLAY the combined prompt in the requirement text area
            displayJiraPromptInWorkflow(promptResult);

            updateProgress(100, 'Multi-ticket requirements processed', 2);

            // ✅ ENABLE the generate button
            const generateBtn = document.getElementById('generateAppBtn');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.style.opacity = '1';
                generateBtn.style.cursor = 'pointer';
            }

            showToast(`Multi-ticket prompt generated for ${ticketResults.length} tickets. Ready for code generation!`, 'success');

        } catch (error) {
            console.error('❌ Multi-ticket processing error:', error);
            showToast('Multi-ticket processing failed: ' + error.message, 'error');
        } finally {
            if (ingestBtn) {
                ingestBtn.disabled = false;
                ingestBtn.textContent = 'Ingest Requirements';
            }
            hideProgress();
        }
        return;
    }

    // Check if single JIRA ticket mode
    const jiraSection = document.getElementById('jiraIntegrationSection');
    if (jiraSection && jiraSection.style.display !== 'none') {
        // JIRA integration is active, check if tickets are processed
        if (selectedJiraTickets.size === 0) {
            showToast('Please select JIRA tickets first', 'warning');
            return;
        }

        // Check if prompt is already generated from JIRA tickets
        const requirementText = document.getElementById('requirementText');
        if (requirementText && requirementText.value.includes('JIRA Ticket Implementation Request')) {
            showToast('JIRA tickets already processed. Ready for code generation.', 'success');
            return;
        }

        // Single ticket JIRA mode - use existing logic
        showToast('JIRA tickets already processed. Ready for code generation.', 'success');
        return;
    }

    // Original file-based ingestion logic for non-JIRA workflows
    const devFileInput = document.getElementById('developerFileInput');
    const requirementTextElement = document.getElementById('requirementText');

    const technicalNotes = requirementTextElement ? requirementTextElement.value.trim() : '';

    // Check if at least one input is provided
    if ((!devFileInput || devFileInput.files.length === 0) && !technicalNotes) {
        showToast('Please upload files or enter technical notes!', 'warning');
        return;
    }

    const ingestBtn = document.getElementById('ingestDevBtn');
    if (!ingestBtn) return;

    ingestBtn.disabled = true;
    ingestBtn.textContent = 'Processing Requirements...';

    try {
        let uploadedContent = [];

        showProgress('Processing Requirements', [
            'Uploading files',
            'Extracting content',
            'Parsing requirements',
            'Building AI prompt',
            'Saving prompt data'
        ]);

        // Step 1: Upload and process files if any
        if (devFileInput && devFileInput.files.length > 0) {
            updateProgress(20, 'Uploading files', 0);

            const formData = new FormData();
            Array.from(devFileInput.files).forEach(file => {
                formData.append('files', file);
            });

            const uploadResponse = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const uploadResult = await uploadResponse.json();

            if (!uploadResult.success) {
                throw new Error(uploadResult.message);
            }

            updateProgress(40, 'Extracting content', 1);

            // Get file contents
            for (const file of uploadResult.files) {
                const contentResponse = await fetch('/get_file_content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ filepath: file.path })
                });

                const contentResult = await contentResponse.json();
                if (contentResult.success) {
                    uploadedContent.push({
                        filename: file.name,
                        content: contentResult.content,
                        type: detectContentType(file.name, contentResult.content)
                    });
                }
            }
        }

        updateProgress(60, 'Parsing requirements', 2);

        // Step 2: Build the comprehensive prompt
        const aiPrompt = buildAIPrompt({
            workflowType: window.selectedWorkflowType || 'User Prompt',
            uploadedContent: uploadedContent,
            requirementText: '', // Not using separate requirement text anymore
            technicalNotes: technicalNotes,
            generationOptions: getGenerationOptions()
        });

        updateProgress(80, 'Building AI prompt', 3);

        // Step 3: Send to backend for processing and saving
        const response = await fetch('/process_developer_prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: aiPrompt,
                workflowType: window.selectedWorkflowType || 'jira',
                rawInputs: {
                    files: uploadedContent,
                    requirements: '', // Not using separate requirements anymore
                    technicalNotes: technicalNotes
                }
            })
        });

        const result = await response.json();

        updateProgress(95, 'Saving prompt data', 4);

        if (result.success) {
            updateProgress(100, 'Requirements processed successfully', 4);

            // Show the tab editor and display prompt
            showTabEditor();
            displayCreatedPromptInTab(aiPrompt, result);

            // Enable generate code button
            const generateBtn = document.getElementById('generateAppBtn');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.style.opacity = '1';
                generateBtn.style.cursor = 'pointer';
            }

            showToast('Requirements processed successfully! Prompt created and saved.', 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Ingestion error:', error);
        showToast('Requirements processing failed: ' + error.message, 'error');
    } finally {
        ingestBtn.disabled = false;
        ingestBtn.textContent = 'Ingest Requirements';
        hideProgress();
    }
}


// Modify the existing ingestDeveloperRequirements function to handle both methods
async function ingestDeveloperRequirements() {
    const jiraSection = document.getElementById('jiraIntegrationSection');

    if (jiraSection && jiraSection.style.display !== 'none') {
        // JIRA integration is active, check if tickets are processed
        if (selectedJiraTickets.size === 0) {
            showToast('Please select JIRA tickets first', 'warning');
            return;
        }

        // Check if prompt is already generated from JIRA tickets
        const requirementText = document.getElementById('requirementText');
        if (requirementText && requirementText.value.includes('JIRA Ticket Implementation Request')) {
            showToast('JIRA tickets already processed. Ready for code generation.', 'success');
            return;
        }

        // Generate prompt from selected JIRA tickets
        try {
            const response = await fetch('/generate_jira_prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const result = await response.json();

            if (result.success) {
                displayJiraPromptInWorkflow(result);
                showToast('JIRA tickets processed successfully. Ready for code generation.', 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            showToast('Error processing JIRA tickets: ' + error.message, 'error');
        }
        return;
    } else {
        // Use existing file upload logic
        return await ingestDeveloperRequirementsOriginal();
    }
}

function showGeneratedCodeContainer() {
    console.log('📋 Showing prompt display area');

    let container = document.getElementById('generatedCodeContainer');
    if (!container) {
        // Create container if it doesn't exist
        container = document.createElement('div');
        container.id = 'generatedCodeContainer';
        container.className = 'generated-code-container';

        // Insert after developer buttons
        const buttonsContainer = document.querySelector('.developer-buttons');
        if (buttonsContainer && buttonsContainer.parentNode) {
            buttonsContainer.parentNode.insertBefore(container, buttonsContainer.nextSibling);
        }
    }

    // Clear existing content
    container.innerHTML = '';
    container.style.display = 'block';

    // Create the text area for displaying prompt
    const promptDisplayArea = document.createElement('div');
    promptDisplayArea.className = 'prompt-display-area';
    promptDisplayArea.innerHTML = `
        <div style="margin-top: 30px; background: #f8fafc; border-radius: 15px; border: 2px solid #3b82f6; padding: 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <h3 style="color: #1e40af; margin: 0; font-size: 1.2rem;">🤖 Generated AI Prompt</h3>
                <div style="display: flex; gap: 10px;">
                    <button class="action-btn save-btn" onclick="savePromptData()" title="Save prompt">💾</button>
                    <button class="action-btn download-btn" onclick="downloadPromptData()" title="Download prompt">📥</button>
                </div>
            </div>
            <textarea 
                id="developerPromptDisplay" 
                readonly
                style="
                    width: 100%; 
                    min-height: 400px; 
                    padding: 15px; 
                    border: 2px solid #e5e7eb;
                    border-radius: 10px; 
                    font-family: 'Courier New', monospace;
                    font-size: 0.9rem; 
                    resize: vertical;
                    background: white;
                    color: #374151;
                "
                placeholder="Generated prompt will appear here..."
            ></textarea>
            <div style="margin-top: 10px; color: #6b7280; font-size: 0.85rem; text-align: right;">
                <span id="promptCharCount">0 characters</span>
            </div>
        </div>
    `;

    container.appendChild(promptDisplayArea);
}


// NEW: Function to display the created prompt
function displayCreatedPrompt(aiPrompt, result) {
    console.log('📝 Displaying created prompt');

    const promptTextarea = document.getElementById('developerPromptDisplay');
    const charCountElement = document.getElementById('promptCharCount');

    if (promptTextarea) {
        // Create display message with prompt
        const displayMessage = `=== DEVELOPER REQUIREMENTS PROCESSED ===
Generated on: ${new Date().toLocaleString()}
Workflow Type: ${window.selectedWorkflowType || 'User Prompt'}

=== EXTRACTED REQUIREMENTS SUMMARY ===
${result.extractedRequirements || 'Successfully processed requirements and built AI prompt'}

=== GENERATED AI PROMPT FOR LLAMA MODEL ===
${aiPrompt}

=== STATUS ===
✅ Prompt data saved to backend
✅ Ready for code generation
✅ Click "Generate Application Code" to proceed

=== NEXT STEPS ===
1. Review the generated prompt above
2. Click "Generate Application Code" button
3. AI will use this prompt to generate your code
`;

        promptTextarea.value = displayMessage;

        // Update character count
        if (charCountElement) {
            charCountElement.textContent = `${displayMessage.length} characters`;
        }

        // Auto-resize textarea
        promptTextarea.style.height = 'auto';
        promptTextarea.style.height = Math.max(400, promptTextarea.scrollHeight) + 'px';
    }
}


// NEW: Function to save prompt data
function savePromptData() {
    console.log('💾 Saving prompt data');

    const promptTextarea = document.getElementById('developerPromptDisplay');
    if (!promptTextarea) return;

    const promptData = promptTextarea.value;
    if (!promptData) {
        showToast('No prompt data to save!', 'warning');
        return;
    }

    // Save to localStorage
    localStorage.setItem('developer_prompt_data', promptData);
    localStorage.setItem('developer_prompt_timestamp', new Date().toISOString());

    showToast('Prompt data saved successfully!', 'success');
}

// NEW: Function to download prompt data
function downloadPromptData() {
    console.log('📥 Downloading prompt data');

    const promptTextarea = document.getElementById('developerPromptDisplay');
    if (!promptTextarea) return;

    const promptData = promptTextarea.value;
    if (!promptData) {
        showToast('No prompt data to download!', 'warning');
        return;
    }

    const element = document.createElement('a');
    const file = new Blob([promptData], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `developer_prompt_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast('Prompt data downloaded successfully!', 'success');
}

function buildAIPrompt(data) {
    const { workflowType, uploadedContent, requirementText, technicalNotes, generationOptions } = data;

    let prompt = `You are an expert software developer tasked with generating production-ready code.\n\n`;

    // Add workflow context
    switch(workflowType) {
        case 'User Prompt':
            prompt += `TASK TYPE: User Prompt Implementation\n`;
            prompt += `Generate code that fully implements the user prompt with all acceptance criteria.\n\n`;
            break;
        case 'jira':
            prompt += `TASK TYPE: JIRA User Story Implementation\n`;
            prompt += `Generate code that fully implements the user story with all acceptance criteria.\n\n`;
            break;
        case 'feature':
            prompt += `TASK TYPE: New Feature Implementation\n`;
            prompt += `Create a complete feature implementation based on the requirements.\n\n`;
            break;
        case 'enhancement':
            prompt += `TASK TYPE: Code Enhancement\n`;
            prompt += `Enhance existing code with improvements and optimizations.\n\n`;
            break;
        case 'bug':
            prompt += `TASK TYPE: Bug Fix\n`;
            prompt += `Fix the reported bug and ensure the solution is robust.\n\n`;
            break;
    }

    // Add uploaded file contents
    if (uploadedContent.length > 0) {
        prompt += `=== UPLOADED REQUIREMENTS ===\n`;
        uploadedContent.forEach((file, index) => {
            prompt += `\n--- File ${index + 1}: ${file.filename} ---\n`;
            prompt += `Type: ${file.type}\n`;
            prompt += `Content:\n${file.content}\n`;
            prompt += `--- End of ${file.filename} ---\n`;
        });
        prompt += `\n`;
    }

    // Add manual requirements
    if (requirementText) {
        prompt += `=== USER REQUIREMENTS ===\n`;
        prompt += `${requirementText}\n\n`;
    }

    // Add technical notes
    if (technicalNotes) {
        prompt += `=== TECHNICAL NOTES ===\n`;
        prompt += `${technicalNotes}\n\n`;
    }

    // Add generation options
    prompt += `=== GENERATION REQUIREMENTS ===\n`;
    if (generationOptions.includeTests) {
        prompt += `- Include comprehensive unit tests with good coverage\n`;
    }
    if (generationOptions.generateDocs) {
        prompt += `- Generate detailed documentation with docstrings and comments\n`;
    }
    if (generationOptions.useLibraries) {
        prompt += `- Utilize existing libraries and frameworks when appropriate\n`;
    }
    if (generationOptions.followPatterns) {
        prompt += `- Follow established project patterns and coding standards\n`;
    }
    if (generationOptions.includeErrors) {
        prompt += `- Include robust error handling and validation\n`;
    }
    if (generationOptions.performanceOpt) {
        prompt += `- Optimize for performance and efficiency\n`;
    }

    if (workflowType === 'jira') {
        prompt += `7. Ensure ALL acceptance criteria are met\n`;
        prompt += `8. Implement exactly what the user story requests\n`;
    }

    prompt += `\nGenerate the complete implementation now:\n`;

    return prompt;
}

function detectContentType(filename, content) {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase();

    if (lowerFilename.includes('jira') || content.includes('acceptance criteria')) {
        return 'JIRA Story';
    } else if (lowerContent.includes('feature request') || lowerContent.includes('feature:')) {
        return 'Feature Request';
    } else if (lowerContent.includes('bug') || lowerContent.includes('error') || lowerContent.includes('issue')) {
        return 'Bug Report';
    } else if (lowerContent.includes('enhancement') || lowerContent.includes('improve')) {
        return 'Enhancement Request';
    }
    return 'Requirement Document';
}

/*
function getGenerationOptions() {
    return {
        includeTests: document.getElementById('includeTests')?.checked || false,
        generateDocs: document.getElementById('generateDocs')?.checked || false,
        useLibraries: document.getElementById('useLibraries')?.checked || false,
        followPatterns: document.getElementById('followPatterns')?.checked || false,
        includeErrors: document.getElementById('includeErrors')?.checked || false,
        performanceOpt: document.getElementById('performanceOpt')?.checked || false
    };
}
*/
// 5. UPDATE getGenerationOptions to ensure it's working correctly:
function getGenerationOptions() {
    const options = {
        includeTests: document.getElementById('includeTests')?.checked || false,
        generateDocs: document.getElementById('generateDocs')?.checked || false,
        useLibraries: document.getElementById('useLibraries')?.checked || false,
        followPatterns: document.getElementById('followPatterns')?.checked || false,
        includeErrors: document.getElementById('includeErrors')?.checked || false,
        performanceOpt: document.getElementById('performanceOpt')?.checked || false
    };

    console.log('⚙️ Generation options:', options);
    return options;
}
function displayProcessedRequirements(result) {
    // Create or update a section to show processed requirements
    let container = document.getElementById('processedRequirementsContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'processedRequirementsContainer';
        container.style.cssText = `
            margin-top: 30px;
            padding: 20px;
            background: #f0f9ff;
            border-radius: 12px;
            border: 1px solid #3b82f6;
        `;

        // Insert after the generation options
        const genOptions = document.querySelector('.generation-options') ||
                          document.querySelector('[style*="Generation Options"]');
        if (genOptions && genOptions.parentNode) {
            genOptions.parentNode.insertBefore(container, genOptions.nextSibling);
        }
    }

    container.innerHTML = `
        <h3 style="color: #1e40af; margin-bottom: 15px;">✅ Requirements Processed</h3>
        <div style="background: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
            <h4 style="color: #374151; margin-bottom: 10px;">Extracted Requirements:</h4>
            <pre style="white-space: pre-wrap; color: #4b5563; font-size: 0.9rem;">${result.extractedRequirements || 'Processing complete'}</pre>
        </div>
        ${result.prompt ? `
            <details style="margin-top: 15px;">
                <summary style="cursor: pointer; color: #6b7280; font-size: 0.9rem;">View AI Prompt (Debug)</summary>
                <pre style="white-space: pre-wrap; background: #f3f4f6; padding: 15px; 
                           border-radius: 8px; margin-top: 10px; font-size: 0.8rem; 
                           max-height: 300px; overflow-y: auto;">${result.prompt}</pre>
            </details>
        ` : ''}
    `;
}

// 6. ADD function to test if unit test generation is working:
function testUnitTestGeneration() {
    console.log('🧪 Testing unit test generation...');

    // Check if the generation options are available
    const includeTestsCheckbox = document.getElementById('includeTests');
    if (!includeTestsCheckbox) {
        console.log('❌ Include Tests checkbox not found');
        return false;
    }

    console.log(`✅ Include Tests checkbox found, checked: ${includeTestsCheckbox.checked}`);

    // Check if the buildAIPrompt function includes test requirements
    const testOptions = getGenerationOptions();
    if (testOptions.includeTests) {
        console.log('✅ Include Tests is enabled in generation options');
    } else {
        console.log('❌ Include Tests is disabled in generation options');
    }

    return true;
}

function displayUserStories(stories) {
    const container = document.getElementById('userStoriesContainer');
    const grid = document.getElementById('storiesGrid');

    if (!container || !grid) return;

    container.style.display = 'block';
    grid.innerHTML = '';

    stories.forEach((story, index) => {
        const storyCard = document.createElement('div');
        storyCard.className = 'story-card';
        storyCard.innerHTML = `
            <div class="story-header">
                <div class="story-checkbox">
                    <input type="checkbox" id="story${index}" checked 
                           onchange="toggleStorySelection('${story.id}', this.checked)">
                    <label for="story${index}">Select for generation</label>
                </div>
                <div class="story-id">${story.id}</div>
            </div>
            <div class="story-content">
                <h4 class="story-title">${story.title}</h4>
                <p class="story-description">${story.description}</p>
                <div class="story-criteria">
                    <strong>Acceptance Criteria:</strong>
                    <p>${story.acceptance_criteria}</p>
                </div>
                <div class="story-meta">
                    <span class="story-priority">Priority: ${story.priority || 'Medium'}</span>
                    <span class="story-epic">Epic: ${story.epic || 'N/A'}</span>
                </div>
            </div>
        `;

        grid.appendChild(storyCard);

        // Add to selected stories by default
        selectedUserStories.add(story.id);
    });

    updateStorySelectionStatus();
}

function toggleStorySelection(storyId, isSelected) {
    if (isSelected) {
        selectedUserStories.add(storyId);
    } else {
        selectedUserStories.delete(storyId);
    }

    updateStorySelectionStatus();
    console.log(`📝 Story ${storyId} ${isSelected ? 'selected' : 'deselected'}`);
}

function updateStorySelectionStatus() {
    const generateBtn = document.getElementById('generateAppBtn');
    if (generateBtn) {
        if (selectedUserStories.size === 0) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generate Application Code (Select Stories)';
        } else {
            generateBtn.disabled = false;
            generateBtn.textContent = `Generate Code (${selectedUserStories.size} Selected)`;
        }
    }
}

function updateCodeAreaCharCount(index) {
    const textarea = document.getElementById(`appCode${index}`);
    const charCount = document.getElementById(`appCodeCharCount${index}`);

    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
    }
}

function autoResizeCodeTextarea(index) {
    const textarea = document.getElementById(`appCode${index}`);
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(300, textarea.scrollHeight) + 'px';
    }
}

/*
async function generateApplicationCode() {
    console.log('🔧 Starting application code generation...');

    // FIXED: Skip user story selection check for simplified workflow
    // Instead, check if we have processed requirements (prompt data)
    //const promptTextarea = document.getElementById('developerPromptDisplay');
    const promptTextarea = document.getElementById('promptTabTextarea');
    if (!promptTextarea || !promptTextarea.value.trim()) {
        showToast('Please ingest requirements first before generating code!', 'warning');
        return;
    }

    const generateBtn = document.getElementById('generateAppBtn');
    if (!generateBtn) return;

    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');

    try {
        showProgress('Generating Application Code', [
            'Loading processed requirements',
            'Preparing LLaMA model context',
            'Generating Python code',
            'Optimizing implementation',
            'Finalizing code structure'
        ]);

        updateProgress(20, 'Loading processed requirements', 0);
        await delay(1000);

        updateProgress(40, 'Preparing LLaMA model context', 1);
        await delay(1000);

        updateProgress(60, 'Generating application code', 2);

        // FIXED: Call backend without selected_story_ids
        const response = await fetch('/generate_app_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // No selected_story_ids needed - backend will use stored prompt
                generate_from_prompt: true
            })
        });

        updateProgress(80, 'Optimizing implementation', 3);
        await delay(1000);

        const result = await response.json();

        updateProgress(100, 'Code generation completed', 4);

        if (result.success) {
            // Display generated code in the tab editor
            const generatedCode = result.generated_code || [];
            generatedApplicationCode = result.generated_code;
            displayGeneratedApplicationCodeInTab(generatedCode);

            // Enable review button
            const reviewBtn = document.getElementById('reviewAppBtn');
            if (reviewBtn) {
                reviewBtn.disabled = false;
            }

            showToast(result.message || 'Code generated successfully!', 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Code generation error:', error);
        showToast('Code generation failed: ' + error.message, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-loading');
        generateBtn.textContent = 'Generate Application Code';
        hideProgress();
    }
}
*/

/*
async function generateApplicationCode() {
    console.log('🔧 Starting application code generation...');

    // EXISTING: Skip user story selection check for simplified workflow
    // Instead, check if we have processed requirements (prompt data)
    const promptTextarea = document.getElementById('promptTabTextarea');
    if (!promptTextarea || !promptTextarea.value.trim()) {
        showToast('Please ingest requirements first before generating code!', 'warning');
        return;
    }

    const generateBtn = document.getElementById('generateAppBtn');
    if (!generateBtn) return;

    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');

    try {
        showProgress('Generating Application Code', [
            'Checking for reusable code',
            'Loading processed requirements',
            'Preparing LLaMA model context',
            'Generating Python code',
            'Optimizing implementation',
            'Finalizing code structure'
        ]);

        // NEW: Check for reusable code FIRST
        updateProgress(10, 'Checking User Prompts/Stories', 0);
        const currentPrompt = promptTextarea.value.trim();

        const reuseResult = await checkForReusableCode(currentPrompt, true);
        // DEBUG: Check what reuseResult actually contains
        console.log('[DEBUG] reuseResult received:', reuseResult);
        console.log('[DEBUG] reuseResult type:', typeof reuseResult);
        console.log('[DEBUG] reuseResult.reusable_found:', reuseResult ? reuseResult.reusable_found : 'reuseResult is null');
        console.log('[DEBUG] reuseResult && reuseResult.reusable_found:', !!(reuseResult && reuseResult.reusable_found));

        if (reuseResult && reuseResult.reusable_found) {
            // Use reused code directly
            console.log('✅ Checking Generation options & Using smart code Generation');
            updateProgress(80, 'Smart reuse found - using existing code', 4);
            await delay(500);

            // Display the reused code
            const generatedCode = reuseResult.generated_code || [];
            generatedApplicationCode = reuseResult.generated_code;

             // DEBUG: Check what was actually assigned
            console.log('[DEBUG] Smart reuse - generatedApplicationCode assigned:');
            console.log('[DEBUG] Type:', typeof generatedApplicationCode);
            console.log('[DEBUG] Length:', generatedApplicationCode ? generatedApplicationCode.length : 'null/undefined');
            console.log('[DEBUG] Content preview:', generatedApplicationCode);

            displayGeneratedApplicationCodeInTab(generatedCode);

            // Enable review button
            const reviewBtn = document.getElementById('reviewAppBtn');
            if (reviewBtn) {
                reviewBtn.disabled = false;
            }

            updateProgress(100, 'Smart reuse completed successfully', 5);
            showToast(`Smart Reuse Complete: Used ${reuseResult.source_script}`, 'success');
            return; // Exit early - no need for AI generation
        }

        // EXISTING: Fallback to normal AI generation if no reuse found
        console.log('🤖 Proceeding with AI based Code generation');
        updateProgress(20, 'Loading processed requirements', 1);
        await delay(1000);

        updateProgress(40, 'Preparing LLaMA model context', 2);
        await delay(1000);

        updateProgress(60, 'Generating application code', 3);

        // EXISTING: Call backend without selected_story_ids
        const response = await fetch('/generate_app_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // No selected_story_ids needed - backend will use stored prompt
                generate_from_prompt: true
            })
        });

        updateProgress(80, 'Optimizing implementation', 4);
        await delay(1000);

        const result = await response.json();

        updateProgress(100, 'Code generation completed', 5);

        if (result.success) {
            // EXISTING: Display generated code in the tab editor
            const generatedCode = result.generated_code || [];
            generatedApplicationCode = result.generated_code;
            displayGeneratedApplicationCodeInTab(generatedCode);

            // EXISTING: Enable review button
            const reviewBtn = document.getElementById('reviewAppBtn');
            if (reviewBtn) {
                reviewBtn.disabled = false;
            }

            showToast(result.message || 'Code generated successfully!', 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Code generation error:', error);
        showToast('Code generation failed: ' + error.message, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-loading');
        generateBtn.textContent = 'Generate Application Code';
        hideProgress();
    }
}
*/

// Create individual ticket areas (only when generation starts)
function createIndividualTicketAreas(workflowItems) {
    const container = document.getElementById('generatedCodeContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="multi-ticket-container">
            <div class="multi-ticket-header">
                <h3>🎫 Multi-Ticket Code Generation</h3>
                <p>Generating code for ${workflowItems.length} JIRA tickets</p>
            </div>
            
            <!-- Enhanced Ticket Selection Controls -->
            <div class="ticket-controls">
                <div class="control-group">
                    <label>Code Type Selection:</label>
                    <button class="control-btn main-code-btn" onclick="selectAllMainCode()">Select All Main Code</button>
                    <button class="control-btn test-code-btn" onclick="selectAllTestCode()">Select All Unit Tests</button>
                </div>
                
                <div class="control-group">
                    <label>Actions:</label>
                    <!-- Remove this line: <button class="control-btn action-btn" onclick="reviewSelectedTicketCode()">Review Selected</button> -->
                    <button class="control-btn action-btn" onclick="runSelectedTicketCode()">Run Selected</button>
                </div>
            </div>

            <div id="multiTicketAreas" class="multi-ticket-areas">
                ${workflowItems.map((item, index) => createTicketArea(item, index)).join('')}
            </div>
        </div>
    `;
    container.style.display = 'block';
}

// Select all main code tabs
function selectAllMainCode() {
    document.querySelectorAll('.ticket-checkbox input').forEach(cb => {
        cb.checked = true;
        // Switch each ticket to main code tab
        const ticketId = cb.value;
        const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);
        if (ticketIndex !== -1) {
            switchTicketTab(`main_${ticketIndex}`, ticketIndex);
        }
    });
    showToast('Selected all main code tabs', 'info');
}

// Select all unit test tabs
function selectAllTestCode() {
    document.querySelectorAll('.ticket-checkbox input').forEach(cb => {
        cb.checked = true;
        // Switch each ticket to test code tab
        const ticketId = cb.value;
        const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);
        if (ticketIndex !== -1) {
            switchTicketTab(`test_${ticketIndex}`, ticketIndex);
        }
    });
    showToast('Selected all unit test tabs', 'info');
}
/*
// Missing function: Run Selected - intelligently detects active tab type
async function runSelectedTicketCode() {
    console.log('🚀 Running selected code based on active tab type');

    // Check what type of tabs are currently active across all tickets
    let activeMainCount = 0;
    let activeTestCount = 0;

    for (let i = 0; i < ticketResults.length; i++) {
        const mainTab = document.querySelector(`.ticket-tab-content[data-tab="main_${i}"].active`);
        const testTab = document.querySelector(`.ticket-tab-content[data-tab="test_${i}"].active`);

        if (mainTab) activeMainCount++;
        if (testTab) activeTestCount++;
    }

    console.log(`Active tabs: ${activeMainCount} main, ${activeTestCount} test`);

    if (activeMainCount > 0 && activeTestCount === 0) {
        // All main code tabs are active - run main code logic
        console.log('🚀 Detected main code context - running main code');
        await runAllActiveMainCode();
    } else if (activeTestCount > 0 && activeMainCount === 0) {
        // All test tabs are active - run unit test logic
        console.log('🧪 Detected unit test context - running unit tests');
        await runAllActiveUnitTests();
    } else {
        // Mixed or no active tabs
        showToast('Please select either all main code or all unit tests before running', 'warning');
    }
}

// Run all currently active main code
async function runAllActiveMainCode() {
    console.log('🚀 Running all active main code');

    // Find the first active main code area and use your existing runCode logic
    for (let i = 0; i < ticketResults.length; i++) {
        const mainTab = document.querySelector(`.ticket-tab-content[data-tab="main_${i}"].active`);
        if (mainTab) {
            // Use your existing runTicketCode function for the first active main code
            await runTicketCode(i);
            showToast(`Executed main code for ticket ${ticketResults[i].ticket_id}`, 'success');
            break; // Run one at a time for now
        }
    }
}

// Run all currently active unit tests
    async function runAllActiveUnitTests() {
    console.log('🧪 Running all active unit tests');

    // Find the first active unit test area and use your existing runTests logic
    for (let i = 0; i < ticketResults.length; i++) {
        const testTab = document.querySelector(`.ticket-tab-content[data-tab="test_${i}"].active`);
        if (testTab) {
            // Use your existing runTicketTests function for the first active test
            await runTicketTests(i);
            showToast(`Executed unit tests for ticket ${ticketResults[i].ticket_id}`, 'success');
            // Small delay between executions
            await delay(1000);
        }
    }
}
*/

// Updated: Run Selected - only runs checked tickets
async function runSelectedTicketCode() {
    console.log('🚀 Running selected (checked) tickets based on active tab type');

    // Get only the checked tickets
    const selectedTicketIds = getSelectedTickets();

    if (selectedTicketIds.length === 0) {
        showToast('Please select at least one ticket by checking the checkbox', 'warning');
        return;
    }

    // Check what type of tabs are currently active for the selected tickets
    let activeMainCount = 0;
    let activeTestCount = 0;
    const selectedIndices = [];

    selectedTicketIds.forEach(ticketId => {
        const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);
        if (ticketIndex !== -1) {
            selectedIndices.push(ticketIndex);

            const mainTab = document.querySelector(`.ticket-tab-content[data-tab="main_${ticketIndex}"].active`);
            const testTab = document.querySelector(`.ticket-tab-content[data-tab="test_${ticketIndex}"].active`);

            if (mainTab) activeMainCount++;
            if (testTab) activeTestCount++;
        }
    });

    console.log(`Selected tickets: ${selectedTicketIds.length}, Active tabs: ${activeMainCount} main, ${activeTestCount} test`);

    if (activeMainCount > 0 && activeTestCount === 0) {
        // All selected tickets show main code - run main code logic
        console.log('🚀 Running main code for selected tickets');
        await runSelectedMainCode(selectedIndices);
    } else if (activeTestCount > 0 && activeMainCount === 0) {
        // All selected tickets show tests - run unit test logic
        console.log('🧪 Running unit tests for selected tickets');
        await runSelectedUnitTests(selectedIndices);
    } else {
        // Mixed tabs or no selection
        showToast('Please ensure all selected tickets show the same tab type (all main code or all unit tests)', 'warning');
    }
}

// Fix runSelectedMainCode function
/*
async function runSelectedMainCode(selectedIndices) {
    showProgress('Running main code for selected tickets...', [
        'Preparing execution',
        'Running selected main code',
        'Collecting results'
    ]); // ← Fixed: Pass array instead of string

    try {
        for (let j = 0; j < selectedIndices.length; j++) {
            const ticketIndex = selectedIndices[j];
            console.log(`Running main code for ticket index ${ticketIndex}`);

            //const progress = ((j + 1) / selectedIndices.length) * 100;
            //updateProgress(progress, `Running main code ${j + 1}/${selectedIndices.length}`);

            await runTicketCode(ticketIndex);
            await delay(500);
        }

        showToast(`Executed main code for ${selectedIndices.length} selected tickets!`, 'success');

    } catch (error) {
        console.error('Selected main code execution error:', error);
        showToast('Main code execution failed: ' + error.message, 'error');
    }
}
*/

async function runSelectedMainCode(selectedIndices) {
    console.log('🚀 Starting multi-ticket main code execution');

    // Check if code has been reviewed (optional but recommended)
    const reviewBtn = document.getElementById('reviewAppBtn');
    const isReviewed = reviewBtn && reviewBtn.textContent.includes('Review Completed');

    if (!isReviewed) {
        const confirmExecute = confirm('Please Complete Code Review before executing');
        if (!confirmExecute || confirmExecute) {
            return;
        }
    }

    // Store selected tickets for later execution
    window.multiTicketSelectedIndices = selectedIndices;

    // Load available devices first
    await loadAvailableDevices();

    if (availableDevices.length === 0) {
        showToast('No devices available for execution. Please check device configuration.', 'error');
        return;
    }

    // Use your existing device selection modal
    createDeviceSelectionModal();
}

// Fix runSelectedUnitTests function
async function runSelectedUnitTests(selectedIndices) {
    // RESTORE original unit test code before running
    selectedIndices.forEach(ticketIndex => {
        const ticket = ticketResults[ticketIndex];
        const testTextarea = document.getElementById(`testArea${ticketIndex}`);

        if (testTextarea) {
            // Check if textarea contains review results (indicators of review content)
            const currentContent = testTextarea.value;
            if (currentContent.includes('=== CODE REVIEW REPORT ===') ||
                currentContent.includes('UNIT TEST CODE REVIEW') ||
                currentContent.includes('STATIC ANALYSIS')) {

                console.log(`🔄 Detected review content in ${ticket.ticket_id}, restoring original unit test code`);

                // Option A: Check if we have stored original code
                if (window.originalUnitTestCode && window.originalUnitTestCode[ticket.ticket_id]) {
                    testTextarea.value = window.originalUnitTestCode[ticket.ticket_id];
                    console.log(`✅ Restored original unit test code for ${ticket.ticket_id}`);
                }
                // Option B: If no stored code, try to extract from review content
                else {
                    // Look for original code section in review report
                    const originalCodeMatch = currentContent.match(/=== ORIGINAL CODE ===([\s\S]*?)(?:===|$)/);
                    if (originalCodeMatch && originalCodeMatch[1]) {
                        const originalCode = originalCodeMatch[1].trim();
                        testTextarea.value = originalCode;
                        console.log(`✅ Extracted original unit test code for ${ticket.ticket_id} from review`);
                    } else {
                        console.warn(`⚠️ Could not restore unit test code for ${ticket.ticket_id} - no original code found`);
                        showToast(`Warning: Could not restore unit test code for ${ticket.ticket_id}`, 'warning');
                    }
                }

                // Update character count after restoration
                updateTicketCharCount(ticketIndex, 'test');
            }
        }
    });

    showProgress('Running unit tests for selected tickets...', [
        'Preparing test execution',
        'Running selected unit tests',
        'Collecting test results'
    ]); // ← Fixed: Pass array instead of string

    try {
        for (let j = 0; j < selectedIndices.length; j++) {
            const ticketIndex = selectedIndices[j];
            console.log(`Running unit tests for ticket index ${ticketIndex}`);

            //const progress = ((j + 1) / selectedIndices.length) * 100;
            //updateProgress(progress, `Running tests ${j + 1}/${selectedIndices.length}`);

            await runTicketTests(ticketIndex);
            await delay(1000);
        }

        showToast(`Executed unit tests for ${selectedIndices.length} selected tickets!`, 'success');

    } catch (error) {
        console.error('Selected unit tests execution error:', error);
        showToast('Unit tests execution failed: ' + error.message, 'error');
    }
}

// Add a function to store original code when generating unit tests
function storeOriginalUnitTestCode(ticketId, code) {
    if (!window.originalUnitTestCode) {
        window.originalUnitTestCode = {};
    }
    window.originalUnitTestCode[ticketId] = code;
    console.log(`💾 Stored original unit test code for ${ticketId}`);
}

// Enhanced toggleTicketSelection with better logic
function toggleTicketSelection(ticketId) {
    console.log(`🎯 Toggling selection for ticket: ${ticketId}`);

    // Find the specific checkbox in the ticket area (not in the JIRA selection area)
    const checkbox = document.querySelector(`.ticket-area-group .ticket-checkbox input[value="${ticketId}"]`);
    const ticketItem = document.querySelector(`.ticket-area-group[data-ticket-id="${ticketId}"]`);

    if (checkbox && ticketItem) {
        // Update visual selection state
        if (checkbox.checked) {
            ticketItem.classList.add('selected');
            console.log(`✅ Selected ticket: ${ticketId}`);
        } else {
            ticketItem.classList.remove('selected');
            console.log(`❌ Deselected ticket: ${ticketId}`);
        }

        // Update the selection count display
        updateSelectionCount();
    } else {
        console.error(`❌ Checkbox or ticket item not found for: ${ticketId}`);
        console.log('Available checkboxes:', document.querySelectorAll('.ticket-checkbox input'));
        console.log('Available ticket items:', document.querySelectorAll('[data-ticket-id]'));
    }
}

/*
// Update selection count display
function updateSelectionCount() {
    const checkedBoxes = document.querySelectorAll('.ticket-checkbox input:checked');
    const totalBoxes = document.querySelectorAll('.ticket-checkbox input');

    console.log(`Selected: ${checkedBoxes.length}/${totalBoxes.length} tickets`);

    // You can add a visual indicator here if needed
    // For example, update a counter in the UI
}
*/

function updateSelectionCount() {
    // Only count checkboxes in the multi-ticket area, not the JIRA selection area
    const checkedBoxes = document.querySelectorAll('.ticket-area-group .ticket-checkbox input:checked');
    const totalBoxes = document.querySelectorAll('.ticket-area-group .ticket-checkbox input');

    console.log(`Selection count: ${checkedBoxes.length}/${totalBoxes.length} tickets`);

    // Log each checked item for debugging
    checkedBoxes.forEach((cb, index) => {
        console.log(`Checked ${index}: ${cb.value}`);
    });
}

// Enhanced getSelectedTickets with debugging
function getSelectedTickets() {
    // Find all checked checkboxes specifically in ticket areas
    const checkboxes = document.querySelectorAll('.ticket-area-group .ticket-checkbox input:checked');

    console.log(`Found ${checkboxes.length} checked checkboxes`);

    const selectedIds = [];
    checkboxes.forEach((cb, index) => {
        console.log(`Checkbox ${index}: value="${cb.value}", checked=${cb.checked}`);
        selectedIds.push(cb.value);
    });

    // Remove duplicates
    const uniqueSelectedIds = [...new Set(selectedIds)];
    console.log('Raw selected IDs:', selectedIds);
    console.log('Unique selected IDs:', uniqueSelectedIds);

    return uniqueSelectedIds;
}

// Generate code for all tickets sequentially
async function generateAllTicketsCode() {
    showProgress('Generating code for all tickets...', [
        'Preparing ticket data',
        'Processing individual tickets',
        'Generating code with smart reuse',
        'Finalizing results'
    ]);

    try {
        for (let i = 0; i < ticketResults.length; i++) {
            const ticket = ticketResults[i];

            updateTicketStatus(i, 'Generating...', '#3b82f6');

            const cleanPrompt = ticket.main_requirement || ticket.description || ticket.title;
            // Store individual ticket prompt and generate code
            await fetch('/process_developer_prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: cleanPrompt,
                    workflowType: 'jira',
                    rawInputs: {
                        files: [],
                        requirements: cleanPrompt,
                        technicalNotes: ticket.technical_notes || ''
                    }
                })
            });

            // Use your existing generation endpoint with smart reuse
            const generateResponse = await fetch('/generate_app_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generate_from_prompt: true })
            });

            const generateResult = await generateResponse.json();

            if (generateResult.success) {
                displayTicketCode(i, generateResult.generated_code);
                updateTicketStatus(i, 'Generated ✓', '#22c55e');
            } else {
                updateTicketStatus(i, 'Failed ✗', '#ef4444');
            }

            const progress = ((i + 1) / ticketResults.length) * 100;
            updateProgress(progress, `Generated ${i + 1}/${ticketResults.length} tickets`);
        }
        // Enable review button after successful generation
        const reviewBtn = document.getElementById('reviewAppBtn');
        if (reviewBtn) {
            reviewBtn.disabled = false;
            reviewBtn.style.opacity = '1';
            reviewBtn.style.cursor = 'pointer';
        }

        // ADD THIS: Disable generate button after generation
        const generateBtn = document.getElementById('generateAppBtn');
        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = 'Code Generated ✓';
            generateBtn.style.opacity = '0.6';
            generateBtn.style.cursor = 'not-allowed';
        }
        showToast(`Generated code for ${ticketResults.length} tickets!`, 'success');

    } catch (error) {
        console.error('Multi-ticket generation error:', error);
        showToast('Code generation failed: ' + error.message, 'error');
    } finally {
        hideProgress();
    }
}

//NEW FIXED ONE - LETS TRY
async function generateApplicationCode() {
    // ✅ Handle multi-ticket mode
    if (multiTicketMode && ticketResults && ticketResults.length > 0) {
        console.log('🎫 Starting multi-ticket code generation');

        // Create individual ticket areas NOW (not during ingestion)
        createIndividualTicketAreas(ticketResults);

        // Start sequential generation for each ticket
        await generateAllTicketsCode();
        return;
    }

    console.log('🔧 Starting application code generation...');

    // EXISTING: Skip user story selection check for simplified workflow
    const promptTextarea = document.getElementById('promptTabTextarea');
    if (!promptTextarea || !promptTextarea.value.trim()) {
        showToast('Please ingest requirements first before generating code!', 'warning');
        return;
    }

    const generateBtn = document.getElementById('generateAppBtn');
    if (!generateBtn) return;

    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');

    try {
        showProgress('Generating Application Code', [
            'Checking for reusable code',
            'Loading processed requirements',
            'Preparing LLaMA model context',
            'Generating Python code',
            'Optimizing implementation',
            'Finalizing code structure'
        ]);

        // NEW: Check for reusable code FIRST
        updateProgress(10, 'Checking for reusable code', 0);
        const currentPrompt = promptTextarea.value.trim();
        console.log('[DEBUG] About to call checkForReusableCode with prompt:', currentPrompt.substring(0, 100));

        const reuseResult = await checkForReusableCode(currentPrompt, true);

        // DEBUG: Check what reuseResult actually contains
        console.log('[DEBUG] reuseResult received:', reuseResult);
        console.log('[DEBUG] reuseResult type:', typeof reuseResult);
        console.log('[DEBUG] reuseResult.reusable_found:', reuseResult ? reuseResult.reusable_found : 'reuseResult is null');
        console.log('[DEBUG] reuseResult && reuseResult.reusable_found:', !!(reuseResult && reuseResult.reusable_found));

        if (reuseResult && reuseResult.reusable_found) {
            console.log('[DEBUG] ✅ ENTERING smart code generation section');
            // Use reused code directly
            console.log('✅ Using smart code generation');
            updateProgress(80, 'Smart code found - using existing code', 4);
            await delay(1000);

            // Display the reused code
            const generatedCode = reuseResult.generated_code || [];
            generatedApplicationCode = reuseResult.generated_code;

            // FIX: Send the reused code to server so review function can access it
            try {
                await fetch('/store_generated_code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        generated_code: reuseResult.generated_code
                    })
                });
                console.log('[DEBUG] ✅ Sent reused code to server for review function');
            } catch (error) {
                console.error('[DEBUG] ❌ Failed to send code to server:', error);
            }
            await delay(1000);
            // DEBUG: Check what was actually assigned
            console.log('[DEBUG] After assignment - generatedApplicationCode:', generatedApplicationCode);
            console.log('[DEBUG] After assignment - generatedApplicationCode length:', generatedApplicationCode ? generatedApplicationCode.length : 'null');
            await delay(1000);

            updateAnalyticsCounter('devCodeGenerated');
            displayGeneratedApplicationCodeInTab(generatedCode);

            // Enable review button
            const reviewBtn = document.getElementById('reviewAppBtn');
            if (reviewBtn) {
                reviewBtn.disabled = false;
            }

            updateProgress(100, 'Smart reuse completed successfully', 5);
            showToast(`Smart Code Generation Complete: Used ${reuseResult.source_script}`, 'success');
            return; // Exit early - no need for AI generation
        } else {
            console.log('[DEBUG] ❌ NOT ENTERING smart reuse section');
            console.log('[DEBUG] Reason: reuseResult =', reuseResult);
        }

        // EXISTING: Fallback to normal AI generation if no reuse found
        console.log('🤖 No reusable code found, proceeding with AI generation');
        updateProgress(20, 'Loading processed requirements', 1);
        await delay(1000);

        updateProgress(40, 'Preparing LLaMA model context', 2);
        await delay(1000);

        updateProgress(60, 'Generating application code', 3);

        // EXISTING: Call backend without selected_story_ids
	//const selectedLanguage = document.getElementById('languageSelector')?.value || 'python';
	const languageSelector = document.getElementById('languageSelector');
	const selectedLanguage = languageSelector ? languageSelector.value : 'python';
	const language = selectedLanguage;
	console.log('Language selected:', language);
        const response = await fetch('/generate_app_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                // No selected_story_ids needed - backend will use stored prompt
                generate_from_prompt: true,
                language: language
            })
        });

        updateProgress(80, 'Optimizing implementation', 4);
        await delay(1000);

        const result = await response.json();

        updateProgress(100, 'Code generation completed', 5);

        if (result.success) {
            // EXISTING: Display generated code in the tab editor
            const generatedCode = result.generated_code || [];
            generatedApplicationCode = result.generated_code;
            updateAnalyticsCounter('devCodeGenerated');
            displayGeneratedApplicationCodeInTab(generatedCode);

            // EXISTING: Enable review button
            const reviewBtn = document.getElementById('reviewAppBtn');
            if (reviewBtn) {
                reviewBtn.disabled = false;
            }

            showToast(result.message || 'Code generated successfully!', 'success');
        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Code generation error:', error);
        showToast('Code generation failed: ' + error.message, 'error');
    } finally {
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-loading');
        generateBtn.textContent = 'Generate Application Code';
        hideProgress();
    }
}

// FIXED: New function to display generated application code
function displayGeneratedApplicationCode(codeResults) {
    console.log('📝 Displaying generated application code');

    const container = document.getElementById('generatedCodeContainer');
    if (!container) return;

    // Clear existing content but keep the prompt display
    const existingPromptArea = container.querySelector('.prompt-display-area');
    container.innerHTML = '';

    // Re-add the prompt display area if it existed
    if (existingPromptArea) {
        container.appendChild(existingPromptArea);
    }

    container.style.display = 'block';

    if (!codeResults || codeResults.length === 0) {
        const noCodeMessage = document.createElement('div');
        noCodeMessage.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 10px;">
                <h4 style="color: #92400e; margin-bottom: 10px;">⚠️ No Code Generated</h4>
                <p style="color: #92400e; margin: 0;">The code generation completed but no code was returned. This might be a temporary issue.</p>
            </div>
        `;
        container.appendChild(noCodeMessage);
        return;
    }

    // Create header for generated code section
    const codeHeader = document.createElement('div');
    codeHeader.innerHTML = `
        <div style="margin-top: 30px; margin-bottom: 20px;">
            <h3 style="color: #1e40af; margin-bottom: 10px;">🚀 Generated Application Code</h3>
            <p style="color: #64748b; margin: 0;">Review and customize the generated implementation code</p>
        </div>
    `;
    container.appendChild(codeHeader);

    // Create code areas for each generated file
    codeResults.forEach((codeResult, index) => {
        const codeGroup = document.createElement('div');
        codeGroup.className = 'code-group';
        codeGroup.style.cssText = `
            margin-bottom: 25px;
            border: 2px solid #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            background: white;
        `;

        codeGroup.innerHTML = `
            <div class="code-header" style="
                background: linear-gradient(135deg, #10b981, #059669);
                color: white;
                padding: 15px 20px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: space-between;
            ">
                <div>
                    <h4 style="margin: 0; font-size: 1.1rem;">${codeResult.story_title || codeResult.file_name || 'Generated Code'}</h4>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 5px;">
                        File: ${codeResult.file_name || 'application_code.py'}
                    </div>
                </div>
                <div style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                ">${index + 1}</div>
            </div>
            <div class="code-content" style="position: relative;">
                <textarea 
                    class="code-textarea" 
                    id="appCode${index}"
                    placeholder="Generated code will appear here..."
                    oninput="updateCodeAreaCharCount(${index}); autoResizeCodeTextarea(${index})"
                    style="
                        width: 100%;
                        min-height: 400px;
                        padding: 20px;
                        border: none;
                        font-family: 'Courier New', monospace;
                        font-size: 0.9rem;
                        resize: vertical;
                        background: white;
                        color: #374151;
                    "
                >${codeResult.generated_code || ''}</textarea>
                <div class="code-char-count" id="appCodeCharCount${index}" style="
                    position: absolute;
                    bottom: 12px;
                    right: 18px;
                    color: #6b7280;
                    font-size: 0.8rem;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 4px 8px;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                ">${(codeResult.generated_code || '').length} characters</div>
                <div class="code-actions" style="
                    position: absolute;
                    top: 12px;
                    right: 18px;
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                ">
                    <button class="action-btn save-btn" onclick="saveApplicationCode(${index})" title="Save code" style="
                        width: 36px;
                        height: 36px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        background: #22c55e;
                        color: white;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                    ">
                        💾
                    </button>
                    <button class="action-btn download-btn" onclick="downloadApplicationCode(${index})" title="Download code" style="
                        width: 36px;
                        height: 36px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        background: #3b82f6;
                        color: white;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                    ">
                        📥
                    </button>
                </div>
            </div>
        `;

        container.appendChild(codeGroup);

        // Auto-resize textarea
        setTimeout(() => autoResizeCodeTextarea(index), 100);
    });

    // Store generated code globally for save/download functions
    generatedApplicationCode = codeResults;
}

function saveApplicationCode(index) {
    console.log(`💾 Saving application code ${index}`);

    const textarea = document.getElementById(`appCode${index}`);
    if (!textarea) return;

    const code = textarea.value.trim();
    if (!code) {
        showToast('No code to save!', 'warning');
        return;
    }

    // Save to localStorage as backup
    localStorage.setItem(`app_code_${index}`, code);
    localStorage.setItem(`app_code_${index}_timestamp`, new Date().toISOString());

    showToast(`Application code ${index + 1} saved successfully!`, 'success');
}

function downloadApplicationCode(index) {
    console.log(`📥 Downloading application code ${index}`);

    const textarea = document.getElementById(`appCode${index}`);
    if (!textarea) return;

    const code = textarea.value.trim();
    if (!code) {
        showToast('No code to download!', 'warning');
        return;
    }

    const codeData = generatedApplicationCode[index];
    const filename = codeData ? codeData.file_name : `application_code_${index + 1}.py`;

    const element = document.createElement('a');
    const file = new Blob([code], { type: 'text/x-python' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${filename} downloaded successfully!`, 'success');
}


function displayDeveloperUnittestReviewResults() {
    console.log('🧪 [DEVELOPER] Displaying unittest review results');

    // Track application code review
    updateAnalyticsCounter('devUnittestsReviewed');

    // Try to read summary2.txt (unittest review summary)
    fetch('/get-unittest-review-summary')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.summary_content) {
                const unittestTextarea = document.getElementById('unittestTabTextarea');
                if (unittestTextarea) {
                    // Format the unittest review content
                    const unittestReview = `=== UNITTEST CODE REVIEW RESULTS ===
Generated on: ${new Date().toLocaleString()}

${data.summary_content}

=== UNITTEST REVIEW ACTIONS ===
   ✅ 1. Look for [PASS] ✅ or [FAIL] ❌ indicators in the analysis above
   ✅ 2. CHECK "OPEN REPORT" FOR COMPREHENSIVE HTML RESULTS  
   ✅ 3. REVIEW UNITTEST QUALITY AND COVERAGE
   ❌ 4. DO NOT PROCEED IF UNITTEST STATIC CODE ANALYSIS FAILS

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ 🧪 UNITTEST CODE REVIEW COMPLETED FOR DEVELOPER WORKFLOW. CHECK ERRORS/ISSUES ABOVE. 🧪 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                    unittestTextarea.value = unittestReview;
                    updateTabCharCount('unittest');

                    // Update unittest tab status
                    const unittestStatus = document.getElementById('unittestStatus');
                    if (unittestStatus) {
                        unittestStatus.textContent = '✅ Review completed successfully';
                        unittestStatus.className = 'status-indicator success';
                    }

                    // Update unittest tab info
                    const unittestInfo = document.getElementById('unittestInfo');
                    if (unittestInfo) {
                        unittestInfo.textContent = `Unittest review completed - ${new Date().toLocaleString()}`;
                    }

                    // Update unittest tab badge
                    const unittestBadge = document.getElementById('unittestTabBadge');
                    if (unittestBadge) {
                        unittestBadge.textContent = 'REVIEWED ✅';
                        unittestBadge.style.background = '#10b981';
                        unittestBadge.style.color = 'white';
                    }

                    console.log('✅ [DEVELOPER] Unittest review results displayed successfully');
                }
            } else {
                console.log('⚠️ [DEVELOPER] No unittest review summary found, keeping original unittest code');
            }
        })
        .catch(error => {
            console.error('❌ [DEVELOPER] Error fetching unittest review summary:', error);
        });
}

async function checkForReusableCode(prompt, includeTests = true) {
    try {
        console.log('🔍 Checking for reusable code...');

        const response = await fetch('/check_reusable_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: prompt,
                include_tests: includeTests
            })
        });

        const result = await response.json();

        if (result.success && result.reusable_found) {
            console.log(`♻️ Smart Code Generation: ${result.source_script} (${result.confidence}% confidence)`);
            //showToast(`Smart Code Generation: Found ${result.source_script} (${result.confidence}% confidence)`, 'success');
            return result;
        }

        return null;
    } catch (error) {
        console.error('Error checking reusable code:', error);
        return null;
    }
}

// MODIFICATION: In the reviewApplicationCode function, find the success block and add this call
// Look for the line: showToast(`Application code review completed for ${result.individual_reports.length} file(s)! Check each tab for detailed results.`, 'success');
// ADD THIS LINE IMMEDIATELY AFTER IT:

// displayDeveloperUnittestReviewResults(); // ⭐ NEW: Display unittest review results in unittest tab

async function reviewApplicationCode() {
    console.log('🔍 Starting application code review using run_commands.py flow...');

    // MINIMAL FIX: Ensure backend has the code before review
    if (generatedApplicationCode && generatedApplicationCode.length > 0) {
        await fetch('/store_generated_code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generated_code: generatedApplicationCode })
        });
    }

    // Debug logging
    console.log('🔍 DEBUG: generatedApplicationCode:', generatedApplicationCode);
    console.log('🔍 DEBUG: Array.isArray(generatedApplicationCode):', Array.isArray(generatedApplicationCode));
    console.log('🔍 DEBUG: generatedApplicationCode.length:', generatedApplicationCode ? generatedApplicationCode.length : 'undefined');


    // Check if we're in multi-ticket mode
    if (multiTicketMode) {
        const selectedTicketIds = getSelectedTickets();

        // If no tickets specifically selected, review ALL tickets
        const ticketsToReview = selectedTicketIds.length > 0 ? selectedTicketIds :
                               ticketResults.map(t => t.ticket_id);

        console.log(`🔍 Multi-ticket mode: Reviewing ${ticketsToReview.length} tickets`);

        // Prepare ALL code (both main and unit tests) for selected tickets
        const allCodeForReview = [];

        ticketsToReview.forEach(ticketId => {
            const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);
            if (ticketIndex !== -1) {
                // Add main code
                const mainTextarea = document.getElementById(`mainArea${ticketIndex}`);
                if (mainTextarea && mainTextarea.value.trim()) {
                    allCodeForReview.push({
                        file_name: `${ticketId}_main_implementation.py`,
                        generated_code: mainTextarea.value,
                        story_id: `${ticketId}_main`,
                        story_title: `${ticketResults[ticketIndex].title} - Main Code`,
                        ticket_index: ticketIndex,
                        code_type: 'main'
                    });
                }

                // Add unit tests
                const testTextarea = document.getElementById(`testArea${ticketIndex}`);
                if (testTextarea && testTextarea.value.trim()) {
                    allCodeForReview.push({
                        file_name: `${ticketId}_unit_tests.py`,
                        generated_code: testTextarea.value,
                        story_id: `${ticketId}_test`,
                        story_title: `${ticketResults[ticketIndex].title} - Unit Tests`,
                        ticket_index: ticketIndex,
                        code_type: 'test'
                    });
                }
            }
        });

        // Store all code for review
        generatedApplicationCode = allCodeForReview;
        console.log(`🔍 Prepared ${allCodeForReview.length} code files for review`);

        // ADD THIS SINGLE LINE - Store on server for backend
        await fetch('/store_generated_code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generated_code: allCodeForReview }) });
    }

    // Check for generated application code (using the same variable name as QA workflow)
    if (!generatedApplicationCode || generatedApplicationCode.length === 0) {
        showToast('No generated application code to review. Please generate code first!', 'warning');
        return;
    }

    const reviewBtn = document.getElementById('reviewAppBtn');
    if (!reviewBtn) return;

    reviewBtn.disabled = true;
    reviewBtn.classList.add('btn-loading');

    try {
        // Start real progress tracking (same flow as QA workflow)
        startRealProgress('review', 'Reviewing Application Code Quality', [
            'Preparing application code for analysis',
            'Running code formatting checks (black)',
            'Analyzing coding standards and style (flake8)',
            'Performing security analysis (bandit)',
            'Running static code analysis (pylint)',
            'Generating comprehensive review report'
        ]);

        console.log(`🔍 Reviewing ${generatedApplicationCode.length} application code file(s)`);

        const response = await fetch('/review_app_code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        const result = await response.json();
        console.log('📋 Developer review result:', result);

        if (result.success) {

            // Handle multi-ticket individual reports
            if (multiTicketMode && result.individual_reports && result.individual_reports.length > 0) {
                result.individual_reports.forEach((report) => {
                    // Parse the file name to determine ticket and code type
                    const fileName = report.script_name;
                    let ticketId, codeType;

                    if (fileName.includes('_main_implementation.py')) {
                        ticketId = fileName.replace('_main_implementation.py', '');
                        codeType = 'main';
                    } else if (fileName.includes('_unit_tests.py')) {
                        ticketId = fileName.replace('_unit_tests.py', '');
                        codeType = 'test';
                    }

                    const ticketIndex = ticketResults.findIndex(t => t.ticket_id === ticketId);

                    if (ticketIndex !== -1) {
                        const textareaId = codeType === 'main' ? `mainArea${ticketIndex}` : `testArea${ticketIndex}`;
                        const textarea = document.getElementById(textareaId);

                        if (textarea) {
                            const reviewReport = `=== CODE REVIEW REPORT ===
Ticket: ${ticketId} - ${codeType.toUpperCase()} CODE
File: ${fileName}

${report.review_report}

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: CODE REVIEW COMPLETED. ADDRESS ISSUES BEFORE DEPLOYMENT. ⚠️  ██
██ 🚀 CODE IS READY FOR DEPLOYMENT IF ALL STATIC ANALYSIS CHECKS PASS. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                            textarea.value = reviewReport;
                            updateTicketCharCount(ticketIndex, codeType);
                        }
                    }
                });

                showToast(`Reviewed both main code and unit tests for selected tickets!`, 'success');
            }
            // Handle individual reports for application code files
            if (result.individual_reports && result.individual_reports.length > 0) {
                console.log('📋 Processing individual review reports for application code');

                // Update each code tab/area with its review report
                result.individual_reports.forEach((report, index) => {
                    console.log(`📄 Processing review for: ${report.script_name}`);

                    // Try to find the corresponding textarea in the enhanced tab editor
                    let textarea = null;

                    // Method 1: Try enhanced tab editor format
                    const codeTabId = `main_${index}`;
                    textarea = document.getElementById(`${codeTabId}Textarea`);

                    // Method 2: Try alternative tab naming
                    if (!textarea) {
                        const altTabId = `code_${report.script_id}`;
                        textarea = document.getElementById(`${altTabId}Textarea`);
                    }

                    // Method 3: Try the main code tab
                    if (!textarea && index === 0) {
                        textarea = document.getElementById('codeTabTextarea');
                    }

                    // Method 4: Fallback to generated code container
                    if (!textarea) {
                        textarea = document.getElementById(`appCode${index}`);
                    }

                    if (textarea) {
                        // Update textarea with review report
                        textarea.value = report.review_report;

                        // Update character count
                        if (window.updateEnhancedTabCharCount) {
                            updateEnhancedTabCharCount(codeTabId);
                        } else if (window.updateCodeAreaCharCount) {
                            updateCodeAreaCharCount(index);
                        }

                        // Auto-resize textarea
                        if (window.autoResizeCodeTextarea) {
                            autoResizeCodeTextarea(index);
                        }

                        // Update main code tab badge to show "REVIEWED"
                        const codeTabBadge = document.getElementById('codeTabBadge');
                        if (codeTabBadge) {
                            codeTabBadge.textContent = 'REVIEWED ✅';
                            codeTabBadge.style.background = '#10b981';
                            codeTabBadge.style.color = 'white';
                        }

                        // Also update the code tab status indicator
                        const codeStatus = document.getElementById('codeStatus');
                        if (codeStatus) {
                            codeStatus.textContent = '✅ Review completed successfully';
                            codeStatus.className = 'status-indicator success';
                        }

                        console.log(`✅ Updated review for ${report.script_name}`);
                    } else {
                        console.warn(`⚠️ Could not find textarea for ${report.script_name}`);
                    }
                });

                showToast(`Application code review completed for ${result.individual_reports.length} file(s)! Check each tab for detailed results.`, 'success');
                updateAnalyticsCounter('devCodeReviewed');
            } else {
                // Fallback for single code file or different format
                console.log('📋 Processing single application code review');

                const mainTextarea = document.getElementById('codeTabTextarea') ||
                                   document.getElementById('appCode0');

                if (mainTextarea) {
                    const reviewReport = `=== APPLICATION CODE REVIEW COMPLETED ===
Generated on: ${new Date().toLocaleString()}

${result.message || 'Code review analysis completed successfully.'}

=== REVIEW ACTIONS ===
✅ 1. Code formatting analysis completed
✅ 2. Style and lint checks completed  
✅ 3. Security analysis completed
✅ 4. Static code analysis completed

Please check "Open Report" for comprehensive HTML results.

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: APPLICATION CODE REVIEW COMPLETED. ADDRESS ISSUES BEFORE DEPLOYMENT. ⚠️  ██
██ 🚀 CODE IS READY FOR DEPLOYMENT IF ALL STATIC ANALYSIS CHECKS PASS. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                    mainTextarea.value = reviewReport;

                    // Update character count
                    if (window.updateTabCharCount) {
                        updateTabCharCount('code');
                    }
                }

                showToast('Application code review completed successfully!', 'success');
            }

            // ADD THE FUNCTION CALL HERE (AFTER BOTH IF/ELSE BLOCKS):
            displayDeveloperUnittestReviewResults(); // ⭐ NEW: Display unittest review results in unittest tab

            // Update button states (same flow as QA)
            const generateBtn = document.getElementById('generateAppBtn');
            const deployBtn = document.getElementById('deployAppBtn');
            const ingestBtn = document.getElementById('ingestDevBtn');

            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.6';
            }

            if (ingestBtn) {
                ingestBtn.disabled = true;
                ingestBtn.style.opacity = '0.6';
            }

            // Review button - mark as completed
            reviewBtn.disabled = true;
            reviewBtn.classList.remove('btn-loading');
            reviewBtn.textContent = 'Review Completed ✓';
            reviewBtn.style.opacity = '0.6';
            reviewBtn.style.cursor = 'not-allowed';

            // Enable deployment button after successful review
            if (deployBtn) {
                deployBtn.disabled = false;
                deployBtn.style.opacity = '1';
                deployBtn.style.cursor = 'pointer';
            }

            // CRITICAL: Show report buttons (same as QA workflow)
            const reportButtons = document.getElementById('developerreportButtons');
            if (reportButtons) {
                reportButtons.classList.add('show');
                reportButtons.style.display = 'flex'; // Make sure it's visible
            }

            /*// Switch to code tab to show review results
            if (window.switchEnhancedTab) {
                // If using enhanced tab editor, switch to first code tab
                setTimeout(() => {
                    switchEnhancedTab('main_0');
                }, 500);
            } else if (window.switchTab) {
                // If using basic tab editor, switch to code tab
                setTimeout(() => {
                    switchTab('code');
                }, 500);
            }*/
            /*
            // Switch to review tab to show results
            setTimeout(() => {
                switchTab('review');
            }, 500);
             */
            setTimeout(() => {
                // Try to switch to first main code tab in enhanced tabs
                const firstMainTab = document.querySelector('.enhanced-tab-header[data-tab*="main"]');
                if (firstMainTab) {
                    const tabId = firstMainTab.getAttribute('data-tab');
                    console.log(`📝 Auto-switching to enhanced tab: ${tabId}`);
                    switchEnhancedTab(tabId);
                } else {
                    // Don't auto-switch if we can't find the right tab
                    console.log('📝 No auto-switch - user can manually select tab');
                }
            }, 600);

        } else {
            // Error handling - same as QA workflow
            console.error('❌ Application code review failed:', result.message);
            stopProgressPolling();
            hideProgress();

            // Reset button on failure
            reviewBtn.disabled = false;
            reviewBtn.classList.remove('btn-loading');
            reviewBtn.textContent = 'Review Code Quality';
            reviewBtn.style.opacity = '1';
            reviewBtn.style.cursor = 'pointer';
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Application code review error:', error);

        // Stop progress polling on error
        stopProgressPolling();
        hideProgress();

        // Reset button on error
        reviewBtn.disabled = false;
        reviewBtn.classList.remove('btn-loading');
        reviewBtn.textContent = 'Review Code Quality';
        reviewBtn.style.opacity = '1';
        reviewBtn.style.cursor = 'pointer';
        showToast('Application code review failed: ' + error.message, 'error');
    }
}

// Function to update enhanced tabs with review status
function markTabAsReviewed(tabId, success = true) {
    console.log(`📝 Marking tab ${tabId} as reviewed (${success ? 'success' : 'with issues'})`);

    const tabHeader = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabHeader) {
        // Update badge
        const badge = tabHeader.querySelector('.file-type-badge');
        if (badge) {
            badge.textContent = success ? 'REVIEWED ✅' : 'ISSUES ⚠️';
            badge.style.background = success ? '#10b981' : '#f59e0b';
            badge.style.color = 'white';
        }

        // Update tab title
        const tabIcon = tabHeader.querySelector('.tab-icon');
        if (tabIcon && success) {
            tabIcon.textContent = '✅'; // Change icon to checkmark
        }
    }

    // Update tab footer status
    const tabContent = document.querySelector(`[data-tab="${tabId}"]`);
    if (tabContent) {
        const statusIndicator = tabContent.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.textContent = success ? '✅ Review completed' : '⚠️ Issues found';
            statusIndicator.className = `status-indicator ${success ? 'success' : 'warning'}`;
        }
    }
}

// Function to show review summary in a toast or modal
function showReviewSummary(reports) {
    if (!reports || reports.length === 0) return;

    const totalFiles = reports.length;
    const reviewedFiles = reports.filter(r => r.review_report.includes('✅')).length;
    const issuesFound = totalFiles - reviewedFiles;

    let summaryMessage = `Review completed for ${totalFiles} file(s). `;
    if (issuesFound === 0) {
        summaryMessage += 'All files passed review! 🎉';
    } else {
        summaryMessage += `${issuesFound} file(s) have issues that need attention. ⚠️`;
    }

    showToast(summaryMessage, issuesFound === 0 ? 'success' : 'warning');
}

function showReviewTab() {
    console.log('📝 Showing review tab');

    // Show the review tab header
    const reviewTabHeader = document.getElementById('reviewTabHeader');
    if (reviewTabHeader) {
        reviewTabHeader.style.display = 'block';
    }

    // Show the review tab badge
    const reviewTabBadge = document.getElementById('reviewTabBadge');
    if (reviewTabBadge) {
        reviewTabBadge.style.display = 'inline-block';
        reviewTabBadge.textContent = 'Completed';
    }
}

function displayReviewResultsInTab(individualReports) {
    console.log('📝 Displaying review results in review tab');

    const reviewTextarea = document.getElementById('reviewTabTextarea');
    const reviewInfo = document.getElementById('reviewInfo');
    const reviewStatus = document.getElementById('reviewStatus');

    if (reviewTextarea) {
        // Combine all individual reports
        let combinedReview = `=== APPLICATION CODE REVIEW RESULTS ===
Generated on: ${new Date().toLocaleString()}
Total Files Reviewed: ${individualReports.length}

`;

        individualReports.forEach((report, index) => {
            combinedReview += `
════════════════════════════════════════════════════════════════════════════════════════════════════════════════
📄 FILE ${index + 1}: ${report.script_name}
════════════════════════════════════════════════════════════════════════════════════════════════════════════════

${report.review_report}

`;
        });

        combinedReview += `
████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ 🎉 REVIEW COMPLETED FOR ALL ${individualReports.length} FILES! CHECK REPORTS FOR DETAILED RESULTS. 🎉 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

        reviewTextarea.value = combinedReview;
        updateTabCharCount('review');
    }

    if (reviewInfo) {
        reviewInfo.textContent = `Review completed for ${individualReports.length} files - ${new Date().toLocaleString()}`;
    }

    if (reviewStatus) {
        reviewStatus.textContent = '✅ Review completed successfully';
        reviewStatus.className = 'status-indicator success';
    }
}

function displaySingleReviewInTab(reviewReport) {
    console.log('📝 Displaying single review in review tab');

    const reviewTextarea = document.getElementById('reviewTabTextarea');
    const reviewInfo = document.getElementById('reviewInfo');
    const reviewStatus = document.getElementById('reviewStatus');

    if (reviewTextarea) {
        reviewTextarea.value = reviewReport;
        updateTabCharCount('review');
    }

    if (reviewInfo) {
        reviewInfo.textContent = `Review completed - ${new Date().toLocaleString()}`;
    }

    if (reviewStatus) {
        reviewStatus.textContent = '✅ Review completed successfully';
        reviewStatus.className = 'status-indicator success';
    }
}

function initializeDeveloperStatus() {
    console.log('📊 Initializing developer status tracking');

    // Initialize status tracking variables
    window.developerStatus = {
        codeGenerated: false,
        codeReviewed: false,
        codeDeployed: false
    };

    // Update status display
    updateDeveloperStatusDisplay();
}

function setupDeveloperButtonStates() {
    console.log('🎛️ Setting up developer button states');

    const generateBtn = document.getElementById('generateAppBtn');
    const reviewBtn = document.getElementById('reviewAppBtn');
    const deployBtn = document.getElementById('deployAppBtn');

    // Initial button states
    if (generateBtn) generateBtn.disabled = true;
    if (reviewBtn) reviewBtn.disabled = true;
    if (deployBtn) deployBtn.disabled = true;
}

function updateDeveloperStatusDisplay() {
    const statusSection = document.getElementById('developerStatusSection');
    if (!statusSection) return;

    const codeGenStatus = document.getElementById('codeGenerationStatus');
    const reviewStatus = document.getElementById('codeReviewStatus');
    const deployStatus = document.getElementById('deploymentStatus');

    if (window.developerStatus) {
        // Update code generation status
        if (codeGenStatus) {
            updateStatusItem(codeGenStatus,
                window.developerStatus.codeGenerated ? 'completed' : 'pending',
                window.developerStatus.codeGenerated ? 'Completed' : 'Pending'
            );
        }

        // Update review status
        if (reviewStatus) {
            updateStatusItem(reviewStatus,
                window.developerStatus.codeReviewed ? 'completed' : 'pending',
                window.developerStatus.codeReviewed ? 'Completed' : 'Pending'
            );
        }

        // Update deployment status
        if (deployStatus) {
            updateStatusItem(deployStatus,
                window.developerStatus.codeDeployed ? 'completed' : 'pending',
                window.developerStatus.codeDeployed ? 'Deployed' : 'Pending'
            );
        }
    }
}

function updateStatusItem(statusElement, status, text) {
    const icon = statusElement.querySelector('.status-icon');
    const value = statusElement.querySelector('.status-value');

    if (icon && value) {
        switch(status) {
            case 'completed':
                icon.textContent = '✅';
                value.textContent = text;
                value.style.color = '#059669';
                break;
            case 'in-progress':
                icon.textContent = '🔄';
                value.textContent = text;
                value.style.color = '#d97706';
                break;
            case 'error':
                icon.textContent = '❌';
                value.textContent = text;
                value.style.color = '#dc2626';
                break;
            default:
                icon.textContent = '⏳';
                value.textContent = text;
                value.style.color = '#6b7280';
        }
    }
}

// ================================================================================================
// REAL PROGRESS TRACKING FUNCTIONS
// ================================================================================================

function startRealProgress(taskType, title, initialSteps = []) {
    console.log(`🚀 Starting real progress tracking for: ${taskType}`);

    currentTaskType = taskType;

    // Show progress container
    showProgress(title, initialSteps);

    // Reset progress
    updateProgress(0, 'Initializing...', 0);

    // Start polling for real progress
    progressPollingInterval = setInterval(() => {
        pollProgress(taskType);
    }, 500); // Poll every 500ms for smooth updates
}

async function pollProgress(taskType) {
    try {
        const response = await fetch(`/progress/${taskType}`);
        const progressData = await response.json();

        // FIXED: Check if we're in developer workflow and use appropriate progress update
        const isDeveloperWorkflow = document.getElementById('developerContent').style.display !== 'none';

        // Update UI with real progress
        /*
        updateProgress(
            progressData.progress,
            progressData.step,
            Math.floor(progressData.progress / 20) // Convert to step index
        );
        */

        if (isDeveloperWorkflow) {
            // Update developer progress UI
            updateDeveloperProgress(
                progressData.progress,
                progressData.step,
                Math.floor(progressData.progress / 20)
            );
        } else {
            // Update QA progress UI (existing behavior)
            updateProgress(
                progressData.progress,
                progressData.step,
                Math.floor(progressData.progress / 20)
            );
        }

        // Check if task is completed
        if (progressData.completed) {
            console.log(`✅ Task ${taskType} completed with progress: ${progressData.progress}%`);
            stopProgressPolling();

            // Small delay to show 100% before hiding
            setTimeout(() => {
                if (isDeveloperWorkflow) {
                    hideDeveloperProgress();
                } else {
                    hideProgress();
                }
            }, 1000);
        }

    } catch (error) {
        console.error(`❌ Error polling progress for ${taskType}:`, error);
        // Don't stop polling on error - backend might be processing
    }
}

function stopProgressPolling() {
    if (progressPollingInterval) {
        clearInterval(progressPollingInterval);
        progressPollingInterval = null;
        currentTaskType = null;
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopProgressPolling();
});

// ================================================================================================
// UTILITY FUNCTIONS
// ================================================================================================

function preventDefault(e) {
    e.preventDefault();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': '📄', 'rtf': '📄', 'doc': '📝', 'docx': '📝',
        'xls': '📊', 'xlsx': '📊', 'csv': '📈', 'txt': '📄',
        'js': '💻', 'py': '🐍', 'html': '🌐', 'css': '🎨',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️',
        'zip': '📦', 'rar': '📦'
    };
    return iconMap[ext] || '📄';
}

// ================================================================================================
// TOAST NOTIFICATION SYSTEM
// ================================================================================================

function showToast(message, type = 'info') {
    console.log(`📢 Toast: ${message} (${type})`);

    if (elements.toastMessage && elements.toast) {
        elements.toastMessage.textContent = message;
        elements.toast.className = `toast show ${type}`;

        // Auto-hide after 5 seconds
        setTimeout(() => hideToast(), 5000);
    }
}

function hideToast() {
    if (elements.toast) {
        elements.toast.classList.remove('show');
    }
}

// ================================================================================================
// PROGRESS INDICATOR SYSTEM
// ================================================================================================

function showProgress(title, steps) {
    if (!elements.progressContainer || !elements.progressTitle || !elements.progressSteps) return;

    elements.progressTitle.textContent = title;
    elements.progressContainer.classList.add('show');

    // Create step elements
    elements.progressSteps.innerHTML = '';
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'progress-step';
        stepElement.innerHTML = `
            <div class="step-icon pending" id="step-${index}">●</div>
            <span>${step}</span>
        `;
        elements.progressSteps.appendChild(stepElement);
    });
}

function updateProgress(percentage, status, activeStepIndex = -1) {
    if (!elements.progressBar || !elements.progressPercentage || !elements.progressStatus) return;

    elements.progressBar.style.width = percentage + '%';
    elements.progressPercentage.textContent = Math.round(percentage) + '%';
    elements.progressStatus.textContent = status;

    // Update step states
    const stepElements = elements.progressSteps.querySelectorAll('.progress-step');
    stepElements.forEach((step, index) => {
        const icon = step.querySelector('.step-icon');
        step.classList.remove('active', 'completed');
        icon.classList.remove('active', 'completed', 'pending');

        if (index < activeStepIndex) {
            step.classList.add('completed');
            icon.classList.add('completed');
            icon.textContent = '✓';
        } else if (index === activeStepIndex) {
            step.classList.add('active');
            icon.classList.add('active');
            icon.textContent = '●';
        } else {
            icon.classList.add('pending');
            icon.textContent = '●';
        }
    });
}

function hideProgress() {
    setTimeout(() => {
        if (elements.progressContainer) {
            elements.progressContainer.classList.remove('show');
        }
    }, 1000);
}

// ================================================================================================
// FILE HANDLING SYSTEM
// ================================================================================================

function handleDragOver(e) {
    e.preventDefault();
    if (elements.uploadArea) elements.uploadArea.classList.add('dragover');
}

function handleDragLeave() {
    if (elements.uploadArea) elements.uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    if (elements.uploadArea) elements.uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    console.log(`📁 Files dropped: ${files.length}`);
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    console.log(`📁 Files selected: ${files.length}`);
    if (files && files.length > 0) {
        handleFiles(files);
    }
}

async function handleFiles(files) {
    if (files.length === 0) {
        console.log('⚠️ No files to handle');
        return;
    }

    console.log('📤 Processing files:', Array.from(files).map(f => f.name));

    try {
        showProgress('Uploading Files', [
            'Preparing files',
            'Uploading to server',
            'Processing files'
        ]);

        const formData = new FormData();
        Array.from(files).forEach(file => {
            console.log(`📎 Adding file: ${file.name} (${formatFileSize(file.size)})`);
            formData.append('files', file);
        });

        updateProgress(30, 'Uploading files to server', 1);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        updateProgress(70, 'Processing uploaded files', 2);

        const result = await response.json();
        console.log('📥 Upload result:', result);

        if (result.success) {
            uploadedFiles = result.files;
            displayFileInfo(result.files, result.total_size);
            resetButtonStates();
            updateProgress(100, 'Upload completed successfully', 2);
            showToast(result.message, 'success');
        } else {
            console.error('❌ Upload failed:', result.message);
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Upload error:', error);
        showToast('Upload failed: ' + error.message, 'error');
    } finally {
        hideProgress();
    }
}

/*
function displayFileInfo(files, totalSize) {
    if (!elements.fileInfo) return;

    let fileListHtml = '<div class="file-preview">';
    files.forEach(file => {
        fileListHtml += `
            <div class="file-item">
                <span class="file-icon">${getFileIcon(file.name)}</span>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;
    });
    fileListHtml += '</div>';

    elements.fileInfo.innerHTML = `
        <strong>Files Selected:</strong> ${files.length} file(s)<br>
        <strong>Total Size:</strong> ${formatFileSize(totalSize)}
        ${fileListHtml}
    `;
    elements.fileInfo.style.display = 'block';
}
*/

function displayFileInfo(files, totalSize) {
    // Try developer file info first, then fall back to QA file info
    const isDeveloperMode = !document.getElementById('developerContent').classList.contains('hide');
    const fileInfoElement = isDeveloperMode ? document.getElementById('developerFileInfo') : elements.fileInfo;

    if (!fileInfoElement) return;

    let fileListHtml = '<div class="file-preview">';
    files.forEach(file => {
        fileListHtml += `
            <div class="file-item">
                <span class="file-icon">${getFileIcon(file.name)}</span>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
        `;
    });
    fileListHtml += '</div>';

    fileInfoElement.innerHTML = `
        <strong>Files Selected:</strong> ${files.length} file(s)<br>
        <strong>Total Size:</strong> ${formatFileSize(totalSize)}
        ${fileListHtml}
    `;
    fileInfoElement.style.display = 'block';
}

function resetButtonStates() {
    console.log('🔄 Resetting button states for new workflow');

    const generateBtn = document.getElementById('generateBtn');
    const reviewBtn = document.getElementById('reviewBtn');
    const executeBtn = document.getElementById('executeBtn');
    const ingestBtn = document.getElementById('ingestBtn');
    const reportButtons = document.getElementById('qareportButtons');

    // Reset global data
    ingestedTestCases = [];
    generatedScripts = [];
    executionResults = [];

    // Hide multi-test areas
    hideMultiTestAreas();

    // UPDATED BUTTON STATES FOR NEW WORKFLOW
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = 'Generate Code';
        generateBtn.style.opacity = '0.6';
        generateBtn.style.cursor = 'not-allowed';
    }

    if (reviewBtn) {
        reviewBtn.disabled = true;
        reviewBtn.textContent = 'Review Code';
        reviewBtn.style.opacity = '0.6';
        reviewBtn.style.cursor = 'not-allowed';
    }

    if (executeBtn) {
        executeBtn.disabled = true;
        executeBtn.textContent = 'Execute Code';
        executeBtn.style.opacity = '0.6';
        executeBtn.style.cursor = 'not-allowed';
    }

    if (ingestBtn) {
        ingestBtn.disabled = false;
        ingestBtn.textContent = 'Ingest Test';
        ingestBtn.style.opacity = '1';
        ingestBtn.style.cursor = 'pointer';
    }

    // Reset text area
    if (elements.textArea) elements.textArea.value = '';
    updateCharCount();
    if (elements.codeActions) elements.codeActions.classList.remove('show');
    if (reportButtons) reportButtons.classList.remove('show');

    // ADD THIS LINE: Show save buttons when resetting for new workflow
    showSaveButtons();
}

// Make sure the new functions are globally available
window.hideSaveButtons = hideSaveButtons;
window.showSaveButtons = showSaveButtons;

// ================================================
// DEVICE MANAGEMENT
// ================================================
// Device Management Functions
async function loadAvailableDevices() {
    console.log('🔌 Loading available devices...');

    try {
        const response = await fetch('/devices');
        const result = await response.json();

        if (result.success) {
            availableDevices = result.devices;
            console.log(`📡 Loaded ${availableDevices.length} devices:`, availableDevices);
            return availableDevices;
        } else {
            console.error('❌ Failed to load devices:', result.message);
            showToast(result.message, 'error');
            return [];
        }
    } catch (error) {
        console.error('❌ Error loading devices:', error);
        showToast('Failed to load available devices', 'error');
        return [];
    }
}

async function checkDeviceStatus(deviceId) {
    console.log(`🔍 Checking status for device: ${deviceId}`);

    try {
        const response = await fetch(`/devices/${deviceId}/status`);
        const result = await response.json();

        if (result.success) {
            console.log(`📡 Device ${deviceId} status:`, result.status);
            return result;
        } else {
            console.error(`❌ Failed to check device ${deviceId} status:`, result.message);
            return {
                success: false,
                status: 'error',
                message: result.message,
                is_online: false
            };
        }
    } catch (error) {
        console.error(`❌ Error checking device ${deviceId} status:`, error);
        return {
            success: false,
            status: 'error',
            message: error.message,
            is_online: false
        };
    }
}

function getStatusIcon(status) {
    const statusIcons = {
        'online': '🟢',
        'offline': '🔴',
        'timeout': '🟡',
        'ssh_error': '🟠',
        'auth_error': '🔒',
        'error': '❌',
        'unknown': '⚪',
        'checking': '🔄'
    };
    return statusIcons[status] || '❓';
}

function getStatusColor(status) {
    const statusColors = {
        'online': '#22c55e',
        'offline': '#ef4444',
        'timeout': '#f59e0b',
        'ssh_error': '#f97316',
        'auth_error': '#8b5cf6',
        'error': '#ef4444',
        'unknown': '#6b7280',
        'checking': '#3b82f6'
    };
    return statusColors[status] || '#6b7280';
}

function createDeviceSelectionModal() {
    console.log('🎛️ Creating device selection modal');

    if (!availableDevices || availableDevices.length === 0) {
        showToast('No devices available for selection', 'warning');
        return;
    }

    // Remove existing modal
    const existingModal = document.getElementById('deviceSelectionModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modalHTML = `
        <div id="deviceSelectionModal" class="device-modal-overlay" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(3px);
            animation: fadeIn 0.3s ease-out;
        ">
            <div class="device-modal-content" style="
                background: white;
                border-radius: 20px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                animation: modalSlideIn 0.4s ease-out;
            ">
                <div class="device-modal-header" style="
                    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                    color: white;
                    padding: 25px 30px;
                    border-radius: 20px 20px 0 0;
                    position: relative;
                    overflow: hidden;
                ">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%);
                        animation: shimmer 3s infinite;
                    "></div>
                    <div style="position: relative; z-index: 1;">
                        <h3 style="margin: 0; font-size: 1.4rem; font-weight: 600; display: flex; align-items: center; gap: 12px;">
                            🔌 Select Test Device
                        </h3>
                        <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 0.95rem;">
                            Choose a device to execute your test scripts
                        </p>
                    </div>
                </div>
                
                <div class="device-modal-body" style="padding: 30px;">
                    <div style="margin-bottom: 20px;">
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            margin-bottom: 15px;
                        ">
                            <h4 style="margin: 0; color: #374151; font-size: 1.1rem;">Available Devices:</h4>
                            <button 
                                onclick="refreshDeviceStatus()" 
                                style="
                                    background: #f3f4f6;
                                    border: 1px solid #d1d5db;
                                    border-radius: 8px;
                                    padding: 8px 12px;
                                    cursor: pointer;
                                    font-size: 0.85rem;
                                    color: #374151;
                                    transition: all 0.3s ease;
                                    display: flex;
                                    align-items: center;
                                    gap: 6px;
                                "
                                onmouseover="this.style.background='#e5e7eb'"
                                onmouseout="this.style.background='#f3f4f6'"
                            >
                                🔄 Refresh Status
                            </button>
                        </div>
                        <div id="deviceList" style="
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                            max-height: 400px;
                            overflow-y: auto;
                        ">
                            <!-- Device items will be populated here -->
                        </div>
                    </div>
                </div>
                
                <div class="device-modal-footer" style="
                    padding: 20px 30px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f9fafb;
                    border-radius: 0 0 20px 20px;
                ">
                    <div style="font-size: 0.85rem; color: #6b7280;">
                        💡 Tip: Select an online device for best performance
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button 
                            onclick="closeDeviceSelectionModal()" 
                            style="
                                background: #e5e7eb;
                                color: #374151;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 500;
                                transition: all 0.3s ease;
                            "
                            onmouseover="this.style.background='#d1d5db'"
                            onmouseout="this.style.background='#e5e7eb'"
                        >
                            Cancel
                        </button>
                        <button 
                            id="confirmDeviceBtn"
                            onclick="confirmDeviceSelection()" 
                            disabled
                            style="
                                background: #9ca3af;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                cursor: not-allowed;
                                font-weight: 600;
                                opacity: 0.6;
                                transition: all 0.3s ease;
                            "
                        >
                            Continue with Selected Device
                        </button>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .device-item {
                transition: all 0.3s ease;
                cursor: pointer;
            }
            
            .device-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
            }
            
            .device-item.selected {
                border-color: #3b82f6 !important;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 197, 253, 0.1)) !important;
            }
            
            .status-checking {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
        </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Populate device list
    populateDeviceList();

    console.log('✅ Device selection modal created');
}

function populateDeviceList() {
    const deviceList = document.getElementById('deviceList');
    if (!deviceList) return;

    deviceList.innerHTML = '';

    availableDevices.forEach((device, index) => {
        const deviceItem = document.createElement('div');
        deviceItem.className = 'device-item';
        deviceItem.id = `device-${device.id}`;
        deviceItem.style.cssText = `
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            background: white;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        `;

        const statusIcon = getStatusIcon(device.status);
        const statusColor = getStatusColor(device.status);

        deviceItem.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                    <div style="
                        font-size: 1.5rem;
                        width: 40px;
                        height: 40px;
                        background: ${statusColor}15;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid ${statusColor}40;
                    ">
                        ${statusIcon}
                    </div>
                    <div style="flex: 1;">
                        <div style="
                            font-weight: 600;
                            color: #1f2937;
                            font-size: 1rem;
                            margin-bottom: 4px;
                        ">${device.name}</div>
                        <div style="
                            color: #6b7280;
                            font-size: 0.85rem;
                            margin-bottom: 2px;
                        ">${device.host} • ${device.description || 'Test Device'}</div>
                        <div style="
                            font-size: 0.8rem;
                            color: ${statusColor};
                            font-weight: 500;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                        ">
                            <span style="
                                background: ${statusColor};
                                width: 6px;
                                height: 6px;
                                border-radius: 50%;
                                display: inline-block;
                            "></span>
                            ${device.status_message || device.status.toUpperCase()}
                        </div>
                    </div>
                </div>
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                ">
                    <button 
                        onclick="checkSingleDeviceStatus('${device.id}')"
                        style="
                            background: #f3f4f6;
                            border: 1px solid #d1d5db;
                            border-radius: 6px;
                            padding: 4px 8px;
                            cursor: pointer;
                            font-size: 0.75rem;
                            color: #374151;
                            transition: all 0.3s ease;
                        "
                        onmouseover="this.style.background='#e5e7eb'"
                        onmouseout="this.style.background='#f3f4f6'"
                    >
                        Test Connection
                    </button>
                    <div style="
                        display: flex;
                        gap: 4px;
                        flex-wrap: wrap;
                        justify-content: flex-end;
                    ">
                        ${device.capabilities ? device.capabilities.map(cap => 
                            `<span style="
                                background: #eff6ff;
                                color: #1d4ed8;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: 0.7rem;
                                font-weight: 500;
                                border: 1px solid #bfdbfe;
                            ">${cap}</span>`
                        ).join('') : ''}
                    </div>
                </div>
            </div>
        `;

        // Add click handler for device selection
        deviceItem.addEventListener('click', (e) => {
            // Don't trigger selection if clicking the test button
            if (e.target.textContent === 'Test Connection') return;

            selectDevice(device.id);
        });

        deviceList.appendChild(deviceItem);
    });
}

function selectDevice(deviceId) {
    console.log(`🎯 Selecting device: ${deviceId}`);

    // Remove previous selection
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('selected');
        item.style.borderColor = '#e5e7eb';
        item.style.background = 'white';
    });

    // Select new device
    const deviceItem = document.getElementById(`device-${deviceId}`);
    if (deviceItem) {
        deviceItem.classList.add('selected');
        deviceItem.style.borderColor = '#3b82f6';
        deviceItem.style.background = 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 197, 253, 0.1))';
    }

    selectedDeviceId = deviceId;

    // Enable confirm button
    const confirmBtn = document.getElementById('confirmDeviceBtn');
    if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        confirmBtn.style.cursor = 'pointer';
        confirmBtn.style.opacity = '1';

        const selectedDevice = availableDevices.find(d => d.id === deviceId);
        if (selectedDevice) {
            confirmBtn.textContent = `Continue with ${selectedDevice.name}`;
        }
    }
}

async function checkSingleDeviceStatus(deviceId) {
    console.log(`🔍 Testing connection for device: ${deviceId}`);

    const deviceItem = document.getElementById(`device-${deviceId}`);
    if (!deviceItem) return;

    const statusElement = deviceItem.querySelector('[style*="font-size: 0.8rem"]');
    const iconElement = deviceItem.querySelector('[style*="font-size: 1.5rem"]');

    // Show checking state
    if (statusElement) {
        statusElement.innerHTML = `
            <span style="
                background: #3b82f6;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                display: inline-block;
                animation: pulse 1s infinite;
            "></span>
            Checking connection...
        `;
        statusElement.style.color = '#3b82f6';
    }

    if (iconElement) {
        iconElement.textContent = '🔄';
        iconElement.classList.add('status-checking');
    }

    try {
        const result = await checkDeviceStatus(deviceId);

        // Update device in availableDevices array
        const deviceIndex = availableDevices.findIndex(d => d.id === deviceId);
        if (deviceIndex !== -1) {
            availableDevices[deviceIndex] = {
                ...availableDevices[deviceIndex],
                status: result.status,
                status_message: result.message,
                is_online: result.is_online,
                last_checked: result.checked_at
            };
        }

        // Update UI
        const newStatusIcon = getStatusIcon(result.status);
        const newStatusColor = getStatusColor(result.status);

        if (statusElement) {
            statusElement.innerHTML = `
                <span style="
                    background: ${newStatusColor};
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    display: inline-block;
                "></span>
                ${result.message}
            `;
            statusElement.style.color = newStatusColor;
        }

        if (iconElement) {
            iconElement.textContent = newStatusIcon;
            iconElement.classList.remove('status-checking');
            iconElement.parentElement.style.background = `${newStatusColor}15`;
            iconElement.parentElement.style.borderColor = `${newStatusColor}40`;
        }

        showToast(`Device test complete: ${result.message}`, result.is_online ? 'success' : 'warning');

    } catch (error) {
        console.error(`❌ Error testing device ${deviceId}:`, error);

        if (statusElement) {
            statusElement.innerHTML = `
                <span style="
                    background: #ef4444;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    display: inline-block;
                "></span>
                Connection test failed
            `;
            statusElement.style.color = '#ef4444';
        }

        if (iconElement) {
            iconElement.textContent = '❌';
            iconElement.classList.remove('status-checking');
        }

        showToast(`Device test failed: ${error.message}`, 'error');
    }
}

async function refreshDeviceStatus() {
    console.log('🔄 Refreshing all device statuses...');

    showToast('Refreshing device status...', 'info');

    try {
        const refreshedDevices = await loadAvailableDevices();
        if (refreshedDevices.length > 0) {
            populateDeviceList();
            showToast('Device status refreshed successfully', 'success');
        }
    } catch (error) {
        console.error('❌ Error refreshing devices:', error);
        showToast('Failed to refresh device status', 'error');
    }
}

function confirmDeviceSelection() {
    if (!selectedDeviceId) {
        showToast('Please select a device first', 'warning');
        return;
    }

    const selectedDevice = availableDevices.find(d => d.id === selectedDeviceId);
    if (!selectedDevice) {
        showToast('Selected device not found', 'error');
        return;
    }

    console.log(`✅ Device selection confirmed: ${selectedDevice.name}`);

    // PRESERVE the device ID before closing modal
    window.confirmedDeviceId = selectedDeviceId;

    closeDeviceSelectionModal();

    // Show confirmation and proceed with execution
    showToast(`Selected device: ${selectedDevice.name} (${selectedDevice.status.toUpperCase()})`, 'success');

    // Call the actual execution function
    setTimeout(() => {
        executeCodeWithSelectedDevice();
    }, 500);
}

function closeDeviceSelectionModal() {
    const modal = document.getElementById('deviceSelectionModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }

    selectedDeviceId = null;
}

// ================================================================================================
// TEXT AREA MANAGEMENT
// ================================================================================================

function handleTextAreaInput() {
    updateCharCount();
    autoResizeTextarea();
}

function updateCharCount() {
    if (!elements.textArea || !elements.charCount) return;

    const count = elements.textArea.value.length;
    elements.charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
}

function autoResizeTextarea() {
    if (!elements.textArea) return;

    elements.textArea.style.height = 'auto';
    elements.textArea.style.height = Math.max(180, elements.textArea.scrollHeight) + 'px';
}

function updateTestAreaCharCount(index) {
    const textarea = document.getElementById(`testArea${index}`);
    const charCount = document.getElementById(`charCount${index}`);

    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
    }
}

function autoResizeTestTextarea(index) {
    const textarea = document.getElementById(`testArea${index}`);
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(250, textarea.scrollHeight) + 'px';
    }
}

// ================================================================================================
// MULTI-TEST AREA MANAGEMENT
// ================================================================================================
// 2. UPDATED: Master control panel without Smart Select button
function createMultiTestAreas() {
    // FIXED: Only create multi-test areas if there are MULTIPLE scripts
    if (!generatedScripts || generatedScripts.length <= 1) {
        console.log('🏗️ Single or no test case - using single test area mode');

        // For single test case, make sure execute button is properly set
        updateExecuteButtonState();

        // Make sure single text area is visible
        const singleTextAreaContainer = document.querySelector('.text-area-container');
        if (singleTextAreaContainer) {
            singleTextAreaContainer.style.display = 'block';
        }

        return;
    }

    // Rest of your existing createMultiTestAreas() function stays exactly the same...
    console.log('🏗️ Creating multi-test areas for', generatedScripts.length, 'scripts');

    //const autoTestContent = document.getElementById('autoTestContent');
    const autoTestContent = document.getElementById('qaContent');

    if (!autoTestContent) {
        console.error('❌ AutoTest content area not found!');
        return;
    }

    // Remove existing multi-test areas
    const existingMultiAreas = document.getElementById('multiTestAreas');
    if (existingMultiAreas) {
        existingMultiAreas.remove();
    }

    // Create new multi-test areas container
    const multiTestAreas = document.createElement('div');
    multiTestAreas.id = 'multiTestAreas';
    multiTestAreas.className = 'multi-test-areas';
    multiTestAreas.style.marginBottom = '25px';

    // ✨ CLEANED UP: Master Control Panel without Smart Select
    const masterControlPanel = document.createElement('div');
    masterControlPanel.id = 'masterControlPanel';
    masterControlPanel.className = 'master-control-panel';
    masterControlPanel.style.cssText = `
        background: linear-gradient(135deg, #f0f9ff, #e0f2fe);
        border: 2px solid #0ea5e9;
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 25px;
        display: none;
        box-shadow: 0 4px 15px rgba(14, 165, 233, 0.15);
        animation: slideInFromTop 0.5s ease-out;
    `;

    masterControlPanel.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <!-- Master Checkbox -->
                <div style="
                    background: white;
                    border: 2px solid #0ea5e9;
                    border-radius: 10px;
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.1);
                ">
                    <input 
                        type="checkbox" 
                        id="masterExecuteCheckbox" 
                        checked 
                        onchange="toggleAllTests(this.checked)"
                        style="
                            width: 20px;
                            height: 20px;
                            accent-color: #0ea5e9;
                            cursor: pointer;
                        "
                    >
                    <label for="masterExecuteCheckbox" style="
                        font-weight: 600;
                        color: #0c4a6e;
                        cursor: pointer;
                        font-size: 1rem;
                        margin: 0;
                    ">
                        Select All Tests for Execution
                    </label>
                </div>
                
                <!-- Test Count Display -->
                <div id="testCountDisplay" style="
                    background: #0ea5e9;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 25px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.3);
                ">
                    ${generatedScripts.length} Tests Total
                </div>
            </div>
        </div>
    `;

    multiTestAreas.appendChild(masterControlPanel);

    // Initialize all test cases as selected by default
    selectedTestCases.clear();
    generatedScripts.forEach(script => {
        selectedTestCases.add(script.id);
    });

    // Create test areas for each generated script
    generatedScripts.forEach((script, index) => {
        const testAreaGroup = document.createElement('div');
        testAreaGroup.className = 'test-area-group';
        testAreaGroup.style.cssText = `
            margin-bottom: 30px;
            border: 2px solid #e5e7eb;
            border-radius: 15px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.9);
            transition: all 0.3s ease;
        `;

        testAreaGroup.innerHTML = `
            <div class="test-area-header" style="
                background: linear-gradient(135deg, #1e40af, #3b82f6);
                color: white;
                padding: 15px 20px;
                font-weight: 600;
                font-size: 1.1rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                position: relative;
                overflow: hidden;
            ">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <!-- Individual Execution Checkbox -->
                    <div class="execution-checkbox-container" style="
                        display: none;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 8px;
                        padding: 8px 12px;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        backdrop-filter: blur(10px);
                    " id="checkboxContainer${index}">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem;">
                            <input 
                                type="checkbox" 
                                id="executeCheckbox${index}" 
                                checked 
                                onchange="toggleTestSelection(${script.id}, this.checked)"
                                style="
                                    width: 18px;
                                    height: 18px;
                                    accent-color: #22c55e;
                                    cursor: pointer;
                                "
                            >
                            <span style="color: white; font-weight: 500;">Execute this test</span>
                        </label>
                    </div>
                    <span>Test Case ${script.id}: ${script.test_case_name}</span>
                </div>
                <div style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                ">${script.id}</div>
            </div>
            <div class="test-area-content" style="position: relative;">
                <textarea 
                    class="test-area-textarea" 
                    id="testArea${index}"
                    placeholder="Content for ${script.test_case_name} will appear here..."
                    oninput="updateTestAreaCharCount(${index}); autoResizeTestTextarea(${index})"
                    style="
                        width: 100%;
                        min-height: 250px;
                        padding: 20px;
                        border: none;
                        font-family: 'Courier New', monospace;
                        font-size: 0.9rem;
                        resize: vertical;
                        background: white;
                        color: #374151;
                        border-radius: 0 0 13px 13px;
                    "
                ></textarea>
                <div class="test-area-char-count" id="charCount${index}" style="
                    position: absolute;
                    bottom: 12px;
                    right: 18px;
                    color: #6b7280;
                    font-size: 0.8rem;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 4px 8px;
                    border-radius: 6px;
                    border: 1px solid #e5e7eb;
                ">0 characters</div>
                <div class="test-area-actions" style="
                    position: absolute;
                    top: 12px;
                    right: 18px;
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                ">
                    <button class="action-btn save-btn" onclick="saveTestCode(${index})" title="Save code" style="
                        width: 36px;
                        height: 36px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        background: #22c55e;
                        color: white;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                    ">
                        💾
                    </button>
                    <button class="action-btn download-btn" onclick="downloadTestCode(${index})" title="Download code" style="
                        width: 36px;
                        height: 36px;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 16px;
                        background: #3b82f6;
                        color: white;
                        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
                        transition: all 0.3s ease;
                    ">
                        📥
                    </button>
                </div>
            </div>
        `;
        multiTestAreas.appendChild(testAreaGroup);
    });

    autoTestContent.appendChild(multiTestAreas);

    // Hide single text area only when showing multi-test areas
    const singleTextAreaContainer = document.querySelector('.text-area-container');
    if (singleTextAreaContainer) {
        singleTextAreaContainer.style.display = 'none';
    }

    console.log('✅ Multi-test areas created successfully with clean master control panel');
}

// ================================================================================================
// BULK DOWNLOAD FUNCTIONALITY - ADD THESE FUNCTIONS TO YOUR SCRIPT.JS
// ================================================================================================

// Global variable to track selected scripts for bulk download
let selectedScriptsForDownload = new Set();

// Function to create bulk download controls
function createBulkDownloadControls() {
    console.log('🗂️ Creating bulk download controls in header area');

    if (!generatedScripts || generatedScripts.length <= 1) {
        console.log('🚫 Not creating bulk controls - single or no scripts');
        return;
    }

    // Remove existing bulk controls
    const existingControls = document.getElementById('bulkDownloadControls');
    if (existingControls) {
        existingControls.remove();
    }

    // Create bulk download controls container
    const bulkControls = document.createElement('div');
    bulkControls.id = 'bulkDownloadControls';
    bulkControls.className = 'bulk-download-controls';
    bulkControls.style.cssText = `
        background: linear-gradient(135deg, #f8fafc, #e2e8f0);
        border: 2px solid #64748b;
        border-radius: 15px;
        padding: 20px;
        margin: 20px 0;
        display: block;
        box-shadow: 0 4px 15px rgba(100, 116, 139, 0.15);
        animation: slideInFromTop 0.5s ease-out;
        position: relative;
        z-index: 10;
    `;

    bulkControls.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <!-- Master Download Checkbox -->
                <div style="
                    background: white;
                    border: 2px solid #64748b;
                    border-radius: 10px;
                    padding: 12px 16px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    box-shadow: 0 2px 8px rgba(100, 116, 139, 0.1);
                ">
                    <input 
                        type="checkbox" 
                        id="masterDownloadCheckbox" 
                        checked 
                        onchange="toggleAllScriptsForDownload(this.checked)"
                        style="
                            width: 20px;
                            height: 20px;
                            accent-color: #64748b;
                            cursor: pointer;
                        "
                    >
                    <label for="masterDownloadCheckbox" style="
                        font-weight: 600;
                        color: #334155;
                        cursor: pointer;
                        font-size: 1rem;
                        margin: 0;
                    ">
                        Select All Scripts for Download
                    </label>
                </div>
                
                <!-- Download Count Display -->
                <div id="downloadCountDisplay" style="
                    background: #64748b;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 25px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    box-shadow: 0 2px 8px rgba(100, 116, 139, 0.3);
                ">
                    ${generatedScripts.length} Scripts Selected
                </div>
            </div>
            
            <!-- Download Actions -->
            <div style="display: flex; gap: 10px;">
                <button 
                    id="downloadSelectedBtn" 
                    onclick="downloadSelectedScripts()" 
                    style="
                        background: linear-gradient(135deg, #059669, #10b981);
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                        box-shadow: 0 3px 8px rgba(16, 185, 129, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    "
                    onmouseover="this.style.background='linear-gradient(135deg, #047857, #059669)'; this.style.transform='translateY(-2px)'"
                    onmouseout="this.style.background='linear-gradient(135deg, #059669, #10b981)'; this.style.transform='translateY(0)'"
                >
                    📦 Download as ZIP
                </button>
                
                <button 
                    onclick="hideBulkDownloadControls()" 
                    style="
                        background: #e2e8f0;
                        color: #475569;
                        border: 1px solid #cbd5e1;
                        padding: 10px 16px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                    "
                    onmouseover="this.style.background='#cbd5e1'"
                    onmouseout="this.style.background='#e2e8f0'"
                >
                    ✕ Close
                </button>
            </div>
        </div>
        
        <!-- Selected Scripts Summary -->
        <div id="selectedScriptsSummary" style="
            margin-top: 15px;
            padding: 12px 15px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            font-size: 0.85rem;
            color: #475569;
            display: none;
        ">
            <strong>Selected for download:</strong> <span id="selectedScriptsList">All scripts</span>
        </div>
    `;

    // *** CHANGED: Insert after buttons instead of at end of multiTestAreas ***
    /*
    const buttonsContainer = document.querySelector('.buttons');
    if (buttonsContainer && buttonsContainer.parentNode) {
        // Insert right after the buttons container
        buttonsContainer.parentNode.insertBefore(bulkControls, buttonsContainer.nextSibling);
        console.log('✅ Bulk controls inserted after main buttons');
    } else {
        // Fallback: insert before multiTestAreas if buttons not found
        const multiTestAreas = document.getElementById('multiTestAreas');
        if (multiTestAreas && multiTestAreas.parentNode) {
            multiTestAreas.parentNode.insertBefore(bulkControls, multiTestAreas);
            console.log('✅ Bulk controls inserted before multi-test areas (fallback)');
        }
    }
     */
    // Insert specifically after QA buttons
    const qaContent = document.getElementById('qaContent');
    const qaButtons = qaContent ? qaContent.querySelector('.buttons') : null;

    if (qaButtons && qaButtons.parentNode) {
        // Insert right after the QA buttons container
        qaButtons.parentNode.insertBefore(bulkControls, qaButtons.nextSibling);
        console.log('✅ Bulk controls inserted after QA buttons');
    } else {
        // Fallback: insert before multiTestAreas
        const multiTestAreas = document.getElementById('multiTestAreas');
        if (multiTestAreas && multiTestAreas.parentNode) {
            multiTestAreas.parentNode.insertBefore(bulkControls, multiTestAreas);
            console.log('✅ Bulk controls inserted before multi-test areas (fallback)');
        }
    }

    // Initialize all scripts as selected
    selectedScriptsForDownload.clear();
    generatedScripts.forEach(script => {
        selectedScriptsForDownload.add(script.id);
    });

    // Add individual checkboxes to each test area
    addIndividualDownloadCheckboxes();

    console.log('✅ Bulk download controls created successfully in header area');
}

// Function to add individual download checkboxes to test areas
function addIndividualDownloadCheckboxes() {
    console.log('📋 Adding individual download checkboxes');

    generatedScripts.forEach((script, index) => {
        const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
        if (testHeader) {
            // Remove existing download checkbox if present
            const existingCheckbox = testHeader.querySelector('.download-checkbox-container');
            if (existingCheckbox) {
                existingCheckbox.remove();
            }

            // Create download checkbox container
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'download-checkbox-container';
            checkboxContainer.style.cssText = `
                display: block;
                background: rgba(255, 255, 255, 0.25);
                border-radius: 8px;
                padding: 6px 10px;
                border: 1px solid rgba(255, 255, 255, 0.4);
                backdrop-filter: blur(10px);
                margin-left: auto;
                margin-right: 50px;
            `;

            checkboxContainer.innerHTML = `
                <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.85rem;">
                    <input 
                        type="checkbox" 
                        id="downloadCheckbox${index}" 
                        checked 
                        onchange="toggleScriptForDownload(${script.id}, this.checked)"
                        style="
                            width: 16px;
                            height: 16px;
                            accent-color: #10b981;
                            cursor: pointer;
                        "
                    >
                    <span style="color: white; font-weight: 500;">Include in ZIP</span>
                </label>
            `;

            testHeader.appendChild(checkboxContainer);
        }
    });
}

// Function to show bulk download controls
function showBulkDownloadControlsCompact() {
    console.log('👁️ Showing compact bulk download controls');

    const bulkControls = document.getElementById('bulkDownloadControls');
    if (bulkControls) {
        bulkControls.style.display = 'block';
    }

    // Show individual checkboxes
    generatedScripts.forEach((script, index) => {
        const checkboxContainer = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .download-checkbox-container`);
        if (checkboxContainer) {
            checkboxContainer.style.display = 'block';
        }
    });

    // Hide the show button
    const showButton = document.getElementById('showBulkDownloadBtn');
    if (showButton) {
        showButton.style.display = 'none';
    }

    updateDownloadSelectionSummary();
}

// Function to hide bulk download controls
function hideBulkDownloadControls() {
    console.log('🙈 Hiding bulk download controls');

    const bulkControls = document.getElementById('bulkDownloadControls');
    if (bulkControls) {
        bulkControls.style.display = 'none';
    }

    // Hide individual checkboxes
    generatedScripts.forEach((script, index) => {
        const checkboxContainer = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .download-checkbox-container`);
        if (checkboxContainer) {
            checkboxContainer.style.display = 'none';
        }
    });

    // Show the show button again
    const showButton = document.getElementById('showBulkDownloadBtn');
    if (showButton) {
        showButton.style.display = 'flex';
    }
}

// NEW: Create compact bulk download trigger button in header
function createCompactBulkDownloadButton() {
    console.log('🎯 Creating compact bulk download button in header');

    if (!generatedScripts || generatedScripts.length <= 1) {
        return;
    }

    // Remove existing button
    const existingButton = document.getElementById('compactBulkDownloadBtn');
    if (existingButton) {
        existingButton.remove();
    }

    // Create compact button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'compactBulkDownloadContainer';
    buttonContainer.className = 'compact-bulk-download-container';
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: center;
        margin: 15px 0;
        animation: fadeInUp 0.5s ease-out;
    `;

    buttonContainer.innerHTML = `
        <button 
            id="compactBulkDownloadBtn" 
            onclick="showBulkDownloadControlsCompact()" 
            style="
                background: linear-gradient(135deg, #64748b, #475569);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 600;
                font-size: 0.95rem;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(100, 116, 139, 0.3);
                display: flex;
                align-items: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
            "
            onmouseover="this.style.background='linear-gradient(135deg, #475569, #334155)'; this.style.transform='translateY(-2px)'"
            onmouseout="this.style.background='linear-gradient(135deg, #64748b, #475569)'; this.style.transform='translateY(0)'"
        >
            📁 Bulk Download Options (${generatedScripts.length} scripts)
        </button>
    `;

    // Insert right after the main buttons
    /*
    const buttonsContainer = document.querySelector('.buttons');
    if (buttonsContainer && buttonsContainer.parentNode) {
        buttonsContainer.parentNode.insertBefore(buttonContainer, buttonsContainer.nextSibling);
        console.log('✅ Compact bulk download button created in header');
    }
     */
    // Insert specifically after QA buttons
    const qaContent = document.getElementById('qaContent');
    const qaButtons = qaContent ? qaContent.querySelector('.buttons') : null;

    if (qaButtons && qaButtons.parentNode) {
        qaButtons.parentNode.insertBefore(buttonContainer, qaButtons.nextSibling);
        console.log('✅ Compact bulk download button created after QA buttons');
    }
}

function addBulkDownloadToMultiTestAreas() {
    if (generatedScripts.length > 1) {
        createBulkDownloadControls();
        createCompactBulkDownloadButton();
        console.log('✅ Bulk download components added to header area');
    }
}

// Function to toggle all scripts for download
function toggleAllScriptsForDownload(isChecked) {
    console.log(`🎛️ Master download toggle: ${isChecked ? 'Selecting' : 'Deselecting'} all scripts`);

    if (isChecked) {
        // Select all scripts
        selectedScriptsForDownload.clear();
        generatedScripts.forEach(script => {
            selectedScriptsForDownload.add(script.id);
        });
    } else {
        // Deselect all scripts
        selectedScriptsForDownload.clear();
    }

    // Update individual checkboxes
    generatedScripts.forEach((script, index) => {
        const checkbox = document.getElementById(`downloadCheckbox${index}`);
        if (checkbox) {
            checkbox.checked = isChecked;
        }
    });

    updateDownloadCountDisplay();
    updateDownloadSelectionSummary();
    updateDownloadButtonState();
}

// Function to toggle individual script for download
function toggleScriptForDownload(scriptId, isSelected) {
    console.log(`🎯 Script ${scriptId} download selection: ${isSelected}`);

    if (isSelected) {
        selectedScriptsForDownload.add(scriptId);
    } else {
        selectedScriptsForDownload.delete(scriptId);
    }

    updateMasterDownloadCheckbox();
    updateDownloadCountDisplay();
    updateDownloadSelectionSummary();
    updateDownloadButtonState();
}

// Function to update master download checkbox
function updateMasterDownloadCheckbox() {
    const masterCheckbox = document.getElementById('masterDownloadCheckbox');
    if (!masterCheckbox) return;

    const totalScripts = generatedScripts.length;
    const selectedCount = selectedScriptsForDownload.size;

    if (selectedCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (selectedCount === totalScripts) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true;
    }
}

// Function to update download count display
function updateDownloadCountDisplay() {
    const countDisplay = document.getElementById('downloadCountDisplay');
    if (!countDisplay) return;

    const selectedCount = selectedScriptsForDownload.size;
    const totalCount = generatedScripts.length;

    if (selectedCount === totalCount) {
        countDisplay.textContent = `All ${totalCount} Scripts Selected`;
        countDisplay.style.background = '#10b981';
    } else if (selectedCount === 0) {
        countDisplay.textContent = `No Scripts Selected (${totalCount} Available)`;
        countDisplay.style.background = '#ef4444';
    } else {
        countDisplay.textContent = `${selectedCount} of ${totalCount} Scripts Selected`;
        countDisplay.style.background = '#f59e0b';
    }
}

// Function to update download selection summary
function updateDownloadSelectionSummary() {
    const summary = document.getElementById('selectedScriptsSummary');
    const scriptsList = document.getElementById('selectedScriptsList');

    if (!summary || !scriptsList) return;

    const selectedCount = selectedScriptsForDownload.size;
    const totalCount = generatedScripts.length;

    if (selectedCount === 0) {
        summary.style.display = 'none';
    } else {
        summary.style.display = 'block';

        if (selectedCount === totalCount) {
            scriptsList.textContent = 'All scripts';
        } else {
            const selectedScriptNames = generatedScripts
                .filter(script => selectedScriptsForDownload.has(script.id))
                .map(script => script.script_name)
                .join(', ');
            scriptsList.textContent = selectedScriptNames;
        }
    }
}

// Function to update download button state
function updateDownloadButtonState() {
    const downloadBtn = document.getElementById('downloadSelectedBtn');
    if (!downloadBtn) return;

    const selectedCount = selectedScriptsForDownload.size;

    if (selectedCount === 0) {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '📦 Select Scripts First';
        downloadBtn.style.opacity = '0.6';
        downloadBtn.style.cursor = 'not-allowed';
    } else {
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = `📦 Download ${selectedCount} Script${selectedCount > 1 ? 's' : ''} as ZIP`;
        downloadBtn.style.opacity = '1';
        downloadBtn.style.cursor = 'pointer';
    }
}

// REPLACE your existing downloadSelectedScripts function with this fixed version:
async function downloadSelectedScripts() {
    console.log('📦 Starting bulk download of selected scripts');

    const selectedCount = selectedScriptsForDownload.size;

    if (selectedCount === 0) {
        showToast('Please select at least one script to download!', 'warning');
        return;
    }

    const downloadBtn = document.getElementById('downloadSelectedBtn');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = `<div class="spinner"></div> Creating ZIP...`;
    }

    try {
        // Show progress
        showProgress('Creating Download Package', [
            'Collecting selected scripts',
            'Creating ZIP package',
            'Preparing download'
        ]);

        updateProgress(25, 'Collecting selected scripts', 0);
        await delay(500);

        updateProgress(50, 'Creating ZIP package', 1);

        // Get selected script IDs as array
        const selectedScriptIds = Array.from(selectedScriptsForDownload);

        console.log('📦 Selected script IDs:', selectedScriptIds);

        // Make API call to create ZIP
        const response = await fetch('/download_all_scripts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_script_ids: selectedScriptIds
            })
        });

        const result = await response.json();
        console.log('📦 ZIP creation result:', result);

        updateProgress(75, 'Preparing download', 2);
        await delay(500);

        if (result.success) {
            updateProgress(100, 'Download ready', 2);

            console.log('📦 Creating download with temp filename:', result.temp_filename);

            // Create download link using the temp filename (not full path)
            const downloadUrl = `/download_zip/${result.temp_filename}`;
            console.log('📦 Download URL:', downloadUrl);

            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = downloadUrl;
            downloadLink.download = result.download_filename;
            downloadLink.style.display = 'none';

            document.body.appendChild(downloadLink);

            // Trigger download
            downloadLink.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(downloadLink);
            }, 1000);

            showToast(`Successfully created ZIP package with ${result.script_count} scripts!`, 'success');

            // Reset download controls after successful download
            setTimeout(() => {
                hideBulkDownloadControls();
            }, 3000);

        } else {
            console.error('❌ ZIP creation failed:', result.message);
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Bulk download error:', error);
        showToast('Failed to create download package: ' + error.message, 'error');
    } finally {
        // Reset button
        if (downloadBtn) {
            downloadBtn.disabled = false;
            updateDownloadButtonState();
        }
        hideProgress();
    }
}

// 2. NEW: Master checkbox toggle function
function toggleAllTests(isChecked) {
    console.log(`🎛️ Master toggle: ${isChecked ? 'Selecting' : 'Deselecting'} all tests`);

    if (isChecked) {
        selectAllTests();
    } else {
        deselectAllTests();
    }

    // Update master checkbox appearance
    updateMasterCheckbox();
}


// 3. ADD NEW FUNCTIONS for checkbox management
function toggleTestSelection(testCaseId, isSelected) {
    console.log(`🎯 Test case ${testCaseId} selection toggled: ${isSelected}`);

    if (isSelected) {
        selectedTestCases.add(testCaseId);
    } else {
        selectedTestCases.delete(testCaseId);
    }

    updateExecuteButtonState();
    updateSelectionSummary();
    updateMasterCheckbox(); // NEW: Update master checkbox state

    console.log(`📋 Selected test cases: [${Array.from(selectedTestCases).join(', ')}]`);
}

// 4. NEW: Update master checkbox based on individual selections
function updateMasterCheckbox() {
    const masterCheckbox = document.getElementById('masterExecuteCheckbox');
    if (!masterCheckbox) return;

    const totalTests = generatedScripts.length;
    const selectedCount = selectedTestCases.size;

    if (selectedCount === 0) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
    } else if (selectedCount === totalTests) {
        masterCheckbox.checked = true;
        masterCheckbox.indeterminate = false;
    } else {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = true; // Partial selection
    }

    // Update test count display
    const testCountDisplay = document.getElementById('testCountDisplay');
    if (testCountDisplay) {
        if (selectedCount === totalTests) {
            testCountDisplay.textContent = `All ${totalTests} Tests Selected`;
            testCountDisplay.style.background = '#22c55e';
        } else if (selectedCount === 0) {
            testCountDisplay.textContent = `No Tests Selected (${totalTests} Available)`;
            testCountDisplay.style.background = '#ef4444';
        } else {
            testCountDisplay.textContent = `${selectedCount} of ${totalTests} Tests Selected`;
            testCountDisplay.style.background = '#f59e0b';
        }
    }
}

function updateExecuteButtonState() {
    const executeBtn = document.getElementById('executeBtn');
    if (!executeBtn) return;

    if (!generatedScripts || generatedScripts.length === 0) {
        // No scripts available
        executeBtn.disabled = true;
        executeBtn.textContent = 'Execute Code';
        executeBtn.classList.remove('selective-execution');
        return;
    }

    if (generatedScripts.length === 1) {
        // Single test case: always enabled, simple text
        executeBtn.disabled = false;
        executeBtn.textContent = 'Execute Code';
        executeBtn.classList.remove('selective-execution');
        console.log('🔘 Execute button: Single test mode');
    } else {
        // Multiple test cases: selection-based
        const selectedCount = selectedTestCases.size;
        const totalCount = generatedScripts.length;

        if (selectedCount === 0) {
            executeBtn.disabled = true;
            executeBtn.textContent = 'Execute Code (Select Tests First)';
            executeBtn.classList.add('selective-execution');
        } else if (selectedCount === totalCount) {
            executeBtn.disabled = false;
            executeBtn.textContent = 'Execute All Tests';
            executeBtn.classList.add('selective-execution');
        } else {
            executeBtn.disabled = false;
            executeBtn.textContent = `Execute Selected Tests (${selectedCount}/${totalCount})`;
            executeBtn.classList.add('selective-execution');
        }

        console.log(`🔘 Execute button: Multi-test mode (${selectedCount}/${totalCount} selected)`);
    }
}

// 1. UPDATED: Clean selection summary without redundant buttons
function updateSelectionSummary() {
    const selectedCount = selectedTestCases.size;
    const totalCount = generatedScripts ? generatedScripts.length : 0;

    // Remove any existing selection summary
    const existingSummary = document.getElementById('selectionSummary');
    if (existingSummary) {
        existingSummary.remove();
    }

    // Only show summary if we have tests and some are selected
    if (totalCount === 0) return;

    // Create clean selection summary without buttons
    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'selectionSummary';
    summaryDiv.className = 'selection-summary';

    // Simple, clean summary without redundant buttons
    summaryDiv.innerHTML = `
        <div class="selection-summary-info">
            <div class="selection-count-badge">${selectedCount}</div>
            <div>
                <div class="selection-text">${selectedCount} of ${totalCount} tests selected for execution</div>
                <div class="selection-details">Selected: Test Cases ${Array.from(selectedTestCases).sort((a, b) => a - b).join(', ')}</div>
            </div>
        </div>
    `;

    // Insert before the execute button
    const executeBtn = document.getElementById('executeBtn');
    if (executeBtn && executeBtn.parentNode) {
        executeBtn.parentNode.insertBefore(summaryDiv, executeBtn.parentNode.querySelector('.buttons'));
    }

    console.log(`📊 Selection summary updated: ${selectedCount}/${totalCount} tests selected`);
}

// 5. ENHANCED: Select all with master checkbox update
function selectAllTests() {
    console.log('✅ Selecting all tests');

    generatedScripts.forEach((script, index) => {
        selectedTestCases.add(script.id);
        const checkbox = document.getElementById(`executeCheckbox${index}`);
        if (checkbox) {
            checkbox.checked = true;
        }
    });

    updateExecuteButtonState();
    updateSelectionSummary();
    updateMasterCheckbox();
}

// 6. ENHANCED: Deselect all with master checkbox update
function deselectAllTests() {
    console.log('❌ Deselecting all tests');

    selectedTestCases.clear();

    generatedScripts.forEach((script, index) => {
        const checkbox = document.getElementById(`executeCheckbox${index}`);
        if (checkbox) {
            checkbox.checked = false;
        }
    });

    updateExecuteButtonState();
    updateSelectionSummary();
    updateMasterCheckbox();
}

// 7. NEW: Smart selection based on review results (placeholder logic)
/*
function selectRecommended() {
    console.log('⭐ Smart selecting recommended tests');

    // Clear current selection
    selectedTestCases.clear();

    // Smart logic: Select tests that don't have obvious error indicators
    generatedScripts.forEach((script, index) => {
        const textarea = document.getElementById(`testArea${index}`);
        const content = textarea ? textarea.value.toLowerCase() : '';

        // Simple heuristic: avoid tests with error indicators
        const hasErrors = content.includes('[fail]') ||
                         content.includes('error:') ||
                         content.includes('critical') ||
                         content.includes('security vulnerability') ||
                         content.includes('static code analysis fails');

        const checkbox = document.getElementById(`executeCheckbox${index}`);
        if (checkbox) {
            if (!hasErrors || content.includes('[pass]')) {
                selectedTestCases.add(script.id);
                checkbox.checked = true;
            } else {
                checkbox.checked = false;
            }
        }
    });

    updateExecuteButtonState();
    updateSelectionSummary();
    updateMasterCheckbox();

    const selectedCount = selectedTestCases.size;
    const totalCount = generatedScripts.length;
    const skippedCount = totalCount - selectedCount;

    if (skippedCount > 0) {
        showToast(`Smart selection: Selected ${selectedCount} tests, skipped ${skippedCount} tests with potential issues`, 'warning');
    } else {
        showToast(`Smart selection: All ${selectedCount} tests look good for execution!`, 'success');
    }
}
*/
// 8. ENHANCED: Show checkboxes with master control panel
function showExecutionCheckboxes() {
    console.log('👁️ Showing execution checkboxes and master control panel');

    // Show master control panel
    const masterControlPanel = document.getElementById('masterControlPanel');
    if (masterControlPanel) {
        masterControlPanel.style.display = 'block';
    }

    // Show individual checkboxes
    generatedScripts.forEach((script, index) => {
        const checkboxContainer = document.getElementById(`checkboxContainer${index}`);
        if (checkboxContainer) {
            checkboxContainer.style.display = 'block';
        }
    });

    updateExecuteButtonState();
    updateSelectionSummary();
    updateMasterCheckbox();
}

// 9. ENHANCED: Hide checkboxes with master control panel
function hideExecutionCheckboxes() {
    console.log('🙈 Hiding execution checkboxes and master control panel');

    // Hide master control panel
    const masterControlPanel = document.getElementById('masterControlPanel');
    if (masterControlPanel) {
        masterControlPanel.style.display = 'none';
    }

    // Hide individual checkboxes
    generatedScripts.forEach((script, index) => {
        const checkboxContainer = document.getElementById(`checkboxContainer${index}`);
        if (checkboxContainer) {
            checkboxContainer.style.display = 'none';
        }
    });

    // Remove selection summary
    const existingSummary = document.getElementById('selectionSummary');
    if (existingSummary) {
        existingSummary.remove();
    }
}


function areCheckboxesVisible() {
    if (generatedScripts.length === 0) return false;

    const firstCheckboxContainer = document.getElementById('checkboxContainer0');
    return firstCheckboxContainer && firstCheckboxContainer.style.display !== 'none';
}

function hideMultiTestAreas() {
    console.log('🗑️ Hiding multi-test areas');

    const multiTestAreas = document.getElementById('multiTestAreas');
    if (multiTestAreas) {
        multiTestAreas.remove();
    }

    // Show single text area
    const singleTextAreaContainer = document.querySelector('.text-area-container');
    if (singleTextAreaContainer) {
        singleTextAreaContainer.style.display = 'block';
    }
}

// ================================================================================================
// MAIN FUNCTIONALITY - INGEST TEST (UPDATED TO HANDLE PYTHON FILES)
// ================================================================================================

async function ingestTest() {
    console.log('📥 Starting test ingestion...');

    if (uploadedFiles.length === 0) {
        showToast('Please upload files first!', 'warning');
        return;
    }

    const ingestBtn = document.getElementById('ingestBtn');
    if (!ingestBtn) return;

    ingestBtn.disabled = true;
    ingestBtn.textContent = 'Ingesting...';

    try {
        showProgress('Ingesting Test Data', [
            'Reading uploaded files',
            'Parsing file contents',
            'Extracting test requirements',
            'Generating test metadata'
        ]);

        updateProgress(25, 'Reading uploaded files', 0);
        await delay(500);

        updateProgress(50, 'Parsing file contents', 1);
        await delay(700);

        updateProgress(75, 'Extracting test requirements', 2);

        const response = await fetch('/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: uploadedFiles })
        });

        const result = await response.json();
        console.log('📊 Ingestion result:', result);

        updateProgress(100, 'Test data ingested successfully', 3);

        if (result.success) {
            // Store ingested test cases
            ingestedTestCases = result.processed_files;

            // NEW: Handle different workflow types
            const workflowType = result.workflow_type;
            console.log(`🔄 Detected workflow type: ${workflowType}`);

            if (elements.textArea) {
                let textAreaContent = `Ingestion completed!\n\nFiles processed: ${uploadedFiles.length}\nItems found: ${result.total_test_cases}\n\n`;

                // NEW: Different messages based on file types
                if (result.python_files && result.python_files.length > 0) {
                    textAreaContent += `Python Code Files:\n`;
                    result.python_files.forEach(py => {
                        textAreaContent += `- ${py.original_name} → ${py.script_name}\n`;
                    });
                    textAreaContent += `\nPython files are ready for code review.\n`;
                }

                if (result.processed_files) {
                    const testCaseFiles = result.processed_files.filter(f => f.file_type !== 'python_code');
                    if (testCaseFiles.length > 0) {
                        textAreaContent += `\nTest Case Files:\n`;
                        testCaseFiles.forEach(f => {
                            textAreaContent += `- ${f.name}: ${f.test_cases}\n`;
                        });
                        textAreaContent += `\nTest cases are ready for Python code generation.\n`;
                    }
                }

                elements.textArea.value = textAreaContent;
                updateCharCount();
                autoResizeTextarea();
            }

            // NEW: Set button states based on workflow type
            const generateBtn = document.getElementById('generateBtn');
            const reviewBtn = document.getElementById('reviewBtn');
            const executeBtn = document.getElementById('executeBtn');

            if (workflowType === 'python_code') {
                // Python files uploaded - skip generate, enable review
                console.log('🐍 Python workflow: Skip generate, enable review');

                if (generateBtn) {
                    generateBtn.disabled = true;
                    generateBtn.textContent = 'Code Already Available ✓';
                    generateBtn.style.opacity = '0.6';
                    generateBtn.style.cursor = 'not-allowed';
                }

                if (reviewBtn) {
                    reviewBtn.disabled = false;
                    reviewBtn.style.opacity = '1';
                    reviewBtn.style.cursor = 'pointer';
                }

                if (executeBtn) {
                    executeBtn.disabled = true;
                    executeBtn.style.opacity = '0.6';
                    executeBtn.style.cursor = 'not-allowed';
                }

                // NEW: Populate generatedScripts for Python files (matching the structure expected by review code)
                generatedScripts = result.processed_files
                    .filter(file => file.file_type === 'python_code')
                    .map((processedFile) => {
                        // Find the corresponding python file data
                        const pyFile = result.python_files.find(pf => pf.original_name === processedFile.original_filename);
                        return {
                            id: processedFile.id,  // Use the processed file ID from backend
                            script_name: processedFile.script_filename || pyFile.script_name,
                            test_case_name: processedFile.name,
                            file_path: pyFile.dest_path,
                            code: pyFile.full_content
                        };
                    });

                // Create multi test areas for Python files if needed
                if (generatedScripts.length > 1) {
                    createMultiTestAreas();

                    // NEW: Populate each textarea with the Python code
                    generatedScripts.forEach((script, index) => {
                        const textarea = document.getElementById(`testArea${index}`);
                        if (textarea) {
                            textarea.value = script.code;
                            updateTestAreaCharCount(index);
                            autoResizeTestTextarea(index);
                        }
                    });
                } else if (generatedScripts.length === 1) {
                    // Single Python file - update main text area
                    if (elements.textArea) {
                        elements.textArea.value = generatedScripts[0].code;
                        updateCharCount();
                        autoResizeTextarea();
                        if (elements.codeActions) elements.codeActions.classList.add('show');
                    }
                }

                showToast(`${result.python_files.length} Python file(s) ready for review - Code generation skipped!`, 'success');

            } else if (workflowType === 'test_cases') {
                // Test case files uploaded - enable generate (normal workflow)
                console.log('📝 Test case workflow: Enable generate');

                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.style.opacity = '1';
                    generateBtn.style.cursor = 'pointer';
                }

                if (reviewBtn) {
                    reviewBtn.disabled = true;
                    reviewBtn.style.opacity = '0.6';
                    reviewBtn.style.cursor = 'not-allowed';
                }

                if (executeBtn) {
                    executeBtn.disabled = true;
                    executeBtn.style.opacity = '0.6';
                    executeBtn.style.cursor = 'not-allowed';
                }

                showToast(result.message, 'success');

            } else if (workflowType === 'mixed') {
                // Mixed files - show warning
                console.log('⚠️ Mixed workflow: Both Python and test case files detected');

                if (generateBtn) {
                    generateBtn.disabled = true;
                    generateBtn.textContent = 'Mixed File Types Detected';
                    generateBtn.style.opacity = '0.6';
                    generateBtn.style.cursor = 'not-allowed';
                }

                showToast('Mixed file types detected. Please upload either test case files OR Python code files, not both.', 'warning');
            }

        } else {
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Ingestion error:', error);
        showToast('Ingestion failed: ' + error.message, 'error');
    } finally {
        ingestBtn.disabled = false;
        ingestBtn.textContent = 'Ingest Test';
        hideProgress();
    }
}

// ================================================================================================
// MAIN FUNCTIONALITY - GENERATE CODE (WITH REAL PROGRESS)
// ================================================================================================

async function generateCode() {
    console.log('🔧 Starting code generation...');

    const generateBtn = document.getElementById('generateBtn');
    if (!generateBtn) return;

    generateBtn.disabled = true;
    generateBtn.classList.add('btn-loading');

    try {
        // Start real progress tracking
        startRealProgress('generate', 'Generating Python Test Code', [
            'Analyzing test requirements',
            'Creating Python test structure',
            'Generating Python Code',
            'Optimizing Python code',
            'Finalizing test suite'
        ]);

        // Make the actual API call
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ input_text: elements.textArea ? elements.textArea.value : '' })
        });

        const result = await response.json();
        console.log('🐍 Generation result:', result);

        if (result.success) {
            // Store generated scripts
            generatedScripts = result.generated_scripts;

            const actualCount = generatedScripts ? generatedScripts.length : 1;
            updateAnalyticsCounter('qaTestsGenerated', actualCount);

            // Create multi test areas OR show single area
            if (generatedScripts.length > 1) {
                createMultiTestAreas();
                //createBulkDownloadControls();
                addBulkDownloadToMultiTestAreas();
            } else {
                const singleTextAreaContainer = document.querySelector('.text-area-container');
                if (singleTextAreaContainer) {
                    singleTextAreaContainer.style.display = 'block';
                }
            }

            // Populate text areas
            generatedScripts.forEach((script, index) => {
                const textarea = document.getElementById(`testArea${index}`);
                if (textarea) {
                    textarea.value = script.code;
                    updateTestAreaCharCount(index);
                    autoResizeTestTextarea(index);
                }
            });

            // For single test case, update main text area
            if (generatedScripts.length === 1 && elements.textArea) {
                elements.textArea.value = generatedScripts[0].code;
                updateCharCount();
                autoResizeTextarea();
                if (elements.codeActions) elements.codeActions.classList.add('show');
            }

            // Update button states - NEW WORKFLOW: Review before Execute
            const reviewBtn = document.getElementById('reviewBtn');
            const executeBtn = document.getElementById('executeBtn');
            const ingestBtn = document.getElementById('ingestBtn');

            generateBtn.disabled = true;
            generateBtn.classList.remove('btn-loading');
            generateBtn.textContent = 'Code Generated ✓';
            generateBtn.style.opacity = '0.6';
            generateBtn.style.cursor = 'not-allowed';

            // CHANGED: Enable review button instead of execute
            if (reviewBtn) {
                reviewBtn.disabled = false;
                reviewBtn.style.opacity = '1';
                reviewBtn.style.cursor = 'pointer';
            }

            // CHANGED: Keep execute button disabled until review is complete
            if (executeBtn) {
                executeBtn.disabled = true;
                executeBtn.style.opacity = '0.6';
                executeBtn.style.cursor = 'not-allowed';
            }

            if (ingestBtn) {
                ingestBtn.disabled = true;
                ingestBtn.style.opacity = '0.6';
            }

            showToast(`Generated ${generatedScripts.length} Python test scripts successfully! Review code before execution.`, 'success');
        } else {
            // Stop progress polling on failure
            stopProgressPolling();
            hideProgress();

            // Reset button on failure
            generateBtn.disabled = false;
            generateBtn.classList.remove('btn-loading');
            generateBtn.textContent = 'Generate Code';
            generateBtn.style.opacity = '1';
            generateBtn.style.cursor = 'pointer';
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Generation error:', error);

        // Stop progress polling on error
        stopProgressPolling();
        hideProgress();

        // Reset button on error
        generateBtn.disabled = false;
        generateBtn.classList.remove('btn-loading');
        generateBtn.textContent = 'Generate Code';
        generateBtn.style.opacity = '1';
        generateBtn.style.cursor = 'pointer';
        showToast('Code generation failed: ' + error.message, 'error');
    }
}

// ================================================================================================
// MAIN FUNCTIONALITY - QA REVIEW CODE (WITH REAL PROGRESS)
// ================================================================================================

async function reviewCode() {
    console.log('🔍 Starting code review...');

    // CHANGED: Check for generated scripts instead of execution results
    if (generatedScripts.length === 0) {
        showToast('No generated scripts to review. Please generate Python code first!', 'warning');
        return;
    }

    const reviewBtn = document.getElementById('reviewBtn');
    if (!reviewBtn) return;

    reviewBtn.disabled = true;
    reviewBtn.classList.add('btn-loading');

    try {
        // Start real progress tracking
        startRealProgress('review', 'Reviewing Python Code Quality', [
            'Scanning Python code structure',
            'Analyzing syntax and PEP 8 compliance',
            'Checking Python best practices',
            'Running security analysis',
            'Generating Python recommendations',
            'Compiling final review report'
        ]);

        const response = await fetch('/review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });

        const result = await response.json();
        console.log('📋 Review result:', result);

        if (result.success) {
            // NEW: HIDE BULK DOWNLOAD CONTROLS IMMEDIATELY WHEN REVIEW STARTS
            console.log('🗂️ Hiding bulk download controls - transitioning to review state');
            hideBulkDownloadControls();
            // Pass the actual number of reviewed scripts
            const actualCount = result.individual_reports ? result.individual_reports.length : 1;
            updateAnalyticsCounter('qaTestsReviewed', actualCount);
            //updateAnalyticsCounter('qaTestsReviewed');

            // Also remove the compact trigger button completely
            const compactButton = document.getElementById('compactBulkDownloadContainer');
            if (compactButton) {
                compactButton.remove();
                console.log('🗂️ Removed compact bulk download button');
            }

            // Remove the full bulk download controls container
            const bulkControls = document.getElementById('bulkDownloadControls');
            if (bulkControls) {
                bulkControls.remove();
                console.log('🗂️ Removed bulk download controls container');
            }

            // NEW: Handle individual reports for multiple test cases
            if (result.individual_reports && result.individual_reports.length > 0) {
                console.log('📋 Processing individual reports for multiple test cases');

                // Update each text area with its individual report
                result.individual_reports.forEach((report, index) => {
                    const textarea = document.getElementById(`testArea${index}`);
                    if (textarea) {
                        const individualReview = `=== CODE REVIEW REPORT ===
Test Case: ${report.test_case_name}
Script: ${report.script_name}

${report.review_report}

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: CODE REVIEW COMPLETED SUCCESSFULLY. CHECK ERRORS/ISSUES BEFORE EXECUTION. ⚠️  ██
██ 🚀 CLICK "EXECUTE CODE" TO RUN THE REVIEWED TEST SCRIPTS IF THERE ARE NO STATIC CODE ANALYSIS ISSUE. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                        textarea.value = individualReview;
                        updateTestAreaCharCount(index);
                        autoResizeTestTextarea(index);
                    }
                });

                showToast(`Reviewed ${result.individual_reports.length} Python test scripts with individual analysis!`, 'success');
            }
            // Handle single test case or fallback to old behavior
            else {
                console.log('📋 Processing single test case or fallback review');

                // Update text areas with review reports (original behavior)
                generatedScripts.forEach((script, index) => {
                    const textarea = document.getElementById(`testArea${index}`);
                    if (textarea) {
                        const individualReview = `=== CODE REVIEW REPORT ===
Test Case: ${script.test_case_name}
Script: ${script.script_name}

${result.review_report || 'Review completed successfully.'}

=== INDIVIDUAL ANALYSIS ===
This review covers the specific test case: ${script.test_case_name}

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: CODE REVIEW COMPLETED SUCCESSFULLY. CHECK ERRORS/ISSUES BEFORE EXECUTION. ⚠️  ██
██ 🚀 CLICK "EXECUTE CODE" TO RUN THE REVIEWED TEST SCRIPTS IF THERE ARE NO STATIC CODE ANALYSIS ISSUE. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                        textarea.value = individualReview;
                        updateTestAreaCharCount(index);
                        autoResizeTestTextarea(index);
                    }
                });

                showToast(`Reviewed ${generatedScripts.length} Python test scripts successfully!`, 'success');
            }

            // Single test case handling (when only one script)
            if (generatedScripts.length === 1 && elements.textArea) {
                const singleScript = generatedScripts[0];
                const singleReview = `=== CODE REVIEW REPORT ===
Test Case: ${singleScript.test_case_name}
Script: ${singleScript.script_name}

${result.review_report || result.main_summary || 'Review completed successfully.'}

=== ACTIONS REQUIRED ===
   ✅ 1. Look for [PASS] ✅ or [FAIL] ❌ indicators in the analysis above
   ✅ 2. CHECK "OPEN REPORT" FOR COMPREHENSIVE HTML RESULTS
   ✅ 3. CLICK THE **"EXECUTE CODE"** BUTTON IF NO CRITICAL ISSUES
   ❌ 4. DO NOT PROCEED IF STATIC CODE ANALYSIS FAILS OR SECURITY VULNERABILITIES ARE FOUND
   
████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ ⚠️  IMPORTANT: CODE REVIEW COMPLETED SUCCESSFULLY. CHECK ERRORS/ISSUES BEFORE EXECUTION. ⚠️  ██
██ 🚀 CLICK "EXECUTE CODE" TO RUN THE REVIEWED TEST SCRIPT IF THERE ARE NO STATIC CODE ANALYSIS ISSUE. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

                elements.textArea.value = singleReview;
                updateCharCount();
                autoResizeTextarea();
            }

            // Update button states
            const generateBtn = document.getElementById('generateBtn');
            const executeBtn = document.getElementById('executeBtn');
            const ingestBtn = document.getElementById('ingestBtn');
            const reportButtons = document.getElementById('qareportButtons');

            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.6';
            }

            if (ingestBtn) {
                ingestBtn.disabled = true;
                ingestBtn.style.opacity = '0.6';
            }

            reviewBtn.disabled = true;
            reviewBtn.classList.remove('btn-loading');
            reviewBtn.textContent = 'Review Completed ✓';
            reviewBtn.style.opacity = '0.6';
            reviewBtn.style.cursor = 'not-allowed';

            // CHANGED: Enable execute button after successful review
            if (executeBtn) {
                executeBtn.disabled = false;
                executeBtn.style.opacity = '1';
                executeBtn.style.cursor = 'pointer';
            }

            if (reportButtons) reportButtons.classList.add('show');

            // NEW: Show execution checkboxes after review completion
            if (generatedScripts.length > 1) {
                showExecutionCheckboxes();
                console.log('✅ Execution checkboxes enabled after review completion');
            }

            // ADD THIS LINE: Hide save buttons after review completion
            hideSaveButtons();

        } else {
            // Stop progress polling on failure
            stopProgressPolling();
            hideProgress();

            // Reset button on failure
            reviewBtn.disabled = false;
            reviewBtn.classList.remove('btn-loading');
            reviewBtn.textContent = 'Review Code';
            reviewBtn.style.opacity = '1';
            reviewBtn.style.cursor = 'pointer';
            showToast(result.message, 'error');
        }

    } catch (error) {
        console.error('❌ Review error:', error);

        // Stop progress polling on error
        stopProgressPolling();
        hideProgress();

        // Reset button on error
        reviewBtn.disabled = false;
        reviewBtn.classList.remove('btn-loading');
        reviewBtn.textContent = 'Review Code';
        reviewBtn.style.opacity = '1';
        reviewBtn.style.cursor = 'pointer';
        showToast('Code review failed: ' + error.message, 'error');
    }
}

// ================================================================================================
// MAIN FUNCTIONALITY - EXECUTE CODE (WITH REAL PROGRESS)
// ================================================================================================
/*
async function executeCode() {
    console.log('🚀 Execute Code button clicked');

    try {
        // Check if we have any scripts to execute
        if (!generatedScripts || generatedScripts.length === 0) {
            showToast('No test scripts available for execution. Please generate scripts first.', 'error');
            return;
        }

        // FIXED: Different logic for single vs multiple tests
        let selectedTestIds;

        if (generatedScripts.length === 1) {
            // For single test case: always execute without selection requirement
            console.log('📝 Single test case detected - executing without selection');
            selectedTestIds = [generatedScripts[0].id];
        } else {
            // For multiple test cases: require selection
            if (selectedTestCases.size === 0) {
                showToast('Please select at least one test case for execution.', 'warning');
                return;
            }
            selectedTestIds = Array.from(selectedTestCases);
            console.log('📝 Multiple test cases - executing selected:', selectedTestIds);
        }

        // Disable execute button during execution
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.classList.add('btn-loading');
        }

        // Start real progress tracking
        const selectedCount = selectedTestIds.length;
        const totalCount = generatedScripts.length;

        let progressTitle = `Executing ${selectedCount} Selected Python Test${selectedCount > 1 ? 's' : ''}`;
        if (selectedCount === totalCount) {
            progressTitle = 'Executing All Python Tests';
        }

        startRealProgress('execute', progressTitle, [
            'Preparing Python execution environment',
            'Connecting to test infrastructure',
            'Running selected Python test cases',
            'Collecting test results',
            'Generating execution output'
        ]);

        console.log(`🎯 Executing ${selectedTestIds.length} test case(s):`, selectedTestIds);

        // Make the API call with selected test IDs
        const response = await fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_test_ids: selectedTestIds
            })
        });

        const result = await response.json();
        console.log('🚀 Execution result:', result);

        if (result.success) {
            // ✅ SUCCESS PATH - FIXED RESULT MAPPING
            // Store execution results
            executionResults = result.execution_results;

            // FIXED: Map results by test case ID instead of array index
            executionResults.forEach((execResult) => {
                // Find the textarea index that corresponds to this test case ID
                const scriptIndex = generatedScripts.findIndex(script => script.id === execResult.test_case_id);

                if (scriptIndex !== -1) {
                    const textarea = document.getElementById(`testArea${scriptIndex}`);
                    if (textarea) {
                        const executionOutput = `=== EXECUTION RESULTS ===
Test Case: ${execResult.test_case_name}
Script: ${execResult.script_name}
Connected Host: ${result.connected_host}
Execution Status: ${execResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${execResult.stdout}

STDERR:
${execResult.stderr}

=== EXECUTION COMPLETED ===
✅Test: ${execResult.test_case_name} Execution Done`;

                        textarea.value = executionOutput;
                        updateTestAreaCharCount(scriptIndex);
                        autoResizeTestTextarea(scriptIndex);
                    }
                } else {
                    console.warn(`Could not find textarea for test case ID ${execResult.test_case_id}`);
                }
            });

            // FIXED: Single test case handling using test case ID mapping
            if (executionResults.length === 1 && elements.textArea) {
                const singleResult = executionResults[0];
                const singleExecution = `=== EXECUTION RESULTS ===
Test Case: ${singleResult.test_case_name}
Script: ${singleResult.script_name}
Connected Host: ${result.connected_host}
Execution Status: ${singleResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${singleResult.stdout}

STDERR:
${singleResult.stderr}

=== EXECUTION COMPLETED ===
✅ Test Case Execution Completed`;

                elements.textArea.value = singleExecution;
                updateCharCount();
                autoResizeTextarea();
            }

            // Final button states for SUCCESS
            const generateBtn = document.getElementById('generateBtn');
            const reviewBtn = document.getElementById('reviewBtn');

            executeBtn.disabled = true;
            executeBtn.classList.remove('btn-loading');
            executeBtn.textContent = `Executed ${selectedCount} Test${selectedCount > 1 ? 's' : ''} ✓`;
            executeBtn.style.opacity = '0.6';
            executeBtn.style.cursor = 'not-allowed';

            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.6';
            }

            if (reviewBtn) {
                reviewBtn.disabled = true;
                reviewBtn.style.opacity = '0.6';
            }

            // Hide checkboxes after execution (only for multiple tests)
            if (generatedScripts.length > 1) {
                hideExecutionCheckboxes();
            }

            showToast(`Successfully executed ${selectedCount} test${selectedCount > 1 ? 's' : ''} out of ${totalCount} total!`, 'success');
            hideSaveButtons();

        } else {
            // Error handling - unchanged from your original
            console.error('❌ Execute failed:', result.message);
            stopProgressPolling();
            hideProgress();

            executeBtn.disabled = false;
            executeBtn.classList.remove('btn-loading');
            updateExecuteButtonState();

            if (result.message.includes('Raspberry Pi') ||
                result.message.includes('connection') ||
                result.message.includes('connect')) {
                showErrorModal(
                    'Test Execution Failed',
                    result.message,
                    'Unable to establish connection with the remote test infrastructure. Please verify that the Test devices are online and accessible from your network.'
                );
            } else {
                showToast(result.message, 'error');
            }
        }

    } catch (error) {
        // Error handling - unchanged from your original
        console.error('❌ Execution error:', error);
        stopProgressPolling();
        hideProgress();

        executeBtn.disabled = false;
        executeBtn.classList.remove('btn-loading');
        updateExecuteButtonState();

        if (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('connection') ||
            error.message.includes('Failed to fetch')) {
            showErrorModal(
                'Network Connection Error',
                'Failed to communicate with the test server.',
                `Technical Details: ${error.message}\n\nThis could be due to network connectivity issues or server unavailability.`
            );
        } else {
            showToast('Code execution failed: ' + error.message, 'error');
        }
    }
}
*/

// NEW FUNCTION: Parse execution output to determine actual test pass/fail status
function parseTestResult(executionOutput, scriptSuccess) {
    console.log('🔍 Parsing test result for pass/fail determination');

    const stdout = executionOutput.stdout || '';
    const stderr = executionOutput.stderr || '';
    const combinedOutput = (stdout + ' ' + stderr).toLowerCase();

    // If script didn't execute successfully at all, it's definitely a failure
    if (!scriptSuccess) {
        return {
            status: 'failed',
            reason: 'Script execution failed',
            color: '#ef4444',
            text: 'Failed ✗'
        };
    }

    // Define patterns that indicate test failure
    const failurePatterns = [
        /\[fail\]/i,
        /\[failed\]/i,
        /test.*fail/i,
        /fail.*test/i,
        /error:/i,
        /exception/i,
        /assertion.*fail/i,
        /test.*not.*pass/i,
        /does not match/i,
        /mismatch/i,
        /incorrect/i,
        /invalid/i,
        /test result:.*fail/i,
        /status:.*fail/i,
        /result:.*fail/i
    ];

    // Define patterns that indicate test success/pass
    const successPatterns = [
        /\[pass\]/i,
        /\[passed\]/i,
        /test.*pass/i,
        /pass.*test/i,
        /test.*success/i,
        /success.*test/i,
        /test result:.*completed/i,
        /test result:.*success/i,
        /test result:.*pass/i,
        /status:.*success/i,
        /status:.*pass/i,
        /result:.*success/i,
        /result:.*pass/i,
        /completed successfully/i,
        /test.*completed/i,
        /all.*tests.*pass/i
    ];

    // Check for explicit failure indicators first
    for (const pattern of failurePatterns) {
        if (pattern.test(combinedOutput)) {
            return {
                status: 'failed',
                reason: 'Test assertion failed',
                color: '#ef4444',
                text: 'Failed ✗'
            };
        }
    }

    // Check for explicit success indicators
    for (const pattern of successPatterns) {
        if (pattern.test(combinedOutput)) {
            return {
                status: 'passed',
                reason: 'Test completed successfully',
                color: '#22c55e',
                text: 'Passed ✓'
            };
        }
    }

    // Default: Script executed successfully but no clear pass/fail indicators
    return {
        status: 'executed',
        reason: 'Executed successfully (result unclear)',
        color: '#3b82f6',
        text: 'Executed ✓'
    };
}
// ================================================================================================
// ENHANCED EXECUTE CODE FUNCTION WITH STATUS INDICATORS
// ================================================================================================
/*
async function executeCode() {
    console.log('🚀 Execute Code button clicked');

    try {
        // Check if we have any scripts to execute
        if (!generatedScripts || generatedScripts.length === 0) {
            showToast('No test scripts available for execution. Please generate scripts first.', 'error');
            return;
        }

        // FIXED: Different logic for single vs multiple tests
        let selectedTestIds;

        if (generatedScripts.length === 1) {
            // For single test case: always execute without selection requirement
            console.log('📝 Single test case detected - executing without selection');
            selectedTestIds = [generatedScripts[0].id];
        } else {
            // For multiple test cases: require selection
            if (selectedTestCases.size === 0) {
                showToast('Please select at least one test case for execution.', 'warning');
                return;
            }
            selectedTestIds = Array.from(selectedTestCases);
            console.log('📝 Multiple test cases - executing selected:', selectedTestIds);
        }

        // Disable execute button during execution
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.classList.add('btn-loading');
        }

        // Start real progress tracking
        const selectedCount = selectedTestIds.length;
        const totalCount = generatedScripts.length;

        let progressTitle = `Executing ${selectedCount} Selected Python Test${selectedCount > 1 ? 's' : ''}`;
        if (selectedCount === totalCount) {
            progressTitle = 'Executing All Python Tests';
        }

        startRealProgress('execute', progressTitle, [
            'Preparing Python execution environment',
            'Connecting to test infrastructure',
            'Running selected Python test cases',
            'Collecting test results',
            'Generating execution output'
        ]);

        console.log(`🎯 Executing ${selectedTestIds.length} test case(s):`, selectedTestIds);

        // NEW: Add status indicators to headers BEFORE execution
        generatedScripts.forEach((script, index) => {
            const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
            if (testHeader) {
                // Remove any existing status indicators
                const existingStatus = testHeader.querySelector('.execution-status');
                if (existingStatus) {
                    existingStatus.remove();
                }

                // Add status indicator
                const statusDiv = document.createElement('div');
                statusDiv.className = 'execution-status';
                statusDiv.style.cssText = `
                    position: absolute;
                    top: 50%;
                    right: 60px;
                    transform: translateY(-50%);
                    background: ${selectedTestIds.includes(script.id) ? '#f59e0b' : '#6b7280'};
                    color: white;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    z-index: 10;
                `;
                statusDiv.textContent = selectedTestIds.includes(script.id) ? 'Executing...' : 'Not Selected';

                testHeader.appendChild(statusDiv);
            }
        });

        // Make the API call with selected test IDs
        const response = await fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_test_ids: selectedTestIds
            })
        });

        const result = await response.json();
        console.log('🚀 Execution result:', result);

        if (result.success) {
            // ✅ SUCCESS PATH - FIXED RESULT MAPPING
            // Store execution results
            executionResults = result.execution_results;

            // FIXED: Map results by test case ID instead of array index
            executionResults.forEach((execResult) => {
                // Find the textarea index that corresponds to this test case ID
                const scriptIndex = generatedScripts.findIndex(script => script.id === execResult.test_case_id);

                if (scriptIndex !== -1) {
                    const textarea = document.getElementById(`testArea${scriptIndex}`);
                    if (textarea) {
                        const executionOutput = `=== EXECUTION RESULTS ===
Test Case: ${execResult.test_case_name}
Script: ${execResult.script_name}
Connected Host: ${result.connected_host}
Execution Status: ${execResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${execResult.stdout}

STDERR:
${execResult.stderr}

=== EXECUTION COMPLETED ===
✅Test: ${execResult.test_case_name} Execution Done`;

                        textarea.value = executionOutput;
                        updateTestAreaCharCount(scriptIndex);
                        autoResizeTestTextarea(scriptIndex);
                    }

                    /*
                    // NEW: Update header status to show execution completed
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${scriptIndex + 2}) .test-area-header`);
                    if (testHeader) {
                        const statusDiv = testHeader.querySelector('.execution-status');
                        if (statusDiv) {
                            statusDiv.style.background = execResult.success ? '#22c55e' : '#ef4444';
                            statusDiv.textContent = execResult.success ? 'Executed ✓' : 'Failed ✗';
                        }
                    }*/
                    /*
                    // NEW: Update header status with smart pass/fail detection
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${scriptIndex + 2}) .test-area-header`);
                    if (testHeader) {
                        const statusDiv = testHeader.querySelector('.execution-status');
                        if (statusDiv) {
                            // Use smart parsing to determine actual test result
                            const smartResult = parseTestResult(execResult, execResult.success);
                            statusDiv.style.background = smartResult.color;
                            statusDiv.textContent = smartResult.text;
                            statusDiv.title = smartResult.reason; // Tooltip for details
                        }
                    }
                } else {
                    console.warn(`Could not find textarea for test case ID ${execResult.test_case_id}`);
                }
            });

            // NEW: Update headers for NON-EXECUTED test cases
            generatedScripts.forEach((script, index) => {
                if (!selectedTestIds.includes(script.id)) {
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
                    if (testHeader) {
                        const statusDiv = testHeader.querySelector('.execution-status');
                        if (statusDiv) {
                            statusDiv.style.background = '#6b7280';
                            statusDiv.textContent = 'Not Executed, showing Code Review Results';
                            statusDiv.style.fontSize = '1.0rem'; // Slightly smaller for longer text
                            statusDiv.style.padding = '4px 8px';
                        }
                    }
                }
            });

            // FIXED: Single test case handling using test case ID mapping
            if (executionResults.length === 1 && elements.textArea) {
                const singleResult = executionResults[0];
                const singleExecution = `=== EXECUTION RESULTS ===
Test Case: ${singleResult.test_case_name}
Script: ${singleResult.script_name}
Connected Host: ${result.connected_host}
Execution Status: ${singleResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${singleResult.stdout}

STDERR:
${singleResult.stderr}

=== EXECUTION COMPLETED ===
✅ Test Case Execution Completed`;

                elements.textArea.value = singleExecution;
                updateCharCount();
                autoResizeTextarea();
            }

            // Final button states for SUCCESS
            const generateBtn = document.getElementById('generateBtn');
            const reviewBtn = document.getElementById('reviewBtn');

            executeBtn.disabled = true;
            executeBtn.classList.remove('btn-loading');
            executeBtn.textContent = `Executed ${selectedCount} Test${selectedCount > 1 ? 's' : ''} ✓`;
            executeBtn.style.opacity = '0.6';
            executeBtn.style.cursor = 'not-allowed';

            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.6';
            }

            if (reviewBtn) {
                reviewBtn.disabled = true;
                reviewBtn.style.opacity = '0.6';
            }

            // Hide checkboxes after execution (only for multiple tests)
            if (generatedScripts.length > 1) {
                hideExecutionCheckboxes();
            }

            showToast(`Successfully executed ${selectedCount} test${selectedCount > 1 ? 's' : ''} out of ${totalCount} total!`, 'success');
            hideSaveButtons();

        } else {
            // Error handling - reset status indicators on failure
            generatedScripts.forEach((script, index) => {
                const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
                if (testHeader) {
                    const statusDiv = testHeader.querySelector('.execution-status');
                    if (statusDiv) {
                        statusDiv.style.background = '#ef4444';
                        statusDiv.textContent = 'Execution Failed';
                    }
                }
            });

            console.error('❌ Execute failed:', result.message);
            stopProgressPolling();
            hideProgress();

            executeBtn.disabled = false;
            executeBtn.classList.remove('btn-loading');
            updateExecuteButtonState();

            if (result.message.includes('Raspberry Pi') ||
                result.message.includes('connection') ||
                result.message.includes('connect')) {
                showErrorModal(
                    'Test Execution Failed',
                    result.message,
                    'Unable to establish connection with the remote test infrastructure. Please verify that the Test devices are online and accessible from your network.'
                );
            } else {
                showToast(result.message, 'error');
            }
        }

    } catch (error) {
        // Error handling - reset status indicators on error
        generatedScripts.forEach((script, index) => {
            const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
            if (testHeader) {
                const statusDiv = testHeader.querySelector('.execution-status');
                if (statusDiv) {
                    statusDiv.style.background = '#ef4444';
                    statusDiv.textContent = 'Connection Error';
                }
            }
        });

        console.error('❌ Execution error:', error);
        stopProgressPolling();
        hideProgress();

        executeBtn.disabled = false;
        executeBtn.classList.remove('btn-loading');
        updateExecuteButtonState();

        if (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('connection') ||
            error.message.includes('Failed to fetch')) {
            showErrorModal(
                'Network Connection Error',
                'Failed to communicate with the test server.',
                `Technical Details: ${error.message}\n\nThis could be due to network connectivity issues or server unavailability.`
            );
        } else {
            showToast('Code execution failed: ' + error.message, 'error');
        }
    }
}
*/
// UPDATED: Main execute function with device selection
async function executeCode() {
    console.log('🚀 Execute Code button clicked');

    try {
        // Check if we have any scripts to execute
        if (!generatedScripts || generatedScripts.length === 0) {
            showToast('No test scripts available for execution. Please generate scripts first.', 'error');
            return;
        }

        // Load available devices first
        await loadAvailableDevices();

        if (availableDevices.length === 0) {
            showToast('No devices available for execution. Please check device configuration.', 'error');
            return;
        }

        // Show device selection modal
        createDeviceSelectionModal();

    } catch (error) {
        console.error('❌ Error in executeCode:', error);
        showToast('Failed to initialize execution: ' + error.message, 'error');
    }
}

// NEW: Actual execution function with selected device
async function executeCodeWithSelectedDevice() {
    console.log('🚀 Starting execution with selected device');

    try {
        // Get the selected device ID from the modal (before it gets closed)
        //const selectedDeviceRadio = document.querySelector('input[name="selectedDevice"]:checked');
        //const currentSelectedDeviceId = selectedDeviceRadio ? selectedDeviceRadio.value : selectedDeviceId;
        const currentSelectedDeviceId = window.confirmedDeviceId;

        console.log('🔍 Device ID found:', currentSelectedDeviceId);

        if (!currentSelectedDeviceId) {
            showToast('No device selected', 'error');
            return;
        }

        // Check if we're in multi-ticket mode
        if (window.multiTicketSelectedIndices && window.multiTicketSelectedIndices.length > 0) {
            console.log('🎫 Multi-ticket execution mode detected');
            await executeMultiTicketCode(window.multiTicketSelectedIndices, currentSelectedDeviceId);
            return;
        }

        // FIXED: Different logic for single vs multiple tests
        let selectedTestIds;

        if (generatedScripts.length === 1) {
            // For single test case: always execute without selection requirement
            console.log('📝 Single test case detected - executing without selection');
            selectedTestIds = [generatedScripts[0].id];
        } else {
            // For multiple test cases: require selection
            if (selectedTestCases.size === 0) {
                showToast('Please select at least one test case for execution.', 'warning');
                return;
            }
            selectedTestIds = Array.from(selectedTestCases);
            console.log('📝 Multiple test cases - executing selected:', selectedTestIds);
        }

        // Disable execute button during execution
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.classList.add('btn-loading');
        }

        // Start real progress tracking
        const selectedCount = selectedTestIds.length;
        const totalCount = generatedScripts.length;

        let progressTitle = `Executing ${selectedCount} Selected Python Test${selectedCount > 1 ? 's' : ''}`;
        if (selectedCount === totalCount) {
            progressTitle = 'Executing All Python Tests';
        }

        startRealProgress('execute', progressTitle, [
            'Preparing Python execution environment',
            'Connecting to selected test device',
            'Running selected Python test cases',
            'Collecting test results',
            'Generating execution output'
        ]);

        console.log(`🎯 Executing ${selectedTestIds.length} test case(s):`, selectedTestIds);

        // NEW: Add status indicators to headers BEFORE execution
        generatedScripts.forEach((script, index) => {
            const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
            if (testHeader) {
                // Remove any existing status indicators
                const existingStatus = testHeader.querySelector('.execution-status');
                if (existingStatus) {
                    existingStatus.remove();
                }

                // CREATE a new status div
                const statusDiv = document.createElement('div');
                statusDiv.className = 'execution-status';
                statusDiv.style.cssText = `
                    position: absolute;
                    top: 50%;
                    right: 60px;
                    transform: translateY(-50%);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    z-index: 10;
                `;

                // Set initial status based on selection
                if (selectedTestIds.includes(script.id)) {
                    statusDiv.style.background = '#f59e0b'; // Amber/yellow for executing
                    statusDiv.textContent = 'Executing...';
                    statusDiv.style.animation = 'pulse 2s infinite'; // Add pulsing animation
                } else {
                    statusDiv.style.background = '#6b7280'; // Gray for not selected
                    statusDiv.textContent = 'Not Selected';
                }

                testHeader.appendChild(statusDiv);
            }
        });

        // Make the API call with selected test IDs and device
        const response = await fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_test_ids: selectedTestIds,
                selected_device_id: selectedDeviceId  // NEW: Include selected device
            })
        });

        const result = await response.json();
        console.log('🚀 Execution result:', result);

        if (result.success) {
            // ✅ SUCCESS PATH - FIXED RESULT MAPPING
            // Store execution results
            executionResults = result.execution_results;
        	document.getElementById('DevScriptsPassed').textContent = result.DevScriptsPassed || 0;
        	document.getElementById('DevScriptsFailed').textContent = result.DevScriptsFailed || 0;
        	document.getElementById('QAScriptsPassed').textContent = result.QAScriptsPassed || 0;
        	document.getElementById('QAScriptsFailed').textContent = result.QAScriptsFailed || 0;


        	analyticsData.devscriptspassed = result.DevScriptsPassed;
        	analyticsData.devscriptsfailed = result.DevScriptsFailed;
        	analyticsData.qascriptspassed = result.QAScriptsPassed;
        	analyticsData.qascriptsfailed = result.QAScriptsFailed;

            // Show device information in toast
            if (result.connected_device) {
                showToast(`✅ Executed on ${result.connected_device.name} (${result.connected_device.host})`, 'success');
            }

            // FIXED: Map results by test case ID instead of array index
            executionResults.forEach((execResult) => {
                // Find the textarea index that corresponds to this test case ID
                const scriptIndex = generatedScripts.findIndex(script => script.id === execResult.test_case_id);

                if (scriptIndex !== -1) {
                    const textarea = document.getElementById(`testArea${scriptIndex}`);
                    if (textarea) {
                        const executionOutput = `=== EXECUTION RESULTS ===
Test Case: ${execResult.test_case_name}
Script: ${execResult.script_name}
Device: ${result.connected_device ? result.connected_device.name : 'Unknown'} (${result.connected_device ? result.connected_device.host : 'Unknown'})
Execution Status: ${execResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${execResult.stdout}

STDERR:
${execResult.stderr}

=== EXECUTION COMPLETED ===
✅Test: ${execResult.test_case_name} Execution Done`;

                        textarea.value = executionOutput;
                        updateTestAreaCharCount(scriptIndex);
                        autoResizeTestTextarea(scriptIndex);
                    }

                    // NEW: Update header status with smart pass/fail detection
                    /*
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${scriptIndex + 2}) .test-area-header`);
                    if (testHeader) {
                        const statusDiv = testHeader.querySelector('.execution-status');
                        if (statusDiv) {
                            // Use smart parsing to determine actual test result
                            const smartResult = parseTestResult(execResult, execResult.success);
                            statusDiv.style.background = smartResult.color;
                            statusDiv.textContent = smartResult.text;
                            statusDiv.title = smartResult.reason; // Tooltip for details
                        }
                    }*/
                    // NEW: Update header status with smart pass/fail detection
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${scriptIndex + 2}) .test-area-header`);
                    if (testHeader) {
                        let statusDiv = testHeader.querySelector('.execution-status');

                        // CREATE the status div if it doesn't exist
                        if (!statusDiv) {
                            statusDiv = document.createElement('div');
                            statusDiv.className = 'execution-status';
                            statusDiv.style.cssText = `
                                position: absolute;
                                top: 50%;
                                right: 60px;
                                transform: translateY(-50%);
                                color: white;
                                padding: 4px 12px;
                                border-radius: 15px;
                                font-size: 0.8rem;
                                font-weight: 600;
                                z-index: 10;
                            `;
                            testHeader.appendChild(statusDiv);
                        }

                        // Update with smart pass/fail detection
                        const smartResult = parseTestResult(execResult, execResult.success);
                        statusDiv.style.background = smartResult.color;
                        statusDiv.textContent = smartResult.text;
                        statusDiv.title = smartResult.reason; // Tooltip for details
                    }
                } else {
                    console.warn(`Could not find textarea for test case ID ${execResult.test_case_id}`);
                }
            });

            analyticsData.devscriptspassed = result.DevScriptsPassed;
            analyticsData.devscriptsfailed = result.DevScriptsFailed;
            analyticsData.qascriptspassed = result.QAScriptsPassed;
            analyticsData.qascriptsfailed = result.QAScriptsFailed;


            document.getElementById('DevScriptsPassed').textContent = result.DevScriptsPassed || 0;
            document.getElementById('DevScriptsFailed').textContent = result.DevScriptsFailed || 0;
            document.getElementById('QAScriptsPassed').textContent = result.QAScriptsPassed || 0;
            document.getElementById('QAScriptsFailed').textContent = result.QAScriptsFailed || 0;



                //document.getElementById('DevScriptsPassed').textContent =  analyticsData.devscriptspassed|| 0;
                //document.getElementById('DevScriptsFailed').textContent = analyticsData.devscriptsfailed || 0;
                //document.getElementById('QAScriptsPassed').textContent = analyticsData.devscriptspassed || 0;
                //document.getElementById('QAScriptsFailed').textContent = analyticsdata.devscriptsfailed || 0;
          


            /*
            // NEW: Update headers for NON-EXECUTED test cases
            generatedScripts.forEach((script, index) => {
                if (!selectedTestIds.includes(script.id)) {
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
                    if (testHeader) {
                        const statusDiv = testHeader.querySelector('.execution-status');
                        if (statusDiv) {
                            statusDiv.style.background = '#6b7280';
                            statusDiv.textContent = 'Not Executed, showing Code Review Results';
                            statusDiv.style.fontSize = '1.0rem'; // Slightly smaller for longer text
                            statusDiv.style.padding = '4px 8px';
                        }
                    }
                }
            });
             */
            // NEW: Update headers for NON-EXECUTED test cases
            generatedScripts.forEach((script, index) => {
                if (!selectedTestIds.includes(script.id)) {
                    const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
                    if (testHeader) {
                        let statusDiv = testHeader.querySelector('.execution-status');

                        // CREATE the status div if it doesn't exist
                        if (!statusDiv) {
                            statusDiv = document.createElement('div');
                            statusDiv.className = 'execution-status';
                            statusDiv.style.cssText = `
                                position: absolute;
                                top: 50%;
                                right: 60px;
                                transform: translateY(-50%);
                                color: white;
                                padding: 4px 8px;
                                border-radius: 15px;
                                font-size: 0.8rem;
                                font-weight: 600;
                                z-index: 10;
                            `;
                            testHeader.appendChild(statusDiv);
                        }

                        // Update for non-executed status
                        statusDiv.style.background = '#6b7280';
                        statusDiv.textContent = 'Not Executed, showing Code Review Results';
                        statusDiv.style.fontSize = '1.0rem'; // Smaller for longer text
                        statusDiv.style.padding = '4px 8px';
                    }
                }
            });

            // FIXED: Single test case handling using test case ID mapping
            if (executionResults.length === 1 && elements.textArea) {
                const singleResult = executionResults[0];
                const singleExecution = `=== EXECUTION RESULTS ===
Test Case: ${singleResult.test_case_name}
Script: ${singleResult.script_name}
Device: ${result.connected_device ? result.connected_device.name : 'Unknown'} (${result.connected_device ? result.connected_device.host : 'Unknown'})
Execution Status: ${singleResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${singleResult.stdout}

STDERR:
${singleResult.stderr}

=== EXECUTION COMPLETED ===
✅ Test Case Execution Completed`;

                elements.textArea.value = singleExecution;
                updateCharCount();
                autoResizeTextarea();
            }

            // Final button states for SUCCESS
            const generateBtn = document.getElementById('generateBtn');
            const reviewBtn = document.getElementById('reviewBtn');

            executeBtn.disabled = true;
            executeBtn.classList.remove('btn-loading');
            executeBtn.textContent = `Executed ${selectedCount} Test${selectedCount > 1 ? 's' : ''} ✓`;
            executeBtn.style.opacity = '0.6';
            executeBtn.style.cursor = 'not-allowed';

            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.style.opacity = '0.6';
            }

            if (reviewBtn) {
                reviewBtn.disabled = true;
                reviewBtn.style.opacity = '0.6';
            }

            // Hide checkboxes after execution (only for multiple tests)
            if (generatedScripts.length > 1) {
                hideExecutionCheckboxes();
            }

            showToast(`Successfully executed ${selectedCount} test${selectedCount > 1 ? 's' : ''} out of ${totalCount} total!`, 'success');
            hideSaveButtons();

        } else {
            // Error handling - reset status indicators on failure
            generatedScripts.forEach((script, index) => {
                const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
                if (testHeader) {
                    const statusDiv = testHeader.querySelector('.execution-status');
                    if (statusDiv) {
                        statusDiv.style.background = '#ef4444';
                        statusDiv.textContent = 'Execution Failed';
                    }
                }
            });

            console.error('❌ Execute failed:', result.message);
            stopProgressPolling();
            hideProgress();

            executeBtn.disabled = false;
            executeBtn.classList.remove('btn-loading');
            updateExecuteButtonState();

            if (result.message.includes('device') ||
                result.message.includes('connection') ||
                result.message.includes('connect')) {
                showErrorModal(
                    'Test Execution Failed',
                    result.message,
                    'Unable to establish connection with the selected test device. Please verify that the device is online and accessible from your network.'
                );
            } else {
                showToast(result.message, 'error');
            }
        }

    } catch (error) {
        // Error handling - reset status indicators on error
        generatedScripts.forEach((script, index) => {
            const testHeader = document.querySelector(`#multiTestAreas .test-area-group:nth-child(${index + 2}) .test-area-header`);
            if (testHeader) {
                const statusDiv = testHeader.querySelector('.execution-status');
                if (statusDiv) {
                    statusDiv.style.background = '#ef4444';
                    statusDiv.textContent = 'Connection Error';
                }
            }
        });

        console.error('❌ Execution error:', error);
        stopProgressPolling();
        hideProgress();

        executeBtn.disabled = false;
        executeBtn.classList.remove('btn-loading');
        updateExecuteButtonState();

        if (error.message.includes('fetch') ||
            error.message.includes('network') ||
            error.message.includes('connection') ||
            error.message.includes('Failed to fetch')) {
            showErrorModal(
                'Network Connection Error',
                'Failed to communicate with the test server.',
                `Technical Details: ${error.message}\n\nThis could be due to network connectivity issues or server unavailability.`
            );
        } else {
            showToast('Code execution failed: ' + error.message, 'error');
        }
    }
}

// NEW: Multi-ticket execution function
async function executeMultiTicketCode(selectedIndices, deviceId) {
    console.log(`🎫 Executing ${selectedIndices.length} tickets on device: ${deviceId}`);

    // Find the device object
    const selectedDevice = availableDevices.find(d => d.id === deviceId);

    if (!selectedDevice) {
        showToast('Selected device not found', 'error');
        console.error('❌ Device not found in availableDevices:', availableDevices);
        return;
    }

    console.log('✅ Found device:', selectedDevice.name);

    // Close the device selection modal
    closeDeviceSelectionModal();

    // Show progress
    startDeveloperProgress('execute', `Executing ${selectedIndices.length} tickets on ${selectedDevice.name}`, [
        'Preparing code for execution',
        'Connecting to remote device',
        'Running code on device',
        'Collecting execution results',
        'Updating ticket results'
    ]);

    try {

        // Execute each ticket sequentially
        for (let i = 0; i < selectedIndices.length; i++) {
            const ticketIndex = selectedIndices[i];
            const ticket = ticketResults[ticketIndex];

             updateDeveloperProgress((i / selectedIndices.length) * 80,
                         `Executing ${ticket.ticket_id} (${i + 1}/${selectedIndices.length})`,
                         Math.min(i + 2, 4)); // Step index for progress steps

            // Get the main code from the textarea
            const mainTextarea = document.getElementById(`mainArea${ticketIndex}`);
            if (mainTextarea && mainTextarea.value.trim()) {

                // Prepare code for this ticket
                const codeToExecute = [{
                    file_name: `${ticket.ticket_id}_main_implementation.py`,
                    generated_code: mainTextarea.value.trim(),
                    story_id: ticket.ticket_id,
                    story_title: `Execution for ${ticket.ticket_id}`
                }];

                // Store code for execution using existing function
                await fetch('/store_generated_code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ generated_code: codeToExecute })
                });

                // Execute using your existing backend endpoint
                const response = await fetch('/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selected_device_id: deviceId,
                        workflow_type: 'developer'
                    })
                });

                const result = await response.json();

                // Update this ticket's textarea with results
                //displayDeveloperExecutionResults(result)
                console.log('🔍 Frontend DEBUG - Result:', result);
                updateTicketWithExecutionResults(ticketIndex, result, selectedDevice);


                // Small delay between executions
                await delay(1000);
            }
        }

        updateDeveloperProgress(100, `All ${selectedIndices.length} tickets executed`, 4);
        showToast(`✅ Executed ${selectedIndices.length} tickets on ${selectedDevice.name}`, 'success');

    } catch (error) {
        console.error('Multi-ticket execution error:', error);
        showToast(`Execution failed: ${error.message}`, 'error');
    } finally {
        // FIXED: Use hideDeveloperProgress instead of hideProgress
        setTimeout(() => {
            hideDeveloperProgress();
        }, 2000);
        // Clean up
        window.multiTicketSelectedIndices = null;
    }
}


// NEW: Update individual ticket textarea with execution results
function updateTicketWithExecutionResults(ticketIndex, executionResult, device) {
    console.log('🔍 Frontend DEBUG - executionResult:', executionResult);
    console.log('🔍 Frontend DEBUG - executionResult.success:', executionResult.success);
    console.log('🔍 Frontend DEBUG - typeof success:', typeof executionResult.success);
    const textarea = document.getElementById(`mainArea${ticketIndex}`);
    if (!textarea) return;

    // CLEAR the textarea first (removes code review results)
    textarea.value = '';

    const ticket = ticketResults[ticketIndex];
    const timestamp = new Date().toLocaleString();
    const executionData = executionResult.execution_results?.[0] || {};

    const resultOutput = `=== EXECUTION RESULTS FOR ${ticket.ticket_id} ===
Executed: ${timestamp}
Device: ${device.name} (${device.host})
Status: ${executionResult.success ? 'SUCCESS ✅' : 'FAILED ❌'}

=== EXECUTION OUTPUT ===
STDOUT:
${executionData.stdout || 'No output'}

STDERR:
${executionData.stderr || 'No errors'}

=== SUMMARY ===
${executionResult.success ? 
    '✅ Code executed successfully on remote device' : 
    '❌ Execution failed - check errors above'}

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ 🚀 ${ticket.ticket_id} EXECUTION COMPLETED - CHECK RESULTS ABOVE 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

    textarea.value = resultOutput;
    updateTicketCharCount(ticketIndex, 'main');

    // Update ticket status using your existing function
    updateTicketStatus(ticketIndex,
                     executionResult.success ? 'Executed ✅' : 'Failed ❌',
                     executionResult.success ? '#22c55e' : '#ef4444');
}

// ===========================================
// BUILD AND DEPLOY (PREVIEW ONLY)
//============================================
function deployCode() {
    console.log('🚀 Deploy Code button clicked - showing deploy workflow preview');

    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'deployModalOverlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(5px);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        animation: fadeIn 0.3s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        position: relative;
        animation: slideInScale 0.4s ease-out;
    `;

    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="margin: 0 0 10px 0; color: #1f2937; font-size: 1.8rem; font-weight: 700;">
                🚀 Build & Deploy Workflow
            </h2>
            <p style="margin: 0; color: #6b7280; font-size: 1rem; font-weight: 500;">
                (Preview Only)
            </p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 25px; margin-bottom: 25px; border-left: 4px solid #3b82f6;">
            <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 1.3rem; font-weight: 600;">
                🔨 BUILD PROCESS
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
                <li style="margin-bottom: 8px;">Checkout code from Git repository</li>
                <li style="margin-bottom: 8px;">Install dependencies (pip install -r requirements.txt)</li>
                <li style="margin-bottom: 8px;">Lint & format code (flake8, black, pylint)</li>
                <li style="margin-bottom: 8px;">Run unit tests and generate coverage reports</li>
                <li style="margin-bottom: 8px;">Package application (.whl, Docker image, or distribution)</li>
            </ul>
        </div>

        <div style="background: #f0fdf4; border-radius: 12px; padding: 25px; margin-bottom: 30px; border-left: 4px solid #10b981;">
            <h3 style="margin: 0 0 15px 0; color: #059669; font-size: 1.3rem; font-weight: 600;">
                🚀 DEPLOY PROCESS
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.6;">
                <li style="margin-bottom: 8px;">Push artifacts to registry (Docker Hub, PyPI, etc.)</li>
                <li style="margin-bottom: 8px;">Configure environment (secrets, variables, configs)</li>
                <li style="margin-bottom: 8px;">Deploy to target environment (server/container/cloud)</li>
                <li style="margin-bottom: 8px;">Run health checks and smoke tests</li>
                <li style="margin-bottom: 8px;">Monitor deployment logs and application metrics</li>
            </ul>
        </div>

        <div style="background: #fef3c7; border-radius: 10px; padding: 15px; margin-bottom: 25px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #92400e; font-size: 0.9rem; font-weight: 500;">
                <strong>⚠️ Note:</strong> This is a preview of the deployment workflow. 
                Actual deployment would require CI/CD pipeline configuration and target environment setup.
            </p>
        </div>

        <div style="text-align: center;">
            <button id="closeDeployModal" style="
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 10px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(99, 102, 241, 0.4)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(99, 102, 241, 0.3)'">
                ✕ Close
            </button>
        </div>
    `;

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // Add event listeners
    const closeButton = document.getElementById('closeDeployModal');
    closeButton.addEventListener('click', closeDeployModal);

    // Close modal when clicking outside
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeDeployModal();
        }
    });

    // Close modal with Escape key
    const handleEscape = function(e) {
        if (e.key === 'Escape') {
            closeDeployModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    console.log('✅ Deploy workflow modal displayed');
}

function closeDeployModal() {
    console.log('🔒 Closing deploy modal');

    const modalOverlay = document.getElementById('deployModalOverlay');
    if (modalOverlay) {
        // Add fade out animation
        modalOverlay.style.animation = 'fadeOut 0.3s ease-out';

        setTimeout(() => {
            modalOverlay.remove();
            console.log('✅ Deploy modal closed and removed from DOM');
        }, 300);
    }
}

// ================================================================================================
// INDIVIDUAL TEST CASE FUNCTIONS
// ================================================================================================

function saveTestCode(index) {
    console.log(`💾 Saving test code for index: ${index}`);

    const textarea = document.getElementById(`testArea${index}`);
    if (!textarea) return;

    const code = textarea.value.trim();
    if (!code) {
        showToast('No code to save!', 'warning');
        return;
    }

    const script = generatedScripts[index];

    fetch('/save_code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code: code,
            test_case_id: script.id,
            test_case_name: script.test_case_name
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(`Test Case ${script.id} saved successfully!`, 'success');
        } else {
            showToast(`Save failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error saving code:', error);
        showToast('Error saving code', 'error');
    });
}

function downloadTestCode(index) {
    console.log(`📥 Downloading test code for index: ${index}`);

    const textarea = document.getElementById(`testArea${index}`);
    if (!textarea) return;

    const code = textarea.value.trim();
    if (!code) {
        showToast('No code to download!', 'warning');
        return;
    }
    //debug code - gourabm
    const codeMarker = '# Generated Python Test Code';
    const resultMarker = '=== EXECUTION RESULTS ===';
    const reviewMarker = "=== CODE REVIEW REPORT ==="

    let fileType = 'text/plain';
    let fileExtension = '.txt';
    let fileNamePrefix = "";
    let contentToDownload = code;

    if (code.includes(codeMarker)) {
        const codeStartIndex = code.indexOf(codeMarker);
        contentToDownload = code.substring(codeStartIndex);
        fileType = 'text/x-python';
        fileExtension = '.py';
        fileNamePrefix = 'generated-test-code';
    } else if (code.includes(resultMarker)) {
        fileNamePrefix = 'execution-results';
        const resultStartIndex = code.indexOf(resultMarker);
        contentToDownload = code.substring(resultStartIndex);
    } else if (code.includes(reviewMarker)) {
        fileNamePrefix = 'review-results';
        const resultStartIndex = code.indexOf(reviewMarker);
        contentToDownload = code.substring(resultStartIndex);
    } else {
        showToast('No recognizable content to download!', 'warning');
        return;
    }

    const script = generatedScripts[index];
    const element = document.createElement('a');
    const file = new Blob([contentToDownload], { type: fileType });
    element.href = URL.createObjectURL(file);
    element.download = `${fileNamePrefix}-${new Date().toISOString().slice(0,10)}${fileExtension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${fileNamePrefix} ${script.id} downloaded successfully!`, 'success');
}

// ================================================================================================
// ORIGINAL CODE ACTIONS (FALLBACK FOR SINGLE TEXTAREA)
// ================================================================================================

function saveCode() {
    console.log('💾 Saving code (single textarea mode)');

    if (!elements.textArea) return;

    const code = elements.textArea.value.trim();
    if (!code) {
        showToast('No code to save!', 'warning');
        return;
    }

    // Save to localStorage as backup
    localStorage.setItem('dashboard_code', code);
    localStorage.setItem('dashboard_code_timestamp', new Date().toISOString());

    fetch('/save_code', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(`${data.message}`, 'success');
        } else {
            showToast(`Save failed: ${data.message}`, 'error');
        }
    })
    .catch(error => {
        console.error('❌ Error saving code:', error);
        showToast('Error saving code to file', 'error');
        showToast('Code saved to browser storage only', 'warning');
    });
}

function downloadCode() {
    console.log('📥 Downloading code (single textarea mode)');

    if (!elements.textArea) return;

    const fullText = elements.textArea.value.trim();

    if (!fullText) {
        showToast('No code to download!', 'warning');
        return;
    }

    const codeMarker = '# Generated Python Test Code';
    const resultMarker = '=== EXECUTION RESULTS ===';
    const reviewMarker = '=== CODE REVIEW REPORT ===';

    let fileType = 'text/plain';
    let fileExtension = '.txt';
    let fileNamePrefix = '';
    let contentToDownload = fullText;

    if (fullText.includes(codeMarker)) {
        const codeStartIndex = fullText.indexOf(codeMarker);
        contentToDownload = fullText.substring(codeStartIndex);
        fileType = 'text/x-python';
        fileExtension = '.py';
        fileNamePrefix = 'generated-test-code';
    } else if (fullText.includes(resultMarker)) {
        fileNamePrefix = 'execution-results';
        const resultStartIndex = fullText.indexOf(resultMarker);
        contentToDownload = fullText.substring(resultStartIndex);
    } else if (fullText.includes(reviewMarker)) {
        fileNamePrefix = 'review-results';
        const resultStartIndex = fullText.indexOf(reviewMarker);
        contentToDownload = fullText.substring(resultStartIndex);
    } else {
        showToast('No recognizable content to download!', 'warning');
        return;
    }

    const element = document.createElement('a');
    const file = new Blob([contentToDownload], { type: fileType });
    element.href = URL.createObjectURL(file);
    element.download = `${fileNamePrefix}-${new Date().toISOString().slice(0,10)}${fileExtension}`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${fileExtension} file downloaded successfully!`, 'success');
}

// ================================================================================================
// REPORT FUNCTIONS
// ================================================================================================

async function openReport() {
    console.log('📊 Opening report...');

    try {
        const response = await fetch('/open-report', { method: 'HEAD' });
        if (!response.ok) {
            showToast('Report not found on server.', 'error');
            return;
        }
        window.open('/open-report', '_blank');
        showToast('Report opened in new tab', 'success');
    } catch (err) {
        console.error('❌ Failed to open report:', err);
        showToast('Failed to open report.', 'error');
    }
}

async function downloadReport() {
    console.log('📥 Downloading report...');

    try {
        const response = await fetch('/download-report', { method: 'HEAD' });
        if (!response.ok) {
            showToast('Report not found on server.', 'error');
            return;
        }
        const link = document.createElement('a');
        link.href = '/download-report';
        link.download = 'combinedreport.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Report download started.', 'success');
    } catch (err) {
        console.error('❌ Failed to download report:', err);
        showToast('Failed to download report.', 'error');
    }
}
// Tab Editor Functions

// Show the tab editor container
function showTabEditor() {
    console.log('📝 Showing tab-based editor');

    const container = document.getElementById('tabEditorContainer');
    if (container) {
        container.style.display = 'block';

        // Insert into the generated code container area
        const generatedCodeContainer = document.getElementById('generatedCodeContainer');
        if (generatedCodeContainer) {
            generatedCodeContainer.innerHTML = '';
            generatedCodeContainer.appendChild(container);
            generatedCodeContainer.style.display = 'block';
        }
    }
}

/*// Switch between tabs
function switchTab(tabName) {
    console.log(`🔄 Switching to ${tabName} tab`);

    // Update tab headers
    document.querySelectorAll('.tab-header').forEach(header => {
        header.classList.remove('active');
    });
    document.querySelector(`.tab-header[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');

    // Update character count for active tab
    updateTabCharCount(tabName);
}
*/

function switchTab(tabName) {
    console.log(`🔄 Switching to ${tabName} tab`);

    // Update tab headers
    document.querySelectorAll('.tab-header').forEach(header => {
        header.classList.remove('active');
    });
    const targetHeader = document.querySelector(`.tab-header[data-tab="${tabName}"]`);
    if (targetHeader) {
        targetHeader.classList.add('active');
    }

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const targetContent = document.querySelector(`.tab-content[data-tab="${tabName}"]`);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    // Update character count for active tab
    updateTabCharCount(tabName);
}

// Update character count for a specific tab
function updateTabCharCount(tabName) {
    const textarea = document.getElementById(`${tabName}TabTextarea`);
    const charCount = document.getElementById(`${tabName}CharCount`);

    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count.toLocaleString()} characters`;
    }
}

// Display prompt in the prompt tab
function displayPromptInTab(promptData) {
    console.log('📝 Displaying prompt in tab editor');

    const promptTextarea = document.getElementById('promptTabTextarea');
    const promptInfo = document.getElementById('promptInfo');
    const promptStatus = document.getElementById('promptStatus');

    if (promptTextarea) {
        promptTextarea.value = promptData;
        updateTabCharCount('prompt');

        // Auto-resize if needed
        promptTextarea.style.height = 'auto';
        promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, 500) + 'px';
    }

    if (promptInfo) {
        promptInfo.textContent = `Generated ${new Date().toLocaleString()} - Ready for AI processing`;
    }

    if (promptStatus) {
        promptStatus.textContent = '✅ Ready for code generation';
        promptStatus.className = 'status-indicator success';
    }

    // Show the tab editor
    showTabEditor();

    // Make sure prompt tab is active
    switchTab('prompt');
}

// Display generated code in the code tab
function displayCodeInTab(codeData) {
    console.log('🚀 Displaying generated code in tab editor');

    const codeTextarea = document.getElementById('codeTabTextarea');
    const codeInfo = document.getElementById('codeInfo');
    const codeStatus = document.getElementById('codeStatus');
    const codeBadge = document.getElementById('codeTabBadge');

    if (codeTextarea) {
        // Handle multiple code files - combine them or show the first one
        let codeToDisplay = '';

        if (Array.isArray(codeData) && codeData.length > 0) {
            if (codeData.length === 1) {
                codeToDisplay = codeData[0].generated_code || '';
            } else {
                // Multiple files - combine with separators
                codeToDisplay = codeData.map((file, index) => {
                    return `# ============================================================
# File ${index + 1}: ${file.file_name || `file_${index + 1}.py`}
# Generated: ${new Date().toLocaleString()}
# ============================================================

${file.generated_code || ''}

`;
                }).join('\n\n');
            }
        } else if (typeof codeData === 'string') {
            codeToDisplay = codeData;
        }

        codeTextarea.value = codeToDisplay;
        updateTabCharCount('code');
    }

    if (codeInfo) {
        const fileCount = Array.isArray(codeData) ? codeData.length : 1;
        codeInfo.textContent = `Generated ${fileCount} file${fileCount > 1 ? 's' : ''} - ${new Date().toLocaleString()}`;
    }

    if (codeStatus) {
        codeStatus.textContent = '✅ Code generated successfully';
        codeStatus.className = 'status-indicator success';
    }

    if (codeBadge) {
        codeBadge.style.display = 'inline-block';
        codeBadge.textContent = 'Ready';
    }

    // Automatically switch to code tab
    switchTab('code');
}

// Save content from a specific tab
/*
function saveTabContent(tabName) {
    console.log(`💾 Saving ${tabName} content`);

    const textarea = document.getElementById(`${tabName}TabTextarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No ${tabName} content to save!`, 'warning');
        return;
    }

    // Save to localStorage
    const storageKey = `developer_${tabName}_data`;
    localStorage.setItem(storageKey, content);
    localStorage.setItem(`${storageKey}_timestamp`, new Date().toISOString());

    showToast(`${tabName.charAt(0).toUpperCase() + tabName.slice(1)} content saved successfully!`, 'success');
}
*/

// REPLACE your existing saveTabContent function with this version that saves to dev-scripts
async function saveTabContent(tabName) {
    console.log(`💾 Saving ${tabName} content`);

    const textarea = document.getElementById(`${tabName}TabTextarea`);
    if (!textarea) {
        console.error(`❌ Textarea not found: ${tabName}TabTextarea`);
        return;
    }

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No ${tabName} content to save!`, 'warning');
        return;
    }

    try {
        // Call backend to save to dev-scripts folder
        const response = await fetch('/save_to_dev_scripts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                file_id: tabName,
                content: content
            })
        });

        const result = await response.json();

        if (result.success) {
            // Update localStorage as backup
            const storageKey = `developer_${tabName}_data`;
            localStorage.setItem(storageKey, content);
            localStorage.setItem(`${storageKey}_timestamp`, new Date().toISOString());

            // Show success message
            showToast(`${tabName.charAt(0).toUpperCase() + tabName.slice(1)} saved to dev-scripts/${result.filename}`, 'success');

            console.log(`✅ ${tabName} saved successfully: ${result.file_path}`);

        } else {
            throw new Error(result.message || 'Failed to save file');
        }

    } catch (error) {
        console.error(`❌ Error saving ${tabName}:`, error);

        // Fallback to localStorage only
        const storageKey = `developer_${tabName}_data`;
        localStorage.setItem(storageKey, content);
        localStorage.setItem(`${storageKey}_timestamp`, new Date().toISOString());

        showToast(`${tabName.charAt(0).toUpperCase() + tabName.slice(1)} save failed. Saved to browser storage only.`, 'error');
    }
}

// Download content from a specific tab
function downloadTabContent(tabName) {
    console.log(`📥 Downloading ${tabName} content`);

    const textarea = document.getElementById(`${tabName}TabTextarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No ${tabName} content to download!`, 'warning');
        return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    let filename, mimeType;

    if (tabName === 'prompt') {
        filename = `ai_prompt_${timestamp}.txt`;
        mimeType = 'text/plain';
    } else if (tabName === 'code') {
        filename = `generated_code_${timestamp}.py`;
        mimeType = 'text/x-python';
    } else {
        filename = `${tabName}_${timestamp}.txt`;
        mimeType = 'text/plain';
    }

    const element = document.createElement('a');
    const file = new Blob([content], { type: mimeType });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${filename} downloaded successfully!`, 'success');
}

// Copy content to clipboard
function copyTabContent(tabName) {
    console.log(`📋 Copying ${tabName} content to clipboard`);

    const textarea = document.getElementById(`${tabName}TabTextarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast(`No ${tabName} content to copy!`, 'warning');
        return;
    }

    // Copy to clipboard
    navigator.clipboard.writeText(content).then(() => {
        showToast(`${tabName.charAt(0).toUpperCase() + tabName.slice(1)} content copied to clipboard!`, 'success');
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

// Run/test code (placeholder for future implementation)
async function runCode() {
    console.log('▶️ [DEVELOPER] Starting code execution...');

    // Check if application code has been generated and reviewed
    if (!window.generatedApplicationCode || window.generatedApplicationCode.length === 0) {
        showToast('No generated application code to execute. Please generate code first!', 'warning');
        return;
    }

    // Check if code has been reviewed (optional but recommended)
    const reviewBtn = document.getElementById('reviewAppBtn');
    const isReviewed = reviewBtn && reviewBtn.textContent.includes('Review Completed');

    if (!isReviewed) {
        const confirmExecute = confirm('Please Complete Code Review before executing');
        if (!confirmExecute || confirmExecute) {
            return;
        }
    }

    // Find the Run button in the tab area and add loading state
    const runButton = document.querySelector('button[onclick="runCode()"]');
    if (runButton) {
        runButton.disabled = true;
        runButton.classList.add('btn-loading');
        // FIXED: Keep the button text visible with spinner
        runButton.innerHTML = '⏳ Running...';

        // Add inline spinner CSS if not already present
        if (!document.getElementById('button-spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'button-spinner-styles';
            style.textContent = `
                .btn-loading {
                    position: relative;
                    pointer-events: none;
                    opacity: 0.9;
                    padding-left: 28px !important;
                }
                
                .btn-loading::before {
                    content: '';
                    position: absolute;
                    left: 6px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 12px;
                    height: 12px;
                    border: 2px solid rgba(255,255,255,0.4);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: button-spin 1s linear infinite;
                }
                
                @keyframes button-spin {
                    to { transform: translateY(-50%) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Show device selection modal (reuse QA workflow device selection)
    showDeviceSelectionModal('developer');
}


// Add device selection modal functionality for developer workflow
function showDeviceSelectionModal(workflowType = 'developer') {
    console.log(`🖥️ [${workflowType.toUpperCase()}] Showing device selection modal`);

    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.id = 'deviceSelectionModal';
    modalBackdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 20px;
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideInUp 0.4s ease-out;
    `;

    modalContent.innerHTML = `
        <div style="text-align: center; margin-bottom: 25px;">
            <h2 style="color: #1f2937; margin-bottom: 10px;">🖥️ Select Execution Device</h2>
            <p style="color: #6b7280; margin: 0;">Choose a remote device to execute your ${workflowType === 'developer' ? 'application code' : 'test scripts'}</p>
        </div>
        
        <div id="devicesList" style="margin-bottom: 25px;">
            <div style="text-align: center; padding: 20px;">
                <div style="color: #6b7280;">Loading available devices...</div>
            </div>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button onclick="closeDeviceSelectionModal()" style="
                padding: 12px 24px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                background: white;
                color: #374151;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            ">Cancel</button>
            
            <button id="executeWithDeviceBtn" onclick="executeWithSelectedDevice('${workflowType}')" disabled style="
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                background: #3b82f6;
                color: white;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                opacity: 0.5;
            ">Execute Code</button>
        </div>
    `;

    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);

    // Load devices
    loadDevicesForSelection();

    // Close modal when clicking backdrop
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeDeviceSelectionModal();
        }
    });
}

// Load and display devices for selection with REAL-TIME status checking
async function loadDevicesForSelection() {
    try {
        // First get the device list
        const response = await fetch('/devices');
        const result = await response.json();

        const devicesList = document.getElementById('devicesList');
        if (!devicesList) return;

        if (result.success && result.devices && result.devices.length > 0) {
            devicesList.innerHTML = '';

            // Show loading state initially
            result.devices.forEach(device => {
                const deviceCard = document.createElement('div');
                deviceCard.style.cssText = `
                    border: 2px solid #e5e7eb;
                    border-radius: 12px;
                    padding: 15px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    background: white;
                `;

                deviceCard.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <input type="radio" name="selectedDevice" value="${device.id}" 
                               style="width: 18px; height: 18px; accent-color: #3b82f6;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">
                                ${device.name}
                            </div>
                            <div style="color: #6b7280; font-size: 0.9rem; margin-bottom: 4px;">
                                ${device.host} - ${device.description || 'Remote execution device'}
                            </div>
                            <div id="status-${device.id}" style="display: flex; align-items: center; gap: 8px;">
                                <span style="
                                    display: inline-block;
                                    width: 8px;
                                    height: 8px;
                                    border-radius: 50%;
                                    background: #3b82f6;
                                    animation: pulse 2s infinite;
                                "></span>
                                <span style="font-size: 0.8rem; color: #3b82f6; font-weight: 600;">
                                    Checking status...
                                </span>
                            </div>
                        </div>
                    </div>
                `;

                // Add click handler
                deviceCard.addEventListener('click', () => {
                    // Only allow selection if device is online
                    const statusElement = document.getElementById(`status-${device.id}`);
                    const statusText = statusElement?.textContent || '';

                    if (statusText.includes('Ready') || statusText.includes('Online')) {
                        // Remove selection from other cards
                        document.querySelectorAll('#devicesList > div').forEach(card => {
                            card.style.borderColor = '#e5e7eb';
                            card.style.background = 'white';
                        });

                        // Select this card
                        deviceCard.style.borderColor = '#3b82f6';
                        deviceCard.style.background = '#eff6ff';

                        // Check the radio button
                        const radio = deviceCard.querySelector('input[type="radio"]');
                        radio.checked = true;

                        // Enable execute button
                        const executeBtn = document.getElementById('executeWithDeviceBtn');
                        executeBtn.disabled = false;
                        executeBtn.style.opacity = '1';
                    } else {
                        showToast('Please select an online device', 'warning');
                    }
                });

                devicesList.appendChild(deviceCard);

                // NOW CHECK REAL-TIME STATUS for this device
                checkDeviceRealTimeStatus(device.id);
            });
        } else {
            devicesList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #ef4444;">
                    No devices available. Please check your devices.json configuration.
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        const devicesList = document.getElementById('devicesList');
        if (devicesList) {
            devicesList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #ef4444;">
                    Error loading devices: ${error.message}
                </div>
            `;
        }
    }
}

// NEW: Check real-time status for a specific device
async function checkDeviceRealTimeStatus(deviceId) {
    try {
        console.log(`🔍 Checking real-time status for device: ${deviceId}`);

        const response = await fetch(`/devices/${deviceId}/status`);
        const result = await response.json();

        const statusElement = document.getElementById(`status-${deviceId}`);
        if (!statusElement) return;

        if (result.success && result.is_online) {
            // Device is online
            statusElement.innerHTML = `
                <span style="
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10b981;
                "></span>
                <span style="font-size: 0.8rem; color: #10b981; font-weight: 600;">
                    Ready
                </span>
            `;
        } else {
            // Device is offline or has issues
            const statusColor = result.status === 'timeout' ? '#f59e0b' : '#ef4444';
            const statusText = result.status === 'timeout' ? 'Timeout' : 'Offline';

            statusElement.innerHTML = `
                <span style="
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: ${statusColor};
                "></span>
                <span style="font-size: 0.8rem; color: ${statusColor}; font-weight: 600;">
                    ${statusText} - ${result.message || 'Not reachable'}
                </span>
            `;

            // Disable the card for offline devices
            const deviceCard = statusElement.closest('div');
            if (deviceCard) {
                deviceCard.style.opacity = '0.6';
                deviceCard.style.cursor = 'not-allowed';

                // Disable radio button
                const radio = deviceCard.querySelector('input[type="radio"]');
                if (radio) {
                    radio.disabled = true;
                }
            }
        }

        console.log(`✅ Status check complete for ${deviceId}: ${result.is_online ? 'ONLINE' : 'OFFLINE'}`);

    } catch (error) {
        console.error(`❌ Error checking status for device ${deviceId}:`, error);

        const statusElement = document.getElementById(`status-${deviceId}`);
        if (statusElement) {
            statusElement.innerHTML = `
                <span style="
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #ef4444;
                "></span>
                <span style="font-size: 0.8rem; color: #ef4444; font-weight: 600;">
                    Error checking status
                </span>
            `;
        }
    }
}

// FIXED: Add developer-specific progress functions
function startDeveloperProgress(taskType, title, steps) {
    console.log(`🔄 Starting developer progress tracking for: ${title}`);

    currentTaskType = taskType;

    // Show developer progress container
    const progressContainer = document.getElementById('developerProgressContainer');
    const progressTitle = document.getElementById('developerProgressTitle');
    const progressStatus = document.getElementById('developerProgressStatus');
    const progressBar = document.getElementById('developerProgressBar');
    const progressPercentage = document.getElementById('developerProgressPercentage');
    const progressSteps = document.getElementById('developerProgressSteps');

    if (!progressContainer) {
        console.error('❌ Developer progress container not found!');
        return;
    }

    // Show progress container
    progressContainer.style.display = 'block';
    progressContainer.classList.add('show');

    // Set title and initial status
    if (progressTitle) progressTitle.textContent = title;
    if (progressStatus) progressStatus.textContent = 'Initializing...';

    // Reset progress bar
    if (progressBar) progressBar.style.width = '0%';
    if (progressPercentage) progressPercentage.textContent = '0%';

    // Create step elements
    if (progressSteps) {
        progressSteps.innerHTML = '';
        steps.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'progress-step';
            stepElement.innerHTML = `
                <div class="step-icon pending" id="dev-step-${index}">●</div>
                <span>${step}</span>
            `;
            progressSteps.appendChild(stepElement);
        });
    }

    // Reset progress
    updateDeveloperProgress(0, 'Initializing...', 0);

    // Start polling for real progress
    progressPollingInterval = setInterval(() => {
        pollProgress(taskType);
    }, 500);
}

function updateDeveloperProgress(percentage, status, activeStepIndex = -1) {
    const progressBar = document.getElementById('developerProgressBar');
    const progressPercentage = document.getElementById('developerProgressPercentage');
    const progressStatus = document.getElementById('developerProgressStatus');
    const progressSteps = document.getElementById('developerProgressSteps');

    if (!progressBar || !progressPercentage || !progressStatus) return;

    progressBar.style.width = percentage + '%';
    progressPercentage.textContent = Math.round(percentage) + '%';
    progressStatus.textContent = status;

    // Update step states
    if (progressSteps) {
        const stepElements = progressSteps.querySelectorAll('.progress-step');
        stepElements.forEach((step, index) => {
            const icon = step.querySelector('.step-icon');
            step.classList.remove('active', 'completed');
            icon.classList.remove('active', 'completed', 'pending');

            if (index < activeStepIndex) {
                step.classList.add('completed');
                icon.classList.add('completed');
                icon.textContent = '✓';
            } else if (index === activeStepIndex) {
                step.classList.add('active');
                icon.classList.add('active');
                icon.textContent = '●';
            } else {
                icon.classList.add('pending');
                icon.textContent = '●';
            }
        });
    }
}

function hideDeveloperProgress() {
    setTimeout(() => {
        const progressContainer = document.getElementById('developerProgressContainer');
        if (progressContainer) {
            progressContainer.style.display = 'none';
            progressContainer.classList.remove('show');
        }
    }, 1000);
}

// Execute code with selected device
async function executeWithSelectedDevice(workflowType = 'developer') {
    const selectedDevice = document.querySelector('input[name="selectedDevice"]:checked');
    if (!selectedDevice) {
        showToast('Please select a device first!', 'warning');
        return;
    }

    const deviceId = selectedDevice.value;
    console.log(`🚀 [${workflowType.toUpperCase()}] Executing on device: ${deviceId}`);

    // Close modal
    closeDeviceSelectionModal();

    // Start execution using the same QA workflow endpoint
    await executeDeveloperCode(deviceId);
}

// Execute developer code using QA workflow infrastructure
async function executeDeveloperCode(selectedDeviceId) {
    console.log('🚀 [DEVELOPER] Starting application code execution...');

    // ADD THIS LINE to define the runButton variable
    const runButton = document.querySelector('button[onclick="runCode()"]');

    try {
        // Start real progress tracking (same as QA workflow)
        startDeveloperProgress('execute', 'Executing Application Code', [
            'Preparing application code for execution',
            'Connecting to selected remote device',
            'Uploading application code files',
            'Running application code on device',
            'Collecting execution results',
            'Generating execution report'
        ]);

        // Use the same execution endpoint as QA workflow
        const response = await fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                selected_device_id: selectedDeviceId,
                // Optional: Add workflow type to distinguish
                workflow_type: 'developer'
            })
        });

        const result = await response.json();
        console.log('🚀 [DEVELOPER] Execution result:', result);

        setTimeout(() =>{
            document.getElementById('DevScriptsPassed').textContent = result.DevScriptsPassed || 0;
            document.getElementById('DevScriptsFailed').textContent = result.DevScriptsFailed || 0;
            document.getElementById('QAScriptsPassed').textContent = result.QAScriptsPassed || 0;
            document.getElementById('QAScriptsFailed').textContent = result.QAScriptsFailed || 0;
            
         },1000); 

        analyticsData.devscriptspassed = result.DevScriptsPassed;
        analyticsData.devscriptsfailed = result.DevScriptsFailed;
        analyticsData.qascriptspassed = result.QAScriptsPassed;
        analyticsData.qascriptsfailed = result.QAScriptsFailed;





        if (result.success) {
            // Display execution results in the code tab
            displayDeveloperExecutionResults(result);

            // Show success toast with device info
            if (result.connected_device) {
                showToast(`✅ Code executed successfully on ${result.connected_device.name}!`, 'success');
            } else {
                showToast('✅ Code executed successfully!', 'success');
            }

        } else {
            // Handle execution failure
            console.error('❌ [DEVELOPER] Execution failed:', result.message);
            stopProgressPolling();
            hideDeveloperProgress();
            showToast(`Execution failed: ${result.message}`, 'error');
        }

    } catch (error) {
        console.error('❌ [DEVELOPER] Execution error:', error);
        stopProgressPolling();
        hideDeveloperProgress();
        showToast(`Execution error: ${error.message}`, 'error');
    } finally {
        // Reset the Run button in tab area
        if (runButton) {
            runButton.disabled = false;
            runButton.classList.remove('btn-loading');
            runButton.innerHTML = '▶️ Run';
        }
    }
}


// Display execution results in the developer workflow
function displayDeveloperExecutionResults(result) {
    console.log('📋 [DEVELOPER] Displaying execution results for main code only');

    const codeTextarea = document.getElementById('codeTabTextarea');
    if (codeTextarea && result.execution_results && result.execution_results.length > 0) {
        const executionResult = result.execution_results[0]; // Take first result for main code

        const executionOutput = `=== APPLICATION CODE EXECUTION RESULTS ===
Executed on: ${new Date().toLocaleString()}
Device: ${result.connected_device ? result.connected_device.name : 'Unknown'} (${result.connected_device ? result.connected_device.host : 'Unknown'})
Execution Status: ${executionResult.success ? 'SUCCESS' : 'FAILED'}

=== EXECUTION OUTPUT ===
STDOUT:
${executionResult.stdout}

STDERR:
${executionResult.stderr}

=== EXECUTION COMPLETED ===
✅ Application Code Execution Completed
${result.connected_device ? `Device: ${result.connected_device.name} (${result.connected_device.host})` : ''}

████████████████████████████████████████████████████████████████████████████████████████████████████████████████
██ 🚀 APPLICATION CODE EXECUTION COMPLETED. CHECK OUTPUT ABOVE FOR RESULTS. 🚀 ██
████████████████████████████████████████████████████████████████████████████████████████████████████████████████`;

        codeTextarea.value = executionOutput;
        updateTabCharCount('code');
    }

    // NOTE: Intentionally NOT executing unittest code - only main application code as requested
}

// Close device selection modal
function closeDeviceSelectionModal() {
    const modal = document.getElementById('deviceSelectionModal');
    if (modal) {
        modal.remove();
    }
    selectedDeviceId = null;

    // FIXED: Reset Run button when modal is closed/cancelled
    const runButton = document.querySelector('button[onclick="runCode()"]');
    if (runButton && runButton.classList.contains('btn-loading')) {
        runButton.disabled = false;
        runButton.classList.remove('btn-loading');
        runButton.innerHTML = '▶️ Run';
    }
}

// Update the existing functions to use the tab editor
// Modified displayCreatedPrompt function to use tabs
function displayCreatedPromptInTab(aiPrompt, result) {
    console.log('📝 Displaying created prompt in tab editor');

    const displayMessage = `=== DEVELOPER REQUIREMENTS PROCESSED ===
Generated on: ${new Date().toLocaleString()}
Workflow Type: ${window.selectedWorkflowType || 'User Prompt'}

=== GENERATED AI PROMPT FOR LLAMA MODEL ===
${aiPrompt}

=== STATUS ===
✅ Prompt data saved to backend
✅ Ready for code generation
✅ Click "Generate Application Code" to proceed

=== NEXT STEPS ===
1. Review the generated prompt above
2. Click "Generate Application Code" button
3. AI will use this prompt to generate your code
`;

    displayPromptInTab(displayMessage);
}

/*
function displayGeneratedApplicationCodeInTab(codeResults) {
    console.log('🚀 Displaying generated code in enhanced tab editor while preserving prompt');

    if (!codeResults || codeResults.length === 0) {
        showToast('No code was generated. Please try again.', 'warning');
        return;
    }

    // ✅ PRESERVE the existing prompt data before creating new tabs
    const promptTextarea = document.getElementById('promptTabTextarea');
    const existingPromptData = promptTextarea ? promptTextarea.value : '';

    console.log('💾 Preserving prompt data:', existingPromptData.length > 0 ? 'Found existing prompt' : 'No existing prompt');

    // Parse the generated code to separate main code and unit tests
    const parsedFiles = parseGeneratedCodeFiles(codeResults);

    // Create dynamic tabs for all files
    createDynamicCodeTabs(parsedFiles);

    // ✅ RESTORE the prompt data after tab creation
    if (existingPromptData) {
        const restoredPromptTextarea = document.getElementById('promptTabTextarea');
        if (restoredPromptTextarea) {
            restoredPromptTextarea.value = existingPromptData;
            updateTabCharCount('prompt');
            console.log('✅ Restored prompt data successfully');
        }
    }

    // Store for save/download functions
    window.generatedApplicationCode = codeResults;

    // Show success message
    showToast(`Generated ${codeResults.length} application file(s) successfully!`, 'success');
}
*/

function displayGeneratedApplicationCodeInTab(codeResults) {
    console.log('🚀 Displaying generated code in existing tab interface');

    if (!codeResults || codeResults.length === 0) {
        showToast('No code was generated. Please try again.', 'warning');
        return;
    }

    // Parse the generated code to separate main code and unit tests
    const parsedFiles = parseGeneratedCodeFiles(codeResults);

    // Check if "include unit tests" checkbox was checked
    const includeTestsCheckbox = document.getElementById('includeTests');
    const shouldShowTests = includeTestsCheckbox && includeTestsCheckbox.checked;

    // Get the existing tab editor container
    const tabEditorContainer = document.getElementById('tabEditorContainer');
    if (!tabEditorContainer) {
        console.error('❌ Tab editor container not found');
        return;
    }

    // Ensure the tab editor is visible but don't replace it
    tabEditorContainer.style.display = 'block';

    // CRITICAL FIX: Use the existing basic tab interface instead of creating dynamic tabs
    if (parsedFiles.length > 0) {
        const mainFile = parsedFiles.find(f => f.type === 'main') || parsedFiles[0];
        const testFile = parsedFiles.find(f => f.type === 'test');

        // Display main code in the existing code tab
        if (mainFile && mainFile.content.trim()) {
            displayCodeInTab([{
                generated_code: mainFile.content,
                file_name: mainFile.name || 'main_code.py'
            }]);
        }

        // If unit tests checkbox was checked and tests exist, create a separate test tab
        if (shouldShowTests && testFile && testFile.content.trim()) {
            addUnitTestTab(testFile);
        }
    }

    // Store for save/download functions
    window.generatedApplicationCode = codeResults;

    // Show success message
    const fileCount = parsedFiles.length;
    const testMessage = shouldShowTests && parsedFiles.some(f => f.type === 'test') ? ' with unit tests' : '';
    showToast(`Generated ${fileCount} application file(s)${testMessage} successfully!`, 'success');
}

// FIXED: Add unit test tab functionality when checkbox is checked
function addUnitTestTab(testFile) {
    console.log('🧪 Adding unit test tab');

    // Find the tab headers container
    const tabHeaders = document.querySelector('.tab-headers');
    if (!tabHeaders) return;

    // Check if unit test tab already exists
    let testTabHeader = document.querySelector('.tab-header[data-tab="unittest"]');
    if (!testTabHeader) {
        // Create unit test tab header
        testTabHeader = document.createElement('button');
        testTabHeader.className = 'tab-header';
        testTabHeader.setAttribute('data-tab', 'unittest');
        testTabHeader.onclick = () => switchTab('unittest');
        testTabHeader.innerHTML = `
            <span class="tab-icon">🧪</span>
            <span class="tab-title">Unit Tests</span>
            <span class="tab-badge" id="unittestTabBadge">Ready</span>
        `;
        tabHeaders.appendChild(testTabHeader);
    }

    // Find the tab content wrapper
    const tabContentWrapper = document.querySelector('.tab-content-wrapper');
    if (!tabContentWrapper) return;

    // Check if unit test tab content already exists
    let testTabContent = document.querySelector('.tab-content[data-tab="unittest"]');
    if (!testTabContent) {
        // Create unit test tab content
        testTabContent = document.createElement('div');
        testTabContent.className = 'tab-content';
        testTabContent.setAttribute('data-tab', 'unittest');
        testTabContent.innerHTML = `
            <div class="tab-toolbar">
                <div class="toolbar-left">
                    <h3>🧪 Generated Unit Tests</h3>
                    <span class="content-info" id="unittestInfo">Comprehensive unit tests for validation</span>
                </div>
                <div class="toolbar-right">
                    <button class="toolbar-btn" onclick="saveTabContent('unittest')" title="Save tests">
                        💾 Save
                    </button>
                    <button class="toolbar-btn" onclick="downloadTabContent('unittest')" title="Download tests">
                        📥 Download
                    </button>
                    <button class="toolbar-btn" onclick="runTests()" title="Run tests">
                        ▶️ Run Tests
                    </button>
                </div>
            </div>
            <textarea
                id="unittestTabTextarea"
                class="tab-textarea code-editor"
                placeholder="Generated unit tests will appear here..."
                oninput="updateTabCharCount('unittest')"
            ></textarea>
            <div class="tab-footer">
                <span class="char-count" id="unittestCharCount">0 characters</span>
                <span class="language-indicator">🐍 Python</span>
                <span class="status-indicator" id="unittestStatus">✅ Tests generated successfully</span>
            </div>
        `;
        tabContentWrapper.appendChild(testTabContent);
    }

    // Populate the unit test content
    const testTextarea = document.getElementById('unittestTabTextarea');
    if (testTextarea) {
        testTextarea.value = testFile.content;
        updateTabCharCount('unittest');
    }

    // Update info
    const testInfo = document.getElementById('unittestInfo');
    if (testInfo) {
        testInfo.textContent = `Generated ${new Date().toLocaleString()} - Ready for testing`;
    }

    // Show the unit test tab badge
    const testBadge = document.getElementById('unittestTabBadge');
    if (testBadge) {
        testBadge.style.display = 'inline-block';
    }

    console.log('✅ Unit test tab added successfully');
}


// FIXED: Enhanced parseGeneratedCodeFiles to handle unit test checkbox properly
/*
function parseGeneratedCodeFiles(codeResults) {
    console.log('📋 Parsing generated code files for main code and unit tests');

    const files = [];
    const includeTestsCheckbox = document.getElementById('includeTests');
    const shouldIncludeTests = includeTestsCheckbox && includeTestsCheckbox.checked;

    codeResults.forEach((result, index) => {
        const code = result.generated_code || '';
        const fileName = result.file_name || `generated_code_${index + 1}.py`;

        if (shouldIncludeTests) {
            // Split the code into main code and unit tests only if checkbox is checked
            const { mainCode, unitTests } = separateMainCodeAndTests(code);

            // Create main code file
            if (mainCode.trim()) {
                files.push({
                    id: `main_${index}`,
                    name: fileName,
                    displayName: fileName.replace('.py', ''),
                    content: mainCode,
                    type: 'main',
                    icon: '🚀',
                    language: 'python'
                });
            }

            // Create unit test file if tests exist
            if (unitTests.trim()) {
                const testFileName = fileName.replace('.py', '_test.py');
                files.push({
                    id: `test_${index}`,
                    name: testFileName,
                    displayName: testFileName.replace('.py', ''),
                    content: unitTests,
                    type: 'test',
                    icon: '🧪',
                    language: 'python'
                });
            }
        } else {
            // If tests not requested, treat everything as main code
            files.push({
                id: `main_${index}`,
                name: fileName,
                displayName: fileName.replace('.py', ''),
                content: code,
                type: 'main',
                icon: '🚀',
                language: 'python'
            });
        }
    });

    console.log(`✅ Parsed ${files.length} files (${files.filter(f => f.type === 'main').length} main, ${files.filter(f => f.type === 'test').length} test)`);
    return files;
}
*/

/*
function parseGeneratedCodeFiles(codeResults) {
    console.log('📋 Parsing generated code files for main code and unit tests');

    const files = [];
    const includeTestsCheckbox = document.getElementById('includeTests');
    const shouldIncludeTests = includeTestsCheckbox && includeTestsCheckbox.checked;

    codeResults.forEach((result, index) => {
        const code = result.generated_code || '';
        const fileName = result.file_name || `generated_code_${index + 1}.py`;

        // Check if this is already a separate file (smart reuse case)
        if (fileName.includes('_test.py')) {
            // This is a test file
            if (shouldIncludeTests) {
                files.push({
                    id: `test_${index}`,
                    name: fileName,
                    displayName: fileName.replace('.py', ''),
                    content: code,
                    type: 'test',
                    icon: '🧪',
                    language: 'python'
                });
            }
        } else if (code.includes('# ♻️ SMART REUSE - EXISTING UNIT TESTS')) {
            // This is a reused test file
            if (shouldIncludeTests) {
                files.push({
                    id: `test_${index}`,
                    name: fileName,
                    displayName: fileName.replace('.py', ''),
                    content: code,
                    type: 'test',
                    icon: '🧪',
                    language: 'python'
                });
            }
        } else {
            // This is a main file
            files.push({
                id: `main_${index}`,
                name: fileName,
                displayName: fileName.replace('.py', ''),
                content: code,
                type: 'main',
                icon: '🚀',
                language: 'python'
            });
        }
    });

    return files;
}
*/

// Replace the parseGeneratedCodeFiles function in your script.js with this fixed version:

function parseGeneratedCodeFiles(codeResults) {
    console.log('📋 Parsing generated code files for main code and unit tests');
    console.log('📋 Received files:', codeResults.map(f => f.file_name));

    const files = [];
    const includeTestsCheckbox = document.getElementById('includeTests');
    const shouldIncludeTests = includeTestsCheckbox && includeTestsCheckbox.checked;

    codeResults.forEach((result, index) => {
        const code = result.generated_code || '';
        const fileName = result.file_name || `generated_code_${index + 1}.py`;

        console.log(`📋 Processing file: ${fileName}`);

        // Check if this is already a separate test file (from backend)
        if (fileName.includes('test_implementation.py') ||
            fileName.includes('unit_tests.py') ||
            fileName.endsWith('_test.py') ||  // Smart reuse pattern
            result.story_title === 'Unit Tests' ||
            (result.story_title && result.story_title.includes('Tests'))) {  // Smart reuse pattern
            // This is already a separate test file from backend
            if (shouldIncludeTests) {
                files.push({
                    id: `test_${index}`,
                    name: fileName,
                    displayName: fileName.replace('.py', ''),
                    content: code,
                    type: 'test',
                    icon: '🧪',
                    language: 'python'
                });
                console.log(`✅ Added separate test file: ${fileName}`);
                updateAnalyticsCounter('devUnittestsGenerated');
            }
        } else if (fileName.includes('main_implementation.py') ||
                   result.story_title === 'Main Implementation' ||
                   (result.story_title && result.story_title.startsWith('Smart Reuse:') && !result.story_title.includes('Tests'))) {  // Smart reuse pattern
            // This is already a separate main file from backend
            files.push({
                id: `main_${index}`,
                name: fileName,
                displayName: fileName.replace('.py', ''),
                content: code,
                type: 'main',
                icon: '🚀',
                language: 'python'
            });
            console.log(`✅ Added separate main file: ${fileName}`);
        } else {
            // This might be a combined file that needs splitting
            if (shouldIncludeTests) {
                const { mainCode, unitTests } = separateMainCodeAndTests(code);

                // Create main code file
                if (mainCode.trim()) {
                    files.push({
                        id: `main_${index}`,
                        name: fileName,
                        displayName: fileName.replace('.py', ''),
                        content: mainCode,
                        type: 'main',
                        icon: '🚀',
                        language: 'python'
                    });
                    console.log(`✅ Added main code from combined file: ${fileName}`);
                }

                // Create unit test file if tests exist
                if (unitTests.trim()) {
                    const testFileName = fileName.replace('.py', '_test.py');
                    files.push({
                        id: `test_${index}`,
                        name: testFileName,
                        displayName: testFileName.replace('.py', ''),
                        content: unitTests,
                        type: 'test',
                        icon: '🧪',
                        language: 'python'
                    });
                    console.log(`✅ Added test code from combined file: ${testFileName}`);
                }
                updateAnalyticsCounter('devUnittestsGenerated');
            } else {
                // If tests not requested, treat everything as main code
                files.push({
                    id: `main_${index}`,
                    name: fileName,
                    displayName: fileName.replace('.py', ''),
                    content: code,
                    type: 'main',
                    icon: '🚀',
                    language: 'python'
                });
                console.log(`✅ Added as main code (no tests): ${fileName}`);
            }
        }
    });

    console.log(`📋 Final parsed files: ${files.length} total`);
    console.log(`📋 Main files: ${files.filter(f => f.type === 'main').length}`);
    console.log(`📋 Test files: ${files.filter(f => f.type === 'test').length}`);

    return files;
}
// Separate main code from unit tests
/*
function separateMainCodeAndTests(code) {
    console.log('🔍 Separating main code from unit tests');

    // Look for unit test markers
    const testMarkers = [
        '# Unit Tests',
        'import unittest',
        'class Test',
        'def test_',
        'if __name__ == "__main__":\n    unittest.main()'
    ];

    let splitIndex = -1;

    // Find where tests start
    for (const marker of testMarkers) {
        const index = code.indexOf(marker);
        if (index !== -1) {
            if (splitIndex === -1 || index < splitIndex) {
                splitIndex = index;
            }
        }
    }

    if (splitIndex === -1) {
        // No tests found, return all as main code
        return {
            mainCode: code,
            unitTests: ''
        };
    }

    // Split at the test marker
    const mainCode = code.substring(0, splitIndex).trim();
    const unitTests = code.substring(splitIndex).trim();

    return { mainCode, unitTests };
}
*/

function separateMainCodeAndTests(code) {
    console.log('🔍 Separating main code from unit tests');

    // Enhanced test markers for better detection
    const testMarkers = [
        '# Unit Tests',
        '# =' + '='.repeat(60), // Separator line from backend
        'import unittest',
        'class Test',
        'def test_',
        'if __name__ == "__main__":\n    unittest.main()',
        'unittest.main(verbosity=2)',
        'unittest.main()',
        '# Comprehensive unit tests',
        '# Unit test'
    ];

    let splitIndex = -1;
    let foundMarker = '';

    // Find where tests start - look for the earliest marker
    for (const marker of testMarkers) {
        const index = code.indexOf(marker);
        if (index !== -1) {
            if (splitIndex === -1 || index < splitIndex) {
                splitIndex = index;
                foundMarker = marker;
            }
        }
    }

    console.log(`🔍 Test detection: Found marker "${foundMarker}" at index ${splitIndex}`);

    if (splitIndex === -1) {
        // No tests found, return all as main code
        console.log('❌ No unit tests detected in generated code');
        return {
            mainCode: code,
            unitTests: ''
        };
    }

    // Split at the test marker
    const mainCode = code.substring(0, splitIndex).trim();
    const unitTests = code.substring(splitIndex).trim();

    console.log(`✅ Successfully separated: Main code (${mainCode.length} chars), Unit tests (${unitTests.length} chars)`);

    return { mainCode, unitTests };
}

// Create dynamic tabs in the tab editor
/*
function createDynamicCodeTabs(files) {
    console.log('📝 Creating dynamic code tabs');

    const container = document.getElementById('generatedCodeContainer');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';
    container.style.display = 'block';

    // Create the enhanced tab editor
    const tabEditor = document.createElement('div');
    tabEditor.id = 'enhancedTabEditor';
    tabEditor.className = 'enhanced-tab-editor';

    tabEditor.innerHTML = `
        <div class="enhanced-tab-wrapper">
            <!-- Dynamic Tab Headers -->
            <div class="enhanced-tab-headers" id="dynamicTabHeaders">
                <!-- Prompt tab (always first) -->
                <button class="enhanced-tab-header" data-tab="prompt" onclick="switchEnhancedTab('prompt')">
                    <span class="tab-icon">🤖</span>
                    <span class="tab-title">AI Prompt</span>
                </button>

                <!-- Dynamic code file tabs will be inserted here -->
            </div>

            <!-- Tab Content Wrapper -->
            <div class="enhanced-tab-content-wrapper" id="dynamicTabContent">
                <!-- Prompt tab content (always present) -->
                <div class="enhanced-tab-content active" data-tab="prompt">
                    <div class="enhanced-tab-toolbar">
                        <div class="toolbar-left">
                            <h3>🤖 AI Prompt for LLaMA Model</h3>
                            <span class="content-info">Generated prompt ready for AI processing</span>
                        </div>
                        <div class="toolbar-right">
                            <button class="toolbar-btn" onclick="saveTabContent('prompt')">💾 Save</button>
                            <button class="toolbar-btn" onclick="downloadTabContent('prompt')">📥 Download</button>
                            <button class="toolbar-btn" onclick="copyTabContent('prompt')">📋 Copy</button>
                        </div>
                    </div>
                    <textarea
                        id="promptTabTextarea"
                        class="enhanced-tab-textarea"
                        readonly
                        placeholder="Generated AI prompt will appear here..."
                        oninput="updateEnhancedTabCharCount('prompt')"
                    ></textarea>
                    <div class="enhanced-tab-footer">
                        <span class="char-count" id="promptCharCount">0 characters</span>
                        <span class="status-indicator success">✅ Ready for code generation</span>
                    </div>
                </div>

                <!-- Dynamic code file content will be inserted here -->
            </div>
        </div>
    `;

    container.appendChild(tabEditor);

    // Add dynamic tabs for each code file
    files.forEach((file, index) => {
        addCodeFileTab(file, index === 0); // First code file is active
    });

    // Copy prompt content from existing tab if it exists
    const existingPrompt = document.getElementById('promptTabTextarea');
    const newPromptTextarea = tabEditor.querySelector('#promptTabTextarea');
    if (existingPrompt && newPromptTextarea) {
        newPromptTextarea.value = existingPrompt.value;
        updateEnhancedTabCharCount('prompt');
    }
}
*/

function createDynamicCodeTabs(files) {
    console.log('📝 Creating dynamic code tabs');

    const container = document.getElementById('generatedCodeContainer');
    if (!container) {
        console.error('❌ Generated code container not found');
        return;
    }

    // CRITICAL FIX: Don't clear the entire container - preserve existing content
    // Find existing tab editor or create one
    let tabEditor = container.querySelector('.enhanced-tab-editor');

    if (!tabEditor) {
        // Create new tab editor while preserving existing content
        tabEditor = document.createElement('div');
        tabEditor.className = 'enhanced-tab-editor';
        tabEditor.innerHTML = `
            <div class="enhanced-tab-headers" id="enhancedTabHeaders"></div>
            <div class="enhanced-tab-content-container" id="enhancedTabContentContainer"></div>
        `;
        container.appendChild(tabEditor);
    } else {
        // Clear only the tab content, not the whole container
        const headersContainer = tabEditor.querySelector('#enhancedTabHeaders');
        const contentContainer = tabEditor.querySelector('#enhancedTabContentContainer');
        if (headersContainer) headersContainer.innerHTML = '';
        if (contentContainer) contentContainer.innerHTML = '';
    }

    const headersContainer = document.getElementById('enhancedTabHeaders');
    const contentContainer = document.getElementById('enhancedTabContentContainer');

    if (!headersContainer || !contentContainer) {
        console.error('❌ Tab containers not found');
        return;
    }

    files.forEach((file, index) => {
        const isActive = index === 0;

        // Create tab header with enhanced styling for test files
        const tabHeader = document.createElement('div');
        tabHeader.className = `enhanced-tab-header ${isActive ? 'active' : ''}`;
        tabHeader.setAttribute('data-tab', file.id);
        tabHeader.onclick = () => switchEnhancedTab(file.id);

        const badgeClass = file.type === 'test' ? 'test-badge' : 'main-badge';
        const badgeText = file.type === 'test' ? 'UNIT TESTS' : 'MAIN CODE';

        tabHeader.innerHTML = `
            <span class="tab-icon">${file.icon}</span>
            <span class="tab-name">${file.displayName}</span>
            <span class="file-type-badge ${badgeClass}">${badgeText}</span>
        `;

        headersContainer.appendChild(tabHeader);

        // Create tab content with enhanced toolbar for test files
        const tabContent = document.createElement('div');
        tabContent.className = `enhanced-tab-content ${isActive ? 'active' : ''}`;
        tabContent.setAttribute('data-tab', file.id);

        const toolbarButtons = file.type === 'test'
            ? `
                <button class="toolbar-btn" onclick="saveFileContent('${file.id}')">💾 Save</button>
                <button class="toolbar-btn" onclick="downloadFileContent('${file.id}')">📥 Download</button>
                <button class="toolbar-btn" onclick="copyFileContent('${file.id}')">📋 Copy</button>
                <button class="toolbar-btn test-run-btn" onclick="runTests('${file.id}')">🧪 Run Tests</button>
            `
            : `
                <button class="toolbar-btn" onclick="saveFileContent('${file.id}')">💾 Save</button>
                <button class="toolbar-btn" onclick="downloadFileContent('${file.id}')">📥 Download</button>
                <button class="toolbar-btn" onclick="copyFileContent('${file.id}')">📋 Copy</button>
            `;

        tabContent.innerHTML = `
            <div class="enhanced-tab-toolbar">
                <div class="toolbar-left">
                    <h3>${file.icon} ${file.name}</h3>
                    <span class="content-info">${file.type === 'test' ? 'Unit tests for validation and quality assurance' : 'Main application code implementation'}</span>
                </div>
                <div class="toolbar-right">
                    ${toolbarButtons}
                </div>
            </div>
            <textarea 
                id="${file.id}Textarea" 
                class="enhanced-tab-textarea code-editor"
                placeholder="Generated ${file.type === 'test' ? 'unit tests' : 'application code'} will appear here..."
                oninput="updateEnhancedTabCharCount('${file.id}')"
            >${file.content}</textarea>
            <div class="enhanced-tab-footer">
                <span class="char-count" id="${file.id}CharCount">${file.content.length} characters</span>
                <span class="language-indicator">🐍 Python</span>
                <span class="file-type-indicator ${file.type}">${file.type.toUpperCase()}</span>
                <span class="status-indicator success">✅ Generated successfully</span>
            </div>
        `;

        contentContainer.appendChild(tabContent);
    });

    // Show the container but don't hide other elements
    container.style.display = 'block';

    console.log(`✅ Created ${files.length} dynamic tabs without destroying existing UI`);
}



// Switch between enhanced tabs
function switchEnhancedTab(tabId) {
    console.log(`🔄 Switching to enhanced tab: ${tabId}`);

    // Update tab headers
    document.querySelectorAll('.enhanced-tab-header').forEach(header => {
        header.classList.remove('active');
    });
    document.querySelector(`.enhanced-tab-header[data-tab="${tabId}"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.enhanced-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelector(`.enhanced-tab-content[data-tab="${tabId}"]`)?.classList.add('active');

    // Update character count for active tab
    updateEnhancedTabCharCount(tabId);
}

// Update character count for enhanced tabs
function updateEnhancedTabCharCount(tabId) {
    const textarea = document.getElementById(`${tabId}Textarea`);
    const charCount = document.getElementById(`${tabId}CharCount`);

    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = `${count.toLocaleString()} characters`;
    }
}

// Save file content
function saveFileContent(fileId) {
    console.log(`💾 Saving file content: ${fileId}`);

    const textarea = document.getElementById(`${fileId}Textarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast('No content to save!', 'warning');
        return;
    }

    // Save to localStorage
    localStorage.setItem(`file_${fileId}`, content);
    localStorage.setItem(`file_${fileId}_timestamp`, new Date().toISOString());

    showToast(`File ${fileId} saved successfully!`, 'success');
}


// Download file content
function downloadFileContent(fileId) {
    console.log(`📥 Downloading file content: ${fileId}`);

    const textarea = document.getElementById(`${fileId}Textarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast('No content to download!', 'warning');
        return;
    }

    // Determine filename based on file type
    const timestamp = new Date().toISOString().slice(0, 10);
    let filename;

    if (fileId.includes('test')) {
        filename = `test_${timestamp}.py`;
    } else {
        filename = `main_code_${timestamp}.py`;
    }

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/x-python' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showToast(`${filename} downloaded successfully!`, 'success');
}

// Copy file content to clipboard
function copyFileContent(fileId) {
    console.log(`📋 Copying file content: ${fileId}`);

    const textarea = document.getElementById(`${fileId}Textarea`);
    if (!textarea) return;

    const content = textarea.value.trim();
    if (!content) {
        showToast('No content to copy!', 'warning');
        return;
    }

    navigator.clipboard.writeText(content).then(() => {
        showToast(`File content copied to clipboard!`, 'success');
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        showToast('Failed to copy to clipboard', 'error');
    });
}

// Helper function to run unit tests (placeholder)
/*
function runTests() {
    console.log('▶️ Running unit tests...');
    showToast('Unit test execution feature coming soon!', 'info');
}
*/

// Replace your current runTests() function in script.js with this implementation

async function runTests(fileId = null) {
    console.log('🧪 Starting unit test execution...');

    // Get the unit test content
    let testContent;
    let testFileName;

    // NEW: Check if we're in multi-ticket mode
    if (multiTicketMode && typeof fileId === 'string' && fileId.startsWith('test_')) {
        // Extract index from fileId like 'test_0'
        const index = fileId.split('_')[1];
        const testTextarea = document.getElementById(`testArea${index}`);
        if (!testTextarea || !testTextarea.value.trim()) {
            showToast('No unit test content to execute!', 'warning');
            return;
        }
        testContent = testTextarea.value.trim();
        testFileName = `ticket_${index}_test.py`;
    }

    if (fileId) {
        // Running specific test file
        const testTextarea = document.getElementById(`${fileId}Textarea`);
        if (!testTextarea || !testTextarea.value.trim()) {
            showToast('No unit test content to execute!', 'warning');
            return;
        }
        testContent = testTextarea.value.trim();
        testFileName = `${fileId}_test.py`;
    } else {
        // Running from main unit test tab
        const unittestTextarea = document.getElementById('unittestTabTextarea');
        if (!unittestTextarea || !unittestTextarea.value.trim()) {
            showToast('No unit test content to execute!', 'warning');
            return;
        }

        // Check if textarea has actual unit test code or just review summary
        let hasValidTestCode = false;
        if (unittestTextarea && unittestTextarea.value.trim()) {
            const content = unittestTextarea.value.trim();

            // Check if this looks like unit test code (has def test_ or import unittest/pytest)
            hasValidTestCode = content.includes('def test_') ||
                              content.includes('import unittest') ||
                              content.includes('import pytest') ||
                              content.includes('# UNIT TEST EXECUTION RESULTS'); // Previous execution results

            if (hasValidTestCode && !content.includes('CODE REVIEW SUMMARY')) {
                console.log('✅ Found valid unit test code in textarea');
                testContent = content;
                testFileName = 'unittest_execution.py';
            }
        }
        // FALLBACK: If no valid test code in textarea, try to get from dev-scripts folder
        if (!hasValidTestCode) {
            console.log('⚠️ No valid unit test code in textarea, checking dev-scripts folder...');

            try {
                const response = await fetch('/get_unit_test_from_dev_scripts', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const result = await response.json();

                if (result.success && result.test_content) {
                    console.log('✅ Found unit test file in dev-scripts folder:', result.test_filename);
                    testContent = result.test_content;
                    testFileName = result.test_filename;
                    showToast('📁 Using unit test file from dev-scripts folder', 'info');
                } else {
                    showToast('No unit test content found in textarea or dev-scripts folder!', 'warning');
                    return;
                }
            } catch (error) {
                console.error('❌ Error fetching unit test from dev-scripts:', error);
                showToast('No unit test content to execute!', 'warning');
                return;
            }
        }
        //testContent = unittestTextarea.value.trim();
        //testFileName = 'unittest_execution.py';
    }

    // Check if this is smart reuse content (skip if it's just headers)
    if (testContent.includes('# ♻️ SMART REUSE') && !testContent.includes('def test_')) {
        showToast('Please wait for unit tests to be fully loaded before running.', 'warning');
        return;
    }

    try {
        // FIXED: Use manual progress control without polling
        // First, show the developer progress container manually
        const progressContainer = document.getElementById('developerProgressContainer');
        const progressTitle = document.getElementById('developerProgressTitle');
        const progressStatus = document.getElementById('developerProgressStatus');
        const progressBar = document.getElementById('developerProgressBar');
        const progressPercentage = document.getElementById('developerProgressPercentage');
        const progressSteps = document.getElementById('developerProgressSteps');

        if (!progressContainer) {
            console.error('❌ Developer progress container not found!');
            return;
        }

        // Show progress container
        progressContainer.style.display = 'block';
        progressContainer.classList.add('show');

        // Set title and initial status
        if (progressTitle) progressTitle.textContent = 'Running Unit Tests';
        if (progressStatus) progressStatus.textContent = 'Initializing...';

        // Reset progress bar
        if (progressBar) progressBar.style.width = '0%';
        if (progressPercentage) progressPercentage.textContent = '0%';

        // Create step elements manually
        const steps = [
            'Preparing test environment',
            'Saving test file to server',
            'Installing dependencies (pytest)',
            'Executing unit tests with pytest',
            'Collecting test results'
        ];

        if (progressSteps) {
            progressSteps.innerHTML = '';
            steps.forEach((step, index) => {
                const stepElement = document.createElement('div');
                stepElement.className = 'progress-step';
                stepElement.innerHTML = `
                    <div class="step-icon pending" id="dev-step-${index}">●</div>
                    <span>${step}</span>
                `;
                progressSteps.appendChild(stepElement);
            });
        }
        // Use developer progress functions with properly defined steps array
        //startDeveloperProgress('unit_tests', 'Running Unit Tests', progressSteps);
        updateDeveloperProgress(20, 'Preparing test environment', 0);
        await delay(500);

        updateDeveloperProgress(40, 'Saving test file and installing pytest', 1);

        // Send test content to backend for execution
        const response = await fetch('/run_unit_tests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                test_content: testContent,
                test_filename: testFileName,
                use_pytest: true
            })
        });

        updateDeveloperProgress(60, 'Executing unit tests with pytest', 2);
        await delay(1000);

        const result = await response.json();

        updateDeveloperProgress(80, 'Collecting test results', 3);
        await delay(500);

        updateDeveloperProgress(100, 'Unit test execution completed', 4);

        if (result.success) {
            // Display results in the unit test textarea
            const resultOutput = `# ═══════════════════════════════════════════════════════════════
# 🧪 UNIT TEST EXECUTION RESULTS
# ═══════════════════════════════════════════════════════════════
# Executed on: ${new Date().toLocaleString()}
# Test File: ${testFileName}
# Execution Status: ${result.execution_status || 'COMPLETED'}
# 
# ═══════════════════════════════════════════════════════════════
# PYTEST OUTPUT:
# ═══════════════════════════════════════════════════════════════

${result.stdout || 'No output captured'}

# ═══════════════════════════════════════════════════════════════
# STD ERROR OUTPUT (if any):
# ═══════════════════════════════════════════════════════════════

${result.stderr || 'No errors'}

# ═══════════════════════════════════════════════════════════════
# EXECUTION SUMMARY:
# ═══════════════════════════════════════════════════════════════
# Return Code: ${result.return_code || 'N/A'}
# Tests Passed: ${result.tests_passed || 'Check output above'}
# Tests Failed: ${result.tests_failed || 'Check output above'}
# Total Runtime: ${result.execution_time || 'N/A'}
# 
# ${result.return_code === 0 ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED - Check details above'}
# ═══════════════════════════════════════════════════════════════

# ORIGINAL TEST CODE:
# ═══════════════════════════════════════════════════════════════

${testContent}`;

            // Update the textarea with results
            if (fileId) {
                const testTextarea = document.getElementById(`${fileId}Textarea`);
                if (testTextarea) {
                    testTextarea.value = resultOutput;
                    updateEnhancedTabCharCount(fileId);
                }
            } else {
                const unittestTextarea = document.getElementById('unittestTabTextarea');
                if (unittestTextarea) {
                    unittestTextarea.value = resultOutput;
                    updateTabCharCount('unittest');
                }
            }

            // Show success/failure message
            if (result.return_code === 0) {
                showToast('✅ Unit tests executed successfully! All tests passed.', 'success');
            } else {
                showToast('⚠️ Unit tests completed with failures. Check results above.', 'warning');
            }

        } else {
            showToast(`Unit test execution failed: ${result.message}`, 'error');
        }

    } catch (error) {
        console.error('❌ Unit test execution error:', error);
        showToast('Unit test execution failed: ' + error.message, 'error');
    } finally {
        hideDeveloperProgress();
    }
}

// ================================================================================================
// KEYBOARD SHORTCUTS AND ACCESSIBILITY
// ================================================================================================

document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + S to save code
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (generatedScripts.length > 0) {
            // Save all test codes
            generatedScripts.forEach((script, index) => {
                saveTestCode(index);
            });
        } else {
            saveCode();
        }
    }

    // Ctrl/Cmd + D to download code
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (generatedScripts.length > 0) {
            // Download all test codes
            generatedScripts.forEach((script, index) => {
                downloadTestCode(index);
            });
        } else {
            downloadCode();
        }
    }

    // Escape to close toast
    if (e.key === 'Escape') {
        hideToast();
    }
});

// ================================================================================================
// ERROR HANDLING AND LOGGING
// ================================================================================================

window.addEventListener('error', function(event) {
    console.error('❌ Global error:', event.error);
    showToast('An unexpected error occurred. Please check the console for details.', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred. Please check the console for details.', 'error');
});

// ================================================================================================
// PERFORMANCE MONITORING
// ================================================================================================

function measurePerformance(functionName, fn) {
    return async function(...args) {
        const startTime = performance.now();
        try {
            const result = await fn.apply(this, args);
            const endTime = performance.now();
            console.log(`⚡ ${functionName} completed in ${(endTime - startTime).toFixed(2)}ms`);
            return result;
        } catch (error) {
            const endTime = performance.now();
            console.error(`❌ ${functionName} failed after ${(endTime - startTime).toFixed(2)}ms:`, error);
            throw error;
        }
    };
}

// Wrap main functions with performance monitoring
const originalIngestTest = ingestTest;
const originalGenerateCode = generateCode;
const originalExecuteCode = executeCode;
const originalReviewCode = reviewCode;

ingestTest = measurePerformance('ingestTest', originalIngestTest);
generateCode = measurePerformance('generateCode', originalGenerateCode);
executeCode = measurePerformance('executeCode', originalExecuteCode);
reviewCode = measurePerformance('reviewCode', originalReviewCode);

// ================================================================================================
// GLOBAL FUNCTION EXPORTS FOR ONCLICK HANDLERS
// ================================================================================================

// Make sure all functions are globally available for onclick handlers
window.showHome = showHome;
window.showAutoTest = showAutoTest;
window.ingestTest = ingestTest;
window.generateCode = generateCode;
window.executeCode = executeCode;
window.reviewCode = reviewCode;
window.saveCode = saveCode;
window.downloadCode = downloadCode;
window.saveTestCode = saveTestCode;
window.downloadTestCode = downloadTestCode;
window.downloadReport = downloadReport;
window.openReport = openReport;
window.updateTestAreaCharCount = updateTestAreaCharCount;
window.autoResizeTestTextarea = autoResizeTestTextarea;
window.hideToast = hideToast;
// 6. ADD these functions to global exports at the end of the file
window.toggleTestSelection = toggleTestSelection;
window.selectAllTests = selectAllTests;
window.deselectAllTests = deselectAllTests;
window.showExecutionCheckboxes = showExecutionCheckboxes;
window.hideExecutionCheckboxes = hideExecutionCheckboxes;
// 10. Add these functions to global exports
window.toggleAllTests = toggleAllTests;
//window.selectRecommended = selectRecommended;
window.updateMasterCheckbox = updateMasterCheckbox;

window.toggleAllScriptsForDownload = toggleAllScriptsForDownload;
window.toggleScriptForDownload = toggleScriptForDownload;
window.downloadSelectedScripts = downloadSelectedScripts;
//window.showBulkDownloadControls = showBulkDownloadControls;
window.hideBulkDownloadControls = hideBulkDownloadControls;
window.createBulkDownloadControls = createBulkDownloadControls;
window.showBulkDownloadControlsCompact = showBulkDownloadControlsCompact;
window.createCompactBulkDownloadButton = createCompactBulkDownloadButton;
window.addBulkDownloadToMultiTestAreas = addBulkDownloadToMultiTestAreas;

// Make new functions globally available
window.loadAvailableDevices = loadAvailableDevices;
window.checkDeviceStatus = checkDeviceStatus;
window.createDeviceSelectionModal = createDeviceSelectionModal;
window.selectDevice = selectDevice;
window.checkSingleDeviceStatus = checkSingleDeviceStatus;
window.refreshDeviceStatus = refreshDeviceStatus;
window.confirmDeviceSelection = confirmDeviceSelection;
window.closeDeviceSelectionModal = closeDeviceSelectionModal;
window.executeCodeWithSelectedDevice = executeCodeWithSelectedDevice;

// Developer mode functions
window.showDeveloperMode = showDeveloperMode;
window.showQAMode = showQAMode;
window.showCodebaseManager = showCodebaseManager;
window.ingestDeveloperRequirements = ingestDeveloperRequirements;
window.generateApplicationCode = generateApplicationCode;
window.toggleStorySelection = toggleStorySelection;
window.updateCodebaseStatus = updateCodebaseStatus;
window.updateCodeAreaCharCount = updateCodeAreaCharCount;
window.autoResizeCodeTextarea = autoResizeCodeTextarea;
window.displayGeneratedCode = displayGeneratedCode;
window.saveApplicationCode = saveApplicationCode;
window.downloadApplicationCode = downloadApplicationCode;
window.delay = delay;

// Codebase Manager functions
window.uploadCodebase = uploadCodebase;
window.clearCodebase = clearCodebase;
window.searchCodebase = searchCodebase;
window.displaySearchResults = displaySearchResults;

window.resetDeveloperElements = resetDeveloperElements;
window.resetQAElements = resetQAElements;
window.displayCodebaseDetails = displayCodebaseDetails;

window.switchCodebase = switchCodebase;
window.toggleSection = toggleSection;
window.resyncCurrentCodebase = resyncCurrentCodebase;
window.clearCurrentCodebase = clearCurrentCodebase;
window.saveCodebaseToStorage = saveCodebaseToStorage;
window.displayCodebaseInSidebar = displayCodebaseInSidebar;

window.savePromptData = savePromptData;
window.downloadPromptData = downloadPromptData;

window.displayGeneratedApplicationCode = displayGeneratedApplicationCode;

window.switchTab = switchTab;
window.updateTabCharCount = updateTabCharCount;
window.displayPromptInTab = displayPromptInTab;
window.displayCodeInTab = displayCodeInTab;
window.saveTabContent = saveTabContent;
window.downloadTabContent = downloadTabContent;
window.copyTabContent = copyTabContent;
window.runCode = runCode;
window.showTabEditor = showTabEditor;
window.displayCreatedPromptInTab = displayCreatedPromptInTab;
window.displayGeneratedApplicationCodeInTab = displayGeneratedApplicationCodeInTab;
window.switchEnhancedTab = switchEnhancedTab;
window.updateEnhancedTabCharCount = updateEnhancedTabCharCount;
window.saveFileContent = saveFileContent;
window.downloadFileContent = downloadFileContent;
window.copyFileContent = copyFileContent;
window.runTests = runTests;

window.reviewApplicationCode = reviewApplicationCode;
window.markTabAsReviewed = markTabAsReviewed;
window.showReviewSummary = showReviewSummary;

window.updateDeveloperStatusDisplay = updateDeveloperStatusDisplay;
window.updateStatusItem = updateStatusItem;
window.initializeDeveloperStatus = initializeDeveloperStatus;
window.setupDeveloperButtonStates = setupDeveloperButtonStates;

// Add analytics functions to global exports
window.showAnalytics = showAnalytics;
window.resetAnalytics = resetAnalytics;
window.updateAnalyticsCounter = updateAnalyticsCounter;

// Add Build and Deploy functions
window.deployCode = deployCode;
window.closeDeployModal = closeDeployModal;

// GitHub Integration functions
window.toggleCodebaseInputMethod = toggleCodebaseInputMethod;
window.validateGithubUrl = validateGithubUrl;
window.analyzeGithubRepo = analyzeGithubRepo;
window.uploadCodebaseZip = uploadCodebaseZip;
window.onGithubUrlInput = onGithubUrlInput;

// JIRA Integration functions
window.toggleDeveloperInputMethod = toggleDeveloperInputMethod;
window.connectToJira = connectToJira;
window.loadJiraProjects = loadJiraProjects;
window.loadJiraTickets = loadJiraTickets;
window.toggleJiraTicketSelection = toggleJiraTicketSelection;
window.selectAllJiraTickets = selectAllJiraTickets;
window.deselectAllJiraTickets = deselectAllJiraTickets;
window.proceedWithSelectedTickets = proceedWithSelectedTickets;
window.disconnectFromJira = disconnectFromJira;
window.updateJiraTicketStatus = updateJiraTicketStatus;
window.runCodeWithJiraUpdate = runCodeWithJiraUpdate;

// Enhanced developer workflow functions
window.displayDeveloperWorkflow = displayDeveloperWorkflow;
window.showDeveloperGenerationOptions = showDeveloperGenerationOptions;
window.displayJiraPromptInWorkflow = displayJiraPromptInWorkflow;

// ================================================================================================
// INITIALIZATION COMPLETE
// ================================================================================================

console.log('🎉 Cognizant AutoTest Dashboard - Complete JavaScript with Real Progress Loaded Successfully!');
console.log('📱 Multi-test case support enabled');
console.log('🔧 All functions exported globally');
console.log('⚡ Performance monitoring active');
console.log('♿ Accessibility features enabled');
console.log('🛡️ Error handling configured');
console.log('📊 Real progress tracking implemented');
console.log('🔄 New workflow: Upload → Ingest → Generate → Review → Execute');

// ================================================================================================
// DEVELOPMENT HELPERS (Remove in production)
// ================================================================================================

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Development mode helpers
    console.log('🔧 Development mode detected');

    // Add debug info to window object for console access
    window.debugInfo = {
        uploadedFiles,
        ingestedTestCases,
        generatedScripts,
        executionResults,
        elements,
        progressPollingInterval,
        currentTaskType
    };

    // Log performance metrics
    if ('performance' in window) {
        window.addEventListener('load', function() {
            setTimeout(() => {
                const navTiming = performance.getEntriesByType('navigation')[0];
                console.log(`📊 Page load time: ${navTiming.loadEventEnd - navTiming.fetchStart}ms`);
            }, 0);
        });
    }
}

// ================================================================================================
// END OF FILE
// ================================================================================================
