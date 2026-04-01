const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');

router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { uid, name, email, picture } = req.user;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for account creation' });
    }

    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      user = await User.create({
        firebaseUid: uid,
        name: name || email.split('@')[0] || 'User',
        email,
        avatar: picture || '',
      });
    }

    res.json({ user });
  } catch (error) {
    console.error('Auth verify error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
