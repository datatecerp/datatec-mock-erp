/**
 * Logic for the item form. Handles creation and editing of inventory
 * items, including saving to localStorage and maintaining a list of
 * vendors for convenience. Items are stored in `datatec_items` and
 * vendors in `datatec_vendors`.
 */
document.addEventListener('DOMContentLoaded', () => {
  const { getData, setData, getQueryParams, generateId } = window.datatecStorage;
  // Form fields
  const idField = document.getElementById('itemId');
  const skuField = document.getElementById('itemSku');
  const descField = document.getElementById('itemDescription');
  const priceField = document.getElementById('itemPrice');
  // Fields removed: UOM, Discount, Tax and Default Vendor
  const formTitle = document.getElementById('itemFormTitle');
  const saveBtn = document.getElementById('saveItemBtn');
  const backBtn = document.getElementById('backItemBtn');

  // Set current year in footer
  document.getElementById('yearSpan').textContent = new Date().getFullYear();

  // Vendors are no longer used; vendor list population removed

  // Determine if editing
  const params = getQueryParams();
  let editing = false;
  let item = {};
  if (params.id) {
    const items = getData('datatec_items', []);
    const existing = items.find((it) => it.id === params.id);
    if (existing) {
      item = JSON.parse(JSON.stringify(existing));
      editing = true;
    }
  }
  if (!editing) {
    item = {
      id: generateId(),
      sku: '',
      description: '',
      price: 0,
    };
  }

  function fillForm() {
    idField.value = item.id;
    skuField.value = item.sku;
    descField.value = item.description;
    priceField.value = item.price;
    formTitle.textContent = editing ? `Edit Item ${item.sku}` : 'New Item';
  }

  function gatherData() {
    item.sku = skuField.value.trim();
    item.description = descField.value.trim();
    item.price = parseFloat(priceField.value) || 0;
  }

  function saveItem() {
    gatherData();
    // Basic validation
    if (!item.sku) {
      alert('SKU is required.');
      return;
    }
    const items = getData('datatec_items', []);
    const idx = items.findIndex((it) => it.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    setData('datatec_items', items);
    // Vendors are no longer managed on items
    alert(`Item ${item.sku} saved.`);
    // Return to items list
    location.href = 'items.html';
  }

  saveBtn.addEventListener('click', saveItem);
  backBtn.addEventListener('click', () => {
    if (confirm('Discard changes and return to list?')) {
      location.href = 'items.html';
    }
  });

  fillForm();
});