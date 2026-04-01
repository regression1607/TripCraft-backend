const admin = require('../config/firebase-admin');

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    console.log('[AUTH MW] No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    console.log('[AUTH MW] Verifying token:', token.slice(0, 20) + '...');
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('[AUTH MW] Token verified for:', decoded.email);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[AUTH MW] Token verification failed:', error.code || error.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = verifyToken;
