# FareScope

A personal flight price search tool. It shows live fares from Google Flights (through SerpApi), a calendar of cheap days and an "Anywhere" explorer (from Travelpayouts' cached fares), and an estimated total that adds the airline fees that only appear at checkout.

It doesn't sell tickets. To book, use the links to Google Flights and the airline's own site.

## Run it

Needs Node 22.13 or newer. The server is Express with Node's built-in `node:sqlite`. The web app is React + TypeScript, built with Vite and styled with Tailwind and [shadcn/ui](https://ui.shadcn.com) components (see Design below).

```bash
npm install
cp .env.example .env   # add your keys (optional)
npm run build          # build the web app into dist/
npm start              # http://localhost:3000
```

While working on the UI, `npm run dev` runs the API server and Vite's dev server together (http://localhost:5173, with instant reloads). `npm run typecheck` checks the TypeScript.

If you're behind an HTTP proxy, start it with `NODE_USE_ENV_PROXY=1 npm start` (Node 22.21 or newer). Node's built-in `fetch` ignores `HTTPS_PROXY` otherwise.

Without keys, the app runs on **demo data**. These are fake fares, the same every time, so you can try every feature. The UI shows a yellow banner and a "Demo data" label while they're in use. Add keys to get real prices:

| Key | What it powers | Cost |
|---|---|---|
| `SERPAPI_KEY` | Live search results and return flights (Google Flights) | Free: 250 searches/month |
| `TRAVELPAYOUTS_TOKEN` | Cheapest-days calendar and Anywhere explorer (cached prices, 2–7 days old) | Free |

The two keys work independently. For example, you can use live SerpApi search alongside the demo calendar.

## Hosted demo (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests on every push and pull request. On every push to `main` it also deploys a **static demo build** to GitHub Pages.

GitHub Pages can only host static files, so it can't run the Express server. The static build (`npm run build:static` → `dist/`) bundles the search code into the web app so it runs in the browser. The hosted copy **always uses demo data**: a public page must never contain your SerpApi or Travelpayouts key, because anyone could read it from the page source. Price history is kept in each visitor's own browser.

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

## Design

FareScope borrows the language of airport wayfinding signs, the thing every traveller reads under pressure:

- **The search is a sign:** a slate panel where the airport codes appear large in signal yellow and flip like a departure board when you change them. It's the only bold element, and the only automatic motion (turned off when your system asks for reduced motion).
- **Results are a departure board:** one panel of rows rather than separate cards, so twenty flights scan quickly. A yellow edge marks the top picks.
- **Colour has jobs:** concrete `#E9ECEA` page, paper `#F9FAF9` surfaces, slate `#1D2D35` signs and buttons, signal yellow `#FFC629` only for codes, chosen dates and the Search button, runway green `#1E7F55` only for "cheaper" and "direct".
- **Type:** [B612](https://b612-font.com), the typeface Airbus made for cockpit displays, for codes, times and prices; Atkinson Hyperlegible Next for everything else. Labels are sentence case with a pictogram.

Tokens live in `src/index.css` (light and dark).

## Features

- **Fast search flow:** the airport picker is a command palette with recent and popular airports. Picking From moves straight to To, then to the dates. Press `/` anywhere to start a search. The browser's Back button returns to your previous search.
- **Looks after itself:** light, dark or system theme; on phones the search form folds into a one-line summary after searching, and filters open in a sheet with a "Show N flights" button.
- **Date picker:** a fare calendar showing two months side by side, or a full-screen list of months on a phone. Each day shows its lowest cached one-way fare, with the cheapest days in green and a ★ on the cheapest day of the month. Departure and return are picked as one range, with a hover preview and a nights count. While you pick the return, it shows fares for the return direction. Works fully by keyboard: arrows, Page Up/Down, Home/End, Esc.
- **Search:** return or one way, airport autocomplete, swap button, up to 9 travellers (adults, children, infants in a seat or on a lap), 4 cabin classes, 6 currencies.
- **Return trips:** pick an outbound flight, then a return flight. This matches how Google Flights' `departure_token` works.
- **Filters:** stops (with the cheapest price for each), departure and arrival time of day, max price, max journey time, max layover, no overnight layovers, no separate tickets, airlines (with the cheapest price for each).
- **Sorting:** best, cheapest, fastest, earliest or latest departure. The Best / Cheapest / Fastest tabs show the top price and duration for each.
- **Compare sellers:** after you pick a flight, the trip panel can list every seller Google Flights shows for that exact trip: the airline's own site and travel sites such as Goibibo, Cleartrip, EaseMyTrip, Paytm Travel and Trip.com. Each has its price and a **Book** button that opens that seller's offer. With a SerpApi key this costs 1 search, so it waits for a click; the result is cached. Only Google's partner sellers appear, so some sites (e.g. MakeMyTrip or HappyFares) may be missing for a given flight. A travel site's own convenience fee can go in the `sellers` section of `data/fees.json`.
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
src/                  the React web app (built into dist/ by Vite)
  App.tsx             page shell: header, hero + search card, results / explore / landing
  state/app.tsx       app state and actions: search, return leg, filters, calendar, explore, URL + Back button
  components/app/     FareScope's components (search card, airport picker, fare calendar, flight card,
                      filters, results, trip sheet with Compare sellers, explore, sparkline, …)
  components/ui/      shadcn/ui components (added with `npx shadcn add …`)
  lib/api.ts          calls the server, or the in-browser search code on the Pages build
  lib/filters.js      filter/sort logic with no page code (unit-tested); format.js, dates.js likewise
  index.css           Tailwind + the FareScope theme (light and dark)
static/backend.js     in-browser search code for the Pages build (demo provider only)
data/airports.json    98 bundled airports with coordinates (used by demo data, and preferred in search)
server/world-airports.js  downloads and caches the world airport list
data/fees.json        your fee table
test/                 node:test suites (npm test)
```

API: `GET /api/search`, `/api/return?token=`, `/api/calendar?month=YYYY-MM`, `/api/explore`, `/api/history`, `/api/airports?q=`, `/api/status`, `/api/fees`.

## Limits

- Autocomplete and place names come from Travelpayouts' free public airport list (about 3,700 airports). The server downloads it at startup and keeps it in `data/airports-world.json` (ignored by Git) for 30 days. If the download fails, it falls back to the 98 bundled airports. Demo mode only has fares for those 98. Multi-airport city codes such as `LON` are used only to name Anywhere results, never for search.
- In SerpApi's results, a "Separate tickets" itinerary should be checked one ticket at a time on Google Flights.
- Travelpayouts prices are per adult and come from other users' recent searches, so routes few people search may have gaps. The calendar always shows one-way fares, even for return trips: cached round-trip fares come with random trip lengths, so they mislead when you're picking a departure day.
- Not built yet: multi-city trips, price-drop alerts (planned: a daily job that re-checks saved routes), deep booking links using `booking_token`.
