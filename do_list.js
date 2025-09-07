/**
 * Script to render delivery orders list for the standalone datatec-mock-erp.
 */
document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#doTable tbody');
  const newBtn = document.getElementById('newDoBtn');
  const { getData, formatMoney } = window.datatecStorage;
  function computeValue(doRec) {
    const itemsMaster = getData('datatec_items', []);
    let total = 0;
    if (Array.isArray(doRec.items)) {
      doRec.items.forEach((it) => {
        const master = itemsMaster.find((m) => m.sku === it.sku);
        const price = master && typeof master.price === 'number' ? master.price : 0;
        total += (parseFloat(it.qty) || 0) * price;
      });
    }
    return total;
  }
  function render() {
    const list = getData('datatec_deliveryOrders', []);
    tableBody.innerHTML = '';
    list.sort((a, b) => (a.number > b.number ? -1 : 1));
    list.forEach((doRec) => {
      const tr = document.createElement('tr');
      const value = computeValue(doRec);
      const soLink = doRec.soId ? `<a href="sales_form.html?id=${encodeURIComponent(doRec.soId)}">${doRec.soNumber || ''}</a>` : (doRec.soNumber || '');
      tr.innerHTML = `
        <td>${doRec.number}</td>
        <td>${doRec.date || ''}</td>
        <td>${doRec.customer || ''}</td>
        <td>${soLink}</td>
        <td style="text-align:right;">${formatMoney(value)}</td>
        <td><a href="do_form.html?id=${encodeURIComponent(doRec.id)}" class="btn">View / Edit</a></td>
      `;
      tableBody.appendChild(tr);
    });
  }
  newBtn.addEventListener('click', () => {
    location.href = 'do_form.html';
  });
  document.getElementById('yearSpan').textContent = new Date().getFullYear();
  render();
});