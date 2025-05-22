const express = require('express');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;

// Path to JSON file in same directory as this script
const visitsFile = path.join(__dirname, 'visits.json');

// Middleware
app.use(express.json());

// Rate limiting middleware (30 requests/minute per IP)
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { status: 'error', message: 'Too many requests, slow down!' }
});
app.use('/track', limiter);

// Route: Track a visit
app.get('/track', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const timestamp = new Date().toISOString();

    fs.readFile(visitsFile, 'utf8', (readErr, fileData) => {
        let data = [];

        if (!readErr && fileData) {
            try {
                data = JSON.parse(fileData);
            } catch (parseErr) {
                console.error('Invalid JSON in visits.json:', parseErr);
                data = [];
            }
        }

        // Add new visit
        data.push({ ip, userAgent, timestamp });

        // Write updated data back to file
        fs.writeFile(visitsFile, JSON.stringify(data, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Failed to write visits:', writeErr);
                return res.status(500).json({ status: 'error', message: 'Server error' });
            }

            res.json({ status: 'ok', totalVisits: data.length });
        });
    });
});

// Route: Analytics data
app.get('/analytics-data', (req, res) => {
    fs.readFile(visitsFile, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to read analytics data' });
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(data || '[]');
    });
});

// Route: Home page with visit tracker and disclaimer
app.get('/', (req, res) => {
    res.send(`
        <h1>Visit Tracker</h1>
        <p><small>This site logs your IP address and browser details for analytics.</small></p>
        <script>
            fetch('/track')
                .then(res => res.json())
                .then(data => console.log('Tracked visit:', data));
        </script>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});