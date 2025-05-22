const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Path to JSON file in same directory as this script
const visitsFile = path.join(__dirname, 'visits.json');

// Enable CORS for all routes (adjust origin as needed)
app.use(cors());

// Middleware to parse JSON bodies if needed
app.use(express.json());

// Rate limiting middleware (30 requests/minute per IP)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { status: 'error', message: 'Too many requests, slow down!' }
});
app.use('/track', limiter);

// Route: Track a visit
app.get('/track', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();

    let data = [];
    try {
      const fileData = await fs.readFile(visitsFile, 'utf8');
      if (fileData) data = JSON.parse(fileData);
    } catch (err) {
      // File not found or invalid JSON: start fresh
      data = [];
    }

    data.push({ ip, userAgent, timestamp });

    await fs.writeFile(visitsFile, JSON.stringify(data, null, 2));

    res.json({ status: 'ok', totalVisits: data.length });
  } catch (err) {
    console.error('Error tracking visit:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});

// Route: Analytics data
app.get('/analytics-data', async (req, res) => {
  try {
    const data = await fs.readFile(visitsFile, 'utf8');
    res.setHeader('Content-Type', 'application/json');
    res.send(data || '[]');
  } catch {
    // File missing or error reading: return empty array
    res.json([]);
  }
});

// Route: Home page with visit tracker and disclaimer
app.get('/', (req, res) => {
  res.send(`
    <h1>Visit Tracker</h1>
    <p><small>This site logs your IP address and browser details for analytics.</small></p>
    <script>
      fetch('/track')
        .then(res => res.json())
        .then(data => console.log('Tracked visit:', data))
        .catch(console.error);
    </script>
  `);
});
const mutedFile = path.join(__dirname, 'muted.json');

app.post('/mute-entry', async (req, res) => {
  try {
    const entryToMute = req.body;
    if (!entryToMute || !entryToMute.ip || !entryToMute.timestamp) {
      return res.status(400).json({ status: 'error', message: 'Invalid entry data' });
    }

    // Read current visits
    let visitsData = [];
    try {
      const fileData = await fs.readFile(visitsFile, 'utf8');
      visitsData = fileData ? JSON.parse(fileData) : [];
    } catch {
      visitsData = [];
    }

    // Read muted data
    let mutedData = [];
    try {
      const mutedFileData = await fs.readFile(mutedFile, 'utf8');
      mutedData = mutedFileData ? JSON.parse(mutedFileData) : [];
    } catch {
      mutedData = [];
    }

    // Remove the muted entry from visitsData (match by ip and timestamp)
    visitsData = visitsData.filter(v => !(v.ip === entryToMute.ip && v.timestamp === entryToMute.timestamp));

    // Add to mutedData
    mutedData.push(entryToMute);

    // Write updated data back
    await fs.writeFile(visitsFile, JSON.stringify(visitsData, null, 2));
    await fs.writeFile(mutedFile, JSON.stringify(mutedData, null, 2));

    res.json({ status: 'ok', message: 'Entry muted successfully' });
  } catch (err) {
    console.error('Error muting entry:', err);
    res.status(500).json({ status: 'error', message: 'Server error' });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
