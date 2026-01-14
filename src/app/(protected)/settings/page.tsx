import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsContent } from "./_components/settings-content";

function SettingsLoading() {
	return (
		<div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
			<div>
				<Skeleton className="h-7 w-32 sm:h-9" />
				<Skeleton className="mt-2 hidden h-5 w-64 sm:block" />
			</div>
			<Skeleton className="h-10 w-full sm:h-12" />
			<Skeleton className="h-[300px] w-full sm:h-[400px]" />
		</div>
	);
}

export default function SettingsPage() {
	return (
		<Suspense fallback={<SettingsLoading />}>
			<SettingsContent />
		</Suspense>
	);
}
