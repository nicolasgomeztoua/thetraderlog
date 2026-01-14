"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import {
	Award,
	Check,
	Clock,
	Edit,
	Eye,
	EyeOff,
	FolderOpen,
	Key,
	Link2,
	Loader2,
	Plus,
	Save,
	Shield,
	Sparkles,
	Star,
	Trash2,
	Trophy,
	Wallet,
	XCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TagManager } from "@/components/tags/tag-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccount } from "@/contexts/account-context";
import { ACCOUNT_TYPE_COLORS, cn, PRESET_COLORS } from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/trpc/react";

/**
 * Get the UTC offset in hours for a timezone.
 * Positive offset means ahead of UTC (e.g., Tokyo +9).
 * Negative offset means behind UTC (e.g., New York -5).
 */
function getTimezoneOffsetHours(timezone: string): number {
	const now = new Date();
	const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
	const tzDate = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
	return Math.round((tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60));
}

/**
 * Convert a UTC hour (0-23) to local hour in the given timezone.
 */
function utcHourToLocal(utcHour: number, timezone: string): number {
	const offset = getTimezoneOffsetHours(timezone);
	let localHour = (utcHour + offset) % 24;
	if (localHour < 0) localHour += 24;
	return localHour;
}

/**
 * Convert a local hour (0-23) to UTC hour.
 */
function localHourToUtc(localHour: number, timezone: string): number {
	const offset = getTimezoneOffsetHours(timezone);
	let utcHour = (localHour - offset) % 24;
	if (utcHour < 0) utcHour += 24;
	return utcHour;
}

/**
 * Convert trading sessions from UTC to local timezone hours.
 */
function sessionsToLocal(
	sessions: TradingSession[],
	timezone: string,
): TradingSession[] {
	return sessions.map((s) => ({
		...s,
		startHour: utcHourToLocal(s.startHour, timezone),
		endHour: utcHourToLocal(s.endHour, timezone),
	}));
}

/**
 * Convert trading sessions from local timezone to UTC hours.
 */
function sessionsToUtc(
	sessions: TradingSession[],
	timezone: string,
): TradingSession[] {
	return sessions.map((s) => ({
		...s,
		startHour: localHourToUtc(s.startHour, timezone),
		endHour: localHourToUtc(s.endHour, timezone),
	}));
}

const AI_PROVIDERS = [
	{
		id: "openai",
		name: "OpenAI",
		description: "GPT-4, GPT-3.5 Turbo",
		placeholder: "sk-...",
	},
	{
		id: "anthropic",
		name: "Anthropic",
		description: "Claude 3, Claude 2",
		placeholder: "sk-ant-...",
	},
	{
		id: "google",
		name: "Google AI",
		description: "Gemini Pro, Gemini Ultra",
		placeholder: "AI...",
	},
];

// Default trading sessions (UTC hours)
interface TradingSession {
	name: string;
	startHour: number;
	endHour: number;
	color: string;
}

const DEFAULT_SESSIONS: TradingSession[] = [
	{ name: "Asia", startHour: 0, endHour: 8, color: "#00d4ff" },
	{ name: "London", startHour: 8, endHour: 16, color: "#d4ff00" },
	{ name: "New York", startHour: 13, endHour: 21, color: "#00ff88" },
];

// Use PRESET_COLORS from shared for session colors

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	prop_challenge: "Prop Challenge",
	prop_funded: "Prop Funded",
	live: "Live",
	demo: "Demo",
};

// CHALLENGE_STATUS_COLORS imported from shared

const CHALLENGE_STATUS_LABELS: Record<string, string> = {
	active: "Active",
	passed: "Passed",
	failed: "Failed",
};

const PLATFORM_LABELS: Record<string, string> = {
	mt4: "MT4",
	mt5: "MT5",
	projectx: "ProjectX",
	ninjatrader: "NinjaTrader",
	other: "Manual",
};

type AccountType = "prop_challenge" | "prop_funded" | "live" | "demo";
type DrawdownType = "trailing" | "static" | "eod";
type PayoutFrequency = "weekly" | "bi_weekly" | "monthly";

interface AccountFormState {
	name: string;
	broker: string;
	platform: "mt4" | "mt5" | "projectx" | "ninjatrader" | "other";
	accountType: AccountType;
	initialBalance: string;
	currency: string;
	accountNumber: string;
	notes: string;
	color: string;
	// Prop firm fields
	maxDrawdown: string;
	drawdownType: DrawdownType | "";
	dailyLossLimit: string;
	profitTarget: string;
	consistencyRule: string;
	minTradingDays: string;
	challengeStartDate: string;
	challengeEndDate: string;
	profitSplit: string;
	payoutFrequency: PayoutFrequency | "";
	groupId: string;
}

const defaultAccountForm: AccountFormState = {
	name: "",
	broker: "",
	platform: "other",
	accountType: "live",
	initialBalance: "",
	currency: "USD",
	accountNumber: "",
	notes: "",
	color: "#6366f1",
	// Prop firm defaults
	maxDrawdown: "",
	drawdownType: "",
	dailyLossLimit: "",
	profitTarget: "",
	consistencyRule: "",
	minTradingDays: "",
	challengeStartDate: "",
	challengeEndDate: "",
	profitSplit: "",
	payoutFrequency: "",
	groupId: "",
};

