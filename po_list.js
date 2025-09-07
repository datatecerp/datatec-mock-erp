/**
 * Renders list of purchase orders.
 */
document.addEventListener('DOMContentLoaded', () => {
  const body = document.querySelector('#poTable tbody');
  const btn = document.getElementById('newPoBtn');
  const { getData, formatMoney } = window.datatecStorage;
  function render() {
    const pos = getData('datatec_purchaseOrders', []);
    body.innerHTML = '';
    pos.sort((a, b) => (a.number > b.number ? -1 : 1));
    pos.forEach((po) => {
      const tr = document.createElement('tr');
      const soLink = po.linkedSalesOrderId ? `<a href="sales_form.html?id=${encodeURIComponent(po.linkedSalesOrderId)}">${po.linkedSalesOrderNumber || ''}</a>` : (po.linkedSalesOrderNumber || '');
      tr.innerHTML = `
        <td>${po.number}</td>
        <td>${po.date || ''}</td>
        <td>${soLink}</td>
        <td>${po.vendor || ''}</td>
        <td style="text-align:right;">${formatMoney(po.grandTotal)}</td>
        <td><a href="po_form.html?id=${encodeURIComponent(po.id)}" class="btn">View / Edit</a></td>
      `;
      body.appendChild(tr);
    });
  }
  btn.addEventListener('click', () => {
    location.href = 'po_form.html';
  });
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  render();
});