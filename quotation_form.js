/**
 * Logic for the quotation form page.
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

  // DOM elements
  const recordIdField = document.getElementById('recordId');
  const numberField = document.getElementById('quotationNumber');
  const dateField = document.getElementById('quotationDate');
  const currencyField = document.getElementById('quotationCurrency');
  const customerField = document.getElementById('quotationCustomer');
  const attentionField = document.getElementById('quotationAttention');
  // Email field has been removed from the quotation form. Define a dummy object to avoid errors
  const emailField = document.getElementById('quotationEmail') || { value: '' };
  const billingField = document.getElementById('quotationBilling');
  const shippingField = document.getElementById('quotationShipping');
  const taxSchemeField = document.getElementById('quotationTaxScheme');
  const paymentTermsField = document.getElementById('quotationPaymentTerms');
  const validityField = document.getElementById('quotationValidity');
  const salespersonField = document.getElementById('quotationSalesperson');
  const remarksField = document.getElementById('quotationRemarks');
  const itemsBody = document.getElementById('quotationItemsBody');
  const subtotalCell = document.getElementById('quotationSubtotal');
  const taxTotalCell = document.getElementById('quotationTaxTotal');
  const shippingInput = document.getElementById('quotationShippingTotal');
  // Rounding has been removed from the quotation form. Create a dummy object with a value property so existing
  // code referencing roundingInput.value does not throw errors. The value will always be 0.
  const roundingInput = { value: 0 };
  const grandTotalCell = document.getElementById('quotationGrandTotal');
  const addItemBtn = document.getElementById('addItemBtn');
  const saveBtn = document.getElementById('saveQuotationBtn');
  const convertBtn = document.getElementById('convertToSalesBtn');
  const exportBtn = document.getElementById('exportQuotationBtn');
  const backBtn = document.getElementById('backBtn');
  const formTitle = document.getElementById('formTitle');

  // Load query params
  const params = getQueryParams();
  let editing = false;
  let quotation = {};
  // Load existing quotation if id param provided
  if (params.id) {
    const list = getData('datatec_quotations', []);
    const existing = list.find((q) => q.id === params.id);
    if (existing) {
      quotation = JSON.parse(JSON.stringify(existing));
      editing = true;
    }
  }
  // If new, assign defaults
    if (!editing) {
    // For a new quotation, populate default values including a validity date 30 days from today.
    const today = new Date();
    const validityDate = new Date(today);
    validityDate.setDate(today.getDate() + 30);
      quotation = {
      id: generateId(),
      number: 'QN' + nextNumber('quotation'),
      date: today.toISOString().substring(0, 10),
      currency: 'MYR',
      customer: '',
      attention: '',
      email: '',
      billing: '',
      shipping: '',
      taxScheme: 0,
      paymentTerms: '30 days',
      // Set default validity/expiry to 30 days from the creation date
      validity: validityDate.toISOString().substring(0, 10),
      // Default salesperson set to Kelvin as requested
      salesperson: 'Kelvin',
      remarks: '',
      items: [],
      shippingTotal: 0,
      rounding: 0,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
    };
  }
  // Populate customers datalist
  (function populateCustomerList() {
    const datalist = document.getElementById('customerList');
    const customers = getData('datatec_customers', []);
    datalist.innerHTML = '';
    customers.forEach((c) => {
      const option = document.createElement('option');
      option.value = c.name;
      // store full record in dataset for quick lookup
      option.dataset.details = JSON.stringify(c);
      datalist.appendChild(option);
    });
  })();
  // Populate items datalist
  (function populateItemList() {
    const itemDatalist = document.createElement('datalist');
    itemDatalist.id = 'itemList';
    document.body.appendChild(itemDatalist);
    const items = getData('datatec_items', []);
    itemDatalist.innerHTML = '';
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.sku;
      opt.dataset.details = JSON.stringify(it);
      itemDatalist.appendChild(opt);
    });
  })();
  // Prefill form fields from quotation object
  function fillForm() {
    recordIdField.value = quotation.id;
    numberField.value = quotation.number;
    dateField.value = quotation.date || new Date().toISOString().substring(0, 10);
    currencyField.value = quotation.currency || 'MYR';
    customerField.value = quotation.customer || '';
    attentionField.value = quotation.attention || '';
    emailField.value = quotation.email || '';
    billingField.value = quotation.billing || '';
    shippingField.value = quotation.shipping || '';
    taxSchemeField.value = quotation.taxScheme ?? 0;
    paymentTermsField.value = quotation.paymentTerms || '30 days';
    validityField.value = quotation.validity || '';
    salespersonField.value = quotation.salesperson || '';
    remarksField.value = quotation.remarks || '';
    shippingInput.value = quotation.shippingTotal ?? 0;
    // Rounding input removed; no assignment needed
    // Clear existing item rows
    itemsBody.innerHTML = '';
    if (quotation.items && quotation.items.length) {
      quotation.items.forEach((itm) => addItemRow(itm));
    } else {
      addItemRow();
    }
    computeTotals();
    formTitle.textContent = editing ? `Edit Quotation ${quotation.number}` : 'New Quotation';
  }

  /**
   * Create and append an item row to the items table.
   * If an item object is provided, fields are prefilled.
   * @param {Object} item
   */
  function addItemRow(item = {}) {
    const tr = document.createElement('tr');
    // SKU input with datalist
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
    // Unit Price
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
    // Line total
    const totalTd = document.createElement('td');
    totalTd.className = 'line-total-cell';
    totalTd.textContent = '0.00';
    tr.appendChild(totalTd);
    // Remove button
    const removeTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      tr.remove();
      computeTotals();
    });
    removeTd.appendChild(removeBtn);
    tr.appendChild(removeTd);
    // Append row
    itemsBody.appendChild(tr);
    // SKU change event to auto-fill item details
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
    // When any field changes, recalc totals (discount column removed)
    [qtyInput, priceInput, taxInput].forEach((input) => {
      input.addEventListener('input', computeTotals);
    });
    computeTotals();
  }
  // Compute totals across items
  function computeTotals() {
    let subtotal = 0;
    let taxTotal = 0;
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const cells = row.querySelectorAll('input');
      // Expected order after column removal: SKU, Description, Qty, Price, Tax
      if (cells.length >= 5) {
        const qty = parseFloat(cells[2].value) || 0;
        const price = parseFloat(cells[3].value) || 0;
        const tax = parseFloat(cells[4].value) || 0;
        const net = qty * price;
        const taxAmt = net * (tax / 100);
        subtotal += net;
        taxTotal += taxAmt;
        const total = net + taxAmt;
        const totalCell = row.querySelector('.line-total-cell');
        if (totalCell) totalCell.textContent = formatMoney(total);
      }
    });
    const ship = parseFloat(shippingInput.value) || 0;
    // Rounding removed (always 0)
    subtotalCell.textContent = formatMoney(subtotal);
    taxTotalCell.textContent = formatMoney(taxTotal);
    const grandTotal = subtotal + taxTotal + ship;
    grandTotalCell.textContent = formatMoney(grandTotal);
    // Update the grand total label with currency on the form
    try {
      const currency = (currencyField && currencyField.value) ? currencyField.value.toUpperCase() : '';
      const labelCell = grandTotalCell.parentElement ? grandTotalCell.parentElement.querySelector('th') : null;
      if (labelCell) {
        labelCell.textContent = currency ? `Grand Total (${currency}):` : 'Grand Total:';
      }
    } catch (e) {
      // ignore any errors updating the label
    }
  }
  // Update grand total label whenever currency changes
  if (currencyField) {
    currencyField.addEventListener('change', computeTotals);
  }
  // When shipping changes, recalc (rounding removed)
  shippingInput.addEventListener('input', computeTotals);
  // Add item button
  addItemBtn.addEventListener('click', () => addItemRow());
  // Customer selection autopopulate addresses and terms
  customerField.addEventListener('change', () => {
    const name = customerField.value;
    const customers = getData('datatec_customers', []);
    const found = customers.find((c) => c.name === name);
    if (found) {
      attentionField.value = found.attention || '';
      emailField.value = found.email || '';
      billingField.value = found.billing || '';
      shippingField.value = found.shipping || '';
      taxSchemeField.value = found.taxScheme ?? 0;
      paymentTermsField.value = found.paymentTerms || '30 days';
    }
  });
  // Save or update customers
  function updateCustomerFromForm() {
    const name = customerField.value.trim();
    if (!name) return;
    const customers = getData('datatec_customers', []);
    let cust = customers.find((c) => c.name === name);
    const updated = {
      name,
      attention: attentionField.value.trim(),
      email: emailField.value.trim(),
      billing: billingField.value.trim(),
      shipping: shippingField.value.trim(),
      taxScheme: parseFloat(taxSchemeField.value) || 0,
      paymentTerms: paymentTermsField.value.trim(),
    };
    if (cust) {
      // update existing
      Object.assign(cust, updated);
    } else {
      customers.push(updated);
    }
    setData('datatec_customers', customers);
  }
  // Gather form data into quotation object
  function gatherData() {
    quotation.number = numberField.value;
    quotation.date = dateField.value;
    quotation.currency = currencyField.value;
    quotation.customer = customerField.value.trim();
    quotation.attention = attentionField.value.trim();
    quotation.email = emailField.value.trim();
    quotation.billing = billingField.value.trim();
    quotation.shipping = shippingField.value.trim();
    quotation.taxScheme = parseFloat(taxSchemeField.value) || 0;
    quotation.paymentTerms = paymentTermsField.value.trim();
    quotation.validity = validityField.value;
    quotation.salesperson = salespersonField.value.trim();
    quotation.remarks = remarksField.value.trim();
    quotation.shippingTotal = parseFloat(shippingInput.value) || 0;
    // Rounding removed; always 0
    quotation.rounding = 0;
    quotation.subtotal = parseFloat(subtotalCell.textContent) || 0;
    quotation.taxTotal = parseFloat(taxTotalCell.textContent) || 0;
    quotation.grandTotal = parseFloat(grandTotalCell.textContent) || 0;
    // Items
    quotation.items = [];
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
        // skip blank rows
        if (!sku && !desc && qty === 0 && price === 0 && tax === 0) return;
        quotation.items.push({ sku, description: desc, qty, price, tax });
      }
    });
  }
  // Save quotation and update storage
  function saveQuotation() {
    gatherData();
    // Save customers info
    updateCustomerFromForm();
    // Persist record
    saveRecord('datatec_quotations', quotation);
    // Also save any new items to the global items list. If a Part Number
    // (SKU) from this quotation does not exist in datatec_items, add it
    // with its description, price and tax. Existing items will be updated
    // with the latest description, price and tax values.
    (function updateItemsFromQuotation() {
      const itemsStore = getData('datatec_items', []);
      quotation.items.forEach((it) => {
        const sku = it.sku && it.sku.trim();
        if (!sku) return;
        let existing = itemsStore.find((itm) => itm.sku === sku);
        if (existing) {
          existing.description = it.description || existing.description;
          existing.price = it.price != null ? it.price : existing.price;
          existing.tax = it.tax != null ? it.tax : existing.tax;
        } else {
          itemsStore.push({
            id: generateId(),
            sku: sku,
            description: it.description || '',
            uom: '',
            price: it.price || 0,
            discount: 0,
            tax: it.tax || 0,
            vendor: ''
          });
        }
      });
      setData('datatec_items', itemsStore);
    })();
    return quotation;
  }
  // Event: Save button
  saveBtn.addEventListener('click', () => {
    saveQuotation();
    // Stay on the same page after saving instead of navigating away
    alert(`Quotation ${quotation.number} saved.`);
    // No redirection to quotation_list.html
  });
  // Convert to Sales Order button
  convertBtn.addEventListener('click', () => {
    saveQuotation();
    // Pass quotation id to sales form
    location.href = `sales_form.html?quoteId=${encodeURIComponent(quotation.id)}`;
  });
  // Export PDF button
  exportBtn.addEventListener('click', () => {
    saveQuotation();
    exportQuotationPDF();
  });
  // Back button
  backBtn.addEventListener('click', () => {
    if (confirm('Discard changes and return to list?')) {
      location.href = 'quotation_list.html';
    }
  });
  // Export printable HTML for PDF
  function buildPrintableHTML() {
    /*
      Build a multi-page printable Quotation PDF. We manually paginate the
      items list so we can show accurate page numbers (e.g., "Page 1 of 2").
      Grand totals are styled prominently with a dark background and larger
      font. Customer details and remarks appear only on the first page.
    */
    const companyAddress = '302.D (East Wing)\nLevel 3 Menara BRDB\n285, Jalan Maarof KUL 59000\nMalaysia';
    const companyName = 'DataTec Hardware Sdn Bhd';
    const tagline = 'Your Trusted Solutions &<br>Hardware Partner';
    const phone = '+60 03-2297 3797';
    const email = 'info@datatec.my';
    const website = 'www.datatec.my';
    const items = quotation.items || [];
    // compute item totals for each row
    function buildRowHTML(index, item) {
      const net = item.qty * item.price;
      const taxAmt = net * (item.tax / 100);
      const total = net + taxAmt;
      return '<tr>' +
        '<td>' + (index + 1) + '</td>' +
        '<td>' + (item.sku || '') + '</td>' +
        '<td>' + (item.description || '') + '</td>' +
        /* Centre align numeric values (Qty, Unit Price, Tax %) per user requirement */
        '<td style="text-align:center;">' + item.qty + '</td>' +
        '<td style="text-align:center;">' + formatMoney(item.price) + '</td>' +
        '<td style="text-align:center;">' + formatMoney(item.tax) + '</td>' +
        '<td style="text-align:right;">' + formatMoney(total) + '</td>' +
        '</tr>';
    }
    const rowsPerPage = 12;
    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + quotation.number + '</title>';
    html += '<style>';
    html += '@page { margin: 0; }';
    html += 'body { font-family: Arial, sans-serif; margin:20px; color:#333; }';
    html += '.header { display:flex; align-items:flex-start; justify-content:space-between; border-bottom:2px solid #073763; padding-bottom:10px; }';
    html += '.header .left { display:flex; align-items:flex-start; }';
    html += '.header img { width:120px; height:auto; margin-right:10px; }';
    html += '.company-info { font-size:12px; line-height:1.2; }';
    html += '.company-info .name { font-weight:bold; font-size:14px; margin-bottom:2px; }';
    html += '.tagline { font-size:18px; font-weight:bold; color:#073763; text-align:right; margin-top:20px; }';
    html += 'h2 { text-align:center; color:#073763; margin-top:20px; margin-bottom:10px; }';
    html += 'table { width:100%; border-collapse:collapse; margin-top:15px; font-size:12px; }';
    html += 'table, th, td { border:1px solid #ccc; }';
    html += 'th, td { padding:6px; }';
    html += 'th { background-color:#eaf4ff; }';
    html += 'tbody tr:nth-child(even) { background-color:#f7fbff; }';
    html += '.page { position:relative; min-height:100vh; page-break-after:always; }';
    html += '.page:last-child { page-break-after:auto; }';
    html += '.page-number { position:absolute; bottom:0; width:100%; text-align:center; font-size:10px; margin-top:10px; }';
    html += '.details-table { width:100%; margin-top:10px; font-size:12px; border:0; }';
    html += '.details-table td { border:0; padding:2px; }';
    html += '.totals { margin-top:15px; width:40%; float:right; }';
    html += '.totals table { border:0; width:100%; }';
    html += '.totals td { padding:4px; border:0; }';
    html += '.grand-row { background-color:#041e42; color:#fff; font-size:16px; font-weight:bold; }';
    html += 'footer { margin-top:30px; font-size:11px; text-align:left; border-top:1px solid #ccc; padding-top:10px; color:#555; }';
    html += '</style></head><body>';
    for (let p = 0; p < totalPages; p++) {
      html += '<div class="page">';
      // Header
      html += '<div class="header">';
      html += '<div class="left">';
      html += '<img src="' + location.origin + '/' + location.pathname.replace(/\/.+$/, '') + '/assets/company-logo.jpg" alt="logo" />';
      html += '<div class="company-info">';
      html += '<div class="name">' + companyName + '</div>';
      html += '<div>' + companyAddress.replace(/\n/g, '<br>') + '</div>';
      html += '<div>Phone: ' + phone + '</div>';
      html += '<div>Email: ' + email + ' | Web: ' + website + '</div>';
      html += '</div></div>';
      html += '<div class="tagline">' + tagline + '</div>';
      html += '</div>';
      html += '<h2>Quotation</h2>';
      // Details table
      html += '<table class="details-table">';
      html += '<tr><td><strong>Quotation No:</strong> ' + quotation.number + '</td><td style="text-align:right;"><strong>Date:</strong> ' + quotation.date + '</td></tr>';
      html += '<tr><td><strong>Payment Terms:</strong> ' + (quotation.paymentTerms || '') + '</td><td style="text-align:right;"><strong>Validity/Expiry:</strong> ' + (quotation.validity || '') + '</td></tr>';
      html += '<tr><td><strong>Salesperson:</strong> ' + (quotation.salesperson || '') + '</td><td style="text-align:right;"></td></tr>';
      html += '</table>';
      // Customer details and remarks only on first page
      if (p === 0) {
        html += '<p><strong>Customer:</strong> ' + quotation.customer + '<br>';
        html += '<strong>Attention:</strong> ' + (quotation.attention || '') + '<br>';
        html += '<strong>Billing Address:</strong> ' + quotation.billing + '<br>';
        html += '<strong>Shipping Address:</strong> ' + quotation.shipping + '<br>';
        if (quotation.remarks) html += '<strong>Remarks:</strong> ' + quotation.remarks;
        html += '</p>';
      }
      // Items table for this page
      html += '<table><thead><tr><th>#</th><th>Part Number</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Line Total</th></tr></thead><tbody>';
      const start = p * rowsPerPage;
      const end = Math.min(start + rowsPerPage, items.length);
      for (let i = start; i < end; i++) {
        html += buildRowHTML(i, items[i]);
      }
      html += '</tbody></table>';
      // Totals and terms only on last page
      if (p === totalPages - 1) {
        html += '<div class="totals"><table>';
        html += '<tr><td>Subtotal:</td><td style="text-align:right;">' + formatMoney(quotation.subtotal) + '</td></tr>';
        html += '<tr><td>Tax:</td><td style="text-align:right;">' + formatMoney(quotation.taxTotal) + '</td></tr>';
        html += '<tr><td>Shipping:</td><td style="text-align:right;">' + formatMoney(quotation.shippingTotal) + '</td></tr>';
        /* Add white‑space:nowrap to keep the currency label on the same line */
        html += '<tr class="grand-row"><td style="white-space:nowrap;">Grand Total ' + (quotation.currency ? '(' + quotation.currency.toUpperCase() + ')' : '') + ':</td><td style="text-align:right;">' + formatMoney(quotation.grandTotal) + '</td></tr>';
        html += '</table></div><div style="clear:both;"></div>';
        html += '<footer>';
        html += '<div style="font-weight:bold;">Terms and Conditions</div>';
        html += '<div>1) This quotation is valid for 30 days from the date of issue.</div>';
        html += '<div>2) Delivery depends on stock and lead times. The company is not liable for delays beyond its control.</div>';
        html += '<div>3) Once accepted, orders cannot be cancelled without written approval.</div>';
        html += '<div>4) Cancellation after 48 hours may incur charges; 30% restocking fee applies after 5 days.</div>';
        html += '</footer>';
      }
      // Page number
      html += '<div class="page-number">Page ' + (p + 1) + ' of ' + totalPages + '</div>';
      html += '</div>'; // end page
    }
    html += '</body></html>';
    return html;
  }

  /**
   * Build a paginated printable HTML for the quotation. This new function
   * splits items across pages, adds a centred page number (e.g. Page 1 of 2)
   * at the bottom of each page, and highlights the grand total row.
   */
  function buildPrintableHTMLPaginated() {
    const companyAddress = '302.D (East Wing)\nLevel 3 Menara BRDB\n285, Jalan Maarof KUL 59000\nMalaysia';
    const companyName = 'DataTec Hardware Sdn Bhd';
    const tagline = 'Your Trusted Solutions &<br>Hardware Partner';
    const phone = '+60 03-2297 3797';
    const emailAddr = 'info@datatec.my';
    const website = 'www.datatec.my';
    // Determine the base path of the application. This allows image paths to resolve correctly
    // when the printable document is opened in a blank window. Without this, relative paths
    // can break and cause missing logos in the PDF.
    const basePath = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    // Determine how many item rows fit per page. Using 16 yields good spacing.
    const rowsPerPage = 16;
    const totalPages = Math.max(1, Math.ceil(quotation.items.length / rowsPerPage));
    function buildHeader() {
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
    function buildDetails() {
      return `<h2>Quotation</h2>
        <table style="width:100%; margin-top:10px; font-size:12px; border:0;">
          <tr>
            <td style="border:0;"><strong>Quotation No:</strong> ${quotation.number}</td>
            <td style="border:0; text-align:right;"><strong>Date:</strong> ${quotation.date}</td>
          </tr>
          <tr>
            <td style="border:0;"><strong>Payment Terms:</strong> ${quotation.paymentTerms || ''}</td>
            <td style="border:0; text-align:right;"><strong>Validity/Expiry:</strong> ${quotation.validity || ''}</td>
          </tr>
          <tr>
            <td style="border:0;"><strong>Salesperson:</strong> ${quotation.salesperson || ''}</td>
            <td style="border:0; text-align:right;"></td>
          </tr>
        </table>
        <p>
          <strong>Customer:</strong> ${quotation.customer}<br>
          <strong>Attention:</strong> ${quotation.attention}<br>
          <strong>Billing Address:</strong> ${quotation.billing}<br>
          <strong>Shipping Address:</strong> ${quotation.shipping}<br>
          ${quotation.remarks ? `<strong>Remarks:</strong> ${quotation.remarks}` : ''}
        </p>`;
    }
    function buildItems(pageIndex) {
      let rows = '';
      const start = pageIndex * rowsPerPage;
      const end = Math.min(start + rowsPerPage, quotation.items.length);
      for (let i = start; i < end; i++) {
        const item = quotation.items[i];
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
      return `<table>
        <thead>
          <tr>
            <th>#</th>
            <th>Part Number</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Tax %</th>
            <th>Line Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    }
    function buildTotals() {
      return `<div class="totals">
        <table>
          <tr><td>Subtotal:</td><td style="text-align:right;">${formatMoney(quotation.subtotal)}</td></tr>
          <tr><td>Tax:</td><td style="text-align:right;">${formatMoney(quotation.taxTotal)}</td></tr>
          <tr><td>Shipping:</td><td style="text-align:right;">${formatMoney(quotation.shippingTotal)}</td></tr>
          <!-- Ensure the grand total label (with currency) does not wrap to the next line -->
          <tr class="grand-row"><td style="white-space: nowrap;">Grand Total${quotation.currency ? ' (' + quotation.currency.toUpperCase() + ')' : ''}:</td><td style="text-align:right;">${formatMoney(quotation.grandTotal)}</td></tr>
        </table>
      </div>
      <div style="clear:both;"></div>
      <footer>
        <div style="font-weight:bold;">Terms and Conditions</div>
        <div>1) This quotation is valid for 30 days from the date of issue.</div>
        <div>2) Delivery depends on stock and lead times. The company is not liable for delays beyond its control.</div>
        <div>3) Once accepted, orders cannot be cancelled without written approval.</div>
        <div>4) Cancellation after 48 hours may incur charges; 30% restocking fee applies after 5 days.</div>
      </footer>`;
    }
    // Build all pages
    let htmlPages = '';
    for (let p = 0; p < totalPages; p++) {
      htmlPages += `<div class="page">
        ${buildHeader()}
        ${p === 0 ? buildDetails() : '<h2>Quotation</h2>'}
        ${buildItems(p)}
        ${p === totalPages - 1 ? buildTotals() : ''}
        <div class="page-number">Page ${p + 1} of ${totalPages}</div>
      </div>`;
      if (p < totalPages - 1) htmlPages += '<div class="page-break"></div>';
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${quotation.number}</title><style>
      /* Remove the default print header/footer by setting page margins to zero. */
      @page { margin: 0; }
      body { font-family: Arial, sans-serif; margin: 0; color:#333; }
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
        /* Add some right padding so the tagline does not stick to the edge */
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
         and dark text to contrast with the surrounding totals. */
      .grand-row td {
        font-family: "Arial Black", Arial, sans-serif;
        font-weight: bold;
        color: #041e42;
        /* Reduce font-size so currency stays on the same line */
        font-size: 18px;
        background-color: #ffffff;
      }
      .grand-row td:first-child { width:60%; }
      footer { margin-top:20px; font-size:11px; text-align:left; border-top:1px solid #ccc; padding-top:10px; color:#555; }
      .page {
        page-break-after:auto;
        /* Add padding to avoid overlap with print header/footer overlays */
        padding-top: 12mm;
        padding-bottom: 12mm;
      }
      .page-break { page-break-after:always; }
      .page-number { text-align:center; font-size:10px; margin-top:10px; }
      /* Optional overlays to hide default browser header/footer (date/time and URL) when printing.
         These overlays cover the very top and bottom margin used by browsers for headers/footers
         but are kept small so that the document header is not obscured. Adjust the height if
         necessary for your browser settings. */
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
    </style></head><body><div class="print-overlay-top"></div><div class="print-overlay-bottom"></div>${htmlPages}</body></html>`;
  }
  // Trigger printable view
  function exportQuotationPDF() {
    // Use the paginated version when exporting to ensure correct page numbers
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
  // Populate year in footer
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  // Initialize form
  fillForm();
});