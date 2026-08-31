# cuterobot-bonus

Personal matched-betting (sportsbook bonus extraction) tracker + guide. Static site, client-side only, no backend. Data lives in browser localStorage.

## What it is
- **index.html** — landing + honest backstory/economics
- **guide.html** — step-by-step flow, per-book SOP, hedge math explained
- **tracker.html** — log bets, auto-compute hedge stakes + guaranteed profit, track bonus status, P&L, tax-basis (gross winnings) column, CSV export

## What it is NOT
No automated betting. No credential storage. No scraping. Calculator + logger + guide only. All bet placement is done by hand at each sportsbook.

## Dev
Pure HTML/CSS/vanilla JS. No build step.
```bash
# serve locally
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy to GitHub + cuterobot.tv
Run these yourself (keeps auth with you — do not paste tokens into an agent):
```bash
cd cuterobot-bonus
git init
git add .
git commit -m "Initial: bonus extraction tracker + guide"
git branch -M main
git remote add origin https://github.com/vincentrosso/cuterobot-bonus.git
git push -u origin main
```
Then either:
- **GitHub Pages:** repo Settings → Pages → deploy from `main` branch root. Point cuterobot.tv DNS (CNAME) at the Pages URL.
- **Existing host:** rsync/upload the folder to the cuterobot.tv webroot.

Create the empty repo at github.com/new first (name it `cuterobot-bonus`), then run the push.

## Before first real use — BLOCKING
1. Get CPA answer: do gambling losses offset wins under the standard deduction, or only if itemizing? This determines whether the play nets what's projected. Banner stays pinned in tracker until resolved.
2. Re-verify every offer in `data/books.json` at covers.com — they rotate monthly.
3. Decide public vs private hosting (see BUILD_SPEC.md open items).

## Files for the build agent
- `BUILD_SPEC.md` — full spec, file tree, math, data model
- `CONTEXT.md` — backstory, corrected facts, tone, rejected paths
- `data/books.json` — seed offer data (verify before use)
