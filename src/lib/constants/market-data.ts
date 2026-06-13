// =============================================================================
// MARKET DATA TIMING CONSTANTS
// =============================================================================
//
// Databento's GLBX.MDP3 historical data lags real-time by roughly ~8 hours on a
// rolling basis (observed: the dataset's available `end` trails "now" by ~8h).
// So a session traded today becomes queryable the SAME evening — not intraday,
// and not strictly next-day. Until those bars publish, the Historical API
// returns nothing for that slice, which we surface as "pending" (data still
// coming) rather than "unavailable". Users can also force a re-pull from the
// trade page ("Re-fetch data").

/**
 * Hour (UTC) by which the prior session is conservatively considered published.
 * Used only to decide whether an empty result is "pending" vs "unavailable".
 */
export const DATABENTO_RELEASE_HOUR_UTC = 9;

/**
 * Safety buffer (hours) after the release hour before flipping a missing
 * session from "pending" to "unavailable".
 */
export const DATABENTO_RELEASE_BUFFER_HOURS = 2;

/**
 * Maximum in-flight Databento Historical API requests.
 *
 * Measured (June 2026): the API effectively serves ~2 requests per key
 * concurrently and queues the rest server-side — 4 parallel day-requests
 * completed in 2.5s / 3.8s / 20.6s / 57s. Fanning out wider than the
 * effective concurrency only inflates wall-clock time, so fetches should be
 * funneled through a pool of this size.
 */
export const DATABENTO_MAX_CONCURRENT_FETCHES = 2;

/**
 * Concurrency for per-trade MAE/MFE computation once the candle cache is
 * warm. These are cache reads + row updates (no provider calls), so this
 * only bounds database load.
 */
export const MAEMFE_COMPUTE_CONCURRENCY = 4;

/**
 * Max concurrent MAE/MFE fetches in the user-triggered bulk mutation
 * (trades.bulkCalculateMAEMFE). Each call hits Databento, so cap fan-out at 2
 * to match the provider's effective per-key concurrency.
 */
export const MAEMFE_BATCH_CONCURRENCY = 2;