export function SettingsContent() {
	const { user } = useUser();
	const { openUserProfile } = useClerk();
	const searchParams = useSearchParams();
	const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
	const [activeTab, setActiveTab] = useState("general");

	// Account management state
	const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
	const [editingAccount, setEditingAccount] = useState<string | null>(null);
	const [accountForm, setAccountForm] =
		useState<AccountFormState>(defaultAccountForm);

	// Convert to funded dialog state
	const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
	const [convertingAccountId, setConvertingAccountId] = useState<string | null>(
		null,
	);
	const [convertForm, setConvertForm] = useState({
		name: "",
		initialBalance: "",
		maxDrawdown: "",
		drawdownType: "" as DrawdownType | "",
		dailyLossLimit: "",
		profitSplit: "",
		payoutFrequency: "" as PayoutFrequency | "",
		consistencyRule: "",
	});

	// Group management state
	const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
	const [editingGroup, setEditingGroup] = useState<string | null>(null);
	const [groupForm, setGroupForm] = useState({
		name: "",
		description: "",
		color: "#6366f1",
	});

	const { refetchAccounts, setSelectedAccountId } = useAccount();
	const {
		data: accounts = [],
		isLoading: loadingAccounts,
		refetch: refetchAccountsList,
	} = api.accounts.getAll.useQuery();

	const { data: groups = [], refetch: refetchGroups } =
		api.accounts.getGroups.useQuery();

	// Account mutations
	const createAccount = api.accounts.create.useMutation({
		onSuccess: (newAccount) => {
			toast.success("Account created");
			setIsAccountDialogOpen(false);
			resetAccountForm();
			refetchAccountsList();
			refetchAccounts();
			// Auto-select the newly created account
			if (newAccount?.id) {
				setSelectedAccountId(newAccount.id);
			}
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create account");
		},
	});

	const updateAccount = api.accounts.update.useMutation({
		onSuccess: () => {
			toast.success("Account updated");
			setIsAccountDialogOpen(false);
			setEditingAccount(null);
			resetAccountForm();
			refetchAccountsList();
			refetchAccounts();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update account");
		},
	});

	const deleteAccount = api.accounts.delete.useMutation({
		onSuccess: () => {
			toast.success("Account deleted");
			refetchAccountsList();
			refetchAccounts();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete account");
		},
	});

	const setDefaultAccount = api.accounts.setDefault.useMutation({
		onSuccess: () => {
			toast.success("Default account updated");
			refetchAccountsList();
			refetchAccounts();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to set default account");
		},
	});

	const convertToFunded = api.accounts.convertToFunded.useMutation({
		onSuccess: () => {
			toast.success("Challenge marked as passed! Funded account created.");
			setIsConvertDialogOpen(false);
			setConvertingAccountId(null);
			refetchAccountsList();
			refetchAccounts();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to convert account");
		},
	});

	const markChallengeFailed = api.accounts.markChallengeFailed.useMutation({
		onSuccess: () => {
			toast.success("Challenge marked as failed");
			refetchAccountsList();
			refetchAccounts();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to mark challenge as failed");
		},
	});

	// Group mutations
	const createGroup = api.accounts.createGroup.useMutation({
		onSuccess: () => {
			toast.success("Group created");
			setIsGroupDialogOpen(false);
			resetGroupForm();
			refetchGroups();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create group");
		},
	});

	const updateGroup = api.accounts.updateGroup.useMutation({
		onSuccess: () => {
			toast.success("Group updated");
			setIsGroupDialogOpen(false);
			setEditingGroup(null);
			resetGroupForm();
			refetchGroups();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update group");
		},
	});

	const deleteGroup = api.accounts.deleteGroup.useMutation({
		onSuccess: () => {
			toast.success("Group deleted");
			refetchGroups();
			refetchAccountsList();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete group");
		},
	});

	// Check URL params for tab
	useEffect(() => {
		const tab = searchParams.get("tab");
		if (tab === "accounts" || tab === "groups") {
			setActiveTab("accounts");
		}
	}, [searchParams]);

	const [settings, setSettings] = useState({
		preferredProvider: "openai",
		openaiKey: "",
		anthropicKey: "",
		googleKey: "",
		defaultInstrument: "futures",
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		currency: "USD",
		breakevenThreshold: "3.00",
		tradingSessions: DEFAULT_SESSIONS,
	});

	// Track if settings have been modified
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
	const [initialSettings, setInitialSettings] = useState<
		typeof settings | null
	>(null);

	// Fetch user settings
	const { data: userSettings } = api.settings.get.useQuery();
	const updateSettings = api.settings.update.useMutation({
		onSuccess: () => {
			toast.success("Settings saved");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to save settings");
		},
	});

	// Sync fetched settings to local state
	useEffect(() => {
		if (userSettings) {
			let parsedSessions = DEFAULT_SESSIONS;
			if (userSettings.tradingSessions) {
				try {
					parsedSessions = JSON.parse(userSettings.tradingSessions);
				} catch {
					// Keep defaults on parse error
				}
			}
			const tz =
				userSettings.timezone ??
				Intl.DateTimeFormat().resolvedOptions().timeZone;

			// Convert session hours from UTC (backend) to local timezone (for editing)
			const localSessions = sessionsToLocal(parsedSessions, tz);

			const newSettings = {
				preferredProvider: userSettings.preferredAiProvider ?? "openai",
				openaiKey: userSettings.openaiApiKey ?? "",
				anthropicKey: userSettings.anthropicApiKey ?? "",
				googleKey: userSettings.googleApiKey ?? "",
				defaultInstrument: userSettings.defaultInstrumentType ?? "futures",
				timezone: tz,
				currency: userSettings.currency ?? "USD",
				breakevenThreshold: userSettings.breakevenThreshold ?? "3.00",
				tradingSessions: localSessions,
			};
			setSettings(newSettings);
			setInitialSettings(newSettings);
			setHasUnsavedChanges(false);
		}
	}, [userSettings]);

	// Track changes to settings
	useEffect(() => {
		if (initialSettings) {
			const hasChanges =
				JSON.stringify(settings) !== JSON.stringify(initialSettings);
			setHasUnsavedChanges(hasChanges);
		}
	}, [settings, initialSettings]);

	const resetAccountForm = () => {
		setAccountForm(defaultAccountForm);
	};

	const resetGroupForm = () => {
		setGroupForm({
			name: "",
			description: "",
			color: "#6366f1",
		});
	};

	const openEditAccount = (account: (typeof accounts)[0]) => {
		setEditingAccount(account.id);
		setAccountForm({
			name: account.name,
			broker: account.broker ?? "",
			platform: account.platform ?? "other",
			accountType: account.accountType as AccountType,
			initialBalance: account.initialBalance ?? "",
			currency: account.currency ?? "USD",
			accountNumber: account.accountNumber ?? "",
			notes: account.notes ?? "",
			color: account.color ?? "#6366f1",
			// Prop firm fields
			maxDrawdown: account.maxDrawdown ?? "",
			drawdownType: (account.drawdownType as DrawdownType) ?? "",
			dailyLossLimit: account.dailyLossLimit ?? "",
			profitTarget: account.profitTarget ?? "",
			consistencyRule: account.consistencyRule ?? "",
			minTradingDays: account.minTradingDays?.toString() ?? "",
			challengeStartDate: account.challengeStartDate
				? (new Date(account.challengeStartDate).toISOString().split("T")[0] ??
					"")
				: "",
			challengeEndDate: account.challengeEndDate
				? (new Date(account.challengeEndDate).toISOString().split("T")[0] ?? "")
				: "",
			profitSplit: account.profitSplit ?? "",
			payoutFrequency: (account.payoutFrequency as PayoutFrequency) ?? "",
			groupId: account.groupId?.toString() ?? "",
		});
		setIsAccountDialogOpen(true);
	};

	const openConvertDialog = (account: (typeof accounts)[0]) => {
		setConvertingAccountId(account.id);
		setConvertForm({
			name: `${account.name} (Funded)`,
			initialBalance: account.initialBalance ?? "",
			maxDrawdown: account.maxDrawdown ?? "",
			drawdownType: (account.drawdownType as DrawdownType) ?? "",
			dailyLossLimit: account.dailyLossLimit ?? "",
			profitSplit: "80",
			payoutFrequency: "monthly",
			consistencyRule: account.consistencyRule ?? "",
		});
		setIsConvertDialogOpen(true);
	};

	const handleAccountSubmit = () => {
		if (!accountForm.name.trim()) {
			toast.error("Account name is required");
			return;
		}

		const submitData = {
			name: accountForm.name,
			broker: accountForm.broker || undefined,
			platform: accountForm.platform,
			accountType: accountForm.accountType,
			initialBalance: accountForm.initialBalance || undefined,
			currency: accountForm.currency,
			accountNumber: accountForm.accountNumber || undefined,
			notes: accountForm.notes || undefined,
			color: accountForm.color || undefined,
			// Prop fields (only include if set)
			maxDrawdown: accountForm.maxDrawdown || undefined,
			drawdownType: accountForm.drawdownType || undefined,
			dailyLossLimit: accountForm.dailyLossLimit || undefined,
			profitTarget: accountForm.profitTarget || undefined,
			consistencyRule: accountForm.consistencyRule || undefined,
			minTradingDays: accountForm.minTradingDays
				? parseInt(accountForm.minTradingDays, 10)
				: undefined,
			challengeStartDate: accountForm.challengeStartDate || undefined,
			challengeEndDate: accountForm.challengeEndDate || undefined,
			profitSplit: accountForm.profitSplit || undefined,
			payoutFrequency: accountForm.payoutFrequency || undefined,
			groupId: accountForm.groupId || undefined,
		};

		if (editingAccount) {
			updateAccount.mutate({
				id: editingAccount,
				...submitData,
			});
		} else {
			createAccount.mutate(submitData);
		}
	};

	const handleConvertSubmit = () => {
		if (!convertingAccountId) return;

		convertToFunded.mutate({
			challengeAccountId: convertingAccountId,
			name: convertForm.name,
			initialBalance: convertForm.initialBalance,
			maxDrawdown: convertForm.maxDrawdown || undefined,
			drawdownType: convertForm.drawdownType || undefined,
			dailyLossLimit: convertForm.dailyLossLimit || undefined,
			profitSplit: convertForm.profitSplit || undefined,
			payoutFrequency: convertForm.payoutFrequency || undefined,
			consistencyRule: convertForm.consistencyRule || undefined,
		});
	};

	const handleGroupSubmit = () => {
		if (!groupForm.name.trim()) {
			toast.error("Group name is required");
			return;
		}

		if (editingGroup) {
			updateGroup.mutate({
				id: editingGroup,
				...groupForm,
			});
		} else {
			createGroup.mutate(groupForm);
		}
	};

	const openEditGroup = (group: (typeof groups)[0]) => {
		setEditingGroup(group.id);
		setGroupForm({
			name: group.name,
			description: group.description ?? "",
			color: group.color ?? "#6366f1",
		});
		setIsGroupDialogOpen(true);
	};

	const toggleShowKey = (provider: string) => {
		setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
	};

	const updateSettingsStore = useSettingsStore((state) => state.updateSettings);

	const handleSave = () => {
		// Convert session hours from local timezone back to UTC for storage
		const utcSessions = sessionsToUtc(
			settings.tradingSessions,
			settings.timezone,
		);

		updateSettings.mutate(
			{
				preferredAiProvider: settings.preferredProvider,
				openaiApiKey: settings.openaiKey || undefined,
				anthropicApiKey: settings.anthropicKey || undefined,
				googleApiKey: settings.googleKey || undefined,
				defaultInstrumentType: settings.defaultInstrument as
					| "futures"
					| "forex",
				timezone: settings.timezone,
				currency: settings.currency,
				breakevenThreshold: settings.breakevenThreshold,
				tradingSessions: JSON.stringify(utcSessions),
			},
			{
				onSuccess: () => {
					setInitialSettings(settings);
					setHasUnsavedChanges(false);

					// Sync Zustand store with UTC sessions (analytics use UTC internally)
					updateSettingsStore({
						timezone: settings.timezone,
						currency: settings.currency,
						breakevenThreshold: parseFloat(
							settings.breakevenThreshold || "3.00",
						),
						defaultInstrumentType: settings.defaultInstrument as
							| "futures"
							| "forex",
						tradingSessions: utcSessions,
					});
				},
			},
		);
	};

	// Session management handlers
	const addSession = () => {
		const newSession: TradingSession = {
			name: `Session ${settings.tradingSessions.length + 1}`,
			startHour: 0,
			endHour: 8,
			color:
				PRESET_COLORS[settings.tradingSessions.length % PRESET_COLORS.length] ??
				"#00d4ff",
		};
		setSettings({
			...settings,
			tradingSessions: [...settings.tradingSessions, newSession],
		});
	};

	const updateSession = (index: number, updates: Partial<TradingSession>) => {
		const newSessions = [...settings.tradingSessions];
		newSessions[index] = {
			...newSessions[index],
			...updates,
		} as TradingSession;
		setSettings({ ...settings, tradingSessions: newSessions });
	};

	const removeSession = (index: number) => {
		setSettings({
			...settings,
			tradingSessions: settings.tradingSessions.filter((_, i) => i !== index),
		});
	};

	const resetSessionsToDefault = () => {
		setSettings({ ...settings, tradingSessions: DEFAULT_SESSIONS });
	};

	const isPropAccount =
		accountForm.accountType === "prop_challenge" ||
		accountForm.accountType === "prop_funded";
	const isChallenge = accountForm.accountType === "prop_challenge";
	const isFunded = accountForm.accountType === "prop_funded";

	return (
		<div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
			{/* Header */}
			<div>
				<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
					Configuration
				</span>
				<h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
					Settings
				</h1>
				<p className="mt-1 hidden font-mono text-muted-foreground text-xs sm:block">
					Configure your accounts and AI integrations
				</p>
			</div>

			<Tabs onValueChange={setActiveTab} value={activeTab}>
				<div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
					<TabsList className="inline-flex w-auto min-w-full border border-border bg-secondary sm:grid sm:w-full sm:grid-cols-5">
						<TabsTrigger
							className="min-h-[40px] flex-1 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-white/10 sm:px-4 sm:text-xs"
							value="general"
						>
							General
						</TabsTrigger>
						<TabsTrigger
							className="min-h-[40px] flex-1 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-white/10 sm:px-4 sm:text-xs"
							value="trading"
						>
							Trading
						</TabsTrigger>
						<TabsTrigger
							className="min-h-[40px] flex-1 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-white/10 sm:px-4 sm:text-xs"
							value="accounts"
						>
							Accounts
						</TabsTrigger>
						<TabsTrigger
							className="min-h-[40px] flex-1 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-white/10 sm:px-4 sm:text-xs"
							value="tags"
						>
							Tags
						</TabsTrigger>
						<TabsTrigger
							className="min-h-[40px] flex-1 whitespace-nowrap px-3 font-mono text-[10px] uppercase tracking-wider data-[state=active]:bg-white/10 sm:px-4 sm:text-xs"
							value="ai"
						>
							AI
						</TabsTrigger>
					</TabsList>
				</div>

				{/* General Tab */}
				<TabsContent className="space-y-4 sm:space-y-6" value="general">
					{/* Profile Info */}
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Shield className="h-5 w-5" />
										Profile
									</CardTitle>
									<CardDescription className="hidden sm:block">
										Your account information
									</CardDescription>
								</div>
								<Button
									className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
									onClick={() => openUserProfile()}
									variant="outline"
								>
									<Edit className="mr-2 h-3.5 w-3.5" />
									Manage Profile
								</Button>
							</div>
						</CardHeader>
						<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
							<button
								className="-m-2 flex min-h-[44px] cursor-pointer items-center gap-4 rounded-lg p-2 text-left transition-colors hover:bg-secondary/50"
								onClick={() => openUserProfile()}
								type="button"
							>
								{user?.imageUrl && (
									// biome-ignore lint/performance/noImgElement: External Clerk avatar URLs
									<img
										alt="Profile"
										className="h-12 w-12 rounded border border-border"
										src={user.imageUrl}
									/>
								)}
								<div className="min-w-0 flex-1">
									<p className="font-medium transition-colors hover:text-primary">
										{user?.firstName} {user?.lastName}
									</p>
									<p className="truncate font-mono text-muted-foreground text-xs">
										{user?.primaryEmailAddress?.emailAddress}
									</p>
								</div>
							</button>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Trading Tab */}
				<TabsContent className="space-y-4 sm:space-y-6" value="trading">
					{/* Trading Preferences */}
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle>Trading Preferences</CardTitle>
							<CardDescription className="hidden sm:block">
								Default settings for new trades
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label>Default Instrument</Label>
									<Select
										onValueChange={(value) =>
											setSettings({ ...settings, defaultInstrument: value })
										}
										value={settings.defaultInstrument}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="futures">Futures</SelectItem>
											<SelectItem value="forex">Forex</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<Label>Currency</Label>
									<Select
										onValueChange={(value) =>
											setSettings({ ...settings, currency: value })
										}
										value={settings.currency}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="USD">USD ($)</SelectItem>
											<SelectItem value="EUR">EUR (€)</SelectItem>
											<SelectItem value="GBP">GBP (£)</SelectItem>
											<SelectItem value="JPY">JPY (¥)</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="space-y-2">
								<Label>Timezone</Label>
								<Select
									onValueChange={(value) =>
										setSettings({ ...settings, timezone: value })
									}
									value={settings.timezone}
								>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="America/New_York">
											Eastern Time (ET)
										</SelectItem>
										<SelectItem value="America/Chicago">
											Central Time (CT)
										</SelectItem>
										<SelectItem value="America/Denver">
											Mountain Time (MT)
										</SelectItem>
										<SelectItem value="America/Los_Angeles">
											Pacific Time (PT)
										</SelectItem>
										<SelectItem value="Europe/London">
											London (GMT/BST)
										</SelectItem>
										<SelectItem value="Europe/Paris">
											Central European (CET)
										</SelectItem>
										<SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
										<SelectItem value="Asia/Singapore">
											Singapore (SGT)
										</SelectItem>
										<SelectItem value="UTC">UTC</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<Separator />

							<div className="space-y-2">
								<Label>Breakeven Threshold</Label>
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground">$</span>
									<Input
										className="w-full sm:w-32"
										inputMode="decimal"
										min="0"
										onChange={(e) =>
											setSettings({
												...settings,
												breakevenThreshold: e.target.value,
											})
										}
										placeholder="3.00"
										step="0.01"
										type="number"
										value={settings.breakevenThreshold}
									/>
								</div>
								<p className="text-muted-foreground text-xs sm:text-sm">
									Trades with P&L within ±${settings.breakevenThreshold || "0"}{" "}
									are classified as breakeven
								</p>
							</div>
						</CardContent>
					</Card>

					{/* Trading Sessions */}
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Clock className="h-5 w-5" />
										Trading Sessions
									</CardTitle>
									<CardDescription className="hidden sm:block">
										Define your trading sessions for analytics breakdown
									</CardDescription>
								</div>
								<div className="flex gap-2">
									<Button
										className="min-h-[36px] flex-1 font-mono text-[10px] sm:flex-none"
										onClick={resetSessionsToDefault}
										size="sm"
										variant="outline"
									>
										Reset
									</Button>
									<Button
										className="min-h-[36px] flex-1 font-mono text-[10px] sm:flex-none"
										onClick={addSession}
										size="sm"
										variant="outline"
									>
										<Plus className="mr-1 h-3 w-3" />
										Add
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
							{settings.tradingSessions.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No sessions configured. Add one or reset to defaults.
								</p>
							) : (
								<div className="space-y-3">
									{settings.tradingSessions.map((session, index) => (
										<div
											className="flex flex-col gap-3 rounded border border-border bg-card p-3 sm:flex-row sm:items-center"
											key={`session-${session.name}-${session.startHour}`}
										>
											{/* Top row on mobile: Name + Delete */}
											<div className="flex items-center gap-3 sm:flex-1">
												{/* Color indicator */}
												<div
													className="h-8 w-2 shrink-0 rounded"
													style={{ backgroundColor: session.color }}
												/>

												{/* Session name */}
												<div className="min-w-0 flex-1">
													<Input
														className="h-8 font-mono text-sm"
														onChange={(e) =>
															updateSession(index, { name: e.target.value })
														}
														placeholder="Session name"
														value={session.name}
													/>
												</div>

												{/* Delete button - visible on mobile at end of name row */}
												<Button
													className="h-8 w-8 shrink-0 p-0 sm:hidden"
													onClick={() => removeSession(index)}
													size="sm"
													variant="ghost"
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>

											{/* Bottom row on mobile: Time range + Color */}
											<div className="flex items-center gap-2">
												{/* Time range */}
												<Select
													onValueChange={(value) =>
														updateSession(index, {
															startHour: parseInt(value, 10),
														})
													}
													value={session.startHour.toString()}
												>
													<SelectTrigger className="min-h-[36px] w-[70px] font-mono text-xs sm:w-24">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{[
															0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
															15, 16, 17, 18, 19, 20, 21, 22, 23,
														].map((hour) => (
															<SelectItem
																key={`start-hour-${hour}`}
																value={hour.toString()}
															>
																{hour.toString().padStart(2, "0")}:00
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<span className="text-muted-foreground">→</span>
												<Select
													onValueChange={(value) =>
														updateSession(index, {
															endHour: parseInt(value, 10),
														})
													}
													value={session.endHour.toString()}
												>
													<SelectTrigger className="min-h-[36px] w-[70px] font-mono text-xs sm:w-24">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{[
															0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
															15, 16, 17, 18, 19, 20, 21, 22, 23,
														].map((hour) => (
															<SelectItem
																key={`end-hour-${hour}`}
																value={hour.toString()}
															>
																{hour.toString().padStart(2, "0")}:00
															</SelectItem>
														))}
													</SelectContent>
												</Select>

												{/* Color picker */}
												<Select
													onValueChange={(value) =>
														updateSession(index, { color: value })
													}
													value={session.color}
												>
													<SelectTrigger className="min-h-[36px] w-12 sm:w-16">
														<div
															className="h-4 w-4 rounded"
															style={{ backgroundColor: session.color }}
														/>
													</SelectTrigger>
													<SelectContent>
														{PRESET_COLORS.map((color) => (
															<SelectItem key={color} value={color}>
																<div className="flex items-center gap-2">
																	<div
																		className="h-4 w-4 rounded"
																		style={{ backgroundColor: color }}
																	/>
																</div>
															</SelectItem>
														))}
													</SelectContent>
												</Select>

												{/* Delete button - hidden on mobile, visible on desktop */}
												<Button
													className="hidden h-8 w-8 p-0 sm:flex"
													onClick={() => removeSession(index)}
													size="sm"
													variant="ghost"
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}

							{/* Visual timeline */}
							{settings.tradingSessions.length > 0 && (
								<div className="mt-4 rounded border border-border bg-secondary p-3">
									<p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase">
										24h Timeline
									</p>
									<div className="relative h-8 rounded bg-card">
										{settings.tradingSessions.map((session, _index) => {
											const start = (session.startHour / 24) * 100;
											const width =
												session.endHour >= session.startHour
													? ((session.endHour - session.startHour) / 24) * 100
													: ((24 - session.startHour + session.endHour) / 24) *
														100;
											return (
												<div
													className="absolute top-0 h-full rounded opacity-70"
													key={`timeline-${session.name}-${session.startHour}`}
													style={{
														left: `${start}%`,
														width: `${Math.min(width, 100 - start)}%`,
														backgroundColor: session.color,
													}}
													title={`${session.name}: ${session.startHour
														.toString()
														.padStart(2, "0")}:00 - ${session.endHour
														.toString()
														.padStart(2, "0")}:00`}
												/>
											);
										})}
										{/* Hour markers */}
										<div className="absolute bottom-0 left-0 flex w-full justify-between px-1 font-mono text-[8px] text-muted-foreground">
											<span>0</span>
											<span>6</span>
											<span>12</span>
											<span>18</span>
											<span>24</span>
										</div>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* Trading Accounts Tab */}
				<TabsContent className="space-y-4 sm:space-y-6" value="accounts">
					{/* Account Groups Section */}
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<FolderOpen className="h-5 w-5" />
										Account Groups
									</CardTitle>
									<CardDescription className="hidden sm:block">
										Group accounts for copy trading or combined stats
									</CardDescription>
								</div>
								<Dialog
									onOpenChange={(open) => {
										setIsGroupDialogOpen(open);
										if (!open) {
											setEditingGroup(null);
											resetGroupForm();
										}
									}}
									open={isGroupDialogOpen}
								>
									<DialogTrigger asChild>
										<Button
											className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
											variant="outline"
										>
											<Plus className="mr-2 h-3.5 w-3.5" />
											Add Group
										</Button>
									</DialogTrigger>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>
												{editingGroup ? "Edit Group" : "Create Group"}
											</DialogTitle>
											<DialogDescription>
												{editingGroup
													? "Update your account group details"
													: "Create a new group to combine account statistics"}
											</DialogDescription>
										</DialogHeader>
										<div className="space-y-4">
											<div className="space-y-2">
												<Label>Group Name *</Label>
												<Input
													onChange={(e) =>
														setGroupForm({ ...groupForm, name: e.target.value })
													}
													placeholder="e.g., Copy Trading Group"
													value={groupForm.name}
												/>
											</div>
											<div className="space-y-2">
												<Label>Description</Label>
												<Input
													onChange={(e) =>
														setGroupForm({
															...groupForm,
															description: e.target.value,
														})
													}
													placeholder="Optional description"
													value={groupForm.description}
												/>
											</div>
										</div>
										<DialogFooter>
											<Button
												onClick={() => {
													setIsGroupDialogOpen(false);
													setEditingGroup(null);
													resetGroupForm();
												}}
												variant="outline"
											>
												Cancel
											</Button>
											<Button
												disabled={
													createGroup.isPending || updateGroup.isPending
												}
												onClick={handleGroupSubmit}
											>
												{(createGroup.isPending || updateGroup.isPending) && (
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												)}
												{editingGroup ? "Update" : "Create"}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</div>
						</CardHeader>
						<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
							{groups.length === 0 ? (
								<p className="py-4 text-center text-muted-foreground text-sm">
									No groups yet. Create one to combine account statistics.
								</p>
							) : (
								<div className="space-y-2">
									{groups.map((group) => (
										<div
											className="flex items-center justify-between gap-2 rounded border border-border bg-card p-3"
											key={group.id}
										>
											<div className="min-w-0 flex-1">
												<span className="font-medium font-mono text-sm">
													{group.name}
												</span>
												<p className="truncate font-mono text-muted-foreground text-xs">
													{group.accounts?.length || 0} accounts
													{group.description && ` • ${group.description}`}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-1">
												<Button
													className="min-h-[36px] min-w-[36px]"
													onClick={() => openEditGroup(group)}
													size="sm"
													variant="ghost"
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													className="min-h-[36px] min-w-[36px]"
													disabled={deleteGroup.isPending}
													onClick={() => {
														if (
															confirm(
																"Delete this group? Accounts will be unassigned.",
															)
														) {
															deleteGroup.mutate({ id: group.id });
														}
													}}
													size="sm"
													variant="ghost"
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Trading Accounts Section */}
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle className="flex items-center gap-2">
										<Wallet className="h-5 w-5" />
										Trading Accounts
									</CardTitle>
									<CardDescription className="hidden sm:block">
										Manage your trading accounts to track performance separately
									</CardDescription>
								</div>
								<Dialog
									onOpenChange={(open) => {
										setIsAccountDialogOpen(open);
										if (!open) {
											setEditingAccount(null);
											resetAccountForm();
										}
									}}
									open={isAccountDialogOpen}
								>
									<DialogTrigger asChild>
										<Button className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto">
											<Plus className="mr-2 h-3.5 w-3.5" />
											Add Account
										</Button>
									</DialogTrigger>
									<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
										<DialogHeader>
											<DialogTitle>
												{editingAccount ? "Edit Account" : "Create Account"}
											</DialogTitle>
											<DialogDescription>
												{editingAccount
													? "Update your trading account details"
													: "Add a new trading account to track separately"}
											</DialogDescription>
										</DialogHeader>
										<div className="space-y-4">
											{/* Basic Info */}
											<div className="space-y-2">
												<Label>Account Name *</Label>
												<Input
													onChange={(e) =>
														setAccountForm({
															...accountForm,
															name: e.target.value,
														})
													}
													placeholder="e.g., Main Trading Account"
													value={accountForm.name}
												/>
											</div>

											<div className="grid gap-4 sm:grid-cols-2">
												<div className="space-y-2">
													<Label>Account Type</Label>
													<Select
														onValueChange={(value) =>
															setAccountForm({
																...accountForm,
																accountType: value as AccountType,
															})
														}
														value={accountForm.accountType}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="prop_challenge">
																Prop Challenge
															</SelectItem>
															<SelectItem value="prop_funded">
																Prop Funded
															</SelectItem>
															<SelectItem value="live">Live</SelectItem>
															<SelectItem value="demo">Demo</SelectItem>
														</SelectContent>
													</Select>
												</div>
												<div className="space-y-2">
													<Label>Platform</Label>
													<Select
														onValueChange={(value) =>
															setAccountForm({
																...accountForm,
																platform: value as typeof accountForm.platform,
															})
														}
														value={accountForm.platform}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="mt4">MetaTrader 4</SelectItem>
															<SelectItem value="mt5">MetaTrader 5</SelectItem>
															<SelectItem value="projectx">ProjectX</SelectItem>
															<SelectItem value="ninjatrader">
																NinjaTrader
															</SelectItem>
															<SelectItem value="other">
																Other / Manual
															</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>

											<div className="space-y-2">
												<Label>Broker</Label>
												<Input
													onChange={(e) =>
														setAccountForm({
															...accountForm,
															broker: e.target.value,
														})
													}
													placeholder="e.g., Apex, Topstep, FTMO"
													value={accountForm.broker}
												/>
											</div>

											<div className="grid gap-4 sm:grid-cols-2">
												<div className="space-y-2">
													<Label>Initial Balance</Label>
													<Input
														onChange={(e) =>
															setAccountForm({
																...accountForm,
																initialBalance: e.target.value,
															})
														}
														placeholder="50000"
														type="number"
														value={accountForm.initialBalance}
													/>
												</div>
												<div className="space-y-2">
													<Label>Currency</Label>
													<Select
														onValueChange={(value) =>
															setAccountForm({
																...accountForm,
																currency: value,
															})
														}
														value={accountForm.currency}
													>
														<SelectTrigger>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="USD">USD</SelectItem>
															<SelectItem value="EUR">EUR</SelectItem>
															<SelectItem value="GBP">GBP</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</div>

											{/* Group Assignment */}
											{groups.length > 0 && (
												<div className="space-y-2">
													<Label>
														Account Group{" "}
														<span className="font-normal text-muted-foreground">
															(optional)
														</span>
													</Label>
													<Select
														onValueChange={(value) =>
															setAccountForm({
																...accountForm,
																groupId: value === "none" ? "" : value,
															})
														}
														value={accountForm.groupId || "none"}
													>
														<SelectTrigger>
															<SelectValue placeholder="No group" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="none">No group</SelectItem>
															{groups.map((group) => (
																<SelectItem
																	key={group.id}
																	value={group.id.toString()}
																>
																	{group.name}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												</div>
											)}

											{/* Prop Firm Rules */}
											{isPropAccount && (
												<>
													<Separator />
													<div className="space-y-1">
														<h4 className="font-medium text-sm">
															Prop Firm Rules
														</h4>
														<p className="text-muted-foreground text-xs">
															Configure your prop firm account parameters
														</p>
													</div>

													<div className="grid gap-4 sm:grid-cols-2">
														<div className="space-y-2">
															<Label>Max Drawdown (%)</Label>
															<Input
																onChange={(e) =>
																	setAccountForm({
																		...accountForm,
																		maxDrawdown: e.target.value,
																	})
																}
																placeholder="6.00"
																step="0.01"
																type="number"
																value={accountForm.maxDrawdown}
															/>
														</div>
														<div className="space-y-2">
															<Label>Drawdown Type</Label>
															<Select
																onValueChange={(value) =>
																	setAccountForm({
																		...accountForm,
																		drawdownType: value as DrawdownType,
																	})
																}
																value={accountForm.drawdownType}
															>
																<SelectTrigger>
																	<SelectValue placeholder="Select type" />
																</SelectTrigger>
																<SelectContent>
																	<SelectItem value="trailing">
																		Trailing
																	</SelectItem>
																	<SelectItem value="static">Static</SelectItem>
																	<SelectItem value="eod">
																		End of Day (EOD)
																	</SelectItem>
																</SelectContent>
															</Select>
														</div>
													</div>

													<div className="grid gap-4 sm:grid-cols-2">
														<div className="space-y-2">
															<Label>
																Daily Loss Limit (%){" "}
																<span className="font-normal text-muted-foreground">
																	(optional)
																</span>
															</Label>
															<Input
																onChange={(e) =>
																	setAccountForm({
																		...accountForm,
																		dailyLossLimit: e.target.value,
																	})
																}
																placeholder="3.00"
																step="0.01"
																type="number"
																value={accountForm.dailyLossLimit}
															/>
														</div>
														<div className="space-y-2">
															<Label>
																Consistency Rule (%){" "}
																<span className="font-normal text-muted-foreground">
																	(optional)
																</span>
															</Label>
															<Input
																onChange={(e) =>
																	setAccountForm({
																		...accountForm,
																		consistencyRule: e.target.value,
																	})
																}
																placeholder="30"
																step="1"
																type="number"
																value={accountForm.consistencyRule}
															/>
															<p className="text-[10px] text-muted-foreground">
																Max single day profit as % of target
															</p>
														</div>
													</div>

													{/* Challenge-specific fields */}
													{isChallenge && (
														<>
															<div className="grid gap-4 sm:grid-cols-2">
																<div className="space-y-2">
																	<Label>Profit Target (%)</Label>
																	<Input
																		onChange={(e) =>
																			setAccountForm({
																				...accountForm,
																				profitTarget: e.target.value,
																			})
																		}
																		placeholder="8.00"
																		step="0.01"
																		type="number"
																		value={accountForm.profitTarget}
																	/>
																</div>
																<div className="space-y-2">
																	<Label>
																		Min Trading Days{" "}
																		<span className="font-normal text-muted-foreground">
																			(optional)
																		</span>
																	</Label>
																	<Input
																		onChange={(e) =>
																			setAccountForm({
																				...accountForm,
																				minTradingDays: e.target.value,
																			})
																		}
																		placeholder="5"
																		type="number"
																		value={accountForm.minTradingDays}
																	/>
																</div>
															</div>
															<div className="grid gap-4 sm:grid-cols-2">
																<div className="space-y-2">
																	<Label>
																		Start Date{" "}
																		<span className="font-normal text-muted-foreground">
																			(optional)
																		</span>
																	</Label>
																	<Input
																		onChange={(e) =>
																			setAccountForm({
																				...accountForm,
																				challengeStartDate: e.target.value,
																			})
																		}
																		type="date"
																		value={accountForm.challengeStartDate}
																	/>
																</div>
																<div className="space-y-2">
																	<Label>
																		End Date{" "}
																		<span className="font-normal text-muted-foreground">
																			(optional)
																		</span>
																	</Label>
																	<Input
																		onChange={(e) =>
																			setAccountForm({
																				...accountForm,
																				challengeEndDate: e.target.value,
																			})
																		}
																		type="date"
																		value={accountForm.challengeEndDate}
																	/>
																</div>
															</div>
														</>
													)}

													{/* Funded-specific fields */}
													{isFunded && (
														<div className="grid gap-4 sm:grid-cols-2">
															<div className="space-y-2">
																<Label>
																	Profit Split (%){" "}
																	<span className="font-normal text-muted-foreground">
																		(optional)
																	</span>
																</Label>
																<Input
																	onChange={(e) =>
																		setAccountForm({
																			...accountForm,
																			profitSplit: e.target.value,
																		})
																	}
																	placeholder="80"
																	step="1"
																	type="number"
																	value={accountForm.profitSplit}
																/>
															</div>
															<div className="space-y-2">
																<Label>
																	Payout Frequency{" "}
																	<span className="font-normal text-muted-foreground">
																		(optional)
																	</span>
																</Label>
																<Select
																	onValueChange={(value) =>
																		setAccountForm({
																			...accountForm,
																			payoutFrequency: value as PayoutFrequency,
																		})
																	}
																	value={accountForm.payoutFrequency}
																>
																	<SelectTrigger>
																		<SelectValue placeholder="Select frequency" />
																	</SelectTrigger>
																	<SelectContent>
																		<SelectItem value="weekly">
																			Weekly
																		</SelectItem>
																		<SelectItem value="bi_weekly">
																			Bi-Weekly
																		</SelectItem>
																		<SelectItem value="monthly">
																			Monthly
																		</SelectItem>
																	</SelectContent>
																</Select>
															</div>
														</div>
													)}
												</>
											)}
										</div>
										<DialogFooter>
											<Button
												onClick={() => {
													setIsAccountDialogOpen(false);
													setEditingAccount(null);
													resetAccountForm();
												}}
												variant="outline"
											>
												Cancel
											</Button>
											<Button
												disabled={
													createAccount.isPending || updateAccount.isPending
												}
												onClick={handleAccountSubmit}
											>
												{(createAccount.isPending ||
													updateAccount.isPending) && (
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												)}
												{editingAccount ? "Update" : "Create"}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>
							</div>
						</CardHeader>
						<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
							{loadingAccounts ? (
								<div className="flex items-center justify-center py-8">
									<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
								</div>
							) : accounts.length === 0 ? (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<Wallet className="h-12 w-12 text-muted-foreground/50" />
									<h3 className="mt-4 font-semibold">No accounts yet</h3>
									<p className="text-muted-foreground text-sm">
										Create your first trading account to start tracking
									</p>
								</div>
							) : (
								<div className="space-y-3">
									{accounts.map((account) => (
										<div
											className="flex flex-col gap-3 rounded border border-border bg-card p-3 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between sm:p-4"
											key={account.id}
										>
											<div className="flex items-start gap-3 sm:items-center">
												<div
													className={cn(
														"mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full sm:mt-0",
														ACCOUNT_TYPE_COLORS[account.accountType],
													)}
												/>
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
														<span className="font-medium font-mono text-sm">
															{account.name}
														</span>
														{account.isDefault && (
															<Badge
																className="gap-1 font-mono text-[10px]"
																variant="secondary"
															>
																<Star className="h-2.5 w-2.5" />
																<span className="hidden sm:inline">
																	Default
																</span>
															</Badge>
														)}
														<Badge
															className="font-mono text-[10px]"
															variant="outline"
														>
															{ACCOUNT_TYPE_LABELS[account.accountType]}
														</Badge>
														{account.accountType === "prop_challenge" &&
															account.challengeStatus && (
																<Badge
																	className={cn(
																		"font-mono text-[10px]",
																		account.challengeStatus === "passed" &&
																			"bg-green-500/20 text-green-500",
																		account.challengeStatus === "failed" &&
																			"bg-red-500/20 text-red-500",
																		account.challengeStatus === "active" &&
																			"bg-amber-500/20 text-amber-500",
																	)}
																>
																	{
																		CHALLENGE_STATUS_LABELS[
																			account.challengeStatus
																		]
																	}
																</Badge>
															)}
														{account.linkedAccountId && (
															<Badge
																className="hidden gap-1 font-mono text-[10px] sm:inline-flex"
																variant="secondary"
															>
																<Link2 className="h-2.5 w-2.5" />
																Linked
															</Badge>
														)}
														{account.groupId && (
															<Badge
																className="hidden gap-1 font-mono text-[10px] sm:inline-flex"
																variant="secondary"
															>
																<FolderOpen className="h-2.5 w-2.5" />
																{groups.find((g) => g.id === account.groupId)
																	?.name || "Group"}
															</Badge>
														)}
													</div>
													<p className="truncate font-mono text-muted-foreground text-xs">
														{PLATFORM_LABELS[account.platform ?? "other"]}
														{account.broker && ` • ${account.broker}`} •{" "}
														{account.initialBalance
															? `$${parseFloat(
																	account.initialBalance,
																).toLocaleString()}`
															: "$0"}{" "}
														{account.currency}
														{account.maxDrawdown &&
															` • ${account.maxDrawdown}% DD`}
													</p>
												</div>
											</div>
											<div className="flex shrink-0 items-center justify-end gap-1">
												{/* Mark as Passed button for active challenges */}
												{account.accountType === "prop_challenge" &&
													account.challengeStatus === "active" && (
														<>
															<Button
																className="min-h-[36px] min-w-[36px] text-green-500 hover:text-green-400"
																onClick={() => openConvertDialog(account)}
																size="sm"
																title="Mark as Passed"
																variant="ghost"
															>
																<Trophy className="h-4 w-4" />
															</Button>
															<Button
																className="min-h-[36px] min-w-[36px] text-red-500 hover:text-red-400"
																disabled={markChallengeFailed.isPending}
																onClick={() => {
																	if (
																		confirm("Mark this challenge as failed?")
																	) {
																		markChallengeFailed.mutate({
																			id: account.id,
																		});
																	}
																}}
																size="sm"
																title="Mark as Failed"
																variant="ghost"
															>
																<XCircle className="h-4 w-4" />
															</Button>
														</>
													)}
												{!account.isDefault && (
													<Button
														className="min-h-[36px] min-w-[36px]"
														disabled={setDefaultAccount.isPending}
														onClick={() =>
															setDefaultAccount.mutate({ id: account.id })
														}
														size="sm"
														title="Set as Default"
														variant="ghost"
													>
														<Star className="h-4 w-4" />
													</Button>
												)}
												<Button
													className="min-h-[36px] min-w-[36px]"
													onClick={() => openEditAccount(account)}
													size="sm"
													title="Edit"
													variant="ghost"
												>
													<Edit className="h-4 w-4" />
												</Button>
												<Button
													className="min-h-[36px] min-w-[36px]"
													disabled={deleteAccount.isPending}
													onClick={() => {
														if (
															confirm(
																"Are you sure you want to delete this account? Trades will be unassigned.",
															)
														) {
															deleteAccount.mutate({ id: account.id });
														}
													}}
													size="sm"
													title="Delete"
													variant="ghost"
												>
													<Trash2 className="h-4 w-4 text-destructive" />
												</Button>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Convert to Funded Dialog */}
					<Dialog
						onOpenChange={(open) => {
							setIsConvertDialogOpen(open);
							if (!open) setConvertingAccountId(null);
						}}
						open={isConvertDialogOpen}
					>
						<DialogContent>
							<DialogHeader>
								<DialogTitle className="flex items-center gap-2">
									<Award className="h-5 w-5 text-green-500" />
									Mark Challenge as Passed
								</DialogTitle>
								<DialogDescription>
									Create a new funded account linked to this challenge.
									Configure your funded account settings below.
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Funded Account Name *</Label>
									<Input
										onChange={(e) =>
											setConvertForm({ ...convertForm, name: e.target.value })
										}
										value={convertForm.name}
									/>
								</div>
								<div className="space-y-2">
									<Label>Starting Balance *</Label>
									<Input
										onChange={(e) =>
											setConvertForm({
												...convertForm,
												initialBalance: e.target.value,
											})
										}
										placeholder="50000"
										type="number"
										value={convertForm.initialBalance}
									/>
								</div>
								<Separator />
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label>Max Drawdown (%)</Label>
										<Input
											onChange={(e) =>
												setConvertForm({
													...convertForm,
													maxDrawdown: e.target.value,
												})
											}
											placeholder="6.00"
											step="0.01"
											type="number"
											value={convertForm.maxDrawdown}
										/>
									</div>
									<div className="space-y-2">
										<Label>Drawdown Type</Label>
										<Select
											onValueChange={(value) =>
												setConvertForm({
													...convertForm,
													drawdownType: value as DrawdownType,
												})
											}
											value={convertForm.drawdownType}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select type" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="trailing">Trailing</SelectItem>
												<SelectItem value="static">Static</SelectItem>
												<SelectItem value="eod">End of Day (EOD)</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label>Profit Split (%)</Label>
										<Input
											onChange={(e) =>
												setConvertForm({
													...convertForm,
													profitSplit: e.target.value,
												})
											}
											placeholder="80"
											type="number"
											value={convertForm.profitSplit}
										/>
									</div>
									<div className="space-y-2">
										<Label>Payout Frequency</Label>
										<Select
											onValueChange={(value) =>
												setConvertForm({
													...convertForm,
													payoutFrequency: value as PayoutFrequency,
												})
											}
											value={convertForm.payoutFrequency}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select frequency" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="weekly">Weekly</SelectItem>
												<SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
												<SelectItem value="monthly">Monthly</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</div>
							<DialogFooter>
								<Button
									onClick={() => {
										setIsConvertDialogOpen(false);
										setConvertingAccountId(null);
									}}
									variant="outline"
								>
									Cancel
								</Button>
								<Button
									className="bg-green-600 hover:bg-green-700"
									disabled={convertToFunded.isPending}
									onClick={handleConvertSubmit}
								>
									{convertToFunded.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Create Funded Account
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</TabsContent>

				{/* Tags Tab */}
				<TabsContent className="space-y-4 sm:space-y-6" value="tags">
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle>Tag Management</CardTitle>
							<CardDescription className="hidden sm:block">
								Create and manage tags to organize your trades
							</CardDescription>
						</CardHeader>
						<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
							<TagManager />
						</CardContent>
					</Card>
				</TabsContent>

				{/* AI Providers Tab */}
				<TabsContent className="space-y-4 sm:space-y-6" value="ai">
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle className="flex items-center gap-2">
								<Key className="h-5 w-5" />
								AI Provider Keys
							</CardTitle>
							<CardDescription className="hidden sm:block">
								Configure your AI provider API keys for advanced insights
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
							{/* Security Notice */}
							<div className="flex items-start gap-3 rounded-lg border border-primary/50 bg-primary/5 p-3 sm:p-4">
								<Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
								<div>
									<p className="font-medium text-sm sm:text-base">
										Bring Your Own Key (BYOK)
									</p>
									<p className="text-muted-foreground text-xs sm:text-sm">
										Your API keys are encrypted and stored securely. We never
										share your keys or use them for any purpose other than
										generating insights for you.
									</p>
								</div>
							</div>

							{/* Preferred Provider */}
							<div className="space-y-2">
								<Label>Preferred AI Provider</Label>
								<Select
									onValueChange={(value) =>
										setSettings({ ...settings, preferredProvider: value })
									}
									value={settings.preferredProvider}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select provider" />
									</SelectTrigger>
									<SelectContent>
										{AI_PROVIDERS.map((provider) => (
											<SelectItem key={provider.id} value={provider.id}>
												{provider.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<Separator />

							{/* API Keys */}
							{AI_PROVIDERS.map((provider) => (
								<div className="space-y-2" key={provider.id}>
									<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
										<Label className="text-sm" htmlFor={provider.id}>
											{provider.name} API Key
											<span className="ml-2 hidden text-muted-foreground text-xs sm:inline">
												{provider.description}
											</span>
										</Label>
										{settings[`${provider.id}Key` as keyof typeof settings] && (
											<Badge className="w-fit gap-1" variant="secondary">
												<Check className="h-3 w-3" />
												Configured
											</Badge>
										)}
									</div>
									<div className="relative">
										<Input
											className="min-h-[44px] pr-12 font-mono text-sm"
											id={provider.id}
											onChange={(e) =>
												setSettings({
													...settings,
													[`${provider.id}Key`]: e.target.value,
												})
											}
											placeholder={provider.placeholder}
											type={showKeys[provider.id] ? "text" : "password"}
											value={
												settings[
													`${provider.id}Key` as keyof typeof settings
												] as string
											}
										/>
										<Button
											className="-translate-y-1/2 absolute top-1/2 right-1 min-h-[36px] min-w-[36px]"
											onClick={() => toggleShowKey(provider.id)}
											size="icon"
											type="button"
											variant="ghost"
										>
											{showKeys[provider.id] ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</Button>
									</div>
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Save Button - Fixed at bottom */}
			<div className="flex flex-col gap-3 rounded border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
				<div className="flex items-center gap-2">
					{hasUnsavedChanges && (
						<>
							<div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
							<span className="font-mono text-muted-foreground text-xs">
								Unsaved changes
							</span>
						</>
					)}
				</div>
				<Button
					className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
					disabled={updateSettings.isPending || !hasUnsavedChanges}
					onClick={handleSave}
				>
					{updateSettings.isPending ? (
						<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
					) : (
						<Save className="mr-2 h-3.5 w-3.5" />
					)}
					Save Settings
				</Button>
			</div>
		</div>
	);
}
