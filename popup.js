// Debug logging
console.log('Popup script loaded');

// Store DOM elements
const elements = {
    // Existing elements
    generate: document.getElementById("generate"),
    // User info inputs
    userName: document.getElementById("userName"),
    userPhone: document.getElementById("userPhone"),
    userEmail: document.getElementById("userEmail"),
    userCity: document.getElementById("userCity"),
    userState: document.getElementById("userState"),
    userZip: document.getElementById("userZip"),
    saveUserInfo: document.getElementById("saveUserInfo"),
    userInfoStatus: document.getElementById("userInfoStatus"),
    // Rest of elements...
    status: document.getElementById("status"),
    resumeText: document.getElementById("resumeText"),
    jobDescriptionText: document.getElementById("jobDescriptionText"),
    apiKey: document.getElementById("apiKey"),
    apiKeyStatus: document.getElementById("apiKeyStatus"),
    saveApiKey: document.getElementById("saveApiKey"),
    output: document.getElementById("output"),
    downloadButton: document.getElementById("downloadButton"),
    charCount: document.getElementById("charCount"),
    jobDescCharCount: document.getElementById("jobDescCharCount")
};

// API Key handling
elements.saveApiKey.addEventListener('click', async () => {
    const apiKey = elements.apiKey.value.trim();
    
    if (!apiKey) {
        showStatus('apiKeyStatus', 'Please enter an API key', 'error');
        return;
    }

    try {
        await chrome.storage.sync.set({ 'geminiApiKey': apiKey });
        showStatus('apiKeyStatus', 'API key saved!', 'success');
        setTimeout(() => {
            elements.apiKeyStatus.textContent = '';
        }, 2000);
    } catch (error) {
        showStatus('apiKeyStatus', 'Error saving API key', 'error');
        console.error('Save API key error:', error);
    }
});

// Save User Information
elements.saveUserInfo.addEventListener('click', async () => {
    const userInfo = {
        name: elements.userName.value.trim(),
        phone: elements.userPhone.value.trim(),
        email: elements.userEmail.value.trim(),
        city: elements.userCity.value.trim(),
        state: elements.userState.value.trim(),
        zip: elements.userZip.value.trim()
    };

    if (!userInfo.name || !userInfo.email) {
        showStatus('userInfoStatus', 'Name and Email are required.', 'error');
        return;
    }

    try {
        await chrome.storage.sync.set({ 'userInfo': userInfo });
        showStatus('userInfoStatus', 'User information saved!', 'success');
        setTimeout(() => {
            elements.userInfoStatus.textContent = '';
        }, 2000);
    } catch (error) {
        showStatus('userInfoStatus', 'Error saving user information', 'error');
        console.error('Save user info error:', error);
    }
});

// Generate button handler
elements.generate.addEventListener("click", async () => {
    console.log('Generate button clicked');
    
    try {
        // Validate inputs
        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
        if (!geminiApiKey) {
            showStatus('status', 'Please enter your Gemini API key.', 'error');
            return;
        }
        
        const { userInfo } = await chrome.storage.sync.get('userInfo');
        if (!userInfo || !userInfo.name || !userInfo.email) {
            showStatus('status', 'Please provide your user information.', 'error');
            return;
        }

        const resumeText = elements.resumeText.value.trim();
        if (!resumeText) {
            showStatus('status', 'Please enter your resume text.', 'error');
            return;
        }

        const jobDescription = elements.jobDescriptionText.value.trim();
        if (!jobDescription) {
            showStatus('status', 'Please enter the job description.', 'error');
            return;
        }

        showStatus('status', "Generating cover letter...");
        
        // Generate cover letter
        const response = await chrome.runtime.sendMessage({
            action: "generateCoverLetter",
            userInfo,
            jobDescription,
            resumeText,
            apiKey: geminiApiKey
        });

        if (response.error) {
            showStatus('status', response.error, 'error');
            return;
        }

        elements.output.textContent = response.coverLetter;
        elements.downloadButton.style.display = 'block';
        showStatus('status', "Cover letter generated successfully!", 'success');

        // Store the current job description and resume text for future checks
        await chrome.storage.local.set({
            lastJobDescription: jobDescription,
            lastResumeText: resumeText
        });

    } catch (error) {
        console.error('Error:', error);
        showStatus('status', 'An error occurred while generating the cover letter.', 'error');
    }
});

// Helper functions
function showStatus(elementId, message, type = '') {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = type ? `status-text ${type}` : 'status-text';
    
    if (type === 'error') {
        setTimeout(() => {
            element.textContent = '';
        }, 5000);
    }
}

// Add this helper function to extract job requisition ID
function extractJobRequisitionId(jobDescription) {
    // Look specifically for "Job Requisition ID"
    const pattern = /Job Requisition ID\s*:?\s*([A-Z0-9-]+)/i;
    const match = jobDescription.match(pattern);
    
    if (match && match[1]) {
        return `_${match[1].trim()}`; // Return with underscore prefix
    }
    
    return ''; // Return empty string if not found
}

