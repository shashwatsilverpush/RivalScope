require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { loadSchedules } = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/analysis', require('./routes/analysis'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/config', require('./routes/config'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/competitors', require('./routes/competitors'));
app.use('/api/chat', require('./routes/chat'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve React frontend in production (built by Dockerfile)
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`RivalScope running on http://localhost:${PORT}`);
  loadSchedules();
});

const path = require('path');
const express = require('express');
const app = express();

// ... your existing API routes ...

// Serve frontend static files
app.use(express.static(path.join(__current_dir, '../frontend/dist')));

// Handle SPA routing (important!)
app.get('*', (req, res) => {
  res.sendFile(path.join(__current_dir, '../frontend/dist', 'index.html'));
});

const PORT = parseInt(process.env.SMTP_Server_Port) || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
