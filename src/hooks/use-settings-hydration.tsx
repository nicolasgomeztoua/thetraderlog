"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { api } from "@/trpc/react";

/**
 * Hook that hydrates the settings store from tRPC.
 * Should be called once in a top-level component (e.g., protected layout).
 * Uses a ref to prevent re-hydration on re-renders.
 */
export function useSettingsHydration() {
	const { data: settings, isLoading, isSuccess } = api.settings.get.useQuery();
	const hydrate = useSettingsStore((state) => state.hydrate);
	const hasHydratedRef = useRef(false);

	useEffect(() => {
		// Only hydrate once when settings are successfully loaded
		if (isSuccess && settings && !hasHydratedRef.current) {
			hydrate({
				timezone: settings.timezone,
				currency: settings.currency,
				breakevenThreshold: settings.breakevenThreshold,
				tradingSessions: settings.tradingSessions,
				theme: settings.theme,
			});
			hasHydratedRef.current = true;
		}
	}, [isSuccess, settings, hydrate]);

	return { isLoading, isHydrated: hasHydratedRef.current };
}

/**
 * Client component that hydrates settings on mount.
 * Use this in the layout to ensure settings are loaded app-wide.
 */
export function SettingsHydration({ children }: { children: React.ReactNode }) {
	useSettingsHydration();
	return <>{children}</>;
}
