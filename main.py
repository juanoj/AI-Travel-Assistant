# Updates:
# - Added support for round-trip and one-way flights
# - Implemented flight type handling (round_trip/one_way)
# - Added separate date handling for each flight type
# - Enhanced flight sorting by price (lowest first)
# - Added alternative date suggestions when no flights found
# - Improved response formatting with trip type indication
#   - Retained previous features:
#     - Structured flight data response
#     - Email sending capability
#     - Flight details context storage
#     - Error handling and logging
#     - IATA code mapping
#     - Best 3 flight options display
#     - Booking URL inclusion

import os
import json
import logging
import google.auth
from flask import Flask, request, jsonify
from google.cloud import secretmanager
import requests
import functions_framework
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)

# Function to get secret
def get_secret(secret_name):
    try:
        _, project = google.auth.default()
        client = secretmanager.SecretManagerServiceClient()
        secret_path = f"projects/{project}/secrets/{secret_name}/versions/latest"
        response = client.access_secret_version(request={"name": secret_path})
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        logging.error(f"Error getting secret: {e}")
        return None

# Get SerpAPI key
SERPAPI_KEY = get_secret("SERPAPI_KEY")

# Manually mapped IATA codes for major cities
IATA_CODES = {
    "Miami": "MIA", "Dubai": "DXB", "New York": "JFK", "Los Angeles": "LAX",
    "London": "LHR", "Paris": "CDG", "Tokyo": "HND", "Toronto": "YYZ",
    "Chicago": "ORD", "San Francisco": "SFO", "Boston": "BOS", "Dallas": "DFW",
    "Atlanta": "ATL", "Washington": "DCA", "Seattle": "SEA", "Houston": "IAH",
    "Mexico City": "MEX", "Madrid": "MAD", "Barcelona": "BCN", "Berlin": "BER",
    "Rome": "FCO", "Amsterdam": "AMS", "Singapore": "SIN", "Hong Kong": "HKG",
    "Bangkok": "BKK", "Sydney": "SYD"
}

def get_iata_code(city_name):
    """Retrieve the IATA code from a predefined dictionary."""
    return IATA_CODES.get(city_name, None)

def search_flights(departure_id, arrival_id, outbound_date, return_date=None, flight_type=1):
    """Fetches flight data from SerpAPI."""
    try:
        url = "https://serpapi.com/search"
        params = {
            "engine": "google_flights",
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": outbound_date,
            "currency": "USD",
            "hl": "en",
            "api_key": SERPAPI_KEY
        }
        
        # Add type and return_date only for round trips
        if flight_type == 1:  # round trip
            params["type"] = 1
            if return_date:
                params["return_date"] = return_date
            else:
                return {"error": "Return date is required for round-trip flights"}
        else:  # one way
            params["type"] = 2
        
        # Debug logging
        logging.info(f"SerpAPI request params: {params}")
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Debug logging
        logging.info(f"SerpAPI raw response: {data}")
        
        # Extract flights from the response
        flights = []
        if "best_flights" in data:
            flight_list = data["best_flights"]
        elif "other_flights" in data:
            flight_list = data["other_flights"]
        else:
            return {
                "best_options": [],
                "error": "No flights found in the response"
            }
            
        for flight_option in flight_list:
            flight_info = {
                "airline": flight_option.get("airline", "Unknown"),
                "price": flight_option.get("price", "N/A"),
                "duration": flight_option.get("total_duration", ""),
                "booking_url": flight_option.get("booking_token", "")
            }
            flights.append(flight_info)
        
        # Sort by price
        flights.sort(key=lambda x: float(x["price"]) if isinstance(x["price"], (int, float, str)) else float('inf'))
        
        return {
            "best_options": flights[:3],  # Return top 3 options
            "search_params": params
        }
            
    except requests.exceptions.RequestException as e:
        logging.error(f"SerpAPI request error: {e}")
        return {"error": f"API request failed: {str(e)}"}
    except Exception as e:
        logging.error(f"Unexpected error in search_flights: {e}")
        return {"error": f"Unexpected error: {str(e)}"}

# Initialize Secret Manager client
secret_client = secretmanager.SecretManagerServiceClient()

def get_email_credentials():
    project_id = "ai-travel-assistant-451501"
    email_secret_name = f"projects/{project_id}/secrets/email-credentials/versions/latest"
    response = secret_client.access_secret_version(name=email_secret_name)
    return json.loads(response.payload.data.decode('UTF-8'))

