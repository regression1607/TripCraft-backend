const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

router.get('/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Weather API error' });
    }

    const data = await response.json();

    const dailyForecasts = [];
    const seen = new Set();
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!seen.has(date)) {
        seen.add(date);
        dailyForecasts.push({
          date,
          temp: Math.round(item.main.temp),
          condition: item.weather[0].main,
          icon: item.weather[0].icon,
        });
      }
    }

    res.json({ city: data.city.name, forecasts: dailyForecasts });
  } catch (error) {
    console.error('Weather error:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
});

module.exports = router;
