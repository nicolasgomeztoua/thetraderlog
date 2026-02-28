/**
 * Integration tests for admin bug report management endpoints.
 *
 * Tests:
 * - list returns bug reports with user info
 * - filter by status works
 * - updateStatus transitions correctly
 * - getById returns full details
 * - non-admin rejected
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_ADMIN_BUG_REPORT_NOT_FOUND,
	ERR_ADMIN_FORBIDDEN,
	ERR_ADMIN_INVALID_STATUS_TRANSITION,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestCaller,
	createTestUser,
	getTestDb,
	schema,
	type TestCaller,
	truncateAllTables,
} from "../utils";

describe("admin bug reports endpoints", () => {
	let adminCaller: TestCaller;
	let regularCaller: TestCaller;
	let adminUser: User;
	let regularUser: User;
	let bugReportIds: string[] = [];

	beforeAll(async () => {
		await truncateAllTables();

		adminUser = await createTestUser({
			role: "admin",
			email: "admin-bugs@test.local",
			name: "Admin Bug Tester",
		});
		adminCaller = await createTestCaller(adminUser.clerkId, adminUser);

		regularUser = await createTestUser({
			role: "user",
			email: "regular-bugs@test.local",
			name: "Regular Bug Reporter",
		});
		regularCaller = await createTestCaller(regularUser.clerkId, regularUser);

		// Seed bug reports with different statuses, categories, severities
		const db = getTestDb();
		const inserted = await db
			.insert(schema.bugReports)
			.values([
				{
					userId: regularUser.id,
					title: "UI button broken",
					description: "The submit button does not work on the trade form",
					severity: "high",
					category: "ui",
					status: "open",
					pageUrl: "/journal",
					userAgent: "Mozilla/5.0 Test",
				},
				{
					userId: regularUser.id,
					title: "Data not loading",
					description: "Analytics page shows empty data",
					severity: "critical",
					category: "data",
					status: "open",
				},
				{
					userId: adminUser.id,
					title: "Slow dashboard",
					description: "Dashboard takes 10s to load",
					severity: "medium",
					category: "performance",
					status: "in_progress",
				},
				{
					userId: regularUser.id,
					title: "Fixed crash",
					description: "App crashed on trade delete",
					severity: "critical",
					category: "crash",
					status: "resolved",
				},
				{
					userId: adminUser.id,
					title: "Old issue",
					description: "Minor styling issue that was closed",
					severity: "low",
					category: "other",
					status: "closed",
				},
			])
			.returning();

		bugReportIds = inserted.map((r) => r.id);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	describe("admin.bugReports.list", () => {
		it("should return bug reports with user info", async () => {
			const result = await adminCaller.admin.bugReports.list({
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(5);
			expect(result.total).toBe(5);
			expect(result.page).toBe(1);
			expect(result.totalPages).toBe(1);

			// Each item should have user info
			for (const item of result.items) {
				expect(item.user).toBeDefined();
				expect(item.user.id).toBeDefined();
				expect(item.user.name).toBeDefined();
				expect(item.user.email).toBeDefined();
			}
		});

		it("should sort by newest first", async () => {
			const result = await adminCaller.admin.bugReports.list({
				page: 1,
				pageSize: 10,
			});

			// Verify descending order by createdAt
			for (let i = 0; i < result.items.length - 1; i++) {
				const current = new Date(result.items[i]?.createdAt ?? 0).getTime();
				const next = new Date(result.items[i + 1]?.createdAt ?? 0).getTime();
				expect(current).toBeGreaterThanOrEqual(next);
			}
		});

		it("should filter by status", async () => {
			const openResult = await adminCaller.admin.bugReports.list({
				status: "open",
				page: 1,
				pageSize: 10,
			});

			expect(openResult.items.length).toBe(2);
			expect(openResult.total).toBe(2);
			for (const item of openResult.items) {
				expect(item.status).toBe("open");
			}
		});

		it("should filter by category", async () => {
			const uiResult = await adminCaller.admin.bugReports.list({
				category: "ui",
				page: 1,
				pageSize: 10,
			});

			expect(uiResult.items.length).toBe(1);
			expect(uiResult.items[0]?.category).toBe("ui");
		});

		it("should filter by severity", async () => {
			const criticalResult = await adminCaller.admin.bugReports.list({
				severity: "critical",
				page: 1,
				pageSize: 10,
			});

			expect(criticalResult.items.length).toBe(2);
			for (const item of criticalResult.items) {
				expect(item.severity).toBe("critical");
			}
		});

		it("should support pagination", async () => {
			const page1 = await adminCaller.admin.bugReports.list({
				page: 1,
				pageSize: 2,
			});

			expect(page1.items.length).toBe(2);
			expect(page1.total).toBe(5);
			expect(page1.totalPages).toBe(3);

			const page2 = await adminCaller.admin.bugReports.list({
				page: 2,
				pageSize: 2,
			});

			expect(page2.items.length).toBe(2);
			expect(page2.page).toBe(2);

			// Items on different pages should be different
			const page1Ids = page1.items.map((i) => i.id);
			const page2Ids = page2.items.map((i) => i.id);
			for (const id of page2Ids) {
				expect(page1Ids).not.toContain(id);
			}
		});

		it("should combine filters", async () => {
			const result = await adminCaller.admin.bugReports.list({
				status: "open",
				severity: "critical",
				page: 1,
				pageSize: 10,
			});

			expect(result.items.length).toBe(1);
			expect(result.items[0]?.title).toBe("Data not loading");
		});
	});

	describe("admin.bugReports.getById", () => {
		it("should return full bug report details with user info", async () => {
			const reportId = bugReportIds[0] ?? "";
			const report = await adminCaller.admin.bugReports.getById({
				id: reportId,
			});

			expect(report.id).toBe(reportId);
			expect(report.title).toBe("UI button broken");
			expect(report.description).toBe(
				"The submit button does not work on the trade form",
			);
			expect(report.severity).toBe("high");
			expect(report.category).toBe("ui");
			expect(report.status).toBe("open");
			expect(report.pageUrl).toBe("/journal");
			expect(report.userAgent).toBe("Mozilla/5.0 Test");
			expect(report.createdAt).toBeDefined();

			// User info
			expect(report.user.id).toBe(regularUser.id);
			expect(report.user.name).toBe("Regular Bug Reporter");
			expect(report.user.email).toBe("regular-bugs@test.local");
		});

		it("should throw NOT_FOUND for non-existent bug report", async () => {
			await expect(
				adminCaller.admin.bugReports.getById({ id: "nonexistent-id" }),
			).rejects.toThrow(ERR_ADMIN_BUG_REPORT_NOT_FOUND);
		});
	});

	describe("admin.bugReports.updateStatus", () => {
		it("should transition open → in_progress", async () => {
			const reportId = bugReportIds[0] ?? "";
			const updated = await adminCaller.admin.bugReports.updateStatus({
				id: reportId,
				status: "in_progress",
			});

			expect(updated?.status).toBe("in_progress");
		});

		it("should transition in_progress → resolved", async () => {
			const reportId = bugReportIds[0] ?? "";
			const updated = await adminCaller.admin.bugReports.updateStatus({
				id: reportId,
				status: "resolved",
			});

			expect(updated?.status).toBe("resolved");
		});

		it("should transition resolved → closed", async () => {
			const reportId = bugReportIds[0] ?? "";
			const updated = await adminCaller.admin.bugReports.updateStatus({
				id: reportId,
				status: "closed",
			});

			expect(updated?.status).toBe("closed");
		});

		it("should allow reopening a closed report", async () => {
			const reportId = bugReportIds[0] ?? "";
			const updated = await adminCaller.admin.bugReports.updateStatus({
				id: reportId,
				status: "open",
			});

			expect(updated?.status).toBe("open");
		});

		it("should reject invalid status transition (open → resolved)", async () => {
			// Report is now "open" again after reopen
			const reportId = bugReportIds[0] ?? "";
			await expect(
				adminCaller.admin.bugReports.updateStatus({
					id: reportId,
					status: "resolved",
				}),
			).rejects.toThrow(ERR_ADMIN_INVALID_STATUS_TRANSITION);
		});

		it("should throw NOT_FOUND for non-existent bug report", async () => {
			await expect(
				adminCaller.admin.bugReports.updateStatus({
					id: "nonexistent-id",
					status: "in_progress",
				}),
			).rejects.toThrow(ERR_ADMIN_BUG_REPORT_NOT_FOUND);
		});
	});

	describe("admin authorization", () => {
		it("should reject non-admin on bugReports.list", async () => {
			await expect(
				regularCaller.admin.bugReports.list({ page: 1, pageSize: 10 }),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on bugReports.getById", async () => {
			await expect(
				regularCaller.admin.bugReports.getById({
					id: bugReportIds[0] ?? "",
				}),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});

		it("should reject non-admin on bugReports.updateStatus", async () => {
			await expect(
				regularCaller.admin.bugReports.updateStatus({
					id: bugReportIds[0] ?? "",
					status: "in_progress",
				}),
			).rejects.toThrow(ERR_ADMIN_FORBIDDEN);
		});
	});
});
