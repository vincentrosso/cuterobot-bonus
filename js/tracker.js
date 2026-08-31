/* cuterobot-bonus — hedge math + tracker state.
 *
 * Pure functions (odds, hedge, computeBet) are also used by guide.html's inline
 * calculator, so this file must run standalone with no tracker DOM present.
 *
 * NO automated betting. This computes stakes and profit; a human places every bet
 * by hand at each sportsbook.
 */

'use strict';

/* ------------------------------------------------------------------ *
 * Odds helpers
 * ------------------------------------------------------------------ */

// American odds -> decimal odds (total return multiple, stake included).
function toDecimal(american) {
  const a = Number(american);
  if (!isFinite(a) || a === 0) return NaN;
  return a > 0 ? a / 100 + 1 : 100 / Math.abs(a) + 1;
}

// Decimal odds -> implied probability (0..1), no vig removal.
function impliedProb(decimal) {
  const d = Number(decimal);
  return d > 1 ? 1 / d : NaN;
}

// Accepts "+170", "170", "-190", or a decimal like "2.7". Returns decimal odds.
function parseOdds(raw) {
  if (raw === null || raw === undefined) return NaN;
  const s = String(raw).trim().replace(/\s+/g, '');
  if (s === '') return NaN;
  if (/^[+-]?\d+$/.test(s)) {
    const n = Number(s);
    // A bare integer >= 100 or with a sign is American; small values are decimal.
    if (Math.abs(n) >= 100 || /^[+-]/.test(s)) return toDecimal(n);
    return n; // e.g. "3" meaning decimal 3.0 — unusual but allowed
  }
  const f = Number(s);
  return isFinite(f) && f > 1 ? f : NaN;
}

function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ *
 * Core: computeBet
 * ------------------------------------------------------------------ *
 *
 * Two straight (back) bets at two different books — one on the promo book,
 * one hedge on another book covering the opposite outcome. No betting exchange.
 *
 * betType:
 *   'qualifying'      — cash bet; bonus is returned only if this bet LOSES
 *                       (second-chance / bet-&-get). You want promoSide to lose.
 *   'secondChance'    — alias of 'qualifying'.
 *   'bonusConversion' — the promo stake is a bonus bet, stake NOT returned (SNR).
 *                       Convert to cash by hedging. Want big +odds on promo side.
 *   'profitBoost'     — cash bet whose PROFIT is multiplied by boostPct on a win.
 *
 * Inputs:
 *   promoOdds, hedgeOdds — American ("+170") or decimal; parsed by parseOdds.
 *   stake        — promo-side stake (cash, or bonus-bet face value for conversion).
 *   bonusValue   — face value of the bonus you receive (qualifying/secondChance).
 *   conversionRate — expected cash you realise per $1 of bonus bet (default 0.70).
 *   boostPct     — e.g. 1.0 for a 100% profit boost (profitBoost only).
 *   hedgeStakeOverride — if provided, use this hedge stake instead of the
 *                        recommended one (lets the tracker store what was placed).
 *
 * Returns:
 *   { dPromo, dHedge, hedgeStake, profitIfPromoWins, profitIfPromoLoses,
 *     guaranteedFloor, bonusExpectedValue, qualifyingLoss, note }
 *
 * Sign convention: profits are net of BOTH stakes. "guaranteedFloor" is the
 * worse of the two outcomes — the number you can actually count on.
 */
