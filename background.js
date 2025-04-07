// At the top of background.js
const CREDENTIALS = {
    // Add your service account credentials here
    type: "service_account",
    project_id: "ai-travel-assistant-451501",
    private_key_id: "your-private-key-id",
    private_key: "your-private-key",
    client_email: "your-client-email",
    // ... other fields from the JSON
};

async function getAccessToken() {
    try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: generateJWT(CREDENTIALS)
            })
        });

        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Error getting access token:", error);
        throw error;
    }
}

function generateJWT(credentials) {
    const now = Math.floor(Date.now() / 1000);
    const expTime = now + 3600; // Token expires in 1 hour

    const jwt = {
        iss: credentials.client_email,
        sub: credentials.client_email,
        aud: "https://dialogflow.googleapis.com/",
        iat: now,
        exp: expTime
    };

    // You'll need to add a JWT library to your extension
    return jwt; // This needs to be signed with the private key
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'sendToDialogflow') {
        handleDialogflowRequest(request.message)
            .then(response => {
                console.log('Response:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('Error:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }
});

async function getAuthToken() {
    try {
        const auth = await chrome.identity.getAuthToken({ 
            interactive: true,
            scopes: ['https://www.googleapis.com/auth/dialogflow']
        });
        return auth.token;
    } catch (error) {
        throw new Error('Failed to get authentication token');
    }
}

// Add this helper function to extract the booking URL
function extractBookingUrl(text) {
    const urlRegex = /Book here: (https:\/\/www\.google\.com\/travel\/flights[^\s]+)/;
    const match = text.match(urlRegex);
    return match ? match[1] : null;
}

async function handleDialogflowRequest(message) {
    try {
        const token = await getAuthToken();
        const sessionId = await getOrCreateSessionId();
        
        const dialogflowResponse = await fetch(
            `https://dialogflow.googleapis.com/v2/projects/ai-travel-assistant-451501/agent/sessions/${sessionId}:detectIntent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    queryInput: {
                        text: {
                            text: message,
                            languageCode: "en-US"
                        }
                    }
                })
            }
        );

        if (!dialogflowResponse.ok) {
            throw new Error(`Dialogflow API error: ${dialogflowResponse.status}`);
        }

        const data = await dialogflowResponse.json();
        
        // Extract booking URL and update tab if present
        let bookingUrl = null;
        if (data.queryResult?.fulfillmentText) {
            const matches = data.queryResult.fulfillmentText.match(/📌 Book here: (https:\/\/www\.google\.com\/travel\/flights[^\s]+)/);
            if (matches && matches[1]) {
                bookingUrl = matches[1];
                try {
                    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tabs[0]) {
                        await chrome.tabs.update(tabs[0].id, {url: bookingUrl});
                    }
                } catch (error) {
                    console.error('Error updating tab URL:', error);
                }
            }
        }

        return {
            text: data.queryResult?.fulfillmentText || "No response text",
            parameters: data.queryResult?.parameters || {},
            bookingUrl: bookingUrl
        };

    } catch (error) {
        console.error('Dialogflow request error:', error);
        throw error;
    }
}

async function checkDialogflowModel() {
    try {
        const token = await getAccessToken();
        
        // Get agent info
        const agentResponse = await fetch(
            `https://dialogflow.googleapis.com/v2/projects/ai-travel-assistant-451501/agent`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });
        
        const agentData = await agentResponse.json();
        console.log('Agent Details:', {
            apiVersion: agentData.apiVersion,
            tier: agentData.tier,
            supportedLanguages: agentData.supportedLanguages,
            mlFeatures: agentData.mlFeatures
        });
        
    } catch (error) {
        console.error('Error checking model:', error);
    }
}

// At the top of your file after the CREDENTIALS
checkDialogflowModel().then(() => {
    console.log('Model check complete');
});

// Add this function at the top of background.js
async function getOrCreateSessionId() {
    try {
        // Get existing session ID from storage
        const data = await chrome.storage.local.get('dialogflowSessionId');
        if (data.dialogflowSessionId) {
            return data.dialogflowSessionId;
        }
        
        // Create new session ID if none exists
        const sessionId = 'session_' + Date.now();
        await chrome.storage.local.set({ dialogflowSessionId: sessionId });
        return sessionId;
    } catch (error) {
        console.error('Session ID error:', error);
        return 'fallback_session_' + Date.now();
    }
} 