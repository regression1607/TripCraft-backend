function buildItineraryPrompt(trip) {
  return `You are a professional solo travel planner. Create a detailed day-by-day itinerary for a solo traveler.

TRIP DETAILS:
- Starting From: ${trip.currentLocation?.name ? `${trip.currentLocation.name}, ${trip.currentLocation.country || ''}` : 'Not specified'}
- Destination: ${trip.destination.name}, ${trip.destination.country}
- Duration: ${trip.days} days
- Arrival: ${trip.arrivalDate}
- Departure: ${trip.departureDate}
- Total Budget: ${trip.budget.amount} ${trip.budget.currency}
- Accommodation: ${trip.accommodation}
- Travel Pace: ${trip.travelPace}
- Travel Style: ${trip.travelStyle?.join(', ') || 'Mixed'}
- Interests: ${trip.interests?.join(', ') || 'General'}
- Special Requirements: ${trip.specialRequirements || 'None'}

REQUIREMENTS:
1. Create a schedule for each day with specific times
2. Include real place names with approximate GPS coordinates (lat/lng)
3. Include estimated costs for each activity in ${trip.budget.currency}
4. Suggest specific restaurants with cuisine type
5. Include transport suggestions between locations
6. Stay within the total budget
7. Match the travel pace (${trip.travelPace})
8. Include a budget breakdown by category
9. Include a packing list based on destination weather and activities

Respond ONLY with valid JSON in this exact format:
{
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "time": "09:00",
          "title": "Place Name",
          "type": "attraction|food|transport|hotel|shopping",
          "location": { "name": "Area Name", "lat": 35.6762, "lng": 139.6503 },
          "duration": "2 hours",
          "cost": 0,
          "description": "Brief description",
          "rating": 4.5,
          "transport": { "mode": "walk|train|bus|taxi", "duration": "10 min", "cost": 0 }
        }
      ]
    }
  ],
  "budgetBreakdown": {
    "accommodation": 0,
    "food": 0,
    "transport": 0,
    "activities": 0,
    "shopping": 0,
    "total": 0
  },
  "packingList": [
    {
      "category": "Essentials",
      "items": [{ "name": "Passport", "packed": false }]
    }
  ]
}`;
}

module.exports = { buildItineraryPrompt };
