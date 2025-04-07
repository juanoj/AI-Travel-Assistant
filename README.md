# AI-Travel-Assistant
Making easier to search for flights

# ✈️ AI Travel Assistant Chrome Extension  
## A Smart Flight Search Assistant Powered by Dialogflow & SerpAPI

![AI Travel Assistant](images/icon128.png)

This Chrome Extension leverages Google Dialogflow for natural language understanding and integrates with SerpAPI to extract real-time flight options from Google Flights. The assistant can autofill the Google Flights search form based on user input and even send selected results via email.

---

## 🧠 Features

- Conversational flight search using natural language
- Autofills Google Flights search forms
- Retrieves and displays top 3 cheapest flights
- Handles no result scenarios with alternatives
- Emails results to the user on request
- Maintains session context and handles multi-turn interactions

---

## 📁 Project Structure

| File/Folder | Description |
|-------------|-------------|
| `manifest.json` | Chrome Extension manifest (v3) |
| `popup.html` | Chat-based popup UI |
| `popup.js` | Main frontend script managing input/output |
| `background.js` | Message relay between content scripts and Dialogflow |
| `content.js` | Directly interacts with Google Flights DOM |
| `main.py` | Google Cloud Function webhook processing Dialogflow requests and SerpAPI queries |
| `styles.css` | Style definitions for the extension popup |

---

## ⚙️ Installation

1. Clone or download the repository.
2. Go to `chrome://extensions` and enable "Developer mode".
3. Click "Load unpacked" and select the folder.
4. Interact with the popup to start searching for flights using natural language!

---

## 🌐 API & Configuration

- Dialogflow setup using custom intent and entity models (FindFlights)
- Backend deployed as a Google Cloud Function (`main.py`) connected to Dialogflow
- Requires SerpAPI key stored securely via environment variable or Secret Manager
- SMTP credentials configured within the cloud function for email service

---

## 🛠️ Build & Deployment

- Built using HTML/CSS/JavaScript (Chrome Extension MV3)
- NLP handled via Google Dialogflow CX
- Webhook hosted via Google Cloud Functions
- SerpAPI used for scraping Google Flights data

---

## 🚀 Future Enhancements

- Enable OAuth for Gmail-based email sending
- Add support for hotel & rental car searches
- Allow preference-based filtering (airlines, layovers, time ranges)
- UI improvements & animation for chatbot interface

---

## 📧 Contact & Support
For bug reports, questions, or collaboration:
📮 Email: support@ai-travel-assistant.com  
🐛 Issues: [GitHub Issues Page](https://github.com/yourusername/ai-travel-assistant/issues)

---

## Source Code Overview

Below is an overview of the main components from the AI Travel Assistant browser extension and backend integration.

### 📁 `popup.js`
```javascript
// Sample from popup.js
document.getElementById("send-btn").addEventListener("click", function () {
  const input = document.getElementById("user-input").value;
  addMessage(input, "user");
  sendToDialogflow(input);
});
```

### 📁 `main.py`
```python
# Sample from main.py
@app.route("/", methods=["POST"])
def dialogflow_webhook():
    req = request.get_json(force=True)
    departure_city = req.get("queryResult", {}).get("parameters", {}).get("departure_city", "")
    # Logic here
    return jsonify({"fulfillmentText": flight_summary})
```

### 📁 `content.js`, `background.js`, `manifest.json`
These files handle communication between the browser popup, content script, and external API via background messaging and permissions declarations.
(Full code is included in the project directory)

## 🧠 AI and NLP Configuration

### Dialogflow
- Trained with sample utterances such as: "Find flights from Toronto to New York on May 10 for $400"
- Extracts intent and entities like `departure_city`, `destination_city`, `date`, and `budget`
- Responds via webhook to trigger Google Flights autofill and fetch SerpAPI responses.

### SERPAPI Integration
- Uses Google Flights as a data provider.
- Key-based authentication handled in `main.py`.

## 💻 Browser Extension Architecture

```
User → Chat UI → Background Script → Dialogflow ↔ Cloud Function (Webhook)
                                              ↓
                      Popup UI ↔ Content Script → Google Flights DOM
                                              ↓
                          Cloud Function → SMTP → User's Email
```

## 📦 Installation and Usage
- Clone repository and load extension via Chrome's Extension Settings in Developer Mode
- Ensure Google API Key and Dialogflow credentials are set in `main.py`
- Deploy `main.py` as a Google Cloud Function

## 🧪 Testing and Validation
- Test Plan: see `test_cases.md`
- Sample CURL for backend:
```bash
curl -X POST "https://<your-cloud-function-url>" -H "Content-Type: application/json" -d '{
  "queryResult": {
    "parameters": {
      "departure_city": "Toronto",
      "destination_city": "New York",
      "date": "2025-10-10",
      "budget": "500"
    }
  }
}'
```

