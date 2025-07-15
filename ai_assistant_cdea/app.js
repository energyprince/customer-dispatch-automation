// Configuration
const config = {
    API_BASE_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:8080/ai/api' 
        : window.location.pathname.startsWith('/ai/')
            ? `${window.location.protocol}//${window.location.host}/ai/api`
            : `${window.location.protocol}//${window.location.host}/api`,
    WS_URL: window.location.hostname === 'localhost'
        ? 'ws://localhost:8080'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`,
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 3000
};

// State management
const state = {
    messages: [],
    isTyping: false,
    uploadedFile: null,
    ws: null,
    reconnectAttempts: 0,
    sessionId: generateSessionId(),
    connectionStatus: {
        smtp: 'unknown',
        portal: 'unknown',
        ws: 'disconnected'
    }
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    initializeEventListeners();
    loadConversationHistory();
    connectWebSocket();
    updateUIState();
    updateApiUrl();
});

// Dark mode functionality
function initializeDarkMode() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        updateDarkModeIcon(true);
    }
    
    darkModeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateDarkModeIcon(isDark);
    });
}

function updateDarkModeIcon(isDark) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    if (isDark) {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
}

// Event listeners
function initializeEventListeners() {
    // Send message
    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // File upload
    const fileUpload = document.getElementById('fileUpload');
    fileUpload.addEventListener('change', handleFileUpload);
    
    // Drag and drop
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        messagesContainer.classList.add('drag-over');
    });
    
    messagesContainer.addEventListener('dragleave', () => {
        messagesContainer.classList.remove('drag-over');
    });
    
    messagesContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        messagesContainer.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    });
    
    // Quick actions
    document.querySelectorAll('.quick-action').forEach(button => {
        button.addEventListener('click', handleQuickAction);
    });
    
    // Export conversation
    document.getElementById('exportConversation').addEventListener('click', showExportModal);
    document.getElementById('exportJson').addEventListener('click', () => exportConversation('json'));
    document.getElementById('exportText').addEventListener('click', () => exportConversation('text'));
    document.getElementById('cancelExport').addEventListener('click', hideExportModal);
}

// Socket.IO connection
function connectWebSocket() {
    try {
        // Connect to Socket.IO server
        state.ws = io(window.location.hostname === 'localhost' ? 'http://localhost:8080' : '', {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: config.MAX_RECONNECT_ATTEMPTS,
            reconnectionDelay: config.RECONNECT_DELAY
        });
        
        state.ws.on('connect', () => {
            console.log('Socket.IO connected');
            state.reconnectAttempts = 0;
            updateConnectionStatus('ws', 'connected');
            // Join a session room if needed
            if (state.sessionId) {
                state.ws.emit('join', { session_id: state.sessionId });
            }
        });
        
        state.ws.on('message', (data) => {
            handleWebSocketMessage(data);
        });
        
        state.ws.on('status_update', (data) => {
            handleStatusUpdate(data);
        });
        
        state.ws.on('error', (error) => {
            console.error('Socket.IO error:', error);
            updateConnectionStatus('ws', 'error');
        });
        
        state.ws.on('disconnect', () => {
            console.log('Socket.IO disconnected');
            updateConnectionStatus('ws', 'disconnected');
        });
        
        state.ws.on('connect_error', (error) => {
            console.error('Socket.IO connection error:', error);
            updateConnectionStatus('ws', 'error');
        });
    } catch (error) {
        console.error('Failed to initialize Socket.IO:', error);
        updateConnectionStatus('ws', 'error');
    }
}

// Socket.IO handles reconnection automatically

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'status-update':
            handleStatusUpdate(data.payload);
            break;
        case 'dispatch-processed':
            handleDispatchProcessed(data.payload);
            break;
        case 'assistant-typing':
            showTypingIndicator(data.payload.isTyping);
            break;
        case 'message':
            if (data.payload.role === 'assistant') {
                addMessage(data.payload.content, 'assistant');
            }
            break;
    }
}

// Message handling
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const content = messageInput.value.trim();
    
    if (!content && !state.uploadedFile) return;
    
    // Disable input while sending
    messageInput.disabled = true;
    document.getElementById('sendButton').disabled = true;
    
    // Add user message to chat
    if (content) {
        addMessage(content, 'user');
    }
    
    // Clear input
    messageInput.value = '';
    
    // Show typing indicator
    showTypingIndicator(true);
    
    try {
        let response;
        
        // If there's a file, use FormData; otherwise use JSON
        if (state.uploadedFile) {
            const formData = new FormData();
            formData.append('message', content);
            formData.append('file', state.uploadedFile);
            formData.append('session_id', state.sessionId);
            addMessage(`📎 Attached: ${state.uploadedFile.name}`, 'user');
            
            response = await fetch(`${config.API_BASE_URL}/chat`, {
                method: 'POST',
                body: formData
            });
        } else {
            response = await fetch(`${config.API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: content,
                    session_id: state.sessionId
                })
            });
        }
        
        clearFileUpload();
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        addMessage(data.response, 'assistant');
        
        // Update status if included in response
        if (data.status) {
            handleStatusUpdate(data.status);
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addMessage('Sorry, I encountered an error processing your request. Please try again.', 'error');
    } finally {
        showTypingIndicator(false);
        messageInput.disabled = false;
        document.getElementById('sendButton').disabled = false;
        messageInput.focus();
    }
}

function addMessage(content, role) {
    const message = {
        id: Date.now(),
        content,
        role,
        timestamp: new Date().toISOString()
    };
    
    state.messages.push(message);
    renderMessage(message);
    saveConversationHistory();
    updateConversationCount();
    scrollToBottom();
}

function renderMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    
    const roleClass = {
        user: 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100',
        assistant: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
        error: 'bg-red-100 dark:bg-red-900 text-red-900 dark:text-red-100'
    }[message.role] || 'bg-gray-100 dark:bg-gray-700';
    
    messageDiv.innerHTML = `
        <div class="flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4">
            <div class="max-w-[70%] ${roleClass} rounded-lg px-4 py-2">
                <div class="text-sm">${escapeHtml(message.content)}</div>
                <div class="text-xs opacity-60 mt-1">${formatTimestamp(message.timestamp)}</div>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// Quick actions
async function handleQuickAction(event) {
    const action = event.target.dataset.action;
    const button = event.target;
    
    // Disable button during action
    button.disabled = true;
    button.classList.add('opacity-50', 'cursor-not-allowed');
    
    try {
        const response = await fetch(`${config.API_BASE_URL}/quick-action`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Add action request and response to chat
        addMessage(`Running: ${button.textContent}`, 'user');
        addMessage(data.message || data.response, 'assistant');
        
        // Update relevant status
        if (data.status) {
            handleStatusUpdate(data.status);
        }
    } catch (error) {
        console.error('Error executing quick action:', error);
        addMessage(`Failed to execute: ${button.textContent}`, 'error');
    } finally {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

// File handling
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        handleFileSelect(file);
    }
}

function handleFileSelect(file) {
    const allowedTypes = ['.eml', '.msg', '.txt'];
    const fileExtension = file.name.toLowerCase().substr(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(fileExtension)) {
        alert('Please upload a valid email file (.eml, .msg) or text file (.txt)');
        return;
    }
    
    state.uploadedFile = file;
    showFilePreview(file.name);
}

function showFilePreview(fileName) {
    const filePreview = document.getElementById('filePreview');
    const fileNameSpan = filePreview.querySelector('span');
    fileNameSpan.textContent = fileName;
    filePreview.classList.remove('hidden');
}

function clearFileUpload() {
    state.uploadedFile = null;
    document.getElementById('fileUpload').value = '';
    document.getElementById('filePreview').classList.add('hidden');
}

// Status updates
function handleStatusUpdate(status) {
    if (status.smtp !== undefined) {
        updateConnectionStatus('smtp', status.smtp.connected ? 'connected' : 'error');
        document.getElementById('smtpDetails').textContent = status.smtp.message || 'No details';
    }
    
    if (status.portal !== undefined) {
        updateConnectionStatus('portal', status.portal.authenticated ? 'connected' : 'error');
        document.getElementById('portalDetails').textContent = status.portal.message || 'No details';
    }
}

function handleDispatchProcessed(dispatch) {
    const lastDispatchDiv = document.getElementById('lastDispatch');
    lastDispatchDiv.innerHTML = `
        <p class="font-medium">${dispatch.eventId || 'Unknown Event'}</p>
        <p>Start: ${formatTimestamp(dispatch.startTime)}</p>
        <p>Facilities: ${dispatch.facilityCount || 0}</p>
        <p>Status: <span class="font-medium ${dispatch.success ? 'text-green-600' : 'text-red-600'}">${dispatch.status}</span></p>
    `;
}

function updateConnectionStatus(service, status) {
    state.connectionStatus[service] = status;
    const element = document.getElementById(`${service}Status`);
    if (element) {
        element.dataset.status = status;
    }
    
    // Update WebSocket details
    if (service === 'ws') {
        const details = document.getElementById('wsDetails');
        details.textContent = status === 'connected' ? 'Connected' : 
                             status === 'error' ? 'Connection error' : 'Disconnected';
    }
}

// UI utilities
function showTypingIndicator(show) {
    state.isTyping = show;
    const indicator = document.getElementById('typingIndicator');
    if (show) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

function updateConversationCount() {
    document.getElementById('conversationCount').textContent = state.messages.length;
}

function updateApiUrl() {
    document.getElementById('apiUrl').textContent = config.API_BASE_URL;
}

function updateUIState() {
    updateConversationCount();
    
    // Update status indicators
    Object.entries(state.connectionStatus).forEach(([service, status]) => {
        updateConnectionStatus(service, status);
    });
}

// Local storage
function saveConversationHistory() {
    try {
        localStorage.setItem('conversation_history', JSON.stringify(state.messages));
    } catch (error) {
        console.error('Failed to save conversation history:', error);
    }
}

function loadConversationHistory() {
    try {
        const saved = localStorage.getItem('conversation_history');
        if (saved) {
            state.messages = JSON.parse(saved);
            state.messages.forEach(message => renderMessage(message));
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load conversation history:', error);
    }
}

// Export functionality
function showExportModal() {
    document.getElementById('exportModal').classList.remove('hidden');
}

function hideExportModal() {
    document.getElementById('exportModal').classList.add('hidden');
}

function exportConversation(format) {
    let content, filename, mimeType;
    
    if (format === 'json') {
        content = JSON.stringify(state.messages, null, 2);
        filename = `conversation_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
    } else {
        content = state.messages.map(msg => 
            `[${formatTimestamp(msg.timestamp)}] ${msg.role.toUpperCase()}: ${msg.content}`
        ).join('\n\n');
        filename = `conversation_${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    hideExportModal();
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

// Generate session ID
function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Handle status updates from server
function handleStatusUpdate(data) {
    if (data.smtp !== undefined) {
        updateConnectionStatus('smtp', data.smtp ? 'connected' : 'error');
    }
    if (data.portal !== undefined) {
        updateConnectionStatus('portal', data.portal ? 'connected' : 'error');
    }
    if (data.lastDispatch) {
        updateLastDispatch(data.lastDispatch);
    }
}

// Global window function for file clear button
window.clearFileUpload = clearFileUpload;