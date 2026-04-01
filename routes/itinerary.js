const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const Trip = require('../models/Trip');
const Itinerary = require('../models/Itinerary');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
const { buildItineraryPrompt } = require('../utils/openaiPrompt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.use(verifyToken);

// Helper to verify trip ownership
async function verifyTripOwnership(req, tripId) {
  const user = await User.findOne({ firebaseUid: req.user.uid });
  if (!user) return null;
  const trip = await Trip.findOne({ _id: tripId, userId: user._id });
  return trip;
}

router.post('/generate', async (req, res) => {
  try {
    const { tripId } = req.body;
    if (!tripId) return res.status(400).json({ error: 'tripId is required' });

    console.log('[GENERATE] Starting for tripId:', tripId);

    const trip = await verifyTripOwnership(req, tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    console.log('[GENERATE] Trip found:', trip.destination?.name);

    // Delete existing itinerary if regenerating
    await Itinerary.deleteOne({ tripId: trip._id });

    trip.status = 'generating';
    await trip.save();

    const prompt = buildItineraryPrompt(trip);
    console.log('[GENERATE] Calling OpenAI...');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 16000,
    });

    const content = completion.choices[0].message.content;
    const finishReason = completion.choices[0].finish_reason;
    console.log('[GENERATE] OpenAI response length:', content.length, 'finish:', finishReason);

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[GENERATE] JSON parse failed, attempting fix...');
      let fixed = content;
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;

      fixed = fixed.replace(/,\s*"[^"]*$/, '');
      fixed = fixed.replace(/,\s*$/, '');
      for (let i = 0; i < openBrackets - closeBrackets; i++) fixed += ']';
      for (let i = 0; i < openBraces - closeBraces; i++) fixed += '}';

      try {
        parsed = JSON.parse(fixed);
        console.log('[GENERATE] Fixed truncated JSON');
      } catch (fixErr) {
        trip.status = 'error';
        await trip.save();
        return res.status(500).json({ error: 'AI generated invalid response. Please try again.' });
      }
    }

    // Validate parsed data has required structure
    if (!parsed.days || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      trip.status = 'error';
      await trip.save();
      return res.status(500).json({ error: 'AI response missing itinerary days. Please try again.' });
    }

    console.log('[GENERATE] Parsed days:', parsed.days.length, 'Budget total:', parsed.budgetBreakdown?.total);

    const arrivalDate = new Date(trip.arrivalDate);
    const daysWithDates = parsed.days.map((day) => ({
      ...day,
      date: new Date(arrivalDate.getTime() + ((day.dayNumber || 1) - 1) * 86400000),
    }));

    const itinerary = await Itinerary.create({
      tripId: trip._id,
      days: daysWithDates,
      budgetBreakdown: parsed.budgetBreakdown || {},
      packingList: parsed.packingList || [],
    });
    console.log('[GENERATE] Itinerary saved:', itinerary._id);

    // Save first activity coords to trip for explore map
    const firstActivity = daysWithDates[0]?.activities?.find(a => a.location?.lat && a.location?.lng);
    if (firstActivity) {
      trip.destination.lat = firstActivity.location.lat;
      trip.destination.lng = firstActivity.location.lng;
    }

    trip.status = 'ready';
    await trip.save();

    res.json({ itinerary });
  } catch (error) {
    console.error('[GENERATE] ERROR:', error.message);

    if (req.body.tripId) {
      await Trip.findByIdAndUpdate(req.body.tripId, { status: 'error' }).catch(() => {});
    }

    // Never leak internal error details to client
    res.status(500).json({ error: 'Failed to generate itinerary. Please try again.' });
  }
});

// PUT /api/itinerary/:id - Update itinerary (with ownership check, whitelist fields)
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify ownership through trip
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

    const trip = await Trip.findOne({ _id: itinerary.tripId, userId: user._id });
    if (!trip) return res.status(404).json({ error: 'Itinerary not found' });

    // Whitelist only allowed fields
    const { days, packingList } = req.body;
    if (days) itinerary.days = days;
    if (packingList) itinerary.packingList = packingList;

    await itinerary.save();
    res.json({ itinerary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update itinerary' });
  }
});

module.exports = router;
