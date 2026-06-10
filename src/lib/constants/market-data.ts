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
