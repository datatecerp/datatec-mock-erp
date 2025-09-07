/**
 * Logic for Invoice form page.
 */
document.addEventListener('DOMContentLoaded', () => {
  const {
    getData,
    setData,
    saveRecord,
    generateId,
    getQueryParams,
    formatMoney,
  } = window.datatecStorage;
  // DOM references
  const formTitle = document.getElementById('invoiceFormTitle');

  const recordIdField = document.getElementById('invoiceRecordId');
  const numberField = document.getElementById('invoiceNumber');
  const dateField = document.getElementById('invoiceDate');
  const dueField = document.getElementById('invoiceDueDate');
  const soNumberField = document.getElementById('invoiceSONumber');
  const customerField = document.getElementById('invoiceCustomer');
  // Attention and email fields have been removed from the invoice form.
  // Define dummy objects to avoid errors if referenced elsewhere.
  const attentionField = document.getElementById('invoiceAttention') || { value: '' };
  const emailField = document.getElementById('invoiceEmail') || { value: '' };
  // Source field: maps back to Sales Order source
  const sourceField = document.getElementById('invoiceSource');
  const billingField = document.getElementById('invoiceBilling');
  const shippingField = document.getElementById('invoiceShipping');
  const currencyField = document.getElementById('invoiceCurrency');
  const taxSchemeField = document.getElementById('invoiceTaxScheme');
  // Payment terms select field controls how many days after the invoice date the due date is calculated
  const paymentTermsField = document.getElementById('invoicePaymentTerms');
  const itemsBody = document.getElementById('invoiceItemsBody');
  const subtotalCell = document.getElementById('invoiceSubtotal');
  const taxTotalCell = document.getElementById('invoiceTaxTotal');
  const shippingInput = document.getElementById('invoiceShippingTotal');
  // Rounding input removed from invoice form; create dummy object for compatibility
  const roundingInput = { value: 0 };
  const grandTotalCell = document.getElementById('invoiceGrandTotal');
  const addItemBtn = document.getElementById('invoiceAddItemBtn');
  const saveBtn = document.getElementById('saveInvoiceBtn');
  const exportBtn = document.getElementById('exportInvoiceBtn');
  const backBtn = document.getElementById('backInvoiceBtn');
  const viewSOBtn = document.getElementById('viewSOBtn');
  // Status select field (Paid/Unpaid)
  const statusField = document.getElementById('invoiceStatus');

  // Generate the next invoice number.
  //
  // Historically, invoice numbers in this mock ERP were generated based on
  // the year and month with their own counters (e.g. INV24010123), but the
  // business now wants invoice numbers in the format `INVYYNNNNN`.  The first
  // two digits represent the current year (YY) and the remaining digits are
  // sequential, starting from 5000 for each new year.  For example, the
  // first invoice created in 2025 should be `INV255000`, the second
  // `INV255001`, and so on.  To support this behaviour consistently across
  // pages, the `datatecStorage.nextNumber('invoice')` helper is used.  It
  // stores and increments a per‑year counter in localStorage and returns
  // numbers like `255000`, `255001`, etc.  Prefixing the returned value with
  // `INV` produces the desired invoice number format.
  function generateInvoiceNumber() {
    // Obtain the next sequential number for invoices.  The helper takes care
    // of rolling the counter each year and initialising the starting value
    // (YY5000) when no counter exists for the current year.
    const next = window.datatecStorage.nextNumber('invoice');
    // Convert the numeric counter into a string and prefix with "INV".
    return `INV${next}`;
  }

  // Parse query params
  const params = getQueryParams();
  let editing = false;
  let invoice = {};
  if (params.id) {
    // Editing existing invoice
    const list = getData('datatec_invoices', []);
    const existing = list.find((inv) => inv.id === params.id);
    if (existing) {
      invoice = JSON.parse(JSON.stringify(existing));
      editing = true;
    }
  } else if (params.soId) {
    // Create new invoice from sales order
    const soList = getData('datatec_salesOrders', []);
    const so = soList.find((o) => o.id === params.soId);
    if (so) {
      const todayStr = new Date().toISOString().substring(0, 10);
      const invoiceNum = generateInvoiceNumber(todayStr);
      // Compute due date 30 days after today
      const dateObj = new Date(todayStr);
      dateObj.setDate(dateObj.getDate() + 30);
      const dueStr = dateObj.toISOString().substring(0, 10);
      invoice = {
        id: generateId(),
        number: invoiceNum,
        date: todayStr,
        dueDate: dueStr,
        soId: so.id,
        soNumber: so.number,
        customer: so.customer,
        attention: so.attention,
        email: so.email,
        billing: so.billing,
        shipping: so.shipping,
        currency: so.currency || 'MYR',
        taxScheme: so.taxScheme ?? 0,
        items: so.items.map((it) => ({ ...it })),
        shippingTotal: so.shippingTotal ?? 0,
        rounding: so.rounding ?? 0,
        subtotal: 0,
        taxTotal: 0,
        grandTotal: 0,
        source: so.source || '',
        status: 'Unpaid',
        // Carry over payment terms from the sales order if available; default to 30 days
        paymentTerms: (so && so.paymentTerms) ? so.paymentTerms : '30 days',
      };
    }
  }
  // If still empty, create new blank invoice
  if (!invoice.id) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const invNum = generateInvoiceNumber(todayStr);
    const dateObj = new Date(todayStr);
    dateObj.setDate(dateObj.getDate() + 30);
    const dueStr = dateObj.toISOString().substring(0, 10);
    invoice = {
      id: generateId(),
      number: invNum,
      date: todayStr,
      dueDate: dueStr,
      soId: '',
      soNumber: '',
      customer: '',
      attention: '',
      email: '',
      billing: '',
      shipping: '',
      currency: 'MYR',
      taxScheme: 0,
      items: [],
      shippingTotal: 0,
      rounding: 0,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      source: '',
      status: 'Unpaid',
      // Default payment terms for a new blank invoice
      paymentTerms: '30 days',
    };
  }

  // Populate customer datalist
  (function populateCustomers() {
    const list = getData('datatec_customers', []);
    const datalist = document.getElementById('customerList');
    datalist.innerHTML = '';
    list.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.dataset.details = JSON.stringify(c);
      datalist.appendChild(opt);
    });
  })();
  // Populate items datalist
  (function populateItems() {
    const items = getData('datatec_items', []);
    let itemList = document.getElementById('itemList');
    if (!itemList) {
      itemList = document.createElement('datalist');
      itemList.id = 'itemList';
      document.body.appendChild(itemList);
    }
    itemList.innerHTML = '';
    items.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.sku;
      opt.dataset.details = JSON.stringify(it);
      itemList.appendChild(opt);
    });
  })();

  // Fill form with invoice object
  function fillForm() {
    recordIdField.value = invoice.id;
    numberField.value = invoice.number;
    dateField.value = invoice.date;
    dueField.value = invoice.dueDate;
    soNumberField.value = invoice.soNumber || '';
    customerField.value = invoice.customer || '';
    // Attention and Email fields no longer exist; ignore these assignments
    // Set Source field value
    if (sourceField) sourceField.value = invoice.source || '';
    billingField.value = invoice.billing || '';
    shippingField.value = invoice.shipping || '';
    currencyField.value = invoice.currency || 'MYR';
    taxSchemeField.value = invoice.taxScheme ?? 0;
    shippingInput.value = invoice.shippingTotal ?? 0;
    // Rounding input removed; nothing to set

    // Set status select value if status field exists
    if (statusField) {
      statusField.value = invoice.status || 'Unpaid';
    }
    itemsBody.innerHTML = '';
    if (invoice.items && invoice.items.length) {
      invoice.items.forEach((item) => addItemRow(item));
    } else {
      addItemRow();
    }
    computeTotals();
    formTitle.textContent = editing ? `Edit Invoice ${invoice.number}` : 'New Invoice';

    // Populate payment terms select if it exists
    if (paymentTermsField) {
      // Ensure a default value exists on the invoice object
      if (!invoice.paymentTerms) {
        invoice.paymentTerms = '30 days';
      }
      paymentTermsField.value = invoice.paymentTerms;
    }

    // After fields are set, recalculate the due date based on the selected payment terms
    updateDueDate();

    // Show or hide the View SO button depending on whether this invoice is linked to a Sales Order
    if (viewSOBtn) {
      viewSOBtn.style.display = invoice.soId ? 'inline-block' : 'none';
    }
  }

  // Add item row
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
    // Unit price
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
    totalTd.style.textAlign = 'right';
    totalTd.textContent = '0.00';
    tr.appendChild(totalTd);
    // Remove button
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
    // Auto-fill item details when SKU selected
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
    // Listen for changes to recalc totals
    [qtyInput, priceInput, taxInput].forEach((inp) => {
      inp.addEventListener('input', computeTotals);
    });
    computeTotals();
  }

  // Compute totals
  function computeTotals() {
    let subtotal = 0;
    let taxTotal = 0;
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      // order: SKU, Description, Qty, Price, Tax
      if (inputs.length >= 5) {
        const qty = parseFloat(inputs[2].value) || 0;
        const price = parseFloat(inputs[3].value) || 0;
        const tax = parseFloat(inputs[4].value) || 0;
        const net = qty * price;
        const taxAmt = net * (tax / 100);
        subtotal += net;
        taxTotal += taxAmt;
        const totalVal = net + taxAmt;
        const totalCell = row.querySelector('.line-total-cell');
        if (totalCell) totalCell.textContent = formatMoney(totalVal);
      }
    });
    const ship = parseFloat(shippingInput.value) || 0;
    // rounding removed
    subtotalCell.textContent = formatMoney(subtotal);
    taxTotalCell.textContent = formatMoney(taxTotal);
    const grand = subtotal + taxTotal + ship;
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
  // Event listener for shipping (rounding removed)
  shippingInput.addEventListener('input', computeTotals);
  // Update grand total label whenever currency changes
  if (currencyField) {
    currencyField.addEventListener('change', computeTotals);
  }
  // Add item button
  addItemBtn.addEventListener('click', () => addItemRow());

  /**
   * Recalculate the invoice due date based on the selected payment terms and invoice date.
   * If the payment terms cannot be parsed, defaults to 30 days.
   */
  function updateDueDate() {
    // Determine number of days from payment terms value (expects format like "30 days")
    let days = 30;
    if (paymentTermsField && paymentTermsField.value) {
      const parsed = parseInt(paymentTermsField.value);
      if (!isNaN(parsed)) {
        days = parsed;
      }
    }
    // Use the invoice date if provided, otherwise today's date
    let baseDateStr = dateField.value;
    if (!baseDateStr) {
      baseDateStr = new Date().toISOString().substring(0, 10);
    }
    const d = new Date(baseDateStr);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + days);
      dueField.value = d.toISOString().substring(0, 10);
    }
  }
  // Customer change autopopulate addresses
  customerField.addEventListener('change', () => {
    const name = customerField.value;
    const customers = getData('datatec_customers', []);
    const found = customers.find((c) => c.name === name);
    if (found) {
      // Populate billing/shipping and tax; attention and email removed from invoice form
      billingField.value = found.billing || '';
      shippingField.value = found.shipping || '';
      taxSchemeField.value = found.taxScheme ?? 0;
    }
  });
  // Update customer record from form
  function updateCustomer() {
    const name = customerField.value.trim();
    if (!name) return;
    const customers = getData('datatec_customers', []);
    let existing = customers.find((c) => c.name === name);
    const updated = {
      name,
      attention: attentionField.value.trim(),
      email: emailField.value.trim(),
      billing: billingField.value.trim(),
      shipping: shippingField.value.trim(),
      taxScheme: parseFloat(taxSchemeField.value) || 0,
      paymentTerms: '',
    };
    if (existing) {
      Object.assign(existing, updated);
    } else {
      customers.push(updated);
    }
    setData('datatec_customers', customers);
  }
  // Gather form data into invoice object
  function gatherData() {
    invoice.number = numberField.value;
    invoice.date = dateField.value;
    invoice.dueDate = dueField.value;
    invoice.soNumber = soNumberField.value;
    invoice.customer = customerField.value.trim();
    // Attention and email fields removed; do not store values
    invoice.billing = billingField.value.trim();
    invoice.shipping = shippingField.value.trim();
    invoice.source = sourceField ? sourceField.value.trim() : '';
    invoice.currency = currencyField.value;
    invoice.taxScheme = parseFloat(taxSchemeField.value) || 0;
    invoice.shippingTotal = parseFloat(shippingInput.value) || 0;
    // Rounding removed; always 0
    invoice.rounding = 0;
    invoice.subtotal = parseFloat(subtotalCell.textContent) || 0;
    invoice.taxTotal = parseFloat(taxTotalCell.textContent) || 0;
    invoice.grandTotal = parseFloat(grandTotalCell.textContent) || 0;
    invoice.items = [];
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
        invoice.items.push({ sku, description: desc, qty, price, tax });
      }
    });

    // Persist selected payment terms on the invoice
    if (paymentTermsField) {
      invoice.paymentTerms = paymentTermsField.value;
    }

    // Capture invoice status
    if (statusField) {
      invoice.status = statusField.value;
    }
  }
  // Save invoice
  function saveInvoice() {
    gatherData();
    updateCustomer();
    saveRecord('datatec_invoices', invoice);
    return invoice;
  }
  // Save button
  saveBtn.addEventListener('click', () => {
    saveInvoice();
    // Remain on the invoice page after saving
    alert(`Invoice ${invoice.number} saved.`);
    // No redirection to invoice_list.html
  });
  // Back button
  backBtn.addEventListener('click', () => {
    if (confirm('Discard changes and return to list?')) {
      location.href = 'invoice_list.html';
    }
  });
  // When the invoice date changes, regenerate the invoice number (if not editing)
  // and recalculate the due date using the selected payment terms
  dateField.addEventListener('change', () => {
    if (!editing) {
      const newNum = generateInvoiceNumber(dateField.value);
      numberField.value = newNum;
    }
    updateDueDate();
  });

  // When payment terms change, recalculate the due date
  if (paymentTermsField) {
    paymentTermsField.addEventListener('change', () => {
      updateDueDate();
    });
  }
  // Build printable HTML for invoice PDF
  function buildPrintableHTML() {
    // Company details for header
    const companyAddress = '302.D (East Wing)\nLevel 3 Menara BRDB\n285, Jalan Maarof KUL 59000\nMalaysia';
    const companyName = 'DataTec Hardware Sdn Bhd';
    const tagline = 'Your Trusted Solutions &<br>Hardware Partner';
    const phone = '+60 03-2297 3797';
    const email = 'info@datatec.my';
    const website = 'www.datatec.my';
    let rowsHTML = '';
    invoice.items.forEach((item, idx) => {
      // Without discount: net = qty * price
      const net = item.qty * item.price;
      const taxAmt = net * (item.tax || 0) / 100;
      const total = net + taxAmt;
      rowsHTML += `<tr>
        <td>${idx + 1}</td>
        <td>${item.sku}</td>
        <td>${item.description}</td>
        <!-- Centre align Qty, Unit Price and Tax % columns for invoice PDF -->
        <td style="text-align:center;">${item.qty}</td>
        <td style="text-align:center;">${formatMoney(item.price)}</td>
        <td style="text-align:center;">${formatMoney(item.tax || 0)}</td>
        <td style="text-align:right;">${formatMoney(total)}</td>
      </tr>`;
    });
    return `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${invoice.number}</title>
        <style>
          /* Remove default print headers/footers */
          @page { margin: 0; }
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          /* Header layout for logo and tagline */
          .header { display:flex; align-items:flex-start; justify-content:space-between; border-bottom: 2px solid #073763; padding-bottom: 10px; }
          .header .left { display:flex; align-items:flex-start; }
          .header img { width:120px; height:auto; margin-right:10px; }
          .company-info { font-size: 12px; line-height:1.2; }
          .company-info .name { font-weight:bold; font-size:14px; margin-bottom:2px; }
          .tagline { font-size:18px; font-weight:bold; color:#073763; text-align:right; margin-top:20px; }
          h2 { text-align:center; color:#073763; margin-top: 20px; margin-bottom: 10px; }
          table { width:100%; border-collapse:collapse; margin-top:15px; font-size: 12px; }
          table, th, td { border:1px solid #ccc; }
          th, td { padding:6px; }
          th { background-color: #eaf4ff; }
          tbody tr:nth-child(even) { background-color: #f7fbff; }
          .totals table tr:last-child th, .totals table tr:last-child td {
            background-color: #073763;
            color: #fff;
            font-weight:bold;
            font-size:13px;
          }
          .totals { margin-top:15px; width:40%; float:right; }
          .totals table { border:0; }
          .totals td { padding:4px; border:0; }
          /* Left align the footer text and improve spacing */
          footer {
            margin-top:30px;
            font-size:11px;
            text-align:left;
            border-top:1px solid #ccc;
            padding-top:10px;
            color:#555;
          }
          /* page numbering for printed output */
          @media print {
            @page {
              margin: 20mm;
            }
            body { counter-reset: page; }
            footer::after {
              counter-increment: page;
              /* Show current page number and replicate total count to avoid 1 of 0 bug */
              content: "Page " counter(page) " of " counter(page);
              display:block;
              text-align:center;
              font-size:10px;
              margin-top:5px;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="left">
            <img src="${location.origin}/${location.pathname.replace(/\/[^\/]*$/, '')}/assets/company-logo.jpg" alt="logo" />
            <div class="company-info">
              <div class="name">${companyName}</div>
              <div>${companyAddress.replace(/\n/g, '<br>')}</div>
              <div>Phone: ${phone}</div>
              <div>Email: ${email} | Web: ${website}</div>
            </div>
          </div>
          <div class="tagline">${tagline}</div>
        </div>
        <h2>Invoice</h2>
        <p><strong>Invoice No:</strong> ${invoice.number}<br>
           <strong>Date:</strong> ${invoice.date}<br>
           <strong>Due Date:</strong> ${invoice.dueDate}</p>
        <p>
          <strong>Customer:</strong> ${invoice.customer}<br>
          <!-- Source field displays any reference provided on the Sales Order -->
          ${invoice.source ? `<strong>Source:</strong> ${invoice.source}<br>` : ''}
          <strong>Billing Address:</strong> ${invoice.billing}<br>
          <strong>Shipping Address:</strong> ${invoice.shipping}
        </p>
        <table>
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
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>
        <div class="totals">
          <table>
            <tr><td>Subtotal:</td><td style="text-align:right;">${formatMoney(invoice.subtotal)}</td></tr>
            <tr><td>Tax:</td><td style="text-align:right;">${formatMoney(invoice.taxTotal)}</td></tr>
            <tr><td>Shipping:</td><td style="text-align:right;">${formatMoney(invoice.shippingTotal)}</td></tr>
            <!-- Highlighted grand total row -->
            <tr style="background-color:#073763;color:#fff;font-size:13px;font-weight:bold;">
              <!-- Apply nowrap so the grand total label and currency stay on one line -->
              <td style="white-space: nowrap;">Grand Total${invoice.currency ? ' (' + invoice.currency.toUpperCase() + ')' : ''}:</td>
              <td style="text-align:right;">${formatMoney(invoice.grandTotal)}</td>
            </tr>
          </table>
        </div>
        <div style="clear:both;"></div>
        <footer>
          <div><strong>Terms &amp; Conditions:</strong></div>
          <div>Payment due as per agreed terms.</div>
          <div>Late payments may incur interest.</div>
          <div>Goods remain property of Datatec until fully paid.</div>
          <div>Discrepancies must be reported within 7 days.</div>
          <br>
          <!-- Dynamically show the selected payment terms -->
          <div><strong>Payment terms:</strong> ${invoice.paymentTerms || ''}</div>
          <div>RHB Bank Berhad : 21454900013336 (MYR)</div>
          <div>RHB Bank Berhad : 61454900002324 (USD)</div>
          <div>Swift: RHBBMYKL</div>
          <div>Address: No. 134 – 136, Jalan Cerdas, Taman Connaught, Cheras, 56000 Kuala Lumpur</div>
        </footer>
      </body>
      </html>`;
  }

  /**
   * Build a paginated printable HTML for the invoice. Splits items over multiple pages,
   * highlights the grand total row, shows terms and payment info at the end, and
   * centres the page numbers at the bottom. Removes any SO number from the PDF.
   */
  function buildPrintableHTMLPaginated() {
    const companyAddress = '302.D (East Wing)\nLevel 3 Menara BRDB\n285, Jalan Maarof KUL 59000\nMalaysia';
    const companyName = 'DataTec Hardware Sdn Bhd';
    const tagline = 'Your Trusted Solutions &<br>Hardware Partner';
    const phone = '+60 03-2297 3797';
    const emailAddr = 'info@datatec.my';
    const website = 'www.datatec.my';
    // Compute base path for assets to render images correctly in blank window
    const basePath = location.href.substring(0, location.href.lastIndexOf('/') + 1);
    const items = invoice.items || [];
    const rowsPerPage = 16;
    const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage));
    function header() {
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
    function details() {
      return `<h2>Invoice</h2>
        <p><strong>Invoice No:</strong> ${invoice.number}<br>
           <strong>Date:</strong> ${invoice.date}<br>
           <strong>Due Date:</strong> ${invoice.dueDate}</p>
        <p>
          <strong>Customer:</strong> ${invoice.customer}<br>
          ${invoice.source ? `<strong>Source:</strong> ${invoice.source}<br>` : ''}
          <strong>Billing Address:</strong> ${invoice.billing}<br>
          <strong>Shipping Address:</strong> ${invoice.shipping}
        </p>`;
    }
    function itemsTable(pageIndex) {
      let rows = '';
      const start = pageIndex * rowsPerPage;
      const end = Math.min(start + rowsPerPage, items.length);
      for (let i = start; i < end; i++) {
        const item = items[i];
        const net = item.qty * item.price;
        const taxAmt = net * ((item.tax || 0) / 100);
        const total = net + taxAmt;
        rows += `<tr>
          <td>${i + 1}</td>
          <td>${item.sku}</td>
          <td>${item.description}</td>
          <!-- Centre align quantity, unit price and tax percentage columns -->
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:center;">${formatMoney(item.price)}</td>
          <td style="text-align:center;">${formatMoney(item.tax || 0)}</td>
          <td style="text-align:right;">${formatMoney(total)}</td>
        </tr>`;
      }
      return `<table><thead><tr><th>#</th><th>Part Number</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax %</th><th>Line Total</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    function totals() {
      return `<div class="totals"><table>
        <tr><td>Subtotal:</td><td style="text-align:right;">${formatMoney(invoice.subtotal)}</td></tr>
        <tr><td>Tax:</td><td style="text-align:right;">${formatMoney(invoice.taxTotal)}</td></tr>
        <tr><td>Shipping:</td><td style="text-align:right;">${formatMoney(invoice.shippingTotal)}</td></tr>
        <!-- Ensure the grand total label does not wrap onto a new line -->
        <tr class="grand-row"><td style="white-space:nowrap;">Grand Total${invoice.currency ? ' (' + invoice.currency.toUpperCase() + ')' : ''}:</td><td style="text-align:right;">${formatMoney(invoice.grandTotal)}</td></tr>
      </table></div><div style="clear:both;"></div>
      <footer>
        <div><strong>Terms &amp; Conditions:</strong></div>
        <div>Payment due as per agreed terms.</div>
        <div>Late payments may incur interest.</div>
        <div>Goods remain property of Datatec until fully paid.</div>
        <div>Discrepancies must be reported within 7 days.</div>
        <br>
        <div><strong>Payment terms:</strong> ${invoice.paymentTerms || ''}</div>
        <div>RHB Bank Berhad : 21454900013336 (MYR)</div>
        <div>RHB Bank Berhad : 61454900002324 (USD)</div>
        <div>Swift: RHBBMYKL</div>
        <div>Address: No. 134 – 136, Jalan Cerdas, Taman Connaught, Cheras, 56000 Kuala Lumpur</div>
      </footer>`;
    }
    let pages = '';
    for (let p = 0; p < totalPages; p++) {
      pages += `<div class="page">
        ${header()}
        ${p === 0 ? details() : '<h2>Invoice</h2>'}
        ${itemsTable(p)}
        ${p === totalPages - 1 ? totals() : ''}
        <div class="page-number">Page ${p + 1} of ${totalPages}</div>
      </div>`;
      if (p < totalPages - 1) pages += '<div class="page-break"></div>';
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${invoice.number}</title><style>
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
         with dark text for a clean look that still stands out. */
      .grand-row td {
        font-family: "Arial Black", Arial, sans-serif;
        font-weight: bold;
        color: #041e42;
        /* Reduce font-size so the currency label stays on the same line */
        font-size: 18px;
        background-color: #ffffff;
      }
      .grand-row td:first-child { width:60%; }
      footer { margin-top:20px; font-size:11px; text-align:left; border-top:1px solid #ccc; padding-top:10px; color:#555; }
      /* Optional overlays to hide browser headers/footers when printing.
         They cover the very top and bottom margins; adjust height as needed. */
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
        /* Add padding to avoid overlap with print header/footer overlays */
        padding-top: 12mm;
        padding-bottom: 12mm;
      }
      .page-break { page-break-after:always; }
      .page-number { text-align:center; font-size:10px; margin-top:10px; }
    </style></head><body><div class="print-overlay-top"></div><div class="print-overlay-bottom"></div>${pages}</body></html>`;
  }
  // Export button
  exportBtn.addEventListener('click', () => {
    gatherData();
    const html = buildPrintableHTMLPaginated();
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  });

  // View SO button: navigate to linked Sales Order if exists
  if (viewSOBtn) {
    viewSOBtn.addEventListener('click', () => {
      if (invoice.soId) {
        location.href = `sales_form.html?id=${encodeURIComponent(invoice.soId)}`;
      }
    });
  }
  // Populate year
  const yearSpan = document.getElementById('yearSpan');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  // Initialize form
  fillForm();
});