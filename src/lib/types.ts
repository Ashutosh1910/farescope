// Shapes returned by the FareScope API (server/search.js). Kept in one place for the UI.
export type Cabin = 'economy' | 'premium' | 'business' | 'first';
export type Source = 'demo' | 'serpapi' | 'travelpayouts';

export interface Pax { adults: number; children: number; infantsSeat: number; infantsLap: number }

export interface Query extends Pax {
  from: string;
  to: string;
  depart: string;
  return: string | null;
  cabin: Cabin;
  currency: string;
}

export interface Airport { code: string; name: string; city: string; country: string }

export interface Stop { code: string; name: string; time: string }
export interface Segment {
  from: Stop; to: Stop; airline: string; airlineLogo: string | null; flightNumber: string;
  aircraft: string; durationMin: number | null; cabin: string; legroom: string;
  overnight: boolean; oftenDelayed: boolean; extensions: string[];
}
export interface Layover { code: string; name: string; durationMin: number; overnight: boolean }
export interface Leg {
  segments: Segment[]; layovers: Layover[]; stops: number; durationMin: number;
  departTime: string; arriveTime: string;
}
export interface Estimate {
  fare: number; fee: number; total: number; applied: boolean;
  status: 'verified' | 'unverified' | 'not-configured' | 'currency-mismatch' | 'no-price'; note?: string;
}
export interface Flight {
  id: string; price: number; currency: string; isBest: boolean; airlines: string[]; primaryAirline: string;
  logo: string | null; separateTickets: boolean; leg: Leg;
  carbon: { grams: number | null; typical: number | null; diffPercent: number | null } | null;
  departureToken: string | null; bookingToken: string | null; estimate: Estimate; bookUrl: string | null;
}
export interface Insights {
  lowest: number | null; level: string | null; typicalRange: [number, number] | null;
  history: { ts: number; price: number }[];
}
interface Fetched { cached: boolean; fetchedAt: number }
export interface SearchResult extends Fetched {
  flights: Flight[]; unpriced: number; insights: Insights | null; googleFlightsUrl: string | null;
  source: Source; query: Query; airports: { from: Airport; to: Airport };
}
export interface Status {
  liveProvider: 'demo' | 'serpapi'; calendarProvider: 'demo' | 'travelpayouts';
  quota: { usedThisMonth: number; usedThisHour: number; monthlyLimit: number; hourlyLimit: number } | null;
  cacheMinutes: { live: number; calendar: number }; feesCurrency: string; hosted?: boolean;
}
export interface CalendarDay { price: number; airline: string | null; transfers: number | null; returnAt: string | null; link: string | null }
export interface CalendarResult extends Fetched { days: Record<string, CalendarDay>; source: Source }
export interface ExploreDest {
  destination: string; price: number; airline: string | null; departAt: string | null; returnAt: string | null;
  transfers: number | null; link: string | null; airport: Airport;
}
export interface ExploreResult extends Fetched { destinations: ExploreDest[]; source: Source }
export interface HistoryPoint { price: number; airline: string | null; source: string; checkedAt: number }
export interface SellerOption {
  seller: string; isAirline: boolean; separateTickets: boolean; price: number | null; title: string | null;
  extensions: string[]; baggage: string[]; phone: string | null;
  requests: { url: string; postData: string }[]; estimate: Estimate;
}
export interface BookingResult extends Fetched { options: SellerOption[]; baggage: string[]; source: Source }

export interface Filters {
  stops: Set<number>;
  excludedAirlines: Set<string>;
  departWindows: Set<string>;
  arriveWindows: Set<string>;
  maxPrice: number | null;
  maxDuration: number | null;
  maxLayover: number | null;
  noOvernightLayovers: boolean;
  noSeparateTickets: boolean;
}
export type SortKey = 'best' | 'cheapest' | 'fastest' | 'earliest' | 'latest';