function computeBet(opts) {
  const o = opts || {};
  const type = o.betType === 'secondChance' ? 'qualifying' : (o.betType || 'qualifying');
  const dPromo = typeof o.promoOdds === 'number' && o.promoOdds > 1 ? o.promoOdds : parseOdds(o.promoOdds);
  const dHedge = typeof o.hedgeOdds === 'number' && o.hedgeOdds > 1 ? o.hedgeOdds : parseOdds(o.hedgeOdds);
  const S = Number(o.stake) || 0;
  const B = Number(o.bonusValue) || 0;
  const r = o.conversionRate == null ? 0.70 : Number(o.conversionRate);
  const boost = Number(o.boostPct) || 0;

  const out = {
    dPromo, dHedge, hedgeStake: NaN,
    profitIfPromoWins: NaN, profitIfPromoLoses: NaN,
    guaranteedFloor: NaN, bonusExpectedValue: 0, qualifyingLoss: NaN, note: '',
  };
  if (!isFinite(dPromo) || !isFinite(dHedge) || S <= 0) {
    out.note = 'Enter valid odds for both books and a stake.';
    return out;
  }

  const override = o.hedgeStakeOverride != null && o.hedgeStakeOverride !== '' && isFinite(Number(o.hedgeStakeOverride));

  if (type === 'bonusConversion') {
    // Promo stake is a bonus bet, stake not returned. Win pays S*(dPromo-1) only.
    // Equalise: S*(dPromo-1) - H  ==  H*(dHedge-1)
    const H = override ? Number(o.hedgeStakeOverride) : (S * (dPromo - 1)) / dHedge;
    const winBranch = S * (dPromo - 1) - H;          // promo wins, hedge loses
    const loseBranch = H * (dHedge - 1);             // promo loses, hedge wins
    out.hedgeStake = H;
    out.profitIfPromoWins = winBranch;
    out.profitIfPromoLoses = loseBranch;
    out.guaranteedFloor = Math.min(winBranch, loseBranch);
    out.bonusExpectedValue = 0;
    out.note = 'Bonus bet (stake not returned). Put the big +odds side on the promo book.';
    return out;
  }

  if (type === 'profitBoost') {
    // Cash bet; on a win, profit is multiplied by (1+boost). Stake returned on win.
    // Win return = S + S*(dPromo-1)*(1+boost).  Lose = -S.
    // Equalise: S*(dPromo-1)*(1+boost) - H  ==  -S + H*(dHedge-1)
    const grossPromoProfit = S * (dPromo - 1) * (1 + boost);
    const H = override ? Number(o.hedgeStakeOverride) : (grossPromoProfit + S) / dHedge;
    const winBranch = grossPromoProfit - H;
    const loseBranch = -S + H * (dHedge - 1);
    out.hedgeStake = H;
    out.profitIfPromoWins = winBranch;
    out.profitIfPromoLoses = loseBranch;
    out.guaranteedFloor = Math.min(winBranch, loseBranch);
    out.note = boost ? `Profit boosted ${Math.round(boost * 100)}% on a win. Use near-even games.` :
      'Set a boost % (e.g. 100) — otherwise this is just a plain hedge.';
    return out;
  }

  // ---- qualifying / secondChance ----
  // Cash bet on promo book; bonus of face value B credits ONLY if promo side loses.
  // Bonus-adjusted hedge so BOTH branches net the same once bonus EV is counted:
  //   S*(dPromo-1) - H  ==  -S + H*(dHedge-1) + B*r
  //   => H = (S*dPromo - B*r) / dHedge
  const bonusEV = B * r;
  const Hbalanced = (S * dPromo - bonusEV) / dHedge;
  const H = override ? Number(o.hedgeStakeOverride) : Math.max(Hbalanced, 0);

  const winBranch = S * (dPromo - 1) - H;                    // promo wins -> NO bonus
  const loseBranch = -S + H * (dHedge - 1) + bonusEV;        // promo loses -> bonus credits
  const loseBranchCashOnly = -S + H * (dHedge - 1);          // the guaranteed cash before bonus

  out.hedgeStake = H;
  out.profitIfPromoWins = winBranch;
  out.profitIfPromoLoses = loseBranch;
  out.bonusExpectedValue = bonusEV;
  // Qualifying loss = the cash you're down in the branch where you DON'T get the bonus,
  // i.e. the true out-of-pocket cost of triggering the offer.
  out.qualifyingLoss = Math.min(winBranch, loseBranchCashOnly);
  // The floor: if the hedge is bonus-balanced, both branches are equal and that's the floor.
  // If overridden, it's the worse branch (counting bonus EV, since that's the realistic value).
  out.guaranteedFloor = Math.min(winBranch, loseBranch);
  out.note = 'Put the underdog on the promo book — you want the qualifier to LOSE so the bonus triggers.';
  return out;
}

/* ------------------------------------------------------------------ *
 * Tracker state (localStorage)
 * ------------------------------------------------------------------ */

const STORE_KEY = 'cuterobot_bets_v1';

