const express = require('express');
const router = express.Router();
const User = require('../models/User');
const verifyToken = require('../middleware/auth');
const { sendAdminNotification, sendUserConfirmation } = require('../utils/mailer');

// POST /api/subscription/request - User requests a plan (sends emails)
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { plan } = req.body;
    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan. Choose monthly or yearly.' });
    }

    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Send emails
    try {
      await sendAdminNotification(user, plan);
      await sendUserConfirmation(user, plan);
      console.log(`[SUBSCRIPTION] Request sent: ${user.email} wants ${plan}`);
    } catch (emailErr) {
      console.error('[SUBSCRIPTION] Email error:', emailErr.message);
      return res.status(500).json({ error: 'Failed to send notification. Please try again.' });
    }

    res.json({ message: 'Subscription request sent! Check your email for next steps.' });
  } catch (error) {
    console.error('Subscription request error:', error.message);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// GET /api/subscription/status - Get current user's subscription
router.get('/status', verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const sub = user.subscription || {};
    const now = new Date();

    // Check if subscription expired
    if (sub.tier !== 'free' && sub.expiresAt && new Date(sub.expiresAt) < now) {
      user.subscription.tier = 'free';
      user.subscription.expiresAt = null;
      await user.save();
    }

    // Check if monthly trips need reset
    if (sub.tier === 'monthly' && sub.tripsResetAt && new Date(sub.tripsResetAt) < now) {
      user.subscription.tripsThisMonth = 0;
      user.subscription.tripsResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await user.save();
    }

    const limits = { free: 1, monthly: 10, yearly: 100 };
    const tier = user.subscription?.tier || 'free';
    const limit = limits[tier];
    const used = tier === 'free' || tier === 'yearly'
      ? (user.subscription?.totalTripsCreated || 0)
      : (user.subscription?.tripsThisMonth || 0);

    res.json({
      tier,
      tripsUsed: used,
      tripsLimit: limit,
      tripsRemaining: Math.max(0, limit - used),
      expiresAt: user.subscription?.expiresAt || null,
      startDate: user.subscription?.startDate || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// POST /api/subscription/update - Admin updates user subscription
// Protected: only admin email can call this
router.post('/update', verifyToken, async (req, res) => {
  try {
    // Only admin can update subscriptions
    if (req.user.email !== process.env.SMTP_USER) {
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { userId, tier, days } = req.body;
    if (!userId || !tier) {
      return res.status(400).json({ error: 'userId and tier required' });
    }
    if (!['free', 'monthly', 'yearly'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date();
    user.subscription = {
      ...user.subscription,
      tier,
      startDate: tier === 'free' ? null : now,
      expiresAt: tier === 'free' ? null : new Date(now.getTime() + (days || (tier === 'monthly' ? 30 : 365)) * 24 * 60 * 60 * 1000),
      tripsThisMonth: 0,
      tripsResetAt: tier === 'monthly' ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
      totalTripsCreated: user.subscription?.totalTripsCreated || 0,
    };
    await user.save();

    console.log(`[SUBSCRIPTION] Updated: ${user.email} → ${tier}`);
    res.json({ message: `Subscription updated to ${tier}`, user: { _id: user._id, email: user.email, subscription: user.subscription } });
  } catch (error) {
    console.error('Subscription update error:', error.message);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

module.exports = router;
