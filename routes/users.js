const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

// Helper to get current user
async function getUser(req) {
  return User.findOne({ firebaseUid: req.user.uid });
}

// GET /api/users/search?q=john
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [] });

    const currentUser = await getUser(req);
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      _id: { $ne: currentUser._id },
      $or: [
        { name: regex },
        { email: regex },
        { username: regex },
      ],
    })
      .select('name email avatar username')
      .limit(20);

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/users/check-username?username=eka4827
router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 3) {
      return res.json({ available: false, reason: 'Username must be at least 3 characters' });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.json({ available: false, reason: 'Only lowercase letters, numbers, and underscores' });
    }
    if (username.length > 20) {
      return res.json({ available: false, reason: 'Username must be 20 characters or less' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    const currentUser = await getUser(req);

    // Available if no one has it, or current user already has it
    const available = !existing || existing._id.toString() === currentUser._id.toString();
    res.json({ available });
  } catch (error) {
    res.status(500).json({ error: 'Check failed' });
  }
});

// PUT /api/users/username
router.put('/username', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Only lowercase letters, numbers, and underscores allowed' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    const currentUser = await getUser(req);

    if (existing && existing._id.toString() !== currentUser._id.toString()) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    currentUser.username = username.toLowerCase();
    await currentUser.save();
    res.json({ user: currentUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update username' });
  }
});

// PUT /api/users/profile-photo
router.put('/profile-photo', async (req, res) => {
  try {
    const { avatar } = req.body;
    if (!avatar || !avatar.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    // Validate size (~100KB max for base64 of 150x150 image)
    if (avatar.length > 150000) {
      return res.status(400).json({ error: 'Image too large. Please use a smaller photo.' });
    }

    const user = await getUser(req);
    user.avatar = avatar;
    await user.save();
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

// DELETE /api/users/profile-photo
router.delete('/profile-photo', async (req, res) => {
  try {
    const user = await getUser(req);
    user.avatar = '';
    await user.save();
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove photo' });
  }
});

// ─── FRIENDS ──────────────────────────────────────────────────────────────

const Friend = require('../models/Friend');

// POST /api/users/friends - Send friend request
router.post('/friends', async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId is required' });

    const user = await getUser(req);
    if (friendId === user._id.toString()) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    const existing = await Friend.findOne({
      $or: [
        { userId: user._id, friendId },
        { userId: friendId, friendId: user._id },
      ],
    });
    if (existing) return res.json({ friend: existing });

    const friend = await Friend.create({ userId: user._id, friendId });
    res.status(201).json({ friend });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// GET /api/users/friends - List friends
router.get('/friends', async (req, res) => {
  try {
    const user = await getUser(req);
    const friends = await Friend.find({
      $or: [{ userId: user._id }, { friendId: user._id }],
    }).populate('userId', 'name email avatar username')
      .populate('friendId', 'name email avatar username');

    // Map to show the "other" person
    const mapped = friends.map(f => {
      const isRequester = f.userId._id.toString() === user._id.toString();
      return {
        _id: f._id,
        status: f.status,
        friend: isRequester ? f.friendId : f.userId,
        isSentByMe: isRequester,
        createdAt: f.createdAt,
      };
    });

    res.json({ friends: mapped });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// PUT /api/users/friends/:id/accept - Accept friend request
router.put('/friends/:id/accept', async (req, res) => {
  try {
    const user = await getUser(req);
    const friend = await Friend.findOne({ _id: req.params.id, friendId: user._id, status: 'pending' });
    if (!friend) return res.status(404).json({ error: 'Friend request not found' });

    friend.status = 'accepted';
    await friend.save();
    res.json({ friend });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept request' });
  }
});

// DELETE /api/users/friends/:id - Remove friend
router.delete('/friends/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    await Friend.findOneAndDelete({
      _id: req.params.id,
      $or: [{ userId: user._id }, { friendId: user._id }],
    });
    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

module.exports = router;
