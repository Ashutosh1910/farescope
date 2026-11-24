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

Without keys, the app runs on **demo data**. These are fake fares, the same every time, so you can try every feature. The UI shows a yellow banner and a "Demo data" label while they're in use. Add keys to get real prices:

| Key | What it powers | Cost |
|---|---|---|
| `SERPAPI_KEY` | Live search results and return flights (Google Flights) | Free: 250 searches/month |
| `TRAVELPAYOUTS_TOKEN` | Cheapest-days calendar and Anywhere explorer (cached prices, 2–7 days old) | Free |

The two keys work independently. For example, you can use live SerpApi search alongside the demo calendar.

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
public/               UI written in plain JavaScript (no build step)
  js/filters.js       filter/sort logic with no page code (unit-tested)
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
