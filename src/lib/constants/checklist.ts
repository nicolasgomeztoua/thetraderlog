/**
 * Canonical forced checklist item IDs.
 * Any new forced item must be added here first.
 */
export const FORCED_ITEM_PRE_MARKET = "forced-pre-market";
export const FORCED_ITEM_SL_CHECK = "forced-sl-check";

/**
 * Labels for system-level forced checklist items.
 * These items use forcedItemId (not templateId) and their labels
 * are not stored in the DB, so we maintain them here for search indexing.
 */
export const FORCED_CHECKLIST_LABELS: Record<string, string> = {
	[FORCED_ITEM_PRE_MARKET]: "Pre Market Check",
	[FORCED_ITEM_SL_CHECK]: "Added SL to all trades",
};

/** Forced items that can be manually toggled (not auto-calculated). */
export const TOGGLEABLE_FORCED_ITEMS = [FORCED_ITEM_PRE_MARKET];
