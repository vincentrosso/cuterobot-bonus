# CLAUDE.md

Guidance for Claude Code working in this repo.

## What this is

**cuterobot-bonus** — a personal, single-user, client-side web app + guide for *matched
betting* (sportsbook welcome-bonus extraction): claim each book's welcome bonus once in a
legal state, hedge every bet across two books to lock in profit regardless of outcome.

Owner: Vincent Rosso (Yorba Linda, CA — no legal online betting in CA, hence the "drive to
Colorado" framing). Target repo: `github.com/vincentrosso/cuterobot-bonus`. Host:
`cuterobot.tv` as a static site. Separate from the `cuterobot` monorepo.

Read `CONTEXT.md` for the full backstory and every decision already made. Read `BUILD_SPEC.md`
for the original spec. This file is the short version.

## Hard scope boundaries — do NOT cross

- **No automated bet placement.** No scripting against sportsbook sites/APIs, no account
  automation, no scraping behind logins. This is a calculator + logger + guide. A human places
  every bet by hand at each book.
- **No credential handling.** The app never stores or requests sportsbook logins, bank creds,
  SSN, or card numbers. KYC happens at each book directly.
- **Client-side only.** All data in `localStorage` (key `cuterobot_bets_v1`). No backend, no
  database, no analytics. Single user.
- **No paid odds API.** Offer/odds data is user-entered or from `data/books.json` (hand-edited,
  re-verified before each trip). If a feed is ever added, use The Odds API free tier, read-only,
  for *display comparison only* — never automated action.

## File map

```
index.html      landing + honest economics / reality check (first-person, no hype)
guide.html      the loop, hedge math, per-book SOP, two-trip structure, inline calculator
checklist.html  dead-simple ordered checkbox run-sheet — per book: signup URL, who to bet, how much. localStorage key cuterobot_checklist_v1. self-contained (inline <style>+<script>), print-friendly
tracker.html    the tool: log bets, auto hedge stakes, P&L, gross-winnings (tax) column, CSV export
css/style.css   one file. dark, high-contrast, monospace numerics, mobile-first
js/tracker.js   hedge math (toDecimal / parseOdds / computeBet) + tracker UI + localStorage
js/data.js      fetches data/books.json, renders [data-books-table] elements
data/books.json seed offer data — VERIFY every field at covers.com before betting; offers rotate
```

`js/tracker.js` exposes `computeBet`, `toDecimal`, `parseOdds`, `money` as globals (and via
`module.exports` for Node). `guide.html`'s inline calculator reuses them. The tracker UI only
initializes when `#tracker-app` is present, so loading `tracker.js` on other pages is safe.

## Hedge math (js/tracker.js `computeBet`)

`computeBet({ betType, promoOdds, hedgeOdds, stake, bonusValue, conversionRate, boostPct,
hedgeStakeOverride })` → `{ hedgeStake, profitIfPromoWins, profitIfPromoLoses, guaranteedFloor,
qualifyingLoss, bonusExpectedValue, note }`.

- `betType`: `qualifying` / `secondChance` (bonus back if promo side loses — put the underdog
  on the promo book), `bonusConversion` (bonus bet, stake not returned), `profitBoost`.
- Odds accept American (`"+170"`, `"-190"`) or decimal; `parseOdds` disambiguates.
- Qualifying hedge is **bonus-adjusted**: `H = (S·dPromo − bonusValue·rate) / dHedge`, so both
  branches net the same and that equal figure is the guaranteed floor. `qualifyingLoss` is the
  out-of-pocket in the no-bonus branch.
- Conversion hedge: `H = S·(dPromo−1) / dHedge`. Boost hedge folds `(1+boostPct)` into the
  promo win return.
- Profits are net of BOTH stakes. `guaranteedFloor` = the worse branch.

Sanity check any change:
```bash
node -e 'const {computeBet,money}=require("./js/tracker.js");
const q=computeBet({betType:"qualifying",promoOdds:"+170",hedgeOdds:"-190",stake:1500,bonusValue:1500,conversionRate:0.70});
console.log(money(q.hedgeStake), money(q.guaranteedFloor));'   # ~$1,965.52  ~$584.48
```
(nvm noise on the first lines of output is the shell wrapper — ignore it.)

## Dev

Pure HTML/CSS/vanilla JS, no build step.

```bash
python3 -m http.server 8080   # then http://localhost:8080
```

`file://` blocks `fetch`, so `js/data.js` needs the HTTP server to load `books.json`.

## Deploy

Static → GitHub Pages or the cuterobot.tv host. **Vincent runs git push himself** (auth stays
with him) — never paste tokens into an agent. See `README.md` for the exact commands.

## Blocking items before first real use (surfaced as banners in the app)

1. **Tax (blocking).** IRS taxes gross winnings as income; the losing hedge leg deducts only on
   Schedule A if itemizing. Standard deduction → tax on gross with no offset, can eat 30–40%+.
   Vincent has a CPA — get the answer. The tracker's blocking banner stays until it's resolved;
   don't remove it without that.
2. Re-verify every offer in `data/books.json` (they rotate monthly).
3. Public vs private hosting decision (see `BUILD_SPEC.md` open items). Pages currently carry
   `<meta name="robots" content="noindex">` and first-person-private copy.

## Tone for site copy

Plain, honest, first-person. Lead with the reality check, not the upside. It's Vincent's
personal tool and notes, not a marketing funnel.
