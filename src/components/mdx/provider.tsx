"use client";

import { createContext, useContext } from "react";

type DataArtifacts = Record<string, unknown>;

const ReportDataContext = createContext<DataArtifacts>({});

export function ReportDataProvider({
	data,
	children,
}: {
	data: DataArtifacts;
	children: React.ReactNode;
}) {
	return (
		<ReportDataContext.Provider value={data}>
			{children}
		</ReportDataContext.Provider>
	);
}

export function useReportData(refId: string): unknown | undefined {
	const data = useContext(ReportDataContext);
	return data[refId];
}