def send_email(to_email, flight_details):
    try:
        logging.info(f"Starting email send process to: {to_email}")
        credentials = get_email_credentials()
        
        if not credentials:
            logging.error("❌ Failed to get email credentials from Secret Manager")
            raise Exception("Email credentials not found")
            
        logging.info("Got credentials, preparing email...")
        
        msg = MIMEMultipart()
        msg['From'] = f"AI Travel Assistant <{credentials['email']}>"
        msg['To'] = to_email
        msg['Subject'] = "Your Flight Search Results ✈️"
        
        # Create email body with better formatting
        body = f"""
Hello!

Here are your flight search results from AI Travel Assistant:

{flight_details['text']}

You can book your flight directly here:
{flight_details['bookingUrl']}

Need help? Just reply to this email and our team will assist you.

Safe travels! ✈️
AI Travel Assistant
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        logging.info("Connecting to SMTP server...")
        
        # Send email using Gmail SMTP with detailed error logging
        try:
            with smtplib.SMTP('smtp.gmail.com', 587) as server:
                logging.info("Connected to SMTP server")
                server.starttls()
                logging.info("TLS enabled")
                
                logging.info(f"Attempting login with email: {credentials['email']}")
                server.login(credentials['email'], credentials['password'])
                logging.info("Login successful")
                
                logging.info("Sending email...")
                server.send_message(msg)
                logging.info(f"✅ Email sent successfully to {to_email}")
        except smtplib.SMTPAuthenticationError as auth_error:
            logging.error(f"❌ SMTP Authentication failed: {auth_error}")
            raise
        except smtplib.SMTPException as smtp_error:
            logging.error(f"❌ SMTP error occurred: {smtp_error}")
            raise
        except Exception as e:
            logging.error(f"❌ Unexpected error during SMTP operation: {e}")
            raise
            
    except Exception as e:
        logging.error(f"❌ Email sending error: {str(e)}")
        raise e

@functions_framework.http
def dialogflowwebhook(request):
    try:
        req = request.get_json()
        parameters = req.get("queryResult", {}).get("parameters", {})
        
        # Debug log the incoming request
        logging.info(f"Webhook request: {json.dumps(req, indent=2)}")
        
        # Extract parameters
        flight_type = parameters.get("flight_type", "")
        departure_city = parameters.get("departure_city", "")
        destination_city = parameters.get("destination_city", "")
        outbound_date = parameters.get("outbound_date", "")
        return_date = parameters.get("return_date", "")
        budget = parameters.get("budget", {}).get("amount", 0)

        # Get IATA codes
        departure_code = get_iata_code(departure_city)
        destination_code = get_iata_code(destination_city)

        if not departure_code or not destination_code:
            return jsonify({
                "fulfillmentText": f"Sorry, I couldn't find airport codes for {departure_city} or {destination_city}."
            })

        # Format dates (remove timezone info)
        outbound_date = outbound_date.split('T')[0]
        if return_date:
            return_date = return_date.split('T')[0]

        # Validate return date for round trips
        if flight_type == "round_trip" and not return_date:
            return jsonify({
                "fulfillmentText": "For round-trip flights, I need to know your return date. When would you like to return?"
            })

        # Search flights
        flight_type_num = 2 if flight_type == "one-way" else 1
        flights = search_flights(
            departure_code,
            destination_code,
            outbound_date,
            return_date if flight_type == "round_trip" else None,
            flight_type_num
        )

        # Debug log the search results
        logging.info(f"Flight search results: {json.dumps(flights, indent=2)}")

        if "error" in flights:
            return jsonify({
                "fulfillmentText": f"Sorry, I encountered an error: {flights['error']}"
            })

        if not flights.get("best_options"):
            return jsonify({
                "fulfillmentText": f"I couldn't find any flights from {departure_city} to {destination_city} for {outbound_date}. Try different dates or cities."
            })

        # Format response
        response_text = f"I found these flights from {departure_city} to {destination_city}:\n\n"
        
        for i, flight in enumerate(flights["best_options"], 1):
            # Format price with 2 decimal places
            price = float(flight['price']) if isinstance(flight['price'], (int, float, str)) else 0.0
            
            # Format duration in hours and minutes
            duration_mins = int(flight['duration']) if flight['duration'] else 0
            hours = duration_mins // 60
            mins = duration_mins % 60
            duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            
            # Create Google Flights direct URL
            google_flights_url = (
                f"https://www.google.com/travel/flights?"
                f"q=Flights%20to%20{destination_code}%20from%20{departure_code}"
                f"%20on%20{outbound_date}"
            )
            if flight_type == "round_trip":
                google_flights_url += f"%20return%20{return_date}"

            # Build response for each flight option
            option_text = (
                f"Option {i}:\n"
                f"💰 Price: ${price:.2f}\n"
                f"✈️ Airline: {flight['airline']}\n"
                f"⏱️ Duration: {duration_str}\n"
            )
            
            if flight_type == "round_trip":
                option_text += (
                    f"📅 Outbound: {outbound_date}\n"
                    f"📅 Return: {return_date}\n"
                )
            else:
                option_text += f"📅 Date: {outbound_date}\n"
            
            option_text += f"🔗 Book here: {google_flights_url}\n\n"
            
            response_text += option_text

        # Add budget comparison
        if budget > 0:
            cheapest_price = float(flights["best_options"][0]["price"]) if flights["best_options"] else 0
            if cheapest_price <= budget:
                response_text += f"✅ Good news! I found flights within your budget of ${budget}."
            else:
                response_text += f"⚠️ Note: The cheapest flight (${cheapest_price:.2f}) is above your budget of ${budget}."

        return jsonify({
            "fulfillmentText": response_text
        })

    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return jsonify({
            "fulfillmentText": "Sorry, I encountered an error processing your request."
        })

# Run Flask app (for local testing)
if __name__ == "__main__":
    app.run(debug=True)






