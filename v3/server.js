const fs = require('fs');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const AdmZip = require('adm-zip');
const cors = require('cors');

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing and CORS for API routes
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// Path to the zipped front‑end bundle. When the server starts for the first
// time, this will be extracted into the "public" folder. Subsequent runs
// detect the presence of the public directory and skip extraction.
const ZIP_PATH = path.join(__dirname, 'frontend.zip');
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * Unpack the bundled front‑end files into the public directory if they
 * aren't already present. This allows us to keep the front‑end bundled in
 * a single zip file while still serving individual HTML/JS/CSS assets.
 */
function ensureFrontendUnpacked() {
  try {
    // If index.html exists, assume the front‑end has been extracted
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) return;
    if (!fs.existsSync(ZIP_PATH)) {
      console.error('Frontend zip not found:', ZIP_PATH);
      return;
    }
    const zip = new AdmZip(ZIP_PATH);
    zip.extractAllTo(PUBLIC_DIR, true);
    console.log('Extracted frontend to', PUBLIC_DIR);
  } catch (err) {
    console.error('Failed to extract frontend bundle', err);
  }
}

/**
 * Initialize a PostgreSQL connection pool. On Render, the DATABASE_URL
 * environment variable will contain the full connection string. When
 * connecting to external services, we enable SSL but disable certificate
 * verification to avoid issues with self‑signed certs.
 */
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  const config = {};
  if (connectionString) {
    config.connectionString = connectionString;
    config.ssl = { rejectUnauthorized: false };
  } else {
    // Fallback to individual PG env vars
    config.host = process.env.PGHOST || 'localhost';
    config.port = process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432;
    config.user = process.env.PGUSER || undefined;
    config.password = process.env.PGPASSWORD || undefined;
    config.database = process.env.PGDATABASE || undefined;
    config.ssl = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;
  }
  return new Pool(config);
}

const pool = createPool();

/**
 * Ensure the storage table exists and seed a default row if missing.
 * The table stores a single JSON blob under id=1. Using a dedicated
 * initialization function lets us safely create the table on each startup.
 */
async function ensureStorageTable() {
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS datatec_storage (
        id INTEGER PRIMARY KEY,
        data JSONB NOT NULL DEFAULT '{}'::jsonb
      );`
    );
    // Insert row with id=1 if not present
    await client.query(
      `INSERT INTO datatec_storage (id, data)
       VALUES (1, '{}'::jsonb)
       ON CONFLICT (id) DO NOTHING;`
    );
  } finally {
    client.release();
  }
}

/**
 * Retrieve the persisted data object from the database.
 *
 * @returns {Promise<object>} The data stored in the table or an empty object
 */
async function getPersistedData() {
  const res = await pool.query('SELECT data FROM datatec_storage WHERE id = 1');
  if (res.rows.length === 0) return {};
  return res.rows[0].data || {};
}

/**
 * Save a new data object into the database. Overwrites any existing value.
 *
 * @param {object} data The payload to persist
 */
async function savePersistedData(data) {
  await pool.query('UPDATE datatec_storage SET data = $1 WHERE id = 1', [data]);
}

// API route to fetch the entire dataset
app.get('/api/data', async (req, res) => {
  try {
    const data = await getPersistedData();
    res.json({ data });
  } catch (err) {
    console.error('GET /api/data error', err);
    res.status(500).json({ error: 'Failed to retrieve data' });
  }
});

// API route to persist the dataset
app.post('/api/data', async (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload: expected object under `data`' });
  }
  try {
    await savePersistedData(data);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/data error', err);
    res.status(500).json({ error: 'Failed to persist data' });
  }
});

// Extract front‑end assets before setting up static file serving
ensureFrontendUnpacked();
// Serve static files from the public directory
app.use(express.static(PUBLIC_DIR));

// Fallback: if no API or static file matched, serve index.html to allow
// client‑side routing to handle the request. Without this, navigating directly
// to a nested route would return a 404.
app.use((req, res, next) => {
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  return next();
});

// Initialize database and start the server
async function start() {
  try {
    await ensureStorageTable();
    app.listen(PORT, () => {
      console.log(`Datatec ERP server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();