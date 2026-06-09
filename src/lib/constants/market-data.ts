// =============================================================================
// MARKET DATA TIMING CONSTANTS
// =============================================================================
//
// Databento publishes each CME Globex (GLBX.MDP3) session's historical OHLCV
// data on a fixed daily pipeline at ~09:00 UTC the FOLLOWING day (reliably
// complete by ~09:45 UTC; worst observed ~09:44 UTC). Until that release, the
// Historical API returns nothing for that session — so a trade logged today
// only gets candles after the next-day release, not intraday.
//
// Source: Databento staff, https://roadmap.databento.com
//   "We run the metadata pipelines that 'release' the data at 09:00 UTC the
//    following day ... soonest by 09:02 UTC and latest by 09:45 UTC."

/** Hour (UTC) at which Databento releases the prior session's historical data. */
export const DATABENTO_RELEASE_HOUR_UTC = 9;

/**
 * Safety buffer (hours) added after the release hour before we consider a
 * missing session genuinely "unavailable" rather than "pending". Absorbs
 * pipeline variance and aligns the pending→unavailable flip with our backfill.
 */
export const DATABENTO_RELEASE_BUFFER_HOURS = 2;

/**
 * Cron for the daily market-data backfill: 11:00 UTC = release (09:00) + buffer.
 * Pinned to UTC, so it is DST-proof and needs no seasonal adjustment.
 */
export const MARKET_DATA_BACKFILL_CRON = "0 11 * * *";
