// Add this at the top of popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Clear any existing messages
    const chatbox = document.getElementById("chatbox");
    chatbox.innerHTML = '';
    
    // Add welcome message
    appendMessage('bot', 'Hello! Ask me about flights.');
});

// Listen for the send button click
document.getElementById("send-btn").addEventListener("click", async () => {
    const userInput = document.getElementById("user-input");
    const userMessage = userInput.value;
    if (!userMessage.trim()) return;
    
    // Add user message
    appendMessage('user', userMessage);
    
    // Clear input field
    userInput.value = '';

    // Show loading indicator
    appendMessage('loading', 'Thinking...');

    try {
        console.log('Sending message to background:', userMessage);
        
        const response = await chrome.runtime.sendMessage({
            action: 'sendToDialogflow',
            message: userMessage
        });

        removeLoadingMessage();

        if (response.error) {
            console.error('Error:', response.error);
            appendMessage('error', `Sorry, I encountered an error: ${response.error}`);
            return;
        }

        if (response.action === 'send_email') {
            appendMessage('bot', response.text);
            // Store the flight details for when email is provided
            if (response.parameters?.flightDetails) {
                await chrome.storage.local.set({ 
                    pendingFlightDetails: response.parameters.flightDetails 
                });
            }
        } else if (response.text) {
            appendMessage('bot', response.text);
            // Store the current flight details for potential email sharing
            await chrome.storage.local.set({ 
                lastFlightDetails: {
                    text: response.text,
                    bookingUrl: response.bookingUrl
                }
            });

            // If we have a booking URL, navigate to it
            if (response.bookingUrl) {
                try {
                    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
                    if (tabs[0]) {
                        await chrome.tabs.update(tabs[0].id, {
                            url: response.bookingUrl
                        });
                    }
                } catch (error) {
                    console.error('Error navigating to booking URL:', error);
                }
            }

            // Only try to update flight search if we're on a Google Flights page
            if (response.parameters?.departure_city && response.parameters?.destination_city) {
                try {
                    const tabs = await chrome.tabs.query({
                        active: true,
                        currentWindow: true,
                        url: "*://www.google.com/travel/flights*"
                    });
                    
                    if (tabs[0]) {
                        console.log('Updating flight search with parameters:', response.parameters);
                        await chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'updateFlightSearch',
                            parameters: response.parameters
                        }).catch(() => {
                            // Silently fail if not on flights page
                        });
                    }
                } catch (tabError) {
                    console.log('Not on Google Flights page');
                    // Silently fail - this is expected
                }
            }
        } else {
            appendMessage('error', 'Sorry, I received an empty response. Please try again.');
        }

    } catch (error) {
        removeLoadingMessage();
        console.error('Extension error:', error);
        appendMessage('error', `Connection error: ${error.message}`);
    }
});

// Add this function to format flight details for sharing
function formatFlightDetails(text) {
    // Extract flight information using regex
    const flightInfo = text.match(/✈️ Available flights:[\s\S]*?📌 Book here:/);
    const bookingLink = text.match(/📌 Book here: (https:\/\/[^\s]+)/);
    
    if (flightInfo && bookingLink) {
        return {
            details: flightInfo[0].replace('📌 Book here:', '').trim(),
            bookingUrl: bookingLink[1]
        };
    }
    return null;
}

// Enhanced share function with social media options
async function shareFlightResults(text) {
    const flightData = formatFlightDetails(text);
    if (!flightData) return;

    const shareData = {
        title: "Flight Search Results",
        text: `✈️ Check out this flight I found!\n${flightData.details}`,
        url: flightData.bookingUrl
    };

    // Create share buttons container
    const shareOptions = document.createElement('div');
    shareOptions.className = 'share-options';
    
    // WhatsApp
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text + '\n' + shareData.url)}`;
    const whatsappBtn = createShareButton('WhatsApp', '💬', () => window.open(whatsappUrl));
    
    // Twitter/X
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
    const twitterBtn = createShareButton('Twitter', '🐦', () => window.open(twitterUrl));
    
    // Telegram
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareData.url)}&text=${encodeURIComponent(shareData.text)}`;
    const telegramBtn = createShareButton('Telegram', '📬', () => window.open(telegramUrl));
    
    // Email
    const emailBtn = createShareButton('Email', '📧', () => {
        const emailSubject = encodeURIComponent("Flight Deal Found!");
        const emailBody = encodeURIComponent(shareData.text + '\n\n' + shareData.url);
        window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`);
    });

    // Add buttons to container
    shareOptions.appendChild(whatsappBtn);
    shareOptions.appendChild(twitterBtn);
    shareOptions.appendChild(telegramBtn);
    shareOptions.appendChild(emailBtn);

    return shareOptions;
}

function createShareButton(platform, emoji, onClick) {
    const button = document.createElement('button');
    button.className = 'share-button-social';
    button.innerHTML = `${emoji} ${platform}`;
    button.onclick = onClick;
    return button;
}

// Update appendMessage to use new sharing UI
function appendMessage(type, text) {
    const chatbox = document.getElementById("chatbox");
    const messageDiv = document.createElement('div');
    const messageP = document.createElement('p');
    
    if (type === 'bot' && text.includes('✈️ Available flights:')) {
        messageP.textContent = text;
        messageDiv.appendChild(messageP);
        
        // Add share options
        const shareBtn = document.createElement('button');
        shareBtn.className = 'share-button';
        shareBtn.innerHTML = '📤 Share Results';
        
        // Show share options when clicked
        shareBtn.onclick = async () => {
            const shareOptions = await shareFlightResults(text);
            // Remove existing share options if any
            const existingOptions = messageDiv.querySelector('.share-options');
            if (existingOptions) {
                existingOptions.remove();
            }
            messageDiv.appendChild(shareOptions);
        };
        
        messageDiv.appendChild(shareBtn);
    } else {
        messageP.textContent = text;
        messageDiv.appendChild(messageP);
    }
    
    messageDiv.className = type + '-message';
    if (type === 'loading') messageDiv.id = 'loading-message';
    
    chatbox.appendChild(messageDiv);
    chatbox.scrollTop = chatbox.scrollHeight;
}

// Helper function to remove loading message
function removeLoadingMessage() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

// Example of direct API integration
async function shareWithAPI(platform, data) {
    switch(platform) {
        case 'twitter':
            // Would require Twitter OAuth
            await chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: ['tweet.write']
            });
            break;
        case 'telegram':
            // Would require Telegram Bot API
            const botToken = 'YOUR_BOT_TOKEN';
            break;
        // etc...
    }
}


