const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  time: { type: String, required: true },
  title: { type: String, required: true },
  type: {
    type: String,
    default: 'attraction',
  },
  location: {
    name: { type: String },
    lat: { type: Number },
    lng: { type: Number },
  },
  duration: { type: String },
  cost: { type: Number, default: 0 },
  description: { type: String, default: '' },
  rating: { type: Number },
  transport: {
    mode: { type: String },
    duration: { type: String },
    cost: { type: Number, default: 0 },
  },
});

const itinerarySchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  days: [{
    dayNumber: { type: Number, required: true },
    date: { type: Date },
    activities: [activitySchema],
  }],
  budgetBreakdown: {
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  packingList: [{
    category: { type: String },
    items: [{
      name: { type: String },
      packed: { type: Boolean, default: false },
    }],
  }],
  weather: [{
    date: { type: Date },
    temp: { type: Number },
    condition: { type: String },
    icon: { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

itinerarySchema.pre('save', async function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Itinerary', itinerarySchema);
