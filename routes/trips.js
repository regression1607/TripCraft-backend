const express = require('express');
const router = express.Router();
const Trip = require('../models/Trip');
const Itinerary = require('../models/Itinerary');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

// Helper to get user and validate ownership
async function getUserId(req) {
  const user = await User.findOne({ firebaseUid: req.user.uid });
  return user?._id || null;
}

// POST /api/trips - Create trip (whitelist fields, no mass assignment)
router.post('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const { destination, currentLocation, arrivalDate, departureDate, days,
      budget, accommodation, travelPace, travelStyle, interests, specialRequirements } = req.body;

    // Validation
    if (!destination?.name) return res.status(400).json({ error: 'Destination name is required' });
    if (!arrivalDate || !departureDate) return res.status(400).json({ error: 'Arrival and departure dates are required' });
    if (!days || days < 1 || days > 30) return res.status(400).json({ error: 'Days must be between 1 and 30' });
    if (!budget?.amount || budget.amount < 1) return res.status(400).json({ error: 'Budget amount is required' });
    if (new Date(departureDate) <= new Date(arrivalDate)) {
      return res.status(400).json({ error: 'Departure must be after arrival' });
    }

    const trip = await Trip.create({
      userId,
      destination: {
        name: String(destination.name).slice(0, 100),
        country: String(destination.country || '').slice(0, 100),
      },
      currentLocation: currentLocation ? {
        name: String(currentLocation.name || '').slice(0, 100),
        region: String(currentLocation.region || '').slice(0, 100),
        country: String(currentLocation.country || '').slice(0, 100),
        lat: Number(currentLocation.lat) || undefined,
        lng: Number(currentLocation.lng) || undefined,
      } : undefined,
      arrivalDate: new Date(arrivalDate),
      departureDate: new Date(departureDate),
      days: Math.min(Math.max(1, Number(days)), 30),
      budget: {
        amount: Math.min(Number(budget.amount), 100000),
        currency: ['USD','EUR','GBP','INR','JPY','AUD','CAD','THB'].includes(budget.currency) ? budget.currency : 'USD',
      },
      accommodation: ['hotel','hostel','airbnb','any'].includes(accommodation) ? accommodation : 'any',
      travelPace: ['fast','balanced','slow'].includes(travelPace) ? travelPace : 'balanced',
      travelStyle: Array.isArray(travelStyle) ? travelStyle.slice(0, 10).map(s => String(s).slice(0, 50)) : [],
      interests: Array.isArray(interests) ? interests.slice(0, 15).map(s => String(s).slice(0, 50)) : [],
      specialRequirements: String(specialRequirements || '').slice(0, 500),
    });

    res.status(201).json({ trip });
  } catch (error) {
    console.error('Create trip error:', error.message);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

// GET /api/trips - List user's trips (with batched coords lookup)
router.get('/', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const trips = await Trip.find({ userId }).sort({ createdAt: -1 }).lean();

    // Batch lookup coords for trips missing them
    const tripsNeedingCoords = trips.filter(t => !t.destination?.lat || !t.destination?.lng);
    if (tripsNeedingCoords.length > 0) {
      const tripIds = tripsNeedingCoords.map(t => t._id);
      const itineraries = await Itinerary.find({ tripId: { $in: tripIds } }).lean();
      const itinMap = new Map(itineraries.map(i => [String(i.tripId), i]));

      for (const trip of tripsNeedingCoords) {
        const itin = itinMap.get(String(trip._id));
        const firstWithCoords = itin?.days?.[0]?.activities?.find(a => a.location?.lat && a.location?.lng);
        if (firstWithCoords) {
          trip.destination.lat = firstWithCoords.location.lat;
          trip.destination.lng = firstWithCoords.location.lng;
        }
      }
    }

    res.json({ trips });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

// GET /api/trips/:id - Get trip + itinerary (with ownership check)
router.get('/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const trip = await Trip.findOne({ _id: req.params.id, userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const itinerary = await Itinerary.findOne({ tripId: trip._id });
    res.json({ trip, itinerary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

// DELETE /api/trips/:id - Delete trip (with ownership check)
router.delete('/:id', async (req, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(404).json({ error: 'User not found' });

    const trip = await Trip.findOneAndDelete({ _id: req.params.id, userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    await Itinerary.deleteOne({ tripId: trip._id });
    res.json({ message: 'Trip deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

module.exports = router;
