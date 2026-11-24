// Trimmed shape of a SerpApi google_flights response (fields we consume).
export const serpFixture = {
  search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?hl=en&tfs=abc' },
  best_flights: [
    {
      flights: [
        {
          departure_airport: { name: 'Chhatrapati Shivaji Maharaj International Airport', id: 'BOM', time: '2026-12-12 06:00' },
          arrival_airport: { name: 'Indira Gandhi International Airport', id: 'DEL', time: '2026-12-12 08:10' },
          duration: 130, airplane: 'Airbus A321neo', airline: 'IndiGo',
          airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/6E.png',
          travel_class: 'Economy', flight_number: '6E 2001', legroom: '29 in', extensions: ['Average legroom (29 in)'],
        },
      ],
      total_duration: 130,
      carbon_emissions: { this_flight: 98000, typical_for_this_route: 104000, difference_percent: -6 },
      price: 5480, type: 'Round trip', airline_logo: 'https://www.gstatic.com/flights/airline_logos/70px/6E.png',
      departure_token: 'TOKEN_A',
    },
  ],
  other_flights: [
    {
      flights: [
        { departure_airport: { id: 'BOM', name: 'BOM', time: '2026-12-12 21:00' }, arrival_airport: { id: 'HYD', name: 'HYD', time: '2026-12-12 22:30' }, duration: 90, airline: 'Air India', flight_number: 'AI 1', often_delayed_by_over_30_min: true },
        { departure_airport: { id: 'HYD', name: 'HYD', time: '2026-12-13 01:00' }, arrival_airport: { id: 'DEL', name: 'DEL', time: '2026-12-13 03:15' }, duration: 135, airline: 'Air India', flight_number: 'AI 2', overnight: true },
      ],
      layovers: [{ duration: 150, name: 'Rajiv Gandhi International Airport', id: 'HYD', overnight: true }],
      total_duration: 375, price: 4300, type: 'Round trip', departure_token: 'TOKEN_B',
    },
    { flights: [{ departure_airport: { id: 'BOM', time: '2026-12-12 10:00' }, arrival_airport: { id: 'DEL', time: '2026-12-12 12:00' }, duration: 120, airline: 'SpiceJet', flight_number: 'SG 8' }], total_duration: 120 },
  ],
  price_insights: { lowest_price: 4300, price_level: 'low', typical_price_range: [5000, 7500], price_history: [[1764000000, 6000], [1764086400, 5500]] },
};