// Modify the download button click handler
elements.downloadButton.addEventListener('click', () => {
    const coverLetterText = elements.output.textContent;
    const jobDescription = elements.jobDescriptionText.value;
    
    if (!coverLetterText) {
        alert('Please generate a cover letter first.');
        return;
    }

    const jobReqId = extractJobRequisitionId(jobDescription);
    const fileName = `Saurav_Kalaskar_Cover_Letter${jobReqId}.txt`;

    // Create blob and download
    const blob = new Blob([coverLetterText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Load saved API key and user information on popup open
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    try {
        // Load API key
        const { geminiApiKey } = await chrome.storage.sync.get('geminiApiKey');
        if (geminiApiKey) {
            elements.apiKey.value = geminiApiKey;
        }

        // Load user information
        const { userInfo } = await chrome.storage.sync.get('userInfo');
        if (userInfo) {
            elements.userName.value = userInfo.name || '';
            elements.userPhone.value = userInfo.phone || '';
            elements.userEmail.value = userInfo.email || '';
            elements.userCity.value = userInfo.city || '';
            elements.userState.value = userInfo.state || '';
            elements.userZip.value = userInfo.zip || '';
        }

        // Restore state
        restoreState();
    } catch (error) {
        console.error('Error loading data:', error);
    }
});

// Save state function
function saveState() {
    const state = {
        resumeText: elements.resumeText.value,
        jobDescriptionText: elements.jobDescriptionText.value,
        outputText: elements.output.textContent,
        showDownloadButton: elements.downloadButton.style.display
    };
    
    chrome.storage.local.set({ extensionState: state }, () => {
        console.log('State saved');
    });
}

// Restore state function
async function restoreState() {
    try {
        const { extensionState } = await chrome.storage.local.get('extensionState');
        if (extensionState) {
            elements.resumeText.value = extensionState.resumeText || '';
            elements.jobDescriptionText.value = extensionState.jobDescriptionText || '';
            elements.output.textContent = extensionState.outputText || '';
            elements.downloadButton.style.display = extensionState.showDownloadButton || 'none';

            // Update character counts
            updateCharCount(elements.resumeText, elements.charCount);
            updateCharCount(elements.jobDescriptionText, elements.jobDescCharCount);
        }
    } catch (error) {
        console.error('Error restoring state:', error);
    }
}

// Update character count function
function updateCharCount(textElement, countElement) {
    const MAX_CHARS = 10000;
    const currentLength = textElement.value.length;
    countElement.textContent = `${currentLength}/${MAX_CHARS}`;
    
    if (currentLength > MAX_CHARS) {
        countElement.style.color = 'var(--error-color)';
    } else {
        countElement.style.color = 'var(--text-secondary)';
    }
}

// Event listeners for input changes
elements.resumeText.addEventListener('input', () => {
    updateCharCount(elements.resumeText, elements.charCount);
    saveState();
});

elements.jobDescriptionText.addEventListener('input', () => {
    updateCharCount(elements.jobDescriptionText, elements.jobDescCharCount);
    saveState();
});

// Save state before popup closes
window.addEventListener('beforeunload', saveState);

console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);
    
    if (request.action === "generateCoverLetter") {
        (async () => {
            try {
                const coverLetter = await generateCoverLetter(
                    request.userInfo,
                    request.jobDescription,
                    request.resumeText,
                    request.apiKey
                );
                sendResponse({ coverLetter });
            } catch (error) {
                console.error('Generation error:', error);
                sendResponse({ error: error.message });
            }
        })();
        return true; // Keep message channel open
    }
});

async function generateCoverLetter(userInfo, jobDescription, resumeText, apiKey) {
    try {
        const currentDate = new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // Attempt to extract department from job description
        let department = 'Hiring Team';
        const departmentMatch = jobDescription.match(/department[:\-]?\s*([^\n]+)/i);
        if (departmentMatch) {
            department = departmentMatch[1].trim();
        } else {
            // Try to extract job title or position
            const positionMatch = jobDescription.match(/position[:\-]?\s*([^\n]+)/i);
            if (positionMatch) {
                department = positionMatch[1].trim();
            }
        }

        // Build the header with user's information
        const header = `${userInfo.name}
${userInfo.phone} | ${userInfo.email}
${userInfo.city}, ${userInfo.zip}

${currentDate}

Hiring Manager
${department}
Company Name, ${userInfo.city}, ${userInfo.state}

Dear Hiring Manager,`;

        const prompt = `
You are a professional cover letter generator. Create a compelling cover letter following this EXACT format:

[MUST START WITH THIS EXACT HEADER FORMAT:]
${header}

[First Paragraph Guidelines - Create a unique, engaging opening that...]
[... rest of the prompt remains the same ...]

Use this job description to identify relevant skills and requirements: ${jobDescription}
And match with experience from this resume: ${resumeText}`;

        // Proceed to make the API call using the prompt
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        if (!data.candidates?.[0]?.output) {
            throw new Error('Invalid response format from API');
        }

        return data.candidates[0].output;

    } catch (error) {
        console.error('Error in generateCoverLetter:', error);
        throw error;
    }
}