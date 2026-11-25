import type { Filters, Flight, SortKey } from './types';

export interface TimeWindow { id: string; label: string; hint: string; from: number; to: number }
export const WINDOWS: TimeWindow[];
export function hourOf(t: string): number | null;
export function windowOf(t: string): string | null;
export function priceOf(f: Flight, useEstimate?: boolean): number;
export function stopBucket(f: Flight): number;
export function emptyFilters(): Filters;
export function isFiltered(f: Filters): boolean;
export interface Facets {
  count: number;
  stops: Record<number, number>;
  airlines: { name: string; minPrice: number; count: number; logo: string | null }[];
  price: { min: number; max: number } | null;
  duration: { min: number; max: number } | null;
  maxLayover: number;
  hasSeparate: boolean;
  hasOvernight: boolean;
}
export function facets(flights: Flight[], useEstimate?: boolean): Facets;
export function applyFilters(flights: Flight[], f: Filters, useEstimate?: boolean): Flight[];
export const SORTS: Record<SortKey, string>;
export function sortFlights(flights: Flight[], by?: SortKey, useEstimate?: boolean): Flight[];
export function sortSummary(flights: Flight[], useEstimate?: boolean):
  Record<'best' | 'cheapest' | 'fastest', { price: number; durationMin: number }> | null;
