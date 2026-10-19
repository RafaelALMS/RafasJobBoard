import type { Adapter } from './types'

/**
 * LinkedIn / Indeed / Glassdoor scraper adapters.
 *
 * These are intentionally DISABLED. The big boards detect automated access
 * (login walls, CAPTCHAs, IP bans) and scraping them violates their Terms of
 * Service — a scraper here would break constantly and could get your IP banned.
 *
 * Their listings still reach this app through aggregator sources (Adzuna,
 * Jooble, Google Jobs via SerpAPI…), which license the data.
 *
 * If you accept those risks and have an approved data agreement, implement
 * `search()` with Playwright: open the board's public search URL, wait for the
 * results list, extract title/company/location/url per card, and return
 * RawJob[] — the rest of the pipeline needs no changes. Keep `available()`
 * false until then.
 */
function makeScraperStub(id: string, name: string): Adapter {
  return {
    id,
    name,
    kind: 'scraper',
    available: () => false,
    reason: () =>
      'Scraper not enabled (login walls / CAPTCHAs / ToS). Listings available via aggregator sources.',
    async search() {
      throw new Error(`${name} scraper is not implemented`)
    },
  }
}

export const linkedin = makeScraperStub('linkedin', 'LinkedIn')
export const indeed = makeScraperStub('indeed', 'Indeed')
export const glassdoor = makeScraperStub('glassdoor', 'Glassdoor')
