const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Serve static files from the project root. All HTML, CSS and JS files are
// located in this directory. This allows the front‑end application to be
// served alongside the API from a single Render service.
app.use(express.static(path.join(__dirname)));

// Configure PostgreSQL connection using DATABASE_URL. When running on Render,
// DATABASE_URL will be provided automatically. For local development you can
// set it in your environment. If connecting over SSL in production, disable
// certificate verification (Render uses self‑signed certificates). See
// https://docs.render.com/postgresql for details.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Ensure the storage table exists. It stores key/value pairs with the
// "value" column using the jsonb type to preserve data types.
async function initDb() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS erp_data (
      key text PRIMARY KEY,
      value jsonb
    )`
  );
}

initDb().catch((err) => {
  console.error('Failed to initialize database', err);
});

// Read a value by key. Returns { value: <value> } or { value: null }.
app.get('/api/data', async (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }
  try {
    const result = await pool.query('SELECT value FROM erp_data WHERE key = $1', [key]);
    if (result.rows.length > 0) {
      return res.json({ value: result.rows[0].value });
    }
    return res.json({ value: null });
  } catch (err) {
    console.error('Error fetching key', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Write a value by key. Expects JSON body { key, value }. Uses UPSERT to
// insert or update the row. Returns { ok: true } on success.
app.post('/api/data', async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'Missing key in body' });
  }
  try {
    await pool.query(
      'INSERT INTO erp_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error saving key', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Fallback: send index.html for any unknown routes (single page app). This
// ensures deep links work when directly accessed.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ERP server listening on port ${PORT}`);
});