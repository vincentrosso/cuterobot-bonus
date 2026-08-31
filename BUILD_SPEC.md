# cuterobot.tv — Bonus Extraction Tracker & Guide (Build Spec)

**Owner:** Vincent Rosso · **Repo target:** github.com/vincentrosso/cuterobot-bonus · **Host:** cuterobot.tv (static)
**Handoff date:** July 4, 2026

This is a build spec to resume in Claude Code. It contains everything needed to scaffold and ship the site. Read `CONTEXT.md` for the full backstory and decisions already made. Build the file tree in `## File Tree` below.

---

## What this is

A static, single-user, client-side web app + guide for **matched betting** (a.k.a. sportsbook bonus extraction): claiming sportsbook welcome bonuses and hedging each bet across two books to lock in profit regardless of outcome. The site has three surfaces:

1. **Landing/backstory** — what the play is, honest economics, the "border-hopper" framing (Vincent is in CA, which has no legal online betting, so he drives to a legal state).
2. **Guide/flow** — step-by-step SOP, per-book instructions, the hedge math explained, the two-trip structure.
3. **Tracker** — the working tool: log each bet, auto-compute hedge stakes and guaranteed profit, track bonus-bet status, running P&L, and a gross-winnings column for taxes.

## Hard scope boundaries (do NOT cross)

- **No automated bet placement.** No scripting against sportsbook sites/APIs, no account automation, no scraping behind logins. This is a calculator + logger + guide ONLY. Placing bets is done by a human, by hand, in-app at each book.
- **No credential handling.** The app never stores or requests sportsbook logins, bank creds, SSN, or card numbers. KYC happens at each book directly.
- **Client-side only.** All data in `localStorage`. No backend, no database, no analytics that phone home. Single user (Vincent). This keeps it private and trivially hostable.
- **Odds/offer data is user-entered or from an editable JSON.** Do NOT wire a paid odds API in v1. If a feed is added later, use The Odds API free tier, read-only, for *display* comparison — never for automated action.

---

## File Tree

```
cuterobot-bonus/
├── index.html            # landing + backstory (from CONTEXT.md → "Backstory copy")
├── guide.html            # step-by-step flow + per-book SOP + hedge math
├── tracker.html          # the logging/calculator tool
├── css/
│   └── style.css         # shared styles, dark, clean, monospace numerics
├── js/
│   ├── tracker.js        # hedge math, P&L, localStorage persistence
│   └── data.js           # loads books.json, renders offer tables
├── data/
│   └── books.json        # book list, offers, terms — EDITABLE, verify before each trip
├── README.md             # dev setup, deploy steps
└── .gitignore
```

## Core math (implement in js/tracker.js)

**Hedge stake calculation** (back/lay against two fixed-odds books, both American odds):

```
// Convert American odds to decimal
function toDecimal(american) {
  return american > 0 ? (american / 100) + 1 : (100 / Math.abs(american)) + 1;
}

// Qualifying bet: stake S on Book A at decimal odds dA.
// Hedge on Book B at decimal odds dB to equalize outcomes.
// Hedge stake H = (S * dA) / dB
function hedgeStake(S, dA, dB) {
  return (S * toDecimal_A) / toDecimal_B;  // use converted values
}

// Guaranteed profit for a QUALIFYING (cash) bet, bonus triggers on LOSS:
//   If A wins:  S*(dA-1) - H*(dB-1... )   [A pays, B loses]
//   If A loses: -S + H*(dB-1)  + bonusValue*conversionRate
// Show BOTH branches and the min() as "guaranteed floor".

// Bonus bet conversion (stake NOT returned): use high +odds on Book A.
//   profit = min( bonusStake*(dA-1) - hedgeCost,  hedgeReturn )
//   conversionRate ≈ 0.66–0.72 typical
```

Implement helper `computeBet({promoBook, promoSide, promoOdds, hedgeBook, hedgeOdds, stake, betType, bonusValue})` returning `{hedgeStake, profitIfAWins, profitIfALoses, guaranteedFloor, bonusTriggered}`. `betType ∈ {qualifying, bonusConversion, secondChance, profitBoost}`.

## Tracker data model (localStorage key: `cuterobot_bets_v1`)

```json
{
  "bets": [
    {
      "id": "uuid",
      "date": "2026-07-05",
      "state": "CO",
      "book": "BetMGM",
      "promoType": "second_chance_1500",
      "game": "Chile vs Brazil",
      "side": "Chile +170",
      "stake": 1500,
      "hedgeBook": "DraftKings",
      "hedgeSide": "Brazil -190",
      "hedgeStake": 1795,
      "status": "pending",          // pending | settled | bonus_credited | converted
      "bonusValue": 1500,
      "cashRealized": 0,
      "grossWinnings": 0,           // for tax column — gross, not net
      "notes": ""
    }
  ],
  "settings": { "conversionRate": 0.70, "homeState": "CA" }
}
```

Tracker UI needs: add-bet form, editable table, status dropdowns per row, a summary bar (total float in play, total guaranteed floor, total cash realized, **total gross winnings** [tax], net after user-entered blended tax rate), and CSV export.

## books.json seed (VERIFY every field before each trip — offers rotate monthly)

Use the seed in `data/books.json` (already written). Fields: `name`, `offer`, `promoType`, `deposit`, `estExtract`, `states` (or "all-major"), `terms`, `verified` (date), `notes`. Mark everything `"verified": "2026-06"` and add a banner in the UI: "Offers change monthly — re-verify at covers.com before betting."

## Design direction

- Dark theme, high contrast, monospace for all numbers/money. Fast, no framework needed — vanilla JS + one CSS file. Mobile-first (the tracker gets used on a phone in a parking lot).
- Landing page tone: honest, plain, no hype. It's a personal tool, not a marketing funnel. Include the "Honest Reality Check" numbers from CONTEXT.md.
- If you want a framework, plain HTML/CSS/JS is preferred for hostability. Do not add a build step unless necessary.

## Deploy

Static site → GitHub Pages or cuterobot.tv host. See README.md for the git init + push commands. Vincent runs these himself (auth stays with him).

## Open items to resolve in-session

1. **Tax question (blocking):** confirm with CPA whether gambling losses offset wins under standard deduction vs itemizing. Surface this as a pinned banner on the tracker until resolved.
2. **Public vs private:** decide if cuterobot.tv serves this publicly (content/audience angle) or if it's a private/login-gated personal tool. Affects whether backstory copy is first-person-private or audience-facing.
3. Verify current CO offers before first real use.
