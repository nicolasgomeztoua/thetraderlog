"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import type { StrategyFormData } from "@/components/strategy";
import { StrategyForm } from "@/components/strategy";
import { Button } from "@/components/ui/button";
import { FEATURE_CUSTOM_STRATEGIES } from "@/lib/constants/billing";
import { ERR_STRATEGY_CREATE_FAILED } from "@/lib/constants/errors";
import { getErrorMessage } from "@/lib/shared/utils";
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
			toast.error(getErrorMessage(error, ERR_STRATEGY_CREATE_FAILED));
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
		<UpgradePrompt feature={FEATURE_CUSTOM_STRATEGIES}>
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
							Define your trading strategy with entry rules, risk management,
							and a checklist.
						</p>
					</div>
				</div>

				{/* Form */}
				<section>
					<h2 className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
						→ New Strategy
					</h2>
					<div className="overflow-hidden rounded border border-border">
						{/* Terminal window chrome header */}
						<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
							<div className="flex items-center gap-1 sm:gap-1.5">
								<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
								<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
								<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
							</div>
							<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
								strategy-form.new
							</span>
							<div className="w-10 sm:w-14" />
						</div>
						<div className="p-4 sm:p-6">
							<StrategyForm
								isSubmitting={createMutation.isPending}
								onSubmit={handleSubmit}
								submitLabel="Create Strategy"
							/>
						</div>
					</div>
				</section>
			</div>
		</UpgradePrompt>
	);
}
