"use client";

import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "@/trpc/react";

interface Account {
	id: string;
	name: string;
	broker: string | null;
	platform: string | null;
	accountType: "prop_challenge" | "prop_funded" | "live" | "demo";
	initialBalance: string | null;
	currency: string | null;
	isActive: boolean | null;
	isDefault: boolean | null;
	color: string | null;
	// Prop firm fields
	maxDrawdown: string | null;
	drawdownType: "trailing" | "static" | "eod" | null;
	dailyLossLimit: string | null;
	profitTarget: string | null;
	consistencyRule: string | null;
	minTradingDays: number | null;
	challengeStartDate: Date | null;
	challengeEndDate: Date | null;
	challengeStatus: "active" | "passed" | "failed" | null;
	profitSplit: string | null;
	payoutFrequency: "weekly" | "bi_weekly" | "monthly" | null;
	linkedAccountId: string | null;
	groupId: string | null;
}

interface AccountContextType {
	accounts: Account[];
	selectedAccount: Account | null;
	selectedAccountId: string | null;
	setSelectedAccountId: (id: string | null) => void;
	isLoading: boolean;
	refetchAccounts: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: ReactNode }) {
	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
		null,
	);

	const {
		data: accounts = [],
		isLoading,
		refetch,
	} = api.accounts.getActive.useQuery();

	// Set default account on initial load
	useEffect(() => {
		if (accounts.length > 0 && selectedAccountId === null) {
			// Find the default account or use the first one
			const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
			if (defaultAccount) {
				setSelectedAccountId(defaultAccount.id);
			}
		}
	}, [accounts, selectedAccountId]);

	// Persist selected account to localStorage
	useEffect(() => {
		if (selectedAccountId !== null) {
			localStorage.setItem("selectedAccountId", selectedAccountId);
		}
	}, [selectedAccountId]);

	// Load from localStorage on mount
	useEffect(() => {
		const stored = localStorage.getItem("selectedAccountId");
		if (stored) {
			// Verify the account still exists and belongs to user
			if (accounts.some((a) => a.id === stored)) {
				setSelectedAccountId(stored);
			}
		}
	}, [accounts]);

	// Memoize the context value so consumers don't re-render on every provider
	// render — only when the underlying data actually changes. (setSelectedAccountId
	// and refetch are stable references.)
	const value = useMemo<AccountContextType>(
		() => ({
			accounts,
			selectedAccount: accounts.find((a) => a.id === selectedAccountId) ?? null,
			selectedAccountId,
			setSelectedAccountId,
			isLoading,
			refetchAccounts: refetch,
		}),
		[accounts, selectedAccountId, isLoading, refetch],
	);

	return (
		<AccountContext.Provider value={value}>{children}</AccountContext.Provider>
	);
}

export function useAccount() {
	const context = useContext(AccountContext);
	if (context === undefined) {
		throw new Error("useAccount must be used within an AccountProvider");
	}
	return context;
}
