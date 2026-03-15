/**
 * Labels for system-level forced checklist items.
 * These items use forcedItemId (not templateId) and their labels
 * are not stored in the DB, so we maintain them here for search indexing.
 */
export const FORCED_CHECKLIST_LABELS: Record<string, string> = {
	"forced-pre-market": "Pre Market Check",
	"forced-sl-check": "Added SL to all trades",
};
