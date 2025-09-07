/**
 * Logic for Purchase Order form.
 */
document.addEventListener('DOMContentLoaded', () => {
  const {
    getData,
    setData,
    nextNumber,
    getQueryParams,
    saveRecord,
    formatMoney,
    generateId,
  } = window.datatecStorage;
  // Elements
  const formTitle = document.getElementById('poFormTitle');
  const recordIdField = document.getElementById('poRecordId');
  const numberField = document.getElementById('purchaseOrderNumber');
  const dateField = document.getElementById('purchaseOrderDate');
  const expectedField = document.getElementById('expectedDate');
  const vendorField = document.getElementById('poVendor');
  const shipToField = document.getElementById('poShipTo');
  const termsField = document.getElementById('poTerms');
  const currencyField = document.getElementById('poCurrency');
  const taxSchemeField = document.getElementById('poTaxScheme');
  const linkedSelect = document.getElementById('linkedSalesOrder');
  const itemsBody = document.getElementById('poItemsBody');
  const subtotalCell = document.getElementById('poSubtotal');
  const taxTotalCell = document.getElementById('poTaxTotal');
  const shippingInput = document.getElementById('poShippingTotal');
  // Rounding has been removed from the PO form. Create a dummy object with a value property
  // to avoid undefined errors; its value will always be 0.
  const roundingInput = { value: 0 };
  const grandTotalCell = document.getElementById('poGrandTotal');
  const addItemBtn = document.getElementById('poAddItemBtn');
  const saveBtn = document.getElementById('savePoBtn');
  const exportBtn = document.getElementById('exportPoBtn');
  const backBtn = document.getElementById('backPoBtn');

  // Data state
  const params = getQueryParams();
  let editing = false;
  let purchaseOrder = {};
  let linkedSO = null; // loaded sales order

  // Load vendor datalist
  (function populateVendors() {
    const vendors = getData('datatec_vendors', []);
    const datalist = document.getElementById('vendorList');
    datalist.innerHTML = '';
    vendors.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.dataset.details = JSON.stringify(v);
      datalist.appendChild(opt);
    });
  })();
  // Populate linked SO list
  (function populateSOSelect() {
    const sos = getData('datatec_salesOrders', []);
    linkedSelect.innerHTML = '<option value="">-- Select SO --</option>';
    sos.forEach((so) => {
      const option = document.createElement('option');
      option.value = so.id;
      option.textContent = `${so.number} - ${so.customer || ''}`;
      linkedSelect.appendChild(option);
    });
  })();

  /**
   * Get the list of SKUs that have already been purchased for a given Sales Order.
   * It checks all purchase orders stored in localStorage and collects SKUs for
   * orders linked to the specified Sales Order ID.
   * @param {string} soId The ID of the linked sales order
   * @returns {string[]} array of purchased SKUs
   */
  function getPurchasedSkusForSO(soId) {
    const poList = getData('datatec_purchaseOrders', []);
    const purchased = [];
    poList.forEach((po) => {
      if (po.linkedSalesOrderId === soId) {
        if (po.items && Array.isArray(po.items)) {
          po.items.forEach((itm) => {
            if (itm && itm.sku) purchased.push(itm.sku);
          });
        }
      }
    });
    return purchased;
  }
  // Determine mode: editing or new or from soId
  if (params.id) {
    const list = getData('datatec_purchaseOrders', []);
    const po = list.find((p) => p.id === params.id);
    if (po) {
      purchaseOrder = JSON.parse(JSON.stringify(po));
      editing = true;
    }
  } else if (params.soId) {
    // create from sales order
    const soList = getData('datatec_salesOrders', []);
    const so = soList.find((s) => s.id === params.soId);
    if (so) {
      linkedSO = so;
      purchaseOrder = {
        id: generateId(),
        number: 'PO' + nextNumber('purchaseOrder'),
        date: new Date().toISOString().substring(0, 10),
        expectedDate: '',
        vendor: '',
        shipTo: so.shipping,
        terms: '',
        currency: so.currency,
        taxScheme: so.taxScheme,
        linkedSalesOrderId: so.id,
        items: so.items.map((it) => ({ ...it })),
        shippingTotal: 0,
        rounding: 0,
        subtotal: 0,
        taxTotal: 0,
        grandTotal: 0,
      };
    }
  }
  // If still empty, create new
  if (!purchaseOrder.id) {
    purchaseOrder = {
      id: generateId(),
      number: 'PO' + nextNumber('purchaseOrder'),
      date: new Date().toISOString().substring(0, 10),
      expectedDate: '',
      vendor: '',
      shipTo: '',
      terms: '',
      currency: 'MYR',
      taxScheme: 0,
      linkedSalesOrderId: '',
      items: [],
      shippingTotal: 0,
      rounding: 0,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
    };
  }
  // Fill form
  function fillForm() {
    recordIdField.value = purchaseOrder.id;
    numberField.value = purchaseOrder.number;
    dateField.value = purchaseOrder.date;
    expectedField.value = purchaseOrder.expectedDate || '';
    vendorField.value = purchaseOrder.vendor || '';
    shipToField.value = purchaseOrder.shipTo || '';
    termsField.value = purchaseOrder.terms || '';
    currencyField.value = purchaseOrder.currency || 'MYR';
    taxSchemeField.value = purchaseOrder.taxScheme ?? 0;
    linkedSelect.value = purchaseOrder.linkedSalesOrderId || '';
    // Items
    itemsBody.innerHTML = '';
    if (purchaseOrder.items && purchaseOrder.items.length) {
      purchaseOrder.items.forEach((item) => addItemRow(item));
    } else {
      addItemRow();
    }
    computeTotals();
    formTitle.textContent = editing ? `Edit Purchase Order ${purchaseOrder.number}` : 'New Purchase Order';
  }
  // Create item row
  function addItemRow(item = {}) {
    const tr = document.createElement('tr');
    // SKU
    const skuTd = document.createElement('td');
    const skuInput = document.createElement('input');
    skuInput.type = 'text';
    skuInput.setAttribute('list', 'itemList');
    skuInput.value = item.sku || '';
    skuTd.appendChild(skuInput);
    tr.appendChild(skuTd);
    // Description
    const descTd = document.createElement('td');
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.value = item.description || '';
    descTd.appendChild(descInput);
    tr.appendChild(descTd);
    // Qty
    const qtyTd = document.createElement('td');
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = '1';
    qtyInput.value = item.qty ?? '';
    qtyTd.appendChild(qtyInput);
    tr.appendChild(qtyTd);
    // Price
    const priceTd = document.createElement('td');
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '0';
    priceInput.step = '0.01';
    priceInput.value = item.price ?? '';
    priceTd.appendChild(priceInput);
    tr.appendChild(priceTd);
    // Tax
    const taxTd = document.createElement('td');
    const taxInput = document.createElement('input');
    taxInput.type = 'number';
    taxInput.min = '0';
    taxInput.step = '0.01';
    taxInput.value = item.tax ?? '0';
    taxTd.appendChild(taxInput);
    tr.appendChild(taxTd);
    // Total
    const totalTd = document.createElement('td');
    totalTd.className = 'line-total-cell';
    totalTd.textContent = '0.00';
    tr.appendChild(totalTd);
    // Remove
    const remTd = document.createElement('td');
    const remBtn = document.createElement('button');
    remBtn.type = 'button';
    remBtn.className = 'btn';
    remBtn.textContent = '✕';
    remBtn.addEventListener('click', () => {
      tr.remove();
      computeTotals();
    });
    remTd.appendChild(remBtn);
    tr.appendChild(remTd);
    itemsBody.appendChild(tr);
    // Auto-fill when SKU changes
    skuInput.addEventListener('change', () => {
      const val = skuInput.value;
      const items = getData('datatec_items', []);
      const found = items.find((it) => it.sku === val);
      if (found) {
        // Auto-fill description, price and tax only. UOM and discount have been removed.
        descInput.value = found.description || '';
        priceInput.value = found.price || 0;
        taxInput.value = found.tax || 0;
      }
      computeTotals();
    });
    [qtyInput, priceInput, taxInput].forEach((inp) => {
      inp.addEventListener('input', computeTotals);
    });
    computeTotals();
  }
  // Compute totals
  function computeTotals() {
    let subtotal = 0;
    let taxTot = 0;
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      // expected order: SKU, Description, Qty, Price, Tax
      if (inputs.length >= 5) {
        const qty = parseFloat(inputs[2].value) || 0;
        const price = parseFloat(inputs[3].value) || 0;
        const tax = parseFloat(inputs[4].value) || 0;
        const net = qty * price;
        const taxAmt = net * (tax / 100);
        subtotal += net;
        taxTot += taxAmt;
        const total = net + taxAmt;
        const totalCell = row.querySelector('.line-total-cell');
        if (totalCell) totalCell.textContent = formatMoney(total);
      }
    });
    const ship = parseFloat(shippingInput.value) || 0;
    subtotalCell.textContent = formatMoney(subtotal);
    taxTotalCell.textContent = formatMoney(taxTot);
    const grand = subtotal + taxTot + ship;
    grandTotalCell.textContent = formatMoney(grand);
    // Update the grand total label with currency on the form
    try {
      const currency = (currencyField && currencyField.value) ? currencyField.value.toUpperCase() : '';
      const labelCell = grandTotalCell.parentElement ? grandTotalCell.parentElement.querySelector('th') : null;
      if (labelCell) {
        labelCell.textContent = currency ? `Grand Total (${currency}):` : 'Grand Total:';
      }
    } catch (e) {
      // ignore errors
    }
  }
  // Add row button
  addItemBtn.addEventListener('click', () => addItemRow());
  // Shipping rounding input events
  shippingInput.addEventListener('input', computeTotals);
  // Rounding removed; no rounding input event
  // Update grand total label whenever currency changes
  if (currencyField) {
    currencyField.addEventListener('change', computeTotals);
  }
  // Linked SO select change: load items and currency/tax
  linkedSelect.addEventListener('change', () => {
    const soId = linkedSelect.value;
    if (!soId) {
      linkedSO = null;
      return;
    }
    const soList = getData('datatec_salesOrders', []);
    const so = soList.find((s) => s.id === soId);
    if (so) {
      linkedSO = so;
      // update currency and tax scheme
      currencyField.value = so.currency;
      taxSchemeField.value = so.taxScheme;
      shipToField.value = so.shipping;
      // prepopulate items excluding those already purchased in other POs linked to this SO
      itemsBody.innerHTML = '';
      const purchasedSkus = getPurchasedSkusForSO(so.id);
      so.items.forEach((it) => {
        if (!purchasedSkus.includes(it.sku)) {
          addItemRow({ ...it });
        }
      });
      computeTotals();
      // update vendor suggestions (unique vendors from items)
      const vendorsSet = new Set(so.items.map((it) => it.vendor).filter(Boolean));
      if (vendorsSet.size === 1) {
        vendorField.value = Array.from(vendorsSet)[0];
      }
    }
  });
  // Vendor input change: filter items by vendor (if linkedSO loaded)
  vendorField.addEventListener('change', () => {
    if (!linkedSO) return;
    const v = vendorField.value.trim();
    if (!v) {
      // show all items from linked SO excluding purchased
      itemsBody.innerHTML = '';
      const purchasedSkus = getPurchasedSkusForSO(linkedSO.id);
      linkedSO.items.forEach((it) => {
        if (!purchasedSkus.includes(it.sku)) {
          addItemRow({ ...it });
        }
      });
    } else {
      itemsBody.innerHTML = '';
      const purchasedSkus = getPurchasedSkusForSO(linkedSO.id);
      linkedSO.items.forEach((it) => {
        if (!purchasedSkus.includes(it.sku) && (it.vendor === v || !it.vendor)) {
          addItemRow({ ...it });
        }
      });
    }
    computeTotals();
  });
  // Update vendor list when vendor entered
  vendorField.addEventListener('blur', () => {
    const name = vendorField.value.trim();
    if (!name) return;
    const vendors = getData('datatec_vendors', []);
    let existing = vendors.find((v) => v.name === name);
    if (!existing) {
      vendors.push({ name });
      setData('datatec_vendors', vendors);
    }
  });
  // Gather data
  function gatherData() {
    purchaseOrder.number = numberField.value;
    purchaseOrder.date = dateField.value;
    purchaseOrder.expectedDate = expectedField.value;
    purchaseOrder.vendor = vendorField.value.trim();
    purchaseOrder.shipTo = shipToField.value.trim();
    purchaseOrder.terms = termsField.value.trim();
    purchaseOrder.currency = currencyField.value;
    purchaseOrder.taxScheme = parseFloat(taxSchemeField.value) || 0;
    purchaseOrder.linkedSalesOrderId = linkedSelect.value || purchaseOrder.linkedSalesOrderId;
    // Store the human-friendly sales order number for printing
    if (purchaseOrder.linkedSalesOrderId) {
      const soList = getData('datatec_salesOrders', []);
      const soRec = soList.find((s) => s.id === purchaseOrder.linkedSalesOrderId);
      purchaseOrder.linkedSalesOrderNumber = soRec ? soRec.number : '';
    } else {
      purchaseOrder.linkedSalesOrderNumber = '';
    }
    purchaseOrder.shippingTotal = parseFloat(shippingInput.value) || 0;
    // Rounding removed; always 0
    purchaseOrder.rounding = 0;
    purchaseOrder.subtotal = parseFloat(subtotalCell.textContent) || 0;
    purchaseOrder.taxTotal = parseFloat(taxTotalCell.textContent) || 0;
    purchaseOrder.grandTotal = parseFloat(grandTotalCell.textContent) || 0;
    purchaseOrder.items = [];
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      // expected order: SKU, Description, Qty, Price, Tax
      if (inputs.length >= 5) {
        const sku = inputs[0].value.trim();
        const desc = inputs[1].value.trim();
        const qty = parseFloat(inputs[2].value) || 0;
        const price = parseFloat(inputs[3].value) || 0;
        const tax = parseFloat(inputs[4].value) || 0;
        if (!sku && !desc && qty === 0 && price === 0 && tax === 0) return;
        purchaseOrder.items.push({ sku, description: desc, qty, price, tax });
      }
    });
  }
  // Save PO
  function savePO() {
    gatherData();
    saveRecord('datatec_purchaseOrders', purchaseOrder);
    return purchaseOrder;
  }
  // Save button
  saveBtn.addEventListener('click', () => {
    savePO();
    // Stay on the current page after saving; do not navigate back to the list
    alert(`Purchase Order ${purchaseOrder.number} saved.`);
    // No redirection to po_list.html
  });
  // Export PDF button
  exportBtn.addEventListener('click', () => {
    savePO();
    exportPOPdf();
  });
  // Back button
  backBtn.addEventListener('click', () => {
    if (confirm('Discard changes and return to list?')) {
      location.href = 'po_list.html';
    }
  });
  /*
   * Old printable HTML function removed. The application now uses the
   * paginated version defined below (buildPrintableHTMLPaginated). The
   * previous implementation contained embedded CSS outside of a template
   * string which caused syntax errors and prevented the form from working.
   */

  /**
   * Build a paginated printable HTML for Purchase Orders. This new implementation
   * splits items across multiple pages, calculates the correct total number of
   * pages, highlights the grand total row, and centres the page numbering.
   */
  function buildPrintableHTMLPaginated() {
    const companyAddress = '302.D (East Wing)\nLevel 3 Menara BRDB\n285, Jalan Maarof KUL 59000\nMalaysia';
    const companyName = 'DataTec Hardware Sdn Bhd';
    const tagline = 'Your Trusted Solutions &<br>Hardware Partner';
    const phone = '+60 03-2297 3797';
    const emailAddr = 'info@datatec.my';
    const website = 'www.datatec.my';
    // Base path to resolve assets when printing in blank window
    const basePath = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    const items = purchaseOrder.items || [];
    const rowsPerPage = 16;
    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    function headerHTML() {
      return `<div class="header">
        <div class="left">
          <img src="${basePath}assets/company-logo.jpg" alt="logo" />
          <div class="company-info">
            <div class="name">${companyName}</div>
            <div>${companyAddress.replace(/\n/g, '<br>')}</div>
            <div>Phone: ${phone}</div>
            <div>Email: ${emailAddr} | Web: ${website}</div>
          </div>
        </div>
        <div class="tagline">${tagline}</div>
      </div>`;
    }
    function detailsHTML() {
      return `<h2>Purchase Order</h2>
        <p><strong>PO No:</strong> ${purchaseOrder.number}<br>
           <strong>Date:</strong> ${purchaseOrder.date}</p>
        <p>
          <strong>Vendor:</strong> ${purchaseOrder.vendor || ''}<br>
          <strong>Ship To:</strong> ${purchaseOrder.shipTo || ''}<br>
          <strong>Terms:</strong> ${purchaseOrder.terms || ''}<br>
          <strong>Linked SO:</strong> ${purchaseOrder.linkedSalesOrderNumber || ''}
        </p>`;
    }
    function itemsHTML(page) {
      let rows = '';
      const start = page * rowsPerPage;
      const end = Math.min(start + rowsPerPage, items.length);
      for (let i = start; i < end; i++) {
        const item = items[i];
        const net = item.qty * item.price;
        const taxAmt = net * (item.tax / 100);
        const total = net + taxAmt;
        rows += `<tr>
          <td>${i + 1}</td>
          <td>${item.sku}</td>
          <td>${item.description}</td>
          <!-- Centre align quantity, unit price and tax percentage columns -->
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:center;">${formatMoney(item.price)}</td>
          <td style="text-align:center;">${formatMoney(item.tax)}</td>
          <td style="text-align:right;">${formatMoney(total)}</td>
        </tr>`;
      }
      return `<table><thead><tr><th>#</th><th>Part Number</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Line Total</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    function totalsHTML() {
      return `<div class="totals"><table>
        <tr><td>Subtotal:</td><td style="text-align:right;">${formatMoney(purchaseOrder.subtotal)}</td></tr>
        <tr><td>Tax:</td><td style="text-align:right;">${formatMoney(purchaseOrder.taxTotal)}</td></tr>
        <tr><td>Shipping:</td><td style="text-align:right;">${formatMoney(purchaseOrder.shippingTotal)}</td></tr>
        <!-- Ensure the grand total label does not wrap to the next line by applying nowrap -->
        <tr class="grand-row"><td style="white-space:nowrap;">Grand Total${purchaseOrder.currency ? ' (' + purchaseOrder.currency.toUpperCase() + ')' : ''}:</td><td style="text-align:right;">${formatMoney(purchaseOrder.grandTotal)}</td></tr>
      </table></div><div style="clear:both;"></div>
      <footer>
        <div>1. This is a computer-generated document.</div>
        <div>2. Please confirm this order in writing and quote the P.O. No. on all documents.</div>
        <div>3. Delay in delivery might result in this order being cancelled.</div>
        <div>4. Goods may be rejected if there are any discrepencies on delivery.</div>
        <div>5. Render separate invoice for each shipment against this order if partial shipment is made.</div>
      </footer>`;
    }
    let pages = '';
    for (let p = 0; p < totalPages; p++) {
      pages += `<div class="page">
        ${headerHTML()}
        ${p === 0 ? detailsHTML() : '<h2>Purchase Order</h2>'}
        ${itemsHTML(p)}
        ${p === totalPages - 1 ? totalsHTML() : ''}
        <div class="page-number">Page ${p + 1} of ${totalPages}</div>
      </div>`;
      if (p < totalPages - 1) pages += '<div class="page-break"></div>';
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${purchaseOrder.number}</title><style>
      /* Remove default print header/footer by setting margins to zero. */
      @page { margin: 0; }
      body { font-family: Arial, sans-serif; margin:0; color:#333; }
      .header { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid #073763; padding-bottom:10px; }
      .header .left { display:flex; align-items:flex-start; }
      .header img { width:120px; height:auto; margin-right:10px; }
      .company-info { font-size:12px; line-height:1.2; }
      .company-info .name { font-weight:bold; font-size:14px; margin-bottom:2px; }
      .tagline {
        font-size:18px;
        font-weight:bold;
        color:#073763;
        text-align:right;
        margin-top:20px;
        padding-right:40px;
      }
      h2 { text-align:center; color:#073763; margin-top:20px; margin-bottom:10px; }
      table { width:100%; border-collapse:collapse; margin-top:15px; font-size:12px; }
      table, th, td { border:1px solid #ccc; }
      th, td { padding:6px; }
      th { background-color:#eaf4ff; }
      tbody tr:nth-child(even) { background-color:#f7fbff; }
      .totals { margin-top:15px; width:40%; float:right; }
      .totals table { border:0; }
      .totals td { padding:4px; border:0; }
      /* Style the grand total row to stand out: use Arial Black, larger font, dark text, and a light background */
      /* Emphasise the grand total row using a heavy font and larger text. Use a white background
         with dark text to make the final amount clear without a dark fill. */
      .grand-row td {
        font-family: "Arial Black", Arial, sans-serif;
        font-weight: bold;
        color: #041e42;
        /* Reduce font-size so the currency label fits on one line */
        font-size: 18px;
        background-color: #ffffff;
      }
      .grand-row td:first-child { width:60%; }
      footer { margin-top:20px; font-size:11px; text-align:left; border-top:1px solid #ccc; padding-top:10px; color:#555; }
      /* Optional overlays to hide browser headers/footers when printing */
      .print-overlay-top, .print-overlay-bottom {
        position: fixed;
        left: 0;
        width: 100%;
        height: 10mm;
        background: #ffffff;
        z-index: 1;
        pointer-events: none;
      }
      .print-overlay-top { top: 0; }
      .print-overlay-bottom { bottom: 0; }
      .page {
        page-break-after:auto;
        padding-top: 12mm;
        padding-bottom: 12mm;
      }
      .page-break { page-break-after:always; }
      .page-number { text-align:center; font-size:10px; margin-top:10px; }
      </style></head><body><div class="print-overlay-top"></div><div class="print-overlay-bottom"></div>${pages}</body></html>`;
  }
  // Export PDF
  function exportPOPdf() {
    const html = buildPrintableHTMLPaginated();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  }
  // Footer year
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  // Init
  fillForm();
});