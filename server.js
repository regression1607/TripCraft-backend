const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const itineraryRoutes = require('./routes/itinerary');
const weatherRoutes = require('./routes/weather');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const subscriptionRoutes = require('./routes/subscription');

const app = express();

// CORS - restrict origins in production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:8081', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, true); // Allow all for now in dev, tighten in production
  },
}));

app.use(express.json({ limit: '2mb' }));

// Request logger - safe logging (no body to avoid leaking tokens/PII)
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n[${timestamp}] --> ${req.method} ${req.url}`);

  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] <-- ${req.method} ${req.url} ${res.statusCode} (${duration}ms)`);
    return originalSend.call(this, data);
  };
  next();
});

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/subscription', subscriptionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'TripCraft API' });
});

// Export for Vercel serverless
module.exports = app;

// Local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`TripCraft API running on port ${PORT}`);
  });
}
