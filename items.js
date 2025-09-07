/**
 * Logic for the Items list page. Displays all items saved in
 * localStorage and allows the user to create new items or edit/delete
 * existing ones. Items are stored under the key `datatec_items`.
 */
document.addEventListener('DOMContentLoaded', () => {
  const { getData, deleteRecord } = window.datatecStorage;
  const itemsBody = document.getElementById('itemsBody');
  const newItemBtn = document.getElementById('newItemBtn');

  // Populate year in footer
  document.getElementById('yearSpan').textContent = new Date().getFullYear();

  function loadItems() {
    const items = getData('datatec_items', []);
    itemsBody.innerHTML = '';
    if (!items || items.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      // There are now 4 columns (Part Number, Description, Price, Actions)
      td.colSpan = 4;
      td.textContent = 'No items found. Click "New Item" to add one.';
      td.style.textAlign = 'center';
      tr.appendChild(td);
      itemsBody.appendChild(tr);
      return;
    }
    items.forEach((item) => {
      const tr = document.createElement('tr');
      // Part Number
      const skuTd = document.createElement('td');
      skuTd.textContent = item.sku;
      tr.appendChild(skuTd);
      // Description
      const descTd = document.createElement('td');
      descTd.textContent = item.description;
      tr.appendChild(descTd);
      // Unit Price
      const priceTd = document.createElement('td');
      priceTd.style.textAlign = 'right';
      priceTd.textContent = parseFloat(item.price || 0).toFixed(2);
      tr.appendChild(priceTd);
      // Actions
      const actionTd = document.createElement('td');
      // Edit link
      const editLink = document.createElement('a');
      editLink.href = `item_form.html?id=${encodeURIComponent(item.id)}`;
      editLink.textContent = 'Edit';
      editLink.className = 'btn';
      editLink.style.marginRight = '4px';
      actionTd.appendChild(editLink);
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';
      delBtn.className = 'btn';
      delBtn.addEventListener('click', () => {
        if (confirm(`Delete item ${item.sku}?`)) {
          deleteRecord('datatec_items', item.id);
          loadItems();
        }
      });
      actionTd.appendChild(delBtn);
      tr.appendChild(actionTd);
      itemsBody.appendChild(tr);
    });
  }

  newItemBtn.addEventListener('click', () => {
    location.href = 'item_form.html';
  });

  loadItems();
});