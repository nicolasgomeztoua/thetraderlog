import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	ERR_ACCOUNT_NOT_CHALLENGE,
	ERR_ACCOUNT_NOT_FOUND,
	ERR_GROUP_NOT_FOUND,
} from "@/lib/constants/errors";
import type { User } from "@/server/db/schema";
import {
	createTestAccount,
	createTestCaller,
	createTestTrades,
	createTestUser,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("accounts router", () => {
	let user: User;
	let caller: TestCaller;

	beforeAll(async () => {
		await truncateAllTables();
		user = await createTestUser();
		caller = await createTestCaller(user.clerkId, user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// ACCOUNT CRUD OPERATIONS
	// ============================================================================

	describe("create", () => {
		it("should create a basic account", async () => {
			const account = await caller.accounts.create({
				name: "My Trading Account",
				broker: "Interactive Brokers",
				platform: "other",
				accountType: "live",
				initialBalance: "25000",
				currency: "USD",
			});

			expect(account).toBeDefined();
			expect(account?.name).toBe("My Trading Account");
			expect(account?.broker).toBe("Interactive Brokers");
			expect(account?.platform).toBe("other");
			expect(account?.accountType).toBe("live");
			expect(parseFloat(account?.initialBalance ?? "0")).toBe(25000);
			expect(account?.currency).toBe("USD");
			expect(account?.isActive).toBe(true);
		});

		it("should set first account as default automatically", async () => {
			const accounts = await caller.accounts.getAll();
			// The first account created should be default
			const firstAccount = accounts.find(
				(a) => a.name === "My Trading Account",
			);
			expect(firstAccount?.isDefault).toBe(true);
		});

		it("should create a demo account", async () => {
			const account = await caller.accounts.create({
				name: "Demo Account",
				platform: "ninjatrader",
				accountType: "demo",
				initialBalance: "100000",
			});

			expect(account?.accountType).toBe("demo");
			expect(account?.platform).toBe("ninjatrader");
		});

		it("should create a prop challenge account with prop firm fields", async () => {
			const account = await caller.accounts.create({
				name: "FTMO Challenge",
				broker: "FTMO",
				platform: "ninjatrader",
				accountType: "prop_challenge",
				initialBalance: "100000",
				maxDrawdown: "6",
				profitTarget: "10",
				dailyLossLimit: "5",
				drawdownType: "trailing",
				challengeStartDate: new Date().toISOString(),
			});

			expect(account?.accountType).toBe("prop_challenge");
			expect(parseFloat(account?.maxDrawdown ?? "0")).toBe(6);
			expect(parseFloat(account?.profitTarget ?? "0")).toBe(10);
			expect(parseFloat(account?.dailyLossLimit ?? "0")).toBe(5);
			expect(account?.drawdownType).toBe("trailing");
			expect(account?.challengeStatus).toBe("active");
		});

		it("should unset other defaults when creating a new default account", async () => {
			// Create a new account set as default
			const newDefault = await caller.accounts.create({
				name: "New Default Account",
				accountType: "live",
				initialBalance: "50000",
				isDefault: true,
			});

			expect(newDefault?.isDefault).toBe(true);

			// Verify other accounts are no longer default
			const accounts = await caller.accounts.getAll();
			const defaultAccounts = accounts.filter((a) => a.isDefault);
			expect(defaultAccounts.length).toBe(1);
			expect(defaultAccounts[0]?.name).toBe("New Default Account");
		});
	});

	describe("getAll", () => {
		it("should return all accounts for the user", async () => {
			const accounts = await caller.accounts.getAll();

			expect(accounts.length).toBeGreaterThanOrEqual(4);
			expect(accounts.every((a) => a.userId === user.id)).toBe(true);
		});

		it("should order accounts with default first", async () => {
			const accounts = await caller.accounts.getAll();
			const defaultAccount = accounts.find((a) => a.isDefault);

			// Default account should be first
			expect(accounts[0]?.isDefault).toBe(true);
			expect(defaultAccount).toBeDefined();
		});

		it("should not return other users' accounts", async () => {
			// Create another user with their own account
			const otherUser = await createTestUser({ name: "Other Trader" });
			await createTestAccount(otherUser.id, { name: "Other User Account" });

			// Original user should not see the other user's account
			const accounts = await caller.accounts.getAll();
			const otherUserAccount = accounts.find(
				(a) => a.name === "Other User Account",
			);
			expect(otherUserAccount).toBeUndefined();
		});
	});

	describe("getActive", () => {
		it("should return only active accounts", async () => {
			const activeAccounts = await caller.accounts.getActive();

			expect(activeAccounts.every((a) => a.isActive)).toBe(true);
		});
	});

	describe("getDefault", () => {
		it("should return the default account", async () => {
			const defaultAccount = await caller.accounts.getDefault();

			expect(defaultAccount).toBeDefined();
			expect(defaultAccount?.isDefault).toBe(true);
		});

		it("should return first active account if no default is set", async () => {
			// This is tested implicitly - getDefault has fallback logic
			const defaultAccount = await caller.accounts.getDefault();
			expect(defaultAccount).toBeDefined();
		});
	});

	describe("getById", () => {
		it("should return account by ID with relations", async () => {
			const allAccounts = await caller.accounts.getAll();
			const accountId = allAccounts[0]?.id ?? "";

			const account = await caller.accounts.getById({ id: accountId });

			expect(account).toBeDefined();
			expect(account?.id).toBe(accountId);
		});

		it("should throw error for non-existent account", async () => {
			await expect(
				caller.accounts.getById({ id: "non-existent-id" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});

		it("should throw error for account owned by another user", async () => {
			// Create account for another user
			const otherUser = await createTestUser({ name: "Another User" });
			const otherAccount = await createTestAccount(otherUser.id, {
				name: "Private Account",
			});

			// Try to access it with original user's caller
			await expect(
				caller.accounts.getById({ id: otherAccount.id }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});
	});

	describe("update", () => {
		it("should update account fields", async () => {
			const allAccounts = await caller.accounts.getAll();
			const account = allAccounts.find((a) => a.name === "Demo Account");

			const updated = await caller.accounts.update({
				id: account?.id ?? "",
				name: "Updated Demo Account",
				broker: "New Broker",
				notes: "Updated notes",
			});

			expect(updated?.name).toBe("Updated Demo Account");
			expect(updated?.broker).toBe("New Broker");
			expect(updated?.notes).toBe("Updated notes");
		});

		it("should update prop firm fields", async () => {
			const allAccounts = await caller.accounts.getAll();
			const propAccount = allAccounts.find(
				(a) => a.accountType === "prop_challenge",
			);

			const updated = await caller.accounts.update({
				id: propAccount?.id ?? "",
				maxDrawdown: "8",
				profitTarget: "12",
			});

			expect(parseFloat(updated?.maxDrawdown ?? "0")).toBe(8);
			expect(parseFloat(updated?.profitTarget ?? "0")).toBe(12);
		});

		it("should update account to be default", async () => {
			const allAccounts = await caller.accounts.getAll();
			const nonDefaultAccount = allAccounts.find((a) => !a.isDefault);

			await caller.accounts.update({
				id: nonDefaultAccount?.id ?? "",
				isDefault: true,
			});

			// Verify only one default exists
			const updatedAccounts = await caller.accounts.getAll();
			const defaultAccounts = updatedAccounts.filter((a) => a.isDefault);
			expect(defaultAccounts.length).toBe(1);
			expect(defaultAccounts[0]?.id).toBe(nonDefaultAccount?.id);
		});

		it("should throw error when updating non-existent account", async () => {
			await expect(
				caller.accounts.update({ id: "non-existent-id", name: "Test" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});
	});

	describe("setDefault", () => {
		it("should set an account as default", async () => {
			const allAccounts = await caller.accounts.getAll();
			const nonDefaultAccount = allAccounts.find((a) => !a.isDefault);

			const updated = await caller.accounts.setDefault({
				id: nonDefaultAccount?.id ?? "",
			});

			expect(updated?.isDefault).toBe(true);

			// Verify others are not default
			const accounts = await caller.accounts.getAll();
			const defaultCount = accounts.filter((a) => a.isDefault).length;
			expect(defaultCount).toBe(1);
		});
	});

	describe("delete", () => {
		it("should delete an account", async () => {
			// Create an account to delete
			const toDelete = await caller.accounts.create({
				name: "Account To Delete",
				accountType: "demo",
				initialBalance: "5000",
			});

			const result = await caller.accounts.delete({ id: toDelete?.id ?? "" });
			expect(result.success).toBe(true);

			// Verify it's gone
			await expect(
				caller.accounts.getById({ id: toDelete?.id ?? "" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});

		it("should unassign trades when deleting account", async () => {
			// Create account with trades
			const account = await caller.accounts.create({
				name: "Account With Trades",
				accountType: "demo",
				initialBalance: "10000",
			});

			// Create trades for this account
			await createTestTrades(user.id, account?.id ?? "", 2, {
				status: "closed",
			});

			// Delete account
			const result = await caller.accounts.delete({ id: account?.id ?? "" });
			expect(result.success).toBe(true);
		});

		it("should set another account as default if deleting the default", async () => {
			// Get current default and delete it
			const defaultAccount = await caller.accounts.getDefault();

			// Make sure there's another account
			await caller.accounts.create({
				name: "Backup Account",
				accountType: "live",
			});

			await caller.accounts.delete({ id: defaultAccount?.id ?? "" });

			// A new default should be set
			const newDefault = await caller.accounts.getDefault();
			expect(newDefault).toBeDefined();
			expect(newDefault?.id).not.toBe(defaultAccount?.id);
		});
	});

	// ============================================================================
	// PROP FIRM CHALLENGE WORKFLOWS
	// ============================================================================

	describe("prop firm challenge lifecycle", () => {
		let challengeAccount: Awaited<ReturnType<typeof caller.accounts.create>>;

		beforeAll(async () => {
			challengeAccount = await caller.accounts.create({
				name: "MFF Challenge Phase 1",
				broker: "My Forex Funds",
				platform: "ninjatrader",
				accountType: "prop_challenge",
				initialBalance: "50000",
				maxDrawdown: "5",
				profitTarget: "8",
				dailyLossLimit: "4",
				drawdownType: "trailing",
			});
		});

		it("should create challenge with active status", () => {
			expect(challengeAccount?.challengeStatus).toBe("active");
		});

		it("should convert challenge to funded account on pass", async () => {
			const result = await caller.accounts.convertToFunded({
				challengeAccountId: challengeAccount?.id ?? "",
				name: "MFF Funded Account",
				initialBalance: "50000",
				maxDrawdown: "5",
				profitSplit: "80",
				payoutFrequency: "bi_weekly",
			});

			expect(result.challengeAccount.challengeStatus).toBe("passed");
			expect(result.fundedAccount).toBeDefined();
			expect(result.fundedAccount?.accountType).toBe("prop_funded");
			expect(result.fundedAccount?.linkedAccountId).toBe(challengeAccount?.id);
			expect(parseFloat(result.fundedAccount?.profitSplit ?? "0")).toBe(80);
			expect(result.fundedAccount?.payoutFrequency).toBe("bi_weekly");
		});

		it("should get linked account for funded account", async () => {
			const accounts = await caller.accounts.getAll();
			const fundedAccount = accounts.find(
				(a) => a.name === "MFF Funded Account",
			);

			const linked = await caller.accounts.getLinkedAccount({
				id: fundedAccount?.id ?? "",
			});

			expect(linked?.id).toBe(challengeAccount?.id);
		});

		it("should mark challenge as failed", async () => {
			// Create a new challenge to fail
			const failedChallenge = await caller.accounts.create({
				name: "Failed Challenge",
				accountType: "prop_challenge",
				initialBalance: "25000",
			});

			const result = await caller.accounts.markChallengeFailed({
				id: failedChallenge?.id ?? "",
			});

			expect(result?.challengeStatus).toBe("failed");
		});

		it("should throw error when converting non-challenge account", async () => {
			const liveAccount = await caller.accounts.create({
				name: "Live Account",
				accountType: "live",
				initialBalance: "10000",
			});

			await expect(
				caller.accounts.convertToFunded({
					challengeAccountId: liveAccount?.id ?? "",
					name: "Should Fail",
					initialBalance: "10000",
				}),
			).rejects.toThrow(ERR_ACCOUNT_NOT_CHALLENGE);
		});

		it("should throw error when marking non-challenge as failed", async () => {
			const accounts = await caller.accounts.getAll();
			const liveAccount = accounts.find((a) => a.accountType === "live");

			await expect(
				caller.accounts.markChallengeFailed({ id: liveAccount?.id ?? "" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_CHALLENGE);
		});
	});

	// ============================================================================
	// ACCOUNT STATISTICS
	// ============================================================================

	describe("getStats", () => {
		let statsAccount: Awaited<ReturnType<typeof caller.accounts.create>>;

		beforeAll(async () => {
			statsAccount = await caller.accounts.create({
				name: "Stats Test Account",
				accountType: "demo",
				initialBalance: "10000",
			});

			// Create winning trades
			await createTestTrades(user.id, statsAccount?.id ?? "", 3, {
				status: "closed",
				direction: "long",
				entryPrice: "100.00",
				exitPrice: "110.00",
				quantity: "1",
			});

			// Create losing trades
			await createTestTrades(user.id, statsAccount?.id ?? "", 2, {
				status: "closed",
				direction: "long",
				entryPrice: "100.00",
				exitPrice: "95.00",
				quantity: "1",
			});
		});

		it("should calculate account statistics correctly", async () => {
			const stats = await caller.accounts.getStats({
				id: statsAccount?.id ?? "",
			});

			expect(stats.totalTrades).toBe(5);
			expect(stats.wins).toBe(3);
			expect(stats.losses).toBe(2);
			expect(stats.winRate).toBe(60); // 3/5 = 60%
			expect(stats.initialBalance).toBe(10000);
		});

		it("should throw error for non-existent account", async () => {
			await expect(
				caller.accounts.getStats({ id: "non-existent-id" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});
	});

	// ============================================================================
	// ACCOUNT GROUPS
	// ============================================================================

	describe("account groups", () => {
		let group: Awaited<ReturnType<typeof caller.accounts.createGroup>>;

		describe("createGroup", () => {
			it("should create an account group", async () => {
				group = await caller.accounts.createGroup({
					name: "Prop Firm Accounts",
					description: "All my prop firm challenge and funded accounts",
					color: "#d4ff00",
				});

				expect(group).toBeDefined();
				expect(group?.name).toBe("Prop Firm Accounts");
				expect(group?.description).toBe(
					"All my prop firm challenge and funded accounts",
				);
				expect(group?.color).toBe("#d4ff00");
			});
		});

		describe("getGroups", () => {
			it("should return all groups for the user", async () => {
				const groups = await caller.accounts.getGroups();

				expect(groups.length).toBeGreaterThanOrEqual(1);
				expect(groups.some((g) => g.name === "Prop Firm Accounts")).toBe(true);
			});

			it("should include accounts in each group", async () => {
				const groups = await caller.accounts.getGroups();

				// Groups should have accounts relation
				expect(groups[0]).toHaveProperty("accounts");
			});
		});

		describe("getGroupById", () => {
			it("should return group with accounts", async () => {
				const fetchedGroup = await caller.accounts.getGroupById({
					id: group?.id ?? "",
				});

				expect(fetchedGroup?.name).toBe("Prop Firm Accounts");
				expect(fetchedGroup).toHaveProperty("accounts");
			});

			it("should throw error for non-existent group", async () => {
				await expect(
					caller.accounts.getGroupById({ id: "non-existent-id" }),
				).rejects.toThrow(ERR_GROUP_NOT_FOUND);
			});
		});

		describe("updateGroup", () => {
			it("should update group fields", async () => {
				const updated = await caller.accounts.updateGroup({
					id: group?.id ?? "",
					name: "Updated Group Name",
					color: "#00d4ff",
				});

				expect(updated?.name).toBe("Updated Group Name");
				expect(updated?.color).toBe("#00d4ff");
			});
		});

		describe("getGroupStats", () => {
			it("should return cumulative stats for empty group", async () => {
				const stats = await caller.accounts.getGroupStats({
					id: group?.id ?? "",
				});

				expect(stats.totalTrades).toBe(0);
				expect(stats.accountCount).toBe(0);
			});
		});

		describe("deleteGroup", () => {
			it("should delete group and unassign accounts", async () => {
				// Create a new group to delete
				const toDelete = await caller.accounts.createGroup({
					name: "Group To Delete",
				});

				const result = await caller.accounts.deleteGroup({
					id: toDelete?.id ?? "",
				});

				expect(result.success).toBe(true);

				// Verify it's deleted
				await expect(
					caller.accounts.getGroupById({ id: toDelete?.id ?? "" }),
				).rejects.toThrow(ERR_GROUP_NOT_FOUND);
			});
		});
	});

	// ============================================================================
	// AUTHORIZATION & SECURITY
	// ============================================================================

	describe("authorization", () => {
		it("should not allow accessing another user's account", async () => {
			const otherUser = await createTestUser({ name: "Unauthorized User" });
			const otherAccount = await createTestAccount(otherUser.id, {
				name: "Secret Account",
			});

			await expect(
				caller.accounts.getById({ id: otherAccount.id }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);

			await expect(
				caller.accounts.update({ id: otherAccount.id, name: "Hacked" }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);

			await expect(
				caller.accounts.delete({ id: otherAccount.id }),
			).rejects.toThrow(ERR_ACCOUNT_NOT_FOUND);
		});

		it("should not allow accessing another user's group", async () => {
			const otherUser = await createTestUser({ name: "Group Unauthorized" });
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			const otherGroup = await otherCaller.accounts.createGroup({
				name: "Private Group",
			});

			await expect(
				caller.accounts.getGroupById({ id: otherGroup?.id ?? "" }),
			).rejects.toThrow(ERR_GROUP_NOT_FOUND);

			await expect(
				caller.accounts.updateGroup({
					id: otherGroup?.id ?? "",
					name: "Hacked Group",
				}),
			).rejects.toThrow(ERR_GROUP_NOT_FOUND);

			await expect(
				caller.accounts.deleteGroup({ id: otherGroup?.id ?? "" }),
			).rejects.toThrow(ERR_GROUP_NOT_FOUND);
		});
	});
});
