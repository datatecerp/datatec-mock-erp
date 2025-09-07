/**
 * Script for the quotation list page.
 * Renders a table of saved quotations and attaches event handlers to create
 * new quotations or edit existing ones.
 */

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.querySelector('#quotationsTable tbody');
  const newBtn = document.getElementById('newQuotationBtn');
  const { getData, formatMoney } = window.datatecStorage;

  function renderList() {
    const quotations = getData('datatec_quotations', []);
    tableBody.innerHTML = '';
    quotations.sort((a, b) => (a.number > b.number ? -1 : 1));
    quotations.forEach((q) => {
      const tr = document.createElement('tr');
      const date = q.date || '';
      const rowHTML = `
        <td>${q.number}</td>
        <td>${date}</td>
        <td>${q.customer || ''}</td>
        <td style="text-align:right;">${formatMoney(q.grandTotal)}</td>
        <td><a href="quotation_form.html?id=${encodeURIComponent(q.id)}" class="btn">View / Edit</a></td>
      `;
      tr.innerHTML = rowHTML;
      tableBody.appendChild(tr);
    });
  }

  // New quotation button
  newBtn.addEventListener('click', () => {
    // Navigate to form page with no id
    location.href = 'quotation_form.html';
  });

  // Set year in footer
  document.getElementById('yearSpan').textContent = new Date().getFullYear();

  renderList();
});