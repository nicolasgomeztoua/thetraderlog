import {
	defaultShouldDehydrateQuery,
	QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";
import { STALE_TIME_SHORT } from "@/lib/shared";

export const createQueryClient = () =>
	new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: STALE_TIME_SHORT,
				// Single-user app - no one else modifies your data
				refetchOnWindowFocus: false,
			},
			dehydrate: {
				serializeData: SuperJSON.serialize,
				shouldDehydrateQuery: (query) =>
					defaultShouldDehydrateQuery(query) ||
					query.state.status === "pending",
			},
			hydrate: {
				deserializeData: SuperJSON.deserialize,
			},
		},
	});
