const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type: { type: String, enum: ['1:1', 'group', 'trip-group'], required: true },
  name: { type: String },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip' },
  destination: { type: String },
  participants: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: {
    text: { type: String },
    senderId: { type: mongoose.Schema.Types.ObjectId },
    senderName: { type: String },
    timestamp: { type: Date },
    type: { type: String, default: 'text' },
  },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.index({ 'participants.userId': 1, updatedAt: -1 });
conversationSchema.index({ tripId: 1 });
conversationSchema.index({ destination: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
