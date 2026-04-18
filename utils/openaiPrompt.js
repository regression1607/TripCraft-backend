function buildItineraryPrompt(trip) {
  const transportModes = trip.transportModes?.length > 0 ? trip.transportModes.join(', ') : 'any';
  const hasCarOrBike = trip.transportModes?.some(m => ['car', 'bike'].includes(m));

  return `You are a professional solo travel planner. Create a detailed day-by-day itinerary for a solo traveler.

TRIP DETAILS:
- Starting From: ${trip.currentLocation?.name ? `${trip.currentLocation.name}, ${trip.currentLocation.country || ''}` : 'Not specified'}
- Destination: ${trip.destination.name}, ${trip.destination.country}
- Duration: ${trip.days} days
- Arrival: ${trip.arrivalDate}
- Departure: ${trip.departureDate}
- Total Budget: ${trip.budget.amount} ${trip.budget.currency}
- Accommodation: ${trip.accommodation}
- Transport Modes: ${transportModes}
- Travel Style: ${trip.travelStyle?.join(', ') || 'Mixed'}
- Interests: ${trip.interests?.join(', ') || 'General'}
- Special Requirements: ${trip.specialRequirements || 'None'}

REQUIREMENTS:
1. Create a schedule for each day with specific times
2. Include real place names with approximate GPS coordinates (lat/lng)
3. Include estimated costs for each activity in ${trip.budget.currency}
4. Suggest specific restaurants with cuisine type
5. Use ONLY these transport modes between locations: ${transportModes}
6. Stay within the total budget of ${trip.budget.amount} ${trip.budget.currency}
7. Include a budget breakdown by category
8. Include a packing list based on destination weather and activities
${hasCarOrBike ? `9. IMPORTANT: For car/bike travel, include approximate toll costs and fuel costs in the transport section for each journey segment. Use "tollCost" and "fuelCost" fields in the transport object.` : ''}

All costs must be in ${trip.budget.currency}.

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
          "transport": { "mode": "${transportModes.split(',')[0]?.trim() || 'walk'}", "duration": "10 min", "cost": 0${hasCarOrBike ? ', "tollCost": 0, "fuelCost": 0' : ''} }
        }
      ]
    }
  ],
  "budgetBreakdown": {
    "accommodation": 0,
    "food": 0,
    "transport": 0,
    "activities": 0,
    "shopping": 0,${hasCarOrBike ? '\n    "tolls": 0,\n    "fuel": 0,' : ''}
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
