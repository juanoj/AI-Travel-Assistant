const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
    const parameters = req.body.queryResult.parameters;
    const departure = parameters.departure_city;
    const destination = parameters.destination_city;
    const date = parameters.travel_date;
    const budget = parameters.budget;

    const serpApiKey = "YOUR_SERPAPI_KEY";

    try {
        const response = await axios.get("https://serpapi.com/search", {
            params: {
                engine: "google_flights",
                departure_id: departure,
                arrival_id: destination,
                date: date,
                price_to: budget,
                api_key: serpApiKey
            }
        });

        const flightDetails = response.data.results ? response.data.results[0] : "No flights found.";
        res.json({
            fulfillmentText: `Here is a flight from ${departure} to ${destination}: ${flightDetails}`
        });
    } catch (error) {
        console.error("Error fetching flight data:", error);
        res.json({ fulfillmentText: "Sorry, I encountered an error fetching flight details." });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`✅ Webhook is running on port ${PORT}`);
});
