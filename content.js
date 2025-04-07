
// Log activation of the extension
console.log("AI Travel Assistant is active on Google Flights!");

// Add a floating AI chat button to the page
const chatButton = document.createElement("button");
chatButton.innerText = "AI Flight Assistant";
chatButton.style.position = "fixed";
chatButton.style.bottom = "20px";
chatButton.style.right = "20px";
chatButton.style.padding = "10px";
chatButton.style.backgroundColor = "#4285F4";
chatButton.style.color = "white";
chatButton.style.border = "none";
chatButton.style.borderRadius = "5px";
chatButton.style.cursor = "pointer";
document.body.appendChild(chatButton);

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.query) {
        console.log("Received query from popup.js:", request.query);

        // Find the Google Flights search input and update it
        let searchBox = document.querySelector("input[aria-label='Where from?']");
        if (searchBox) {
            searchBox.value = request.query; // Update search input
            searchBox.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
        }

        sendResponse({ status: "Query updated on Google Flights page" });
    }
});
