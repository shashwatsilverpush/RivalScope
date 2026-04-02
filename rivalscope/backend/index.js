require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { loadSchedules } = require('./services/scheduler');

const app = express();

// Railway injects PORT as a string; parseInt ensures it's a valid integer
const PORT = parseInt(process.env.PORT, 10) || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/config', require('./routes/config'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/competitors', require('./routes/competitors'));
app.use('/api/chat', require('./routes/chat'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serving Frontend (Vite Build)
// On Railway, we want this to run whenever the 'dist' folder exists
const DIST_PATH = path.join(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(DIST_PATH)) {
    console.log("Serving static files from:", DIST_PATH);
    app.use(express.static(DIST_PATH));
    
    // IMPORTANT: This catch-all route must be LAST
    app.get('*', (req, res) => {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
} else {
    console.warn("Frontend dist folder not found at:", DIST_PATH);
}

// Start Server
// We listen on 0.0.0.0 so Railway can find the service
app.listen(PORT, '0.0.0.0', () => {
  console.log(`RivalScope running on port ${PORT}`);
  if (typeof loadSchedules === 'function') {
      loadSchedules();
  }
});
