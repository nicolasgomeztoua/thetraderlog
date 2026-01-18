import { customAlphabet } from "nanoid";

const alphabet =
	"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 16);

export const createId = (prefix: string) => `${prefix}-${nanoid()}`;

// Typed helpers for each entity
export const ids = {
	user: () => createId("us"),
	account: () => createId("ac"),
	accountGroup: () => createId("ag"),
	trade: () => createId("tr"),
	execution: () => createId("ex"),
	tag: () => createId("tg"),
	screenshot: () => createId("ss"),
	settings: () => createId("st"),
	filterPreset: () => createId("fp"),
	conversation: () => createId("cv"),
	message: () => createId("mg"),
	strategy: () => createId("sy"),
	strategyRule: () => createId("sr"),
	candleCache: () => createId("cc"),
	dailyJournal: () => createId("dj"),
	checklistTemplate: () => createId("ct"),
	checklistCheck: () => createId("ck"),
	journalAttachment: () => createId("ja"),
	strategyVote: () => createId("sv"),
	strategyDownload: () => createId("sd"),
	strategyReport: () => createId("rp"),
};
