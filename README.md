# FareScope

A personal flight price search tool. It shows live fares from Google Flights (through SerpApi), a calendar of cheap days and an "Anywhere" explorer (from Travelpayouts' cached fares), and an estimated total that adds the airline fees that only appear at checkout.

It doesn't sell tickets. To book, use the links to Google Flights and the airline's own site.

## Run it

Needs Node 22.13 or newer. The only dependency is Express. Data is stored with Node's built-in `node:sqlite`.

```bash
npm install
cp .env.example .env   # add your keys (optional)
npm start              # http://localhost:3000
```

If you're behind an HTTP proxy, start it with `NODE_USE_ENV_PROXY=1 npm start` (Node 22.21 or newer). Node's built-in `fetch` ignores `HTTPS_PROXY` otherwise.

Without keys, the app runs on **demo data**. These are fake fares, the same every time, so you can try every feature. The UI shows a yellow banner and a "Demo data" label while they're in use. Add keys to get real prices:

| Key | What it powers | Cost |
|---|---|---|
| `SERPAPI_KEY` | Live search results and return flights (Google Flights) | Free: 250 searches/month |
| `TRAVELPAYOUTS_TOKEN` | Cheapest-days calendar and Anywhere explorer (cached prices, 2–7 days old) | Free |

The two keys work independently. For example, you can use live SerpApi search alongside the demo calendar.

## Hosted demo (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests on every push and pull request. On every push to `main` it also deploys a **static demo build** to GitHub Pages.

GitHub Pages can only host static files, so it can't run the Express server. The build (`npm run build:static` → `dist/`) bundles the search code into the page so it runs in the browser. The hosted copy **always uses demo data**: a public page must never contain your SerpApi or Travelpayouts key, because anyone could read it from the page source. Price history is kept in each visitor's own browser.

One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. Then push to `main` (or run the workflow by hand from the Actions tab). The site will be at `https://<user>.github.io/<repo>/`.

To try the static build locally:

```bash
npm run build:static && npm run preview
```

For real fares, run the server yourself (above). A server host such as Render, Fly.io or Railway also works; set `SERPAPI_KEY` there as a secret environment variable.

## Full app with live prices (Render)

`render.yaml` describes the server for Render's free plan. The same workflow (`.github/workflows/deploy.yml`) deploys it after the tests pass. Render has no official GitHub Action, so the workflow uses Render's documented **deploy hook**: a secret URL that starts a deploy when called.

One-time setup:

1. On [render.com](https://render.com), choose **New → Blueprint**, connect GitHub and pick this repo. Render reads `render.yaml`.
2. When it asks for the secret values, enter:
   - `SERPAPI_KEY`: your SerpApi key.
   - `APP_PASSWORD`: **set one.** Without it, anyone who finds the URL can run searches and use up your quota. The browser asks for it once; leave the username empty or type anything.
   - `TRAVELPAYOUTS_TOKEN`: optional; leave it blank for demo calendar data.
3. In the service's **Settings → Deploy Hook**, copy the URL. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add it as `RENDER_DEPLOY_HOOK_URL`.
4. After that, every push to `main` that passes the tests redeploys Render as well as GitHub Pages. Until the secret exists, the Render job is skipped.

Free-plan limits:
- The service sleeps when idle, so the first visit after a while takes about a minute.
- The disk is wiped on every deploy or restart, which clears the search cache, your price history and the app's own monthly search counter. SerpApi's own limit of 250 searches a month still applies, so you can't be charged for going over.
- For lasting history, use a paid instance with a persistent disk and set `DB_PATH` to a file on that disk.

`render.yaml` turns off Render's own auto-deploy (`autoDeployTrigger: "off"`) so that deploys happen only after CI passes. If Render rejects that line, set **Auto-Deploy** to **Off** in the service settings instead.

## Features

- **Search:** return or one way, airport autocomplete, swap button, up to 9 travellers (adults, children, infants in a seat or on a lap), 4 cabin classes, 6 currencies.
- **Return trips:** pick an outbound flight, then a return flight. This matches how Google Flights' `departure_token` works.
- **Filters:** stops (with the cheapest price for each), departure and arrival time of day, max price, max journey time, max layover, no overnight layovers, no separate tickets, airlines (with the cheapest price for each).
- **Sorting:** best, cheapest, fastest, earliest or latest departure. The Best / Cheapest / Fastest tabs show the top price and duration for each.
- **Flight details:** each leg, layover, aircraft, legroom, onboard features, "often delayed" warning, CO₂ compared with typical for the route.
- **Cheapest-days calendar:** colour-coded strip for the month. Tap a day to run a live search for it; on a return trip the trip length stays the same.
- **Price insights:** whether prices are low, typical or high, the usual price range, and a trend chart. Every search you run is saved to SQLite, so you build up your own price history for that route.
- **Anywhere:** leave "To" empty to see the cheapest destinations for the month.
- **Estimated totals:** turn on "Show totals with fees" to sort and filter by fare plus convenience fee.
- **Shareable URLs:** searches are saved in the address bar, so you can bookmark them or refresh the page.
- Works on phone screens and in dark mode.

## Protecting your SerpApi quota

- Each search returns every flight at once, and filtering happens in your browser, so changing filters never costs a search.
- Results are cached in SQLite for `LIVE_CACHE_MINUTES` (default 180). Running the same search again is free. **Refresh** forces a new search.
- There's a budget per month and per hour (`SERPAPI_MONTHLY_LIMIT`, `SERPAPI_HOURLY_LIMIT`). When either is reached the app refuses new live searches, but cached results still work. The header shows how many searches you've used.

## Convenience fees (`data/fees.json`)

Search APIs return the fare with taxes included, but not the fee added on the payment page. Look up each airline's fee on its own fees page and enter it:

```json
"IndiGo": { "convenienceFee": 249, "per": "passenger", "verified": "2026-11-24", ... }
```

`per` is one of `passenger`, `passenger_sector` (per passenger, per direction) or `booking`. Lap infants aren't counted unless `countLapInfants` is true. Airlines with `null` show "fee not configured"; the app never guesses an amount. Only IndiGo's ₹249 is filled in, and even that is marked unverified. **Check these every few months.** Fees only apply when you search in the same currency as the fees file (INR).

## Layout

```
server/
  index.js            Express app + API routes
  search.js           validation, provider choice, caching, quota, fee estimates, history
  db.js               SQLite: cache, api_calls (quota), price_history
  fees.js             estimated-total calculation
  airports.js         bundled airport list, autocomplete, distances
  providers/
    serpapi.js        Google Flights via SerpApi -> normalized flights
    travelpayouts.js  Aviasales Data API (prices_for_dates) -> calendar / explore
    demo.js           fake data, same every time, for running without keys
public/               UI written in plain JavaScript (no build step for the server version)
  js/api.js           calls the server, or the in-browser search code on the static build
  js/filters.js       filter/sort logic with no page code (unit-tested)
static/backend.js     in-browser search code for the Pages build (demo provider only)
scripts/build-static.mjs  builds dist/ with esbuild
data/airports.json    98 airports (all major Indian ones plus international hubs)
data/fees.json        your fee table
test/                 node:test suites (npm test)
```

API: `GET /api/search`, `/api/return?token=`, `/api/calendar?month=YYYY-MM`, `/api/explore`, `/api/history`, `/api/airports?q=`, `/api/status`, `/api/fees`.

## Limits

- Demo mode only knows the 98 bundled airports. With a SerpApi key, any IATA code works if you type it, e.g. `IXU`. Autocomplete still only suggests bundled airports.
- In SerpApi's results, a "Separate tickets" itinerary should be checked one ticket at a time on Google Flights.
- Travelpayouts prices are per adult and come from other users' recent searches, so routes few people search may have gaps.
- Not built yet: multi-city trips, price-drop alerts (planned: a daily job that re-checks saved routes), deep booking links using `booking_token`.