const DEFAULT_STATE = () => ({
  bets: [],
  settings: { conversionRate: 0.70, homeState: 'CA', blendedTaxRate: 0.30 },
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_STATE();
    const parsed = JSON.parse(raw);
    const base = DEFAULT_STATE();
    return {
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
      settings: Object.assign(base.settings, parsed.settings || {}),
    };
  } catch (e) {
    console.warn('tracker: corrupt state, starting fresh', e);
    return DEFAULT_STATE();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    alert('Could not save — localStorage may be full or disabled.\n' + e);
  }
}

function uuid() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'b-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

const STATUS_LABELS = {
  pending: 'pending',
  settled: 'settled',
  bonus_credited: 'bonus credited',
  converted: 'converted',
};

/* ------------------------------------------------------------------ *
 * Tracker UI  (only runs if the tracker DOM is present)
 * ------------------------------------------------------------------ */

function initTracker() {
  const root = document.getElementById('tracker-app');
  if (!root) return; // guide page etc. — math functions only

  let state = loadState();

  const $ = (id) => document.getElementById(id);
  const form = $('bet-form');
  const tbody = $('bet-rows');
  const summary = $('summary-bar');
  const calcOut = $('calc-preview');

  // ---- live calculator preview inside the add-bet form ----
  function readForm() {
    const betType = form.betType.value;
    return {
      betType,
      promoBook: form.book.value.trim(),
      hedgeBook: form.hedgeBook.value.trim(),
      promoOdds: form.promoOdds.value.trim(),
      hedgeOdds: form.hedgeOdds.value.trim(),
      stake: Number(form.stake.value) || 0,
      bonusValue: Number(form.bonusValue.value) || 0,
      conversionRate: state.settings.conversionRate,
      boostPct: Number(form.boostPct.value) || 0,
      hedgeStakeOverride: form.hedgeStake.value.trim(),
    };
  }

  function renderPreview() {
    const f = readForm();
    const c = computeBet(f);
    const neg = !isFinite(c.guaranteedFloor) || c.guaranteedFloor < 0;
    calcOut.className = 'result' + (neg ? ' negative' : '');
    if (!isFinite(c.hedgeStake)) {
      calcOut.innerHTML = `<div class="dim">${c.note || 'Fill in odds + stake to see the hedge.'}</div>`;
      return;
    }
    const rows = [
      ['Recommended hedge stake' + (f.hedgeBook ? ' @ ' + f.hedgeBook : ''), money(c.hedgeStake)],
      ['If promo side WINS', money(c.profitIfPromoWins)],
      ['If promo side LOSES', money(c.profitIfPromoLoses)],
    ];
    if (isFinite(c.qualifyingLoss)) rows.push(['Out-of-pocket to trigger bonus', money(c.qualifyingLoss)]);
    if (c.bonusExpectedValue) rows.push([`Bonus EV (@ ${Math.round(f.conversionRate * 100)}% conv.)`, money(c.bonusExpectedValue)]);
    calcOut.innerHTML = `
      <div class="dim" style="font-size:.8rem;text-transform:uppercase;letter-spacing:.04em">Guaranteed floor</div>
      <div class="big ${neg ? 'neg' : 'pos'}">${money(c.guaranteedFloor)}</div>
      ${rows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('')}
      <div class="dim" style="margin-top:.5rem;font-size:.82rem">${c.note || ''}</div>`;
  }

  form.addEventListener('input', renderPreview);
  form.addEventListener('change', renderPreview);

  // ---- add / edit ----
  let editingId = null;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = readForm();
    const c = computeBet(f);
    const rec = {
      id: editingId || uuid(),
      date: form.date.value || new Date().toISOString().slice(0, 10),
      state: form.state.value.trim() || 'CO',
      book: f.promoBook,
      promoType: f.betType,
      game: form.game.value.trim(),
      side: form.side.value.trim(),
      stake: f.stake,
      promoOdds: f.promoOdds,
      hedgeBook: f.hedgeBook,
      hedgeSide: form.hedgeSide.value.trim(),
      hedgeOdds: f.hedgeOdds,
      hedgeStake: isFinite(Number(f.hedgeStakeOverride)) && f.hedgeStakeOverride !== ''
        ? Number(f.hedgeStakeOverride) : round2(c.hedgeStake),
      status: form.status.value,
      bonusValue: f.bonusValue,
      boostPct: f.boostPct,
      guaranteedFloor: round2(c.guaranteedFloor),
      cashRealized: Number(form.cashRealized.value) || 0,
      grossWinnings: Number(form.grossWinnings.value) || 0,
      notes: form.notes.value.trim(),
    };
    if (editingId) {
      state.bets = state.bets.map((b) => (b.id === editingId ? rec : b));
    } else {
      state.bets.push(rec);
    }
    saveState(state);
    editingId = null;
    form.reset();
    form.date.value = new Date().toISOString().slice(0, 10);
    $('form-title').textContent = 'Log a bet';
    $('cancel-edit').hidden = true;
    renderPreview();
    render();
  });

  $('cancel-edit').addEventListener('click', () => {
    editingId = null;
    form.reset();
    form.date.value = new Date().toISOString().slice(0, 10);
    $('form-title').textContent = 'Log a bet';
    $('cancel-edit').hidden = true;
    renderPreview();
  });

  function editBet(id) {
    const b = state.bets.find((x) => x.id === id);
    if (!b) return;
    editingId = id;
    form.date.value = b.date;
    form.state.value = b.state;
    form.betType.value = b.promoType || 'qualifying';
    form.book.value = b.book;
    form.game.value = b.game;
    form.side.value = b.side;
    form.promoOdds.value = b.promoOdds || '';
    form.stake.value = b.stake;
    form.bonusValue.value = b.bonusValue || '';
    form.boostPct.value = b.boostPct || '';
    form.hedgeBook.value = b.hedgeBook || '';
    form.hedgeSide.value = b.hedgeSide || '';
    form.hedgeOdds.value = b.hedgeOdds || '';
    form.hedgeStake.value = b.hedgeStake || '';
    form.status.value = b.status;
    form.cashRealized.value = b.cashRealized || '';
    form.grossWinnings.value = b.grossWinnings || '';
    form.notes.value = b.notes || '';
    $('form-title').textContent = 'Edit bet';
    $('cancel-edit').hidden = false;
    renderPreview();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function deleteBet(id) {
    if (!confirm('Delete this bet?')) return;
    state.bets = state.bets.filter((x) => x.id !== id);
    saveState(state);
    render();
  }

  // ---- inline status change ----
  function setStatus(id, status) {
    state.bets = state.bets.map((b) => (b.id === id ? Object.assign({}, b, { status }) : b));
    saveState(state);
    render();
  }

  // ---- render table + summary ----
  function render() {
    tbody.innerHTML = '';
    if (!state.bets.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="dim" style="text-align:center;padding:1.5rem">No bets yet.</td></tr>';
    }
    state.bets
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .forEach((b) => {
        const tr = document.createElement('tr');
        const floor = isFinite(Number(b.guaranteedFloor)) ? Number(b.guaranteedFloor) : NaN;
        tr.innerHTML = `
          <td>${b.date}</td>
          <td>${esc(b.book)}<div class="dim" style="font-size:.75rem">${esc(b.game)}</div></td>
          <td>${esc(b.side)}<div class="dim" style="font-size:.75rem">vs ${esc(b.hedgeBook)} · ${esc(b.hedgeSide)}</div></td>
          <td class="num">${money(b.stake)}</td>
          <td class="num">${money(b.hedgeStake)}</td>
          <td class="num ${floor >= 0 ? 'pos' : 'neg'}">${isFinite(floor) ? money(floor) : '—'}</td>
          <td class="num">${money(b.cashRealized)}</td>
          <td class="num">${money(b.grossWinnings)}</td>
          <td></td>
          <td style="white-space:nowrap"></td>`;
        // status dropdown
        const stSel = document.createElement('select');
        stSel.className = 'pill ' + b.status;
        Object.keys(STATUS_LABELS).forEach((k) => {
          const op = document.createElement('option');
          op.value = k; op.textContent = STATUS_LABELS[k];
          if (k === b.status) op.selected = true;
          stSel.appendChild(op);
        });
        stSel.addEventListener('change', () => setStatus(b.id, stSel.value));
        tr.children[8].appendChild(stSel);
        // actions
        const ed = document.createElement('button');
        ed.className = 'btn ghost sm'; ed.textContent = 'edit';
        ed.addEventListener('click', () => editBet(b.id));
        const del = document.createElement('button');
        del.className = 'btn ghost sm'; del.textContent = '✕'; del.style.marginLeft = '.25rem';
        del.addEventListener('click', () => deleteBet(b.id));
        tr.children[9].append(ed, del);
        tbody.appendChild(tr);
      });

    renderSummary();
  }

  function renderSummary() {
    const b = state.bets;
    const floatInPlay = sum(b.filter((x) => x.status === 'pending'), (x) => Number(x.stake) + Number(x.hedgeStake || 0));
    const totalFloor = sum(b, (x) => Number(x.guaranteedFloor) || 0);
    const cash = sum(b, (x) => Number(x.cashRealized) || 0);
    const gross = sum(b, (x) => Number(x.grossWinnings) || 0);
    const taxRate = Number(state.settings.blendedTaxRate) || 0;
    const estTax = gross * taxRate;
    const net = cash - estTax;

    const stat = (k, v, cls) => `<div class="stat"><div class="k">${k}</div><div class="v ${cls || ''}">${v}</div></div>`;
    summary.innerHTML =
      stat('Float in play', money(floatInPlay)) +
      stat('Guaranteed floor', money(totalFloor), totalFloor >= 0 ? 'pos' : 'neg') +
      stat('Cash realized', money(cash), 'pos') +
      stat('Gross winnings (tax)', money(gross), 'neg') +
      stat(`Est. tax @ ${Math.round(taxRate * 100)}%`, money(estTax), 'neg') +
      stat('Net after tax', money(net), net >= 0 ? 'pos' : 'neg');
  }

  // ---- settings ----
  const convInput = $('set-conversion');
  const taxInput = $('set-tax');
  if (convInput) {
    convInput.value = state.settings.conversionRate;
    convInput.addEventListener('change', () => {
      state.settings.conversionRate = clamp(Number(convInput.value) || 0.7, 0.4, 1);
      convInput.value = state.settings.conversionRate;
      saveState(state); renderPreview(); render();
    });
  }
  if (taxInput) {
    taxInput.value = state.settings.blendedTaxRate;
    taxInput.addEventListener('change', () => {
      state.settings.blendedTaxRate = clamp(Number(taxInput.value) || 0.3, 0, 0.6);
      taxInput.value = state.settings.blendedTaxRate;
      saveState(state); render();
    });
  }

  // ---- CSV export ----
  $('export-csv').addEventListener('click', () => {
    const cols = ['date', 'state', 'book', 'promoType', 'game', 'side', 'promoOdds', 'stake',
      'hedgeBook', 'hedgeSide', 'hedgeOdds', 'hedgeStake', 'status', 'bonusValue',
      'guaranteedFloor', 'cashRealized', 'grossWinnings', 'notes'];
    const lines = [cols.join(',')];
    state.bets.forEach((b) => {
      lines.push(cols.map((c) => csvCell(b[c])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cuterobot-bonus-bets-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---- wipe ----
  $('wipe-data').addEventListener('click', () => {
    if (!confirm('Erase ALL logged bets and settings from this browser? Export first if you want a copy.')) return;
    localStorage.removeItem(STORE_KEY);
    state = loadState();
    render();
  });

  // ---- banner dismiss (tax banner stays until CPA answer; only "verify offers" is dismissable per session) ----
  document.querySelectorAll('.banner.dismissable button').forEach((btn) => {
    btn.addEventListener('click', () => { btn.closest('.banner').hidden = true; });
  });

  form.date.value = new Date().toISOString().slice(0, 10);
  renderPreview();
  render();
}

/* ---- small utils ---- */
function round2(n) { return isFinite(n) ? Math.round(n * 100) / 100 : n; }
function sum(arr, f) { return arr.reduce((s, x) => s + (Number(f(x)) || 0), 0); }
function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initTracker);
}
if (typeof module !== 'undefined') {
  module.exports = { toDecimal, impliedProb, parseOdds, computeBet, money };
}
