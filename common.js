/*
 * Common utility functions for the Datatec ERP.
 * This file manages persistent storage via localStorage and exposes helpers
 * for generating unique identifiers, counters, and query-string parsing.
 */

/**
 * Base URL of the Google Apps Script web app used to persist data to Google Drive.
 *
 * The provided link exposes a simple API for saving and retrieving key/value
 * pairs. When a value is saved via setData it is transmitted to the script
 * using query parameters. Likewise, getData will asynchronously attempt to
 * refresh localStorage from the remote value. If the script is unreachable
 * or returns an unexpected response, the code gracefully falls back to
 * localStorage so the application remains functional offline.
 */
const DATATEC_DRIVE_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbwOeOZya8LzXWEN1KpUYRxUsWdIrlblfoPby7pCn8ErNEiszMfZuOx1i54OGFgK4i3U5A/exec';

/**
 * Retrieve a JSON‑parsed value from localStorage. This function will also
 * asynchronously query the remote endpoint to update the cached value if
 * possible. The remote call never blocks execution; instead, the returned
 * value is based on what is currently stored locally. If no local value
 * exists, the defaultValue is returned immediately and a background request
 * attempts to populate the cache.
 *
 * @param {string} key – The storage key.
 * @param {any} defaultValue – Value returned if key is not present.
 * @returns {any}
 */
function getData(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw !== null) {
    // Kick off a remote fetch to refresh the cache in the background. Do not
    // await this call so that UI remains responsive.
    try {
      const params = new URLSearchParams({ key });
      fetch(`${DATATEC_DRIVE_ENDPOINT}?${params.toString()}`)
        .then((response) => response.json())
        .then((data) => {
          // Expect data in the shape { value: <any> } from the script.
          if (data && data.value !== undefined) {
            localStorage.setItem(key, JSON.stringify(data.value));
          }
        })
        .catch(() => {
          /* ignore network errors; localStorage value will be used */
        });
    } catch (err) {
      // swallow exceptions silently
    }
    try {
      return JSON.parse(raw);
    } catch (e) {
      return defaultValue;
    }
  }
  // If no local value exists, attempt to fetch from remote. The fetch is still
  // asynchronous; defaultValue is returned immediately. When the remote
  // response arrives, it updates localStorage so future calls see the value.
  try {
    const params = new URLSearchParams({ key });
    fetch(`${DATATEC_DRIVE_ENDPOINT}?${params.toString()}`)
      .then((response) => response.json())
      .then((data) => {
        if (data && data.value !== undefined) {
          localStorage.setItem(key, JSON.stringify(data.value));
        }
      })
      .catch(() => {
        /* ignore */
      });
  } catch (err) {
    /* ignore */
  }
  return defaultValue;
}

/**
 * Transmit a key/value pair to Google Drive via the Apps Script endpoint. The
 * data is encoded in the query string so that GET requests can be used
 * without requiring special headers. The call is fire‑and‑forget; it runs
 * asynchronously and does not block UI updates. If the request fails, no
 * error is surfaced to the user.
 *
 * @param {string} key
 * @param {any} value
 */
function syncToDrive(key, value) {
  try {
    const params = new URLSearchParams({
      key,
      value: JSON.stringify(value),
    });
    fetch(`${DATATEC_DRIVE_ENDPOINT}?${params.toString()}`).catch(() => {
      /* ignore network errors */
    });
  } catch (err) {
    /* ignore */
  }
}

/**
 * Store a value into localStorage as JSON and schedule it for persistence to
 * Google Drive. The remote sync runs asynchronously to avoid blocking the UI.
 *
 * @param {string} key
 * @param {any} value
 */
function setData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // If storing locally fails (e.g. quota exceeded), still attempt to sync
  }
  syncToDrive(key, value);
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
