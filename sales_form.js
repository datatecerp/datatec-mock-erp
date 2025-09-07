/**
 * Logic for Sales Order form.
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
  // DOM
  const formTitle = document.getElementById('soFormTitle');
  const recordIdField = document.getElementById('soRecordId');
  const numberField = document.getElementById('salesOrderNumber');
  const dateField = document.getElementById('salesOrderDate');
  const deliveryField = document.getElementById('deliveryDate');
  const currencyField = document.getElementById('salesCurrency');
  const taxSchemeField = document.getElementById('salesTaxScheme');
  const statusField = document.getElementById('salesStatus');
  const notesField = document.getElementById('salesNotes');
  const customerField = document.getElementById('salesCustomer');
  const attentionField = document.getElementById('salesAttention');
  // Email field has been removed from the form; use a dummy object to avoid errors when referenced
  const emailField = document.getElementById('salesEmail') || { value: '' };
  const billingField = document.getElementById('salesBilling');
  const shippingField = document.getElementById('salesShipping');
  const itemsBody = document.getElementById('salesItemsBody');
  const subtotalCell = document.getElementById('salesSubtotal');
  const taxTotalCell = document.getElementById('salesTaxTotal');
  const shippingInput = document.getElementById('salesShippingTotal');
  const roundingInput = document.getElementById('salesRounding');
  const grandTotalCell = document.getElementById('salesGrandTotal');
  const addItemBtn = document.getElementById('salesAddItemBtn');
  const saveBtn = document.getElementById('saveSalesBtn');
  const convertBtn = document.getElementById('convertToPOBtn');
  const convertInvoiceBtn = document.getElementById('convertToInvoiceBtn');
  // Delivery Order conversion button
  const convertDOBtn = document.getElementById('convertToDOBtn');
  const backBtn = document.getElementById('backSalesBtn');

  // Source field: used to store additional reference and will be carried over to invoice
  const sourceField = document.getElementById('salesSource');

  // Query params: id (for editing), quoteId (convert from quotation)
  const params = getQueryParams();
  let editing = false;
  let salesOrder = {};
  if (params.id) {
    const list = getData('datatec_salesOrders', []);
    const existing = list.find((o) => o.id === params.id);
    if (existing) {
      salesOrder = JSON.parse(JSON.stringify(existing));
      editing = true;
    }
  } else if (params.quoteId) {
    // Create from quotation
    const quotations = getData('datatec_quotations', []);
    const q = quotations.find((qq) => qq.id === params.quoteId);
    if (q) {
      salesOrder = {
        id: generateId(),
        number: 'SO' + nextNumber('salesOrder'),
        date: new Date().toISOString().substring(0, 10),
        deliveryDate: '',
        customer: q.customer,
        attention: q.attention,
        email: q.email,
        billing: q.billing,
        shipping: q.shipping,
        currency: q.currency,
        taxScheme: q.taxScheme,
        status: 'Pending',
        notes: '',
        // carry over default vendor from quotation's item definitions if present
        items: q.items.map((it) => ({ ...it, vendor: it.vendor || '' })),
        shippingTotal: 0,
        rounding: 0,
        subtotal: 0,
        taxTotal: 0,
        grandTotal: 0,
        linkedQuotationId: q.id,
        source: '',
      };
    }
  }
  // If still empty (new SO)
  if (!salesOrder.id) {
    salesOrder = {
      id: generateId(),
      number: 'SO' + nextNumber('salesOrder'),
      date: new Date().toISOString().substring(0, 10),
      deliveryDate: '',
      customer: '',
      attention: '',
      email: '',
      billing: '',
      shipping: '',
      currency: 'MYR',
      taxScheme: 0,
      status: 'Pending',
      notes: '',
      items: [],
      shippingTotal: 0,
      rounding: 0,
      subtotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      source: '',
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
    // Append datalist for items if not exist
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
  // Populate vendors datalist
  (function populateVendors() {
    const vendors = getData('datatec_vendors', []);
    let vendorList = document.getElementById('vendorList');
    if (!vendorList) {
      vendorList = document.createElement('datalist');
      vendorList.id = 'vendorList';
      document.body.appendChild(vendorList);
    }
    vendorList.innerHTML = '';
    vendors.forEach((v) => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.dataset.details = JSON.stringify(v);
      vendorList.appendChild(opt);
    });
  })();
  // Fill form from salesOrder object
  function fillForm() {
    recordIdField.value = salesOrder.id;
    numberField.value = salesOrder.number;
    dateField.value = salesOrder.date;
    deliveryField.value = salesOrder.deliveryDate || '';
    currencyField.value = salesOrder.currency || 'MYR';
    taxSchemeField.value = salesOrder.taxScheme ?? 0;
    statusField.value = salesOrder.status || 'Pending';
    notesField.value = salesOrder.notes || '';
    if (sourceField) sourceField.value = salesOrder.source || '';
    customerField.value = salesOrder.customer || '';
    attentionField.value = salesOrder.attention || '';
    emailField.value = salesOrder.email || '';
    billingField.value = salesOrder.billing || '';
    shippingField.value = salesOrder.shipping || '';
    shippingInput.value = salesOrder.shippingTotal ?? 0;
    roundingInput.value = salesOrder.rounding ?? 0;
    itemsBody.innerHTML = '';
    if (salesOrder.items && salesOrder.items.length) {
      salesOrder.items.forEach((item) => addItemRow(item));
    } else {
      addItemRow();
    }
    computeTotals();
    formTitle.textContent = editing ? `Edit Sales Order ${salesOrder.number}` : 'New Sales Order';

    // Update invoice button visibility after populating status
    updateInvoiceButton();
  }
  // Add item row to table
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
    // Vendor
    const vendorTd = document.createElement('td');
    const vendorInput = document.createElement('input');
    vendorInput.type = 'text';
    vendorInput.setAttribute('list', 'vendorList');
    vendorInput.value = item.vendor || '';
    vendorTd.appendChild(vendorInput);
    tr.appendChild(vendorTd);
    // Line total
    const totalTd = document.createElement('td');
    totalTd.className = 'line-total-cell';
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
        descInput.value = found.description || '';
        priceInput.value = found.price || 0;
        taxInput.value = found.tax || 0;
        vendorInput.value = found.vendor || '';
      }
      computeTotals();
    });
    // On vendor change, optionally update vendor list
    vendorInput.addEventListener('change', () => {
      const name = vendorInput.value.trim();
      if (!name) return;
      const vendors = getData('datatec_vendors', []);
      let existing = vendors.find((v) => v.name === name);
      if (!existing) {
        vendors.push({ name });
        setData('datatec_vendors', vendors);
      }
    });
    // Recompute totals when any numeric field changes
    // Recompute totals when quantity, price or tax change
    [qtyInput, priceInput, taxInput].forEach((inp) => {
      inp.addEventListener('input', computeTotals);
    });
    computeTotals();
  }
  // Compute totals for SO
  function computeTotals() {
    let subtotal = 0;
    let taxTotal = 0;
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      // New column order (after removing UOM and Discount):
      // 0: SKU, 1: Description, 2: Qty, 3: Price, 4: Tax, 5: Vendor
      if (inputs.length >= 6) {
        const qty = parseFloat(inputs[2].value) || 0;
        const price = parseFloat(inputs[3].value) || 0;
        const tax = parseFloat(inputs[4].value) || 0;
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
    const round = parseFloat(roundingInput.value) || 0;
    subtotalCell.textContent = formatMoney(subtotal);
    taxTotalCell.textContent = formatMoney(taxTotal);
    const grand = subtotal + taxTotal + ship + round;
    grandTotalCell.textContent = formatMoney(grand);
  }
  // Shipping and rounding input events
  shippingInput.addEventListener('input', computeTotals);
  roundingInput.addEventListener('input', computeTotals);
  // Add item button
  addItemBtn.addEventListener('click', () => addItemRow());
  // Customer change autopopulate addresses
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
  // Gather form fields into salesOrder object
  function gatherData() {
    salesOrder.number = numberField.value;
    salesOrder.date = dateField.value;
    salesOrder.deliveryDate = deliveryField.value;
    salesOrder.customer = customerField.value.trim();
    salesOrder.attention = attentionField.value.trim();
    salesOrder.email = emailField.value.trim();
    salesOrder.billing = billingField.value.trim();
    salesOrder.shipping = shippingField.value.trim();
    salesOrder.currency = currencyField.value;
    salesOrder.taxScheme = parseFloat(taxSchemeField.value) || 0;
    salesOrder.status = statusField.value;
    salesOrder.notes = notesField.value.trim();
    // Capture source field value so it propagates to invoices and delivery orders
    if (typeof sourceField !== 'undefined' && sourceField) {
      salesOrder.source = sourceField.value.trim();
    }
    salesOrder.shippingTotal = parseFloat(shippingInput.value) || 0;
    salesOrder.rounding = parseFloat(roundingInput.value) || 0;
    salesOrder.subtotal = parseFloat(subtotalCell.textContent) || 0;
    salesOrder.taxTotal = parseFloat(taxTotalCell.textContent) || 0;
    salesOrder.grandTotal = parseFloat(grandTotalCell.textContent) || 0;
    salesOrder.items = [];
    const rows = itemsBody.querySelectorAll('tr');
    rows.forEach((row) => {
      const inputs = row.querySelectorAll('input');
      // New column order: SKU, Description, Qty, Price, Tax, Vendor
      if (inputs.length >= 6) {
        const sku = inputs[0].value.trim();
        const desc = inputs[1].value.trim();
        const qty = parseFloat(inputs[2].value) || 0;
        const price = parseFloat(inputs[3].value) || 0;
        const tax = parseFloat(inputs[4].value) || 0;
        const vendor = inputs[5].value.trim();
        // Skip completely blank rows
        if (!sku && !desc && qty === 0 && price === 0 && tax === 0 && !vendor) return;
        salesOrder.items.push({ sku, description: desc, qty, price, tax, vendor });
      }
    });
  }
  // Save Sales Order
  function saveSalesOrder() {
    gatherData();
    updateCustomer();
    saveRecord('datatec_salesOrders', salesOrder);
    return salesOrder;
  }
  // Save button
  saveBtn.addEventListener('click', () => {
    saveSalesOrder();
    // Stay on the current page after saving
    alert(`Sales Order ${salesOrder.number} saved.`);
    // No redirection to sales_list.html
  });
  // Convert to PO button
  convertBtn.addEventListener('click', () => {
    saveSalesOrder();
    location.href = `po_form.html?soId=${encodeURIComponent(salesOrder.id)}`;
  });

  // Convert to Invoice button
  convertInvoiceBtn.addEventListener('click', () => {
    // Save the sales order first
    saveSalesOrder();
    // Optionally ensure status is Completed
    if (salesOrder.status !== 'Completed') {
      const proceed = confirm('This Sales Order is not marked Completed. Continue creating an invoice?');
      if (!proceed) return;
    }
    location.href = `invoice_form.html?soId=${encodeURIComponent(salesOrder.id)}`;
  });

  // Convert to Delivery Order button
  if (convertDOBtn) {
    convertDOBtn.addEventListener('click', () => {
      // Save the sales order first
      saveSalesOrder();
      // Confirm if status is not completed
      if (salesOrder.status !== 'Completed') {
        const proceed = confirm('This Sales Order is not marked Completed. Continue creating a delivery order?');
        if (!proceed) return;
      }
      location.href = `do_form.html?soId=${encodeURIComponent(salesOrder.id)}`;
    });
  }

  // Show or hide the invoice button based on status
  function updateInvoiceButton() {
    if (!convertInvoiceBtn) return;
    // Always show the convert to invoice button so users can generate invoices at any stage.
    // If the Sales Order status is not completed, a confirmation prompt will still appear
    // when clicking the button (handled in the click handler below).
    convertInvoiceBtn.style.display = 'inline-block';
  }
  statusField.addEventListener('change', updateInvoiceButton);
  // Back button
  backBtn.addEventListener('click', () => {
    if (confirm('Discard changes and return to list?')) {
      location.href = 'sales_list.html';
    }
  });
  // Populate year
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  // Initialize form
  fillForm();
});