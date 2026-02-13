"use client";

import { cn, formatCurrency } from "@/lib/shared";
import { useReportData } from "./provider";

interface DataTableProps {
	dataRef: string;
	caption?: string;
}

function isNumeric(value: unknown): value is number {
	return typeof value === "number" && !Number.isNaN(value);
}

function isPnLColumn(key: string): boolean {
	const pnlKeys = ["pnl", "profit", "loss", "p&l", "amount", "value"];
	return pnlKeys.some((k) => key.toLowerCase().includes(k));
}

export function DataTable({ dataRef, caption }: DataTableProps) {
	const rawData = useReportData(dataRef);

	if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
		return (
			<p className="my-2 font-mono text-muted-foreground text-xs">
				[Table: data not available]
			</p>
		);
	}

	const data = rawData as Record<string, unknown>[];
	const firstRow = data[0] ?? {};
	const columns = Object.keys(firstRow);

	return (
		<div
			className="my-4 overflow-x-auto rounded border border-white/5"
			data-testid="mdx-data-table"
		>
			{caption && (
				<div className="border-white/5 border-b bg-white/[0.02] px-3 py-1.5">
					<p className="font-mono text-[10px] text-muted-foreground uppercase">
						{caption}
					</p>
				</div>
			)}
			<table className="w-full">
				<thead>
					<tr className="border-white/5 border-b">
						{columns.map((col) => (
							<th
								className={cn(
									"px-3 py-1.5 font-medium font-mono text-[10px] text-muted-foreground uppercase",
									isNumeric(firstRow[col]) && "text-right",
								)}
								key={col}
							>
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.map((row, i) => (
						<tr
							className="border-white/[0.03] border-b last:border-0"
							key={`row-${columns.map((c) => String(row[c])).join("-")}-${i}`}
						>
							{columns.map((col) => {
								const value = row[col];
								const numeric = isNumeric(value);
								const pnlCol = isPnLColumn(col);

								return (
									<td
										className={cn(
											"px-3 py-1.5 font-mono text-xs",
											numeric && "text-right tabular-nums",
											pnlCol &&
												numeric &&
												(value > 0
													? "text-[#00ff88]"
													: value < 0
														? "text-[#ff3b3b]"
														: "text-muted-foreground"),
										)}
										key={col}
									>
										{pnlCol && numeric
											? formatCurrency(value)
											: numeric
												? value.toLocaleString()
												: String(value ?? "")}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
