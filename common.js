/*
 * Common utility functions for the Datatec ERP.
 * This file manages persistent storage via localStorage and exposes helpers
 * for generating unique identifiers, counters, and query-string parsing.
 */

/**
 * Retrieve a JSON-parsed value from localStorage.
 * @param {string} key - The storage key.
 * @param {any} defaultValue - Value returned if key is not present.
 * @returns {any}
 */
function getData(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Store a value into localStorage as JSON.
 * @param {string} key
 * @param {any} value
 */
function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Generate a unique identifier.
 * @returns {string}
 */
function generateId() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get and increment counter for a record type.
 * Counters are stored with keys like datatec_counter_quotation.
 * @param {string} type - 'quotation', 'salesOrder', or 'purchaseOrder'
 * @returns {number} The current numeric portion of the counter before increment
 */
function nextNumber(type) {
  /*
    Generate a sequential number for each record type. For certain types we
    incorporate the current year into the starting range so the numbers
    automatically roll over each year. The scheme is:
      - quotations: start at 251000 (legacy behaviour)
      - salesOrder: YY5000, where YY is last two digits of the current year
      - purchaseOrder: YY5000
      - invoice: YY5000
      - deliveryOrder: start at 800 (e.g. DO0800, DO0801, …)
    Counters are stored by type and year to avoid collisions across years.
  */
  const year = new Date().getFullYear().toString().slice(-2);
  let key;
  let base;
  switch (type) {
    case 'salesOrder':
      key = `datatec_counter_salesOrder_${year}`;
      base = parseInt(`${year}5000`, 10);
      break;
    case 'purchaseOrder':
      key = `datatec_counter_purchaseOrder_${year}`;
      base = parseInt(`${year}5000`, 10);
      break;
    case 'invoice':
      key = `datatec_counter_invoice_${year}`;
      base = parseInt(`${year}5000`, 10);
      break;
    case 'deliveryOrder':
      key = `datatec_counter_deliveryOrder`;
      base = 800;
      break;
    case 'quotation':
    default:
      key = `datatec_counter_${type}`;
      base = 251000;
  }
  let value = getData(key, base);
  if (typeof value !== 'number') value = parseInt(value) || base;
  setData(key, value + 1);
  return value;
}

/**
 * Get query parameters as object.
 * @returns {Object}
 */
function getQueryParams() {
  const params = {};
  location.search
    .substring(1)
    .split('&')
    .forEach((pair) => {
      if (!pair) return;
      const [key, value] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  return params;
}

/**
 * Save or update a record in a list stored under key.
 * Records are keyed by `id`. If record with same id exists, it's replaced.
 * @param {string} storeKey
 * @param {Object} record
 */
function saveRecord(storeKey, record) {
  const list = getData(storeKey, []);
  const existingIndex = list.findIndex((r) => r.id === record.id);
  if (existingIndex >= 0) {
    list[existingIndex] = record;
  } else {
    list.push(record);
  }
  setData(storeKey, list);
}

/**
 * Delete a record by id from a list stored under key.
 * @param {string} storeKey
 * @param {string} id
 */
function deleteRecord(storeKey, id) {
  const list = getData(storeKey, []);
  const newList = list.filter((r) => r.id !== id);
  setData(storeKey, newList);
}

/**
 * Format a number as currency with two decimal places.
 * @param {number} value
 * @returns {string}
 */
function formatMoney(value) {
  return parseFloat(value || 0).toFixed(2);
}

// Export functions to global scope so page scripts can access them
window.datatecStorage = {
  getData,
  setData,
  nextNumber,
  getQueryParams,
  saveRecord,
  deleteRecord,
  formatMoney,
  generateId,
};

/*
 * ------------------ Google Apps Script Integration ------------------
 * To enable automatic, cross-device synchronization of ERP data, specify
 * the Web App URL of your Google Apps Script deployment below. The Apps
 * Script should implement doGet() to return a JSON object representing
 * your stored data and doPost() to accept a JSON payload and save it.
 *
 * Once APPS_SCRIPT_URL is set, the ERP will fetch remote data on page
 * load and write all localStorage entries to Google Drive after each
 * update operation.
 *
 * Replace 'YOUR_SCRIPT_URL' with the actual URL from your Apps Script
 * deployment (e.g. https://script.google.com/macros/s/AKfycbx.../exec).
 */
// Set this to your deployed Google Apps Script URL. This allows the ERP
// to load data from Google Drive and sync changes automatically.
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzN0ThnCHndgPnH4aXthEDq9GsZg8mBt1FtM8ayhiutQohIJW7jrJGU3dXQmEJ6-ZzelQ/exec';

/**
 * Download data from Google Drive via Apps Script and populate localStorage.
 * If the script URL is not defined, this function silently aborts.
 */
async function loadRemoteData() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_SCRIPT_URL') {
    return;
  }
  try {
    const resp = await fetch(APPS_SCRIPT_URL);
    if (!resp.ok) return;
    const data = await resp.json();
    Object.keys(data).forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify(data[key]));
      } catch (e) {
        console.error('Failed to write key', key, e);
      }
    });
  } catch (err) {
    console.error('Error loading remote data', err);
  }
}

/**
 * Upload all localStorage data to Google Drive via Apps Script.
 * Serializes the entire contents of localStorage and posts it to the
 * Apps Script endpoint. The Apps Script must handle saving the JSON.
 */
async function syncToRemote() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === 'YOUR_SCRIPT_URL') {
    return;
  }
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        data[key] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        data[key] = localStorage.getItem(key);
      }
    }
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('Error syncing data to remote', err);
  }
}

// Preserve references to the original functions
const originalSetData = setData;
const originalDeleteRecord = deleteRecord;

/**
 * Override setData to update localStorage normally and then sync remote.
 * Does not wait for the remote sync to complete.
 */
setData = function (key, value) {
  originalSetData(key, value);
  // Fire-and-forget remote sync
  syncToRemote();
};

/**
 * Override deleteRecord to update localStorage and then sync remote.
 */
deleteRecord = function (storeKey, id) {
  originalDeleteRecord(storeKey, id);
  syncToRemote();
};

// When the window loads, fetch remote data to hydrate localStorage.
window.addEventListener('load', () => {
  loadRemoteData();
});
