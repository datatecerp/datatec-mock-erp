/**
 * Script to render sales order list.
 */
document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#salesTable tbody');
  const newBtn = document.getElementById('newSalesBtn');
  const { getData, formatMoney } = window.datatecStorage;

  function render() {
    const list = getData('datatec_salesOrders', []);
    const invoices = getData('datatec_invoices', []);
    tableBody.innerHTML = '';
    list.sort((a, b) => (a.number > b.number ? -1 : 1));
    list.forEach((so) => {
      const tr = document.createElement('tr');
      // Find linked invoice by soId or soNumber
      const inv = invoices.find((inv) => (inv.soId && inv.soId === so.id) || (inv.soNumber && inv.soNumber === so.number));
      const invoiceCell = inv ? `<a href="invoice_form.html?id=${encodeURIComponent(inv.id)}">${inv.number}</a>` : '';
      tr.innerHTML = `
        <td>${so.number}</td>
        <td>${so.date || ''}</td>
        <td>${so.customer || ''}</td>
        <td>${so.status || 'Pending'}</td>
        <td>${invoiceCell}</td>
        <td style="text-align:right;">${formatMoney(so.grandTotal)}</td>
        <td>${so.notes ? so.notes : ''}</td>
        <td><a href="sales_form.html?id=${encodeURIComponent(so.id)}" class="btn">View / Edit</a></td>
      `;
      tableBody.appendChild(tr);
    });
  }
  newBtn.addEventListener('click', () => {
    location.href = 'sales_form.html';
  });
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  render();
});