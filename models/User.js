const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-z0-9_]+$/,
    index: true,
  },
  name: { type: String, required: true },
  email: { type: String, required: true, index: true },
  avatar: { type: String, default: '' },
  defaultCurrency: { type: String, default: 'USD' },
  fcmToken: { type: String, default: '' },
  subscription: {
    tier: { type: String, enum: ['free', 'monthly', 'yearly'], default: 'free' },
    startDate: { type: Date },
    expiresAt: { type: Date },
    tripsThisMonth: { type: Number, default: 0 },
    tripsResetAt: { type: Date },
    totalTripsCreated: { type: Number, default: 0 },
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
