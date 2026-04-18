const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  destination: {
    name: { type: String, required: true },
    country: { type: String, default: '' },
    lat: { type: Number },
    lng: { type: Number },
  },
  currentLocation: {
    name: { type: String },
    region: { type: String },
    country: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  arrivalDate: { type: Date, required: true },
  departureDate: { type: Date, required: true },
  days: { type: Number, required: true },
  budget: {
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
  },
  accommodation: {
    type: String,
    enum: ['hotel', 'hostel', 'airbnb', 'any'],
    default: 'any',
  },
  travelPace: {
    type: String,
    enum: ['fast', 'balanced', 'slow'],
    default: 'balanced',
  },
  transportModes: [{ type: String }],
  travelStyle: [{ type: String }],
  interests: [{ type: String }],
  specialRequirements: { type: String, default: '' },
  status: {
    type: String,
    enum: ['generating', 'ready', 'error'],
    default: 'generating',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Trip', tripSchema);
