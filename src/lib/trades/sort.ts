import { TRADE_SORT_FIELDS, type TradeSort } from "@/lib/constants";

interface SortableTrade {
	id: string;
	symbol: string;
	direction: "long" | "short";
	entryTime: Date;
	exitTime: Date | null;
	quantity: string;
	netPnl: string | null;
	exitReason: string | null;
	rating: number | null;
	isReviewed: boolean | null;
	setupType: string | null;
	fees: string | null;
	account?: { name: string } | null;
	strategy?: { name: string } | null;
}

/**
 * Sorts trades by the specified field and direction.
 * Handles dates, numbers, strings, booleans, and null values.
 */
export function sortTrades<T extends SortableTrade>(
	trades: T[],
	sort: TradeSort,
): T[] {
	const { field, direction } = sort;
	const sortKey = TRADE_SORT_FIELDS[field];

	return [...trades].sort((a, b) => {
		let aVal: string | number | boolean | Date | null;
		let bVal: string | number | boolean | Date | null;

		// Handle computed/nested fields
		switch (sortKey) {
			case "_duration":
				aVal = a.exitTime
					? new Date(a.exitTime).getTime() - new Date(a.entryTime).getTime()
					: null;
				bVal = b.exitTime
					? new Date(b.exitTime).getTime() - new Date(b.entryTime).getTime()
					: null;
				break;
			case "_accountName":
				aVal = a.account?.name ?? null;
				bVal = b.account?.name ?? null;
				break;
			case "_strategyName":
				aVal = a.strategy?.name ?? null;
				bVal = b.strategy?.name ?? null;
				break;
			default:
				aVal = a[sortKey as keyof SortableTrade] as
					| string
					| number
					| boolean
					| Date
					| null;
				bVal = b[sortKey as keyof SortableTrade] as
					| string
					| number
					| boolean
					| Date
					| null;
		}

		// Handle null values (sort nulls last)
		if (aVal === null || aVal === undefined) return 1;
		if (bVal === null || bVal === undefined) return -1;

		// Handle dates
		if (sortKey === "entryTime" || sortKey === "exitTime") {
			const aTime = new Date(aVal as string | Date).getTime();
			const bTime = new Date(bVal as string | Date).getTime();
			return direction === "asc" ? aTime - bTime : bTime - aTime;
		}

		// Handle strings (including decimal strings like netPnl, quantity, fees)
		if (typeof aVal === "string" && typeof bVal === "string") {
			const aNum = Number.parseFloat(aVal);
			const bNum = Number.parseFloat(bVal);
			if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
				return direction === "asc" ? aNum - bNum : bNum - aNum;
			}
			return direction === "asc"
				? aVal.localeCompare(bVal)
				: bVal.localeCompare(aVal);
		}

		// Handle numbers
		if (typeof aVal === "number" && typeof bVal === "number") {
			return direction === "asc" ? aVal - bVal : bVal - aVal;
		}

		// Handle booleans
		if (typeof aVal === "boolean" && typeof bVal === "boolean") {
			if (aVal === bVal) return 0;
			return direction === "asc" ? (aVal ? 1 : -1) : aVal ? -1 : 1;
		}

		return 0;
	});
}
