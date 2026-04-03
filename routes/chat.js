const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

async function getUserId(req) {
  const user = await User.findOne({ firebaseUid: req.user.uid });
  return user;
}

// ─── CONVERSATIONS ──────────────────────────────────────────────────────────

// GET /api/chat/conversations - List user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const user = await getUserId(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const conversations = await Conversation.find({
      'participants.userId': user._id,
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .populate('participants.userId', 'name avatar username')
      .lean();

    // Calculate unread count per conversation
    for (const conv of conversations) {
      const unreadCount = await Message.countDocuments({
        conversationId: conv._id,
        senderId: { $ne: user._id },
        readBy: { $nin: [user._id] },
      });
      conv.unreadCount = unreadCount;
    }

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /api/chat/conversations - Create conversation
router.post('/conversations', async (req, res) => {
  try {
    const user = await getUserId(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { type, participantIds, name } = req.body;

    if (!type || !participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'type and participantIds are required' });
    }

    // For 1:1, check if conversation already exists
    if (type === '1:1') {
      if (participantIds.length !== 1) {
        return res.status(400).json({ error: '1:1 chat requires exactly one other participant' });
      }
      const otherId = participantIds[0];
      const existing = await Conversation.findOne({
        type: '1:1',
        'participants.userId': { $all: [user._id, otherId] },
        $expr: { $eq: [{ $size: '$participants' }, 2] },
      }).populate('participants.userId', 'name avatar username');

      if (existing) return res.json({ conversation: existing });
    }

    // Build participants array
    const allParticipantIds = [user._id, ...participantIds.filter(id => id !== user._id.toString())];
    const participants = allParticipantIds.map(id => ({ userId: id }));

    const conversation = await Conversation.create({
      type,
      name: type !== '1:1' ? (name || 'Group Chat') : undefined,
      participants,
      createdBy: user._id,
    });

    const populated = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'name avatar username');

    // Add system message
    if (type !== '1:1') {
      await Message.create({
        conversationId: conversation._id,
        senderId: null,
        senderName: 'System',
        text: `${user.name} created the group`,
        type: 'system',
      });
    }

    res.status(201).json({ conversation: populated });
  } catch (error) {
    console.error('Create conversation error:', error.message);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/chat/conversations/:id - Get conversation details
router.get('/conversations/:id', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      'participants.userId': user._id,
    }).populate('participants.userId', 'name avatar username');

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ conversation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/chat/conversations/:id/join - Join a trip-group
router.post('/conversations/:id/join', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Group not found' });
    if (conversation.type === '1:1') return res.status(400).json({ error: 'Cannot join a 1:1 chat' });

    const already = conversation.participants.some(p => p.userId.toString() === user._id.toString());
    if (already) return res.json({ conversation });

    conversation.participants.push({ userId: user._id });
    conversation.updatedAt = Date.now();
    await conversation.save();

    await Message.create({
      conversationId: conversation._id,
      senderId: null,
      senderName: 'System',
      text: `${user.name} joined the group`,
      type: 'system',
    });

    const populated = await Conversation.findById(conversation._id)
      .populate('participants.userId', 'name avatar username');
    res.json({ conversation: populated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// POST /api/chat/conversations/:id/leave - Leave a group
router.post('/conversations/:id/leave', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      'participants.userId': user._id,
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    conversation.participants = conversation.participants.filter(
      p => p.userId.toString() !== user._id.toString()
    );

    if (conversation.participants.length === 0) {
      await Message.deleteMany({ conversationId: conversation._id });
      await conversation.deleteOne();
      return res.json({ message: 'Group deleted (last member left)' });
    }

    conversation.updatedAt = Date.now();
    await conversation.save();

    await Message.create({
      conversationId: conversation._id,
      senderId: null,
      senderName: 'System',
      text: `${user.name} left the group`,
      type: 'system',
    });

    res.json({ message: 'Left group' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// DELETE /api/chat/conversations/:id - Delete conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      'participants.userId': user._id,
      type: '1:1',
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    await Message.deleteMany({ conversationId: conversation._id });
    await conversation.deleteOne();
    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ─── MESSAGES ───────────────────────────────────────────────────────────────

// GET /api/chat/messages/:convId - Get messages (paginated + polling)
router.get('/messages/:convId', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conv = await Conversation.findOne({
      _id: req.params.convId,
      'participants.userId': user._id,
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { limit = 25, before, after } = req.query;
    const query = { conversationId: req.params.convId };

    if (after) {
      query.createdAt = { $gt: new Date(after) };
      const messages = await Message.find(query).sort({ createdAt: 1 }).limit(50);
      return res.json({ messages, hasMore: false });
    }

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit), 50));

    const hasMore = messages.length === Math.min(Number(limit), 50);
    res.json({ messages: messages.reverse(), hasMore });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/chat/messages/:convId - Send message
router.post('/messages/:convId', async (req, res) => {
  try {
    const user = await getUserId(req);
    const conv = await Conversation.findOne({
      _id: req.params.convId,
      'participants.userId': user._id,
    });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    const { text, type = 'text', metadata } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required' });

    const message = await Message.create({
      conversationId: req.params.convId,
      senderId: user._id,
      senderName: user.name,
      text: text.trim().slice(0, 2000),
      type,
      metadata,
      readBy: [user._id],
    });

    // Update conversation lastMessage
    conv.lastMessage = {
      text: text.trim().slice(0, 100),
      senderId: user._id,
      senderName: user.name,
      timestamp: message.createdAt,
      type,
    };
    conv.updatedAt = Date.now();
    await conv.save();

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/chat/messages/:convId/read - Mark messages as read
router.post('/messages/:convId/read', async (req, res) => {
  try {
    const user = await getUserId(req);
    await Message.updateMany(
      {
        conversationId: req.params.convId,
        senderId: { $ne: user._id },
        readBy: { $nin: [user._id] },
      },
      { $addToSet: { readBy: user._id } }
    );
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// DELETE /api/chat/messages/:msgId - Delete own message
router.delete('/messages/delete/:msgId', async (req, res) => {
  try {
    const user = await getUserId(req);
    const message = await Message.findOneAndDelete({
      _id: req.params.msgId,
      senderId: user._id,
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ─── TRIP GROUPS ────────────────────────────────────────────────────────────

// GET /api/chat/trip-groups?destination=Tokyo
router.get('/trip-groups', async (req, res) => {
  try {
    const { destination } = req.query;
    if (!destination) return res.json({ groups: [] });

    const regex = new RegExp(destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const groups = await Conversation.find({
      type: 'trip-group',
      destination: regex,
    })
      .sort({ updatedAt: -1 })
      .limit(20)
      .populate('participants.userId', 'name avatar username')
      .lean();

    groups.forEach(g => {
      g.participantCount = g.participants.length;
    });

    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trip groups' });
  }
});

// POST /api/chat/trip-groups - Create trip group
router.post('/trip-groups', async (req, res) => {
  try {
    const user = await getUserId(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { tripId, destination, name } = req.body;
    if (!destination) return res.status(400).json({ error: 'Destination is required' });

    // Check if trip group already exists for this trip
    if (tripId) {
      const existing = await Conversation.findOne({ tripId });
      if (existing) return res.json({ conversation: existing });
    }

    const conversation = await Conversation.create({
      type: 'trip-group',
      name: name || `Trip to ${destination}`,
      tripId,
      destination,
      participants: [{ userId: user._id }],
      createdBy: user._id,
    });

    await Message.create({
      conversationId: conversation._id,
      senderId: null,
      senderName: 'System',
      text: `Trip group created for ${destination}`,
      type: 'system',
    });

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Create trip group error:', error.message);
    res.status(500).json({ error: 'Failed to create trip group' });
  }
});

// ─── UNREAD ─────────────────────────────────────────────────────────────────

// GET /api/chat/unread - Total unread count for badge
router.get('/unread', async (req, res) => {
  try {
    const user = await getUserId(req);
    if (!user) return res.json({ totalUnread: 0 });

    const conversations = await Conversation.find({
      'participants.userId': user._id,
    }).select('_id');

    const convIds = conversations.map(c => c._id);

    const totalUnread = await Message.countDocuments({
      conversationId: { $in: convIds },
      senderId: { $ne: user._id },
      readBy: { $nin: [user._id] },
    });

    res.json({ totalUnread });
  } catch (error) {
    res.json({ totalUnread: 0 });
  }
});

module.exports = router;
