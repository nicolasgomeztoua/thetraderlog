"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { StrategyFormData } from "@/components/strategy";
import { StrategyForm } from "@/components/strategy";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export default function NewStrategyPage() {
	const router = useRouter();
	const utils = api.useUtils();

	const createMutation = api.strategies.create.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy created");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create strategy");
		},
	});

	const handleSubmit = (data: StrategyFormData) => {
		createMutation.mutate({
			name: data.name,
			description: data.description || undefined,
			color: data.color,
			entryCriteria: data.entryCriteria || undefined,
			exitRules: data.exitRules || undefined,
			riskParameters: data.riskParameters ?? undefined,
			scalingRules: data.scalingRules ?? undefined,
			trailingRules: data.trailingRules ?? undefined,
			isActive: data.isActive,
			rules: data.rules,
		});
	};

	return (
		<div className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-8 sm:py-6">
			{/* Header */}
			<div className="flex items-center gap-2 sm:gap-3">
				<Button
					asChild
					className="min-h-[44px] min-w-[44px] shrink-0 sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
					size="icon"
					variant="ghost"
				>
					<Link href="/strategies">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div className="min-w-0">
					<h1 className="font-bold text-lg tracking-tight sm:text-2xl">
						New Strategy
					</h1>
					<p className="mt-1 hidden font-mono text-muted-foreground text-sm sm:block">
						Define your trading strategy with entry rules, risk management, and
						a checklist.
					</p>
				</div>
			</div>

			{/* Form */}
			<div className="rounded border border-white/5 bg-white/2 p-4 sm:p-6">
				<StrategyForm
					isSubmitting={createMutation.isPending}
					onSubmit={handleSubmit}
					submitLabel="Create Strategy"
				/>
			</div>
		</div>
	);
}
