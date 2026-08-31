/* cuterobot-bonus — load data/books.json and render offer tables.
 *
 * Any element with [data-books-table] gets a rendered table of offers.
 * Optional attributes:
 *   data-books-filter="major"     -> only states === "all-major"
 *   data-books-filter="regional"  -> only books with an explicit states array
 *   data-books-cols="name,offer,deposit,estExtract,verified"  -> column set
 *
 * NOTE: fetch() fails on file:// in most browsers. Serve with
 *   python3 -m http.server 8080
 */

'use strict';

const BOOKS_URL = (function () {
  // resolve relative to the page so guide.html and index.html both work
  const path = location.pathname.replace(/[^/]*$/, '');
  return path + 'data/books.json';
})();

let BOOKS_CACHE = null;

async function loadBooks() {
  if (BOOKS_CACHE) return BOOKS_CACHE;
  const res = await fetch(BOOKS_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error('books.json: HTTP ' + res.status);
  BOOKS_CACHE = await res.json();
  return BOOKS_CACHE;
}

function fmtMoney(n) {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return '$0';
  return '$' + v.toLocaleString('en-US');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const COL_DEFS = {
  name: { th: 'Book', get: (b) => `<strong>${esc(b.name)}</strong>` },
  offer: { th: 'Offer', get: (b) => esc(b.offer) },
  promoType: { th: 'Type', get: (b) => `<code>${esc(b.promoType)}</code>` },
  deposit: { th: 'Deposit', cls: 'num', get: (b) => fmtMoney(b.deposit) },
  estExtract: {
    th: 'Est. extract', cls: 'num',
    get: (b) => b.estExtractLow === b.estExtractHigh
      ? fmtMoney(b.estExtractLow)
      : `${fmtMoney(b.estExtractLow)}–${fmtMoney(b.estExtractHigh)}`,
  },
  states: {
    th: 'States',
    get: (b) => Array.isArray(b.states) ? esc(b.states.join(', ')) : esc(b.states),
  },
  terms: { th: 'Key terms', get: (b) => `<span class="dim">${esc(b.terms)}</span>` },
  notes: { th: 'Notes', get: (b) => `<span class="dim">${esc(b.notes || '')}</span>` },
  verified: { th: 'Verified', get: (b) => `<span class="dim">${esc(b.verified)}</span>` },
};

function renderBooksTable(el, data) {
  const filter = el.getAttribute('data-books-filter');
  const cols = (el.getAttribute('data-books-cols') || 'name,offer,deposit,estExtract,verified')
    .split(',').map((s) => s.trim()).filter((c) => COL_DEFS[c]);

  let books = data.books.slice();
  if (filter === 'major') books = books.filter((b) => b.states === 'all-major');
  if (filter === 'regional') books = books.filter((b) => Array.isArray(b.states));

  const thead = '<tr>' + cols.map((c) => `<th class="${COL_DEFS[c].cls || ''}">${COL_DEFS[c].th}</th>`).join('') + '</tr>';
  const rows = books.map((b) =>
    '<tr>' + cols.map((c) => `<td class="${COL_DEFS[c].cls || ''}">${COL_DEFS[c].get(b)}</td>`).join('') + '</tr>'
  ).join('');

  el.innerHTML = `<div class="tbl-scroll"><table><thead>${thead}</thead><tbody>${rows}</tbody></table></div>`;
}

function renderVerifyBanner(data) {
  document.querySelectorAll('[data-books-verified]').forEach((el) => {
    const v = data.books[0] && data.books[0].verified;
    el.textContent = v || '—';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const targets = document.querySelectorAll('[data-books-table]');
  if (!targets.length && !document.querySelector('[data-books-verified]')) return;
  try {
    const data = await loadBooks();
    targets.forEach((el) => renderBooksTable(el, data));
    renderVerifyBanner(data);
  } catch (e) {
    console.error(e);
    targets.forEach((el) => {
      el.innerHTML = `<div class="banner">Couldn't load <code>data/books.json</code> (${esc(e.message)}).
        Serve the site over HTTP — <code>python3 -m http.server 8080</code> — <code>file://</code> blocks fetch.</div>`;
    });
  }
});
