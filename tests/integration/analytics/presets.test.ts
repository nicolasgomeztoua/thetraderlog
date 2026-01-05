import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	createTestCaller,
	setupTrader,
	type TestCaller,
	truncateAllTables,
} from "../../utils";

describe("Analytics Filter Presets", () => {
	let caller: TestCaller;
	let testData: Awaited<ReturnType<typeof setupTrader>>;

	beforeAll(async () => {
		await truncateAllTables();
		testData = await setupTrader();
		caller = await createTestCaller(testData.user.clerkId, testData.user);
	});

	afterAll(async () => {
		await truncateAllTables();
	});

	// ============================================================================
	// CREATE FILTER PRESET
	// ============================================================================

	describe("createFilterPreset", () => {
		it("should create a new preset with required fields", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "ES Winners",
				filters: JSON.stringify({ symbols: ["ES"], outcome: "win" }),
			});

			expect(result).toBeDefined();
			expect(result).toHaveProperty("id");
			expect(result?.name).toBe("ES Winners");
			expect(result?.filters).toBe(
				JSON.stringify({ symbols: ["ES"], outcome: "win" }),
			);
			expect(result?.userId).toBe(testData.user.id);
		});

		it("should create preset with description", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "Monday Trades",
				description: "All trades taken on Mondays",
				filters: JSON.stringify({ daysOfWeek: [1] }),
			});

			expect(result?.name).toBe("Monday Trades");
			expect(result?.description).toBe("All trades taken on Mondays");
		});

		it("should create preset with isDefault flag set to true", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "Default Preset",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			expect(result?.isDefault).toBe(true);
		});

		it("should create preset with isDefault flag set to false by default", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "Non-Default Preset",
				filters: JSON.stringify({ symbols: ["NQ"] }),
			});

			expect(result?.isDefault).toBe(false);
		});

		it("should clear previous default when creating new default preset", async () => {
			// Create first default preset
			const first = await caller.analytics.createFilterPreset({
				name: "First Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});
			expect(first?.isDefault).toBe(true);

			// Create second default preset
			const second = await caller.analytics.createFilterPreset({
				name: "Second Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});
			expect(second?.isDefault).toBe(true);

			// Check that first is no longer default
			const presets = await caller.analytics.getFilterPresets();
			const firstUpdated = presets.find((p) => p.id === first?.id);
			expect(firstUpdated?.isDefault).toBe(false);
		});

		it("should store complex filter objects correctly", async () => {
			const complexFilters = {
				symbols: ["ES", "NQ"],
				outcome: "win",
				dateRange: {
					from: "2024-01-01",
					to: "2024-12-31",
				},
				direction: "long",
				minPnl: 100,
				maxPnl: 5000,
			};

			const result = await caller.analytics.createFilterPreset({
				name: "Complex Filters",
				filters: JSON.stringify(complexFilters),
			});

			expect(result?.filters).toBe(JSON.stringify(complexFilters));

			// Verify we can parse it back
			const parsedFilters = JSON.parse(result?.filters ?? "{}");
			expect(parsedFilters.symbols).toEqual(["ES", "NQ"]);
			expect(parsedFilters.outcome).toBe("win");
		});

		it("should handle empty filter object", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "Empty Filters",
				filters: JSON.stringify({}),
			});

			expect(result?.filters).toBe("{}");
		});

		it("should set createdAt timestamp", async () => {
			const before = new Date();
			const result = await caller.analytics.createFilterPreset({
				name: "Timestamp Test",
				filters: JSON.stringify({}),
			});
			const after = new Date();

			expect(result?.createdAt).toBeDefined();
			const createdAt = new Date(result?.createdAt ?? "");
			expect(createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	// ============================================================================
	// GET FILTER PRESETS
	// ============================================================================

	describe("getFilterPresets", () => {
		let freshCaller: TestCaller;
		let freshUserData: Awaited<ReturnType<typeof setupTrader>>;

		beforeAll(async () => {
			freshUserData = await setupTrader();
			freshCaller = await createTestCaller(
				freshUserData.user.clerkId,
				freshUserData.user,
			);
		});

		it("should return empty array when user has no presets", async () => {
			const result = await freshCaller.analytics.getFilterPresets();

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBe(0);
		});

		it("should return all presets for user", async () => {
			// Create some presets
			await freshCaller.analytics.createFilterPreset({
				name: "Preset A",
				filters: JSON.stringify({}),
			});
			await freshCaller.analytics.createFilterPreset({
				name: "Preset B",
				filters: JSON.stringify({}),
			});
			await freshCaller.analytics.createFilterPreset({
				name: "Preset C",
				filters: JSON.stringify({}),
			});

			const result = await freshCaller.analytics.getFilterPresets();

			expect(result.length).toBe(3);
		});

		it("should return presets with correct fields", async () => {
			const result = await freshCaller.analytics.getFilterPresets();

			if (result.length > 0) {
				expect(result[0]).toHaveProperty("id");
				expect(result[0]).toHaveProperty("name");
				expect(result[0]).toHaveProperty("filters");
				expect(result[0]).toHaveProperty("isDefault");
				expect(result[0]).toHaveProperty("userId");
				expect(result[0]).toHaveProperty("createdAt");
			}
		});

		it("should order default preset first", async () => {
			// Create a non-default preset first
			const nonDefault = await freshCaller.analytics.createFilterPreset({
				name: "Non-Default First",
				filters: JSON.stringify({}),
				isDefault: false,
			});

			// Create a default preset
			const defaultPreset = await freshCaller.analytics.createFilterPreset({
				name: "The Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			const result = await freshCaller.analytics.getFilterPresets();

			// Default should be first
			expect(result[0]?.id).toBe(defaultPreset?.id);
		});

		it("should only return presets owned by the user", async () => {
			// Create preset for first user
			await freshCaller.analytics.createFilterPreset({
				name: "Fresh User Preset",
				filters: JSON.stringify({}),
			});

			// Get presets for original test user (should not see freshUser's presets)
			const originalUserPresets = await caller.analytics.getFilterPresets();
			const foundFreshUserPreset = originalUserPresets.find(
				(p) => p.name === "Fresh User Preset",
			);

			expect(foundFreshUserPreset).toBeUndefined();
		});
	});

	// ============================================================================
	// GET DEFAULT PRESET
	// ============================================================================

	describe("getDefaultPreset", () => {
		it("should return null when no default preset exists", async () => {
			// Create user with no presets
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			const result = await newCaller.analytics.getDefaultPreset();

			expect(result).toBeNull();
		});

		it("should return null when user has presets but none is default", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			// Create non-default presets
			await newCaller.analytics.createFilterPreset({
				name: "Non-Default 1",
				filters: JSON.stringify({}),
				isDefault: false,
			});
			await newCaller.analytics.createFilterPreset({
				name: "Non-Default 2",
				filters: JSON.stringify({}),
				isDefault: false,
			});

			const result = await newCaller.analytics.getDefaultPreset();

			expect(result).toBeNull();
		});

		it("should return the default preset when one exists", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			// Create a default preset
			const created = await newCaller.analytics.createFilterPreset({
				name: "My Default",
				description: "This is the default",
				filters: JSON.stringify({ symbols: ["ES"] }),
				isDefault: true,
			});

			const result = await newCaller.analytics.getDefaultPreset();

			expect(result).not.toBeNull();
			expect(result?.id).toBe(created?.id);
			expect(result?.name).toBe("My Default");
			expect(result?.isDefault).toBe(true);
		});

		it("should return only the current user's default preset", async () => {
			// Create default preset for main test user
			const mainDefault = await caller.analytics.createFilterPreset({
				name: "Main User Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			// Create another user with their own default
			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);
			await otherCaller.analytics.createFilterPreset({
				name: "Other User Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			// Each user should only see their own default
			const mainResult = await caller.analytics.getDefaultPreset();
			const otherResult = await otherCaller.analytics.getDefaultPreset();

			expect(mainResult?.name).toBe("Main User Default");
			expect(otherResult?.name).toBe("Other User Default");
		});
	});

	// ============================================================================
	// UPDATE FILTER PRESET
	// ============================================================================

	describe("updateFilterPreset", () => {
		it("should update preset name", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Original Name",
				filters: JSON.stringify({}),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				name: "Updated Name",
			});

			expect(updated?.name).toBe("Updated Name");
			expect(updated?.id).toBe(created?.id);
		});

		it("should update preset description", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Test Description Update",
				description: "Original description",
				filters: JSON.stringify({}),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				description: "New description",
			});

			expect(updated?.description).toBe("New description");
		});

		it("should update preset description to null", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Test Null Description",
				description: "Will be removed",
				filters: JSON.stringify({}),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				description: null,
			});

			expect(updated?.description).toBeNull();
		});

		it("should update preset filters", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Test Filters Update",
				filters: JSON.stringify({ symbols: ["ES"] }),
			});

			const newFilters = JSON.stringify({
				symbols: ["NQ", "ES"],
				outcome: "loss",
			});
			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				filters: newFilters,
			});

			expect(updated?.filters).toBe(newFilters);
		});

		it("should update multiple fields at once", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Multi Update Test",
				description: "Original",
				filters: JSON.stringify({ symbols: ["ES"] }),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				name: "New Multi Name",
				description: "New description",
				filters: JSON.stringify({ symbols: ["NQ"] }),
			});

			expect(updated?.name).toBe("New Multi Name");
			expect(updated?.description).toBe("New description");
			expect(updated?.filters).toBe(JSON.stringify({ symbols: ["NQ"] }));
		});

		it("should return unchanged preset when no updates provided", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "No Changes Test",
				description: "Should stay the same",
				filters: JSON.stringify({ symbols: ["ES"] }),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
			});

			expect(updated?.name).toBe(created?.name);
			expect(updated?.description).toBe(created?.description);
			expect(updated?.filters).toBe(created?.filters);
		});

		it("should throw error for non-existent preset", async () => {
			await expect(
				caller.analytics.updateFilterPreset({
					id: "non-existent-id",
					name: "Should Fail",
				}),
			).rejects.toThrow();
		});

		it("should not allow updating another user's preset", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Protected Preset",
				filters: JSON.stringify({}),
			});

			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			await expect(
				otherCaller.analytics.updateFilterPreset({
					id: created?.id ?? "",
					name: "Hacked Name",
				}),
			).rejects.toThrow("Preset not found or access denied");
		});

		it("should preserve fields not being updated", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Preserve Fields Test",
				description: "Original description",
				filters: JSON.stringify({ symbols: ["ES"] }),
			});

			// Only update name
			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				name: "New Name Only",
			});

			expect(updated?.name).toBe("New Name Only");
			expect(updated?.description).toBe("Original description");
			expect(updated?.filters).toBe(JSON.stringify({ symbols: ["ES"] }));
		});
	});

	// ============================================================================
	// DELETE FILTER PRESET
	// ============================================================================

	describe("deleteFilterPreset", () => {
		it("should delete a preset successfully", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "To Be Deleted",
				filters: JSON.stringify({}),
			});

			const result = await caller.analytics.deleteFilterPreset({
				id: created?.id ?? "",
			});

			expect(result).toEqual({ success: true });

			// Verify it's gone
			const presets = await caller.analytics.getFilterPresets();
			const found = presets.find((p) => p.id === created?.id);
			expect(found).toBeUndefined();
		});

		it("should throw error when deleting non-existent preset", async () => {
			await expect(
				caller.analytics.deleteFilterPreset({
					id: "non-existent-id",
				}),
			).rejects.toThrow("Preset not found or access denied");
		});

		it("should not allow deleting another user's preset", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Protected Delete Test",
				filters: JSON.stringify({}),
			});

			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			await expect(
				otherCaller.analytics.deleteFilterPreset({
					id: created?.id ?? "",
				}),
			).rejects.toThrow("Preset not found or access denied");

			// Verify it still exists for original user
			const presets = await caller.analytics.getFilterPresets();
			const stillExists = presets.find((p) => p.id === created?.id);
			expect(stillExists).toBeDefined();
		});

		it("should allow deleting a default preset", async () => {
			const defaultPreset = await caller.analytics.createFilterPreset({
				name: "Default To Delete",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			const result = await caller.analytics.deleteFilterPreset({
				id: defaultPreset?.id ?? "",
			});

			expect(result).toEqual({ success: true });

			// Verify deletion
			const presets = await caller.analytics.getFilterPresets();
			const found = presets.find((p) => p.id === defaultPreset?.id);
			expect(found).toBeUndefined();
		});
	});

	// ============================================================================
	// SET DEFAULT PRESET
	// ============================================================================

	describe("setDefaultPreset", () => {
		it("should set a preset as default", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			const created = await newCaller.analytics.createFilterPreset({
				name: "To Be Default",
				filters: JSON.stringify({}),
				isDefault: false,
			});

			const result = await newCaller.analytics.setDefaultPreset({
				id: created?.id ?? "",
			});

			expect(result?.isDefault).toBe(true);
			expect(result?.id).toBe(created?.id);

			// Verify via getDefaultPreset
			const defaultPreset = await newCaller.analytics.getDefaultPreset();
			expect(defaultPreset?.id).toBe(created?.id);
		});

		it("should clear previous default when setting new default", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			// Create first default
			const first = await newCaller.analytics.createFilterPreset({
				name: "First Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			// Create second preset (not default)
			const second = await newCaller.analytics.createFilterPreset({
				name: "Second Preset",
				filters: JSON.stringify({}),
				isDefault: false,
			});

			// Set second as default
			await newCaller.analytics.setDefaultPreset({ id: second?.id ?? "" });

			// Verify first is no longer default
			const presets = await newCaller.analytics.getFilterPresets();
			const firstUpdated = presets.find((p) => p.id === first?.id);
			const secondUpdated = presets.find((p) => p.id === second?.id);

			expect(firstUpdated?.isDefault).toBe(false);
			expect(secondUpdated?.isDefault).toBe(true);
		});

		it("should clear default when passing null id", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			// Create a default preset
			await newCaller.analytics.createFilterPreset({
				name: "Will Be Cleared",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			// Clear the default
			const result = await newCaller.analytics.setDefaultPreset({ id: null });

			expect(result).toBeNull();

			// Verify no default exists
			const defaultPreset = await newCaller.analytics.getDefaultPreset();
			expect(defaultPreset).toBeNull();
		});

		it("should throw error for non-existent preset", async () => {
			await expect(
				caller.analytics.setDefaultPreset({
					id: "non-existent-preset-id",
				}),
			).rejects.toThrow("Preset not found or access denied");
		});

		it("should not allow setting another user's preset as default", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Other Users Preset",
				filters: JSON.stringify({}),
			});

			const { user: otherUser } = await setupTrader();
			const otherCaller = await createTestCaller(otherUser.clerkId, otherUser);

			await expect(
				otherCaller.analytics.setDefaultPreset({
					id: created?.id ?? "",
				}),
			).rejects.toThrow("Preset not found or access denied");
		});

		it("should handle setting already-default preset as default", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			const created = await newCaller.analytics.createFilterPreset({
				name: "Already Default",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			// Set it as default again - should not throw
			const result = await newCaller.analytics.setDefaultPreset({
				id: created?.id ?? "",
			});

			expect(result?.isDefault).toBe(true);
			expect(result?.id).toBe(created?.id);
		});
	});

	// ============================================================================
	// AUTHORIZATION & ISOLATION
	// ============================================================================

	describe("Authorization and User Isolation", () => {
		it("should completely isolate presets between users", async () => {
			// Setup two users
			const { user: userA } = await setupTrader();
			const { user: userB } = await setupTrader();
			const callerA = await createTestCaller(userA.clerkId, userA);
			const callerB = await createTestCaller(userB.clerkId, userB);

			// User A creates presets
			await callerA.analytics.createFilterPreset({
				name: "User A Preset 1",
				filters: JSON.stringify({ symbols: ["ES"] }),
			});
			await callerA.analytics.createFilterPreset({
				name: "User A Preset 2",
				filters: JSON.stringify({ symbols: ["NQ"] }),
				isDefault: true,
			});

			// User B creates presets
			await callerB.analytics.createFilterPreset({
				name: "User B Preset 1",
				filters: JSON.stringify({ symbols: ["EURUSD"] }),
				isDefault: true,
			});

			// Verify isolation
			const presetsA = await callerA.analytics.getFilterPresets();
			const presetsB = await callerB.analytics.getFilterPresets();

			expect(presetsA.length).toBe(2);
			expect(presetsB.length).toBe(1);

			expect(presetsA.every((p) => p.userId === userA.id)).toBe(true);
			expect(presetsB.every((p) => p.userId === userB.id)).toBe(true);

			// Verify default presets are isolated
			const defaultA = await callerA.analytics.getDefaultPreset();
			const defaultB = await callerB.analytics.getDefaultPreset();

			expect(defaultA?.name).toBe("User A Preset 2");
			expect(defaultB?.name).toBe("User B Preset 1");
		});

		it("should prevent cross-user operations via direct ID access", async () => {
			const { user: userA } = await setupTrader();
			const { user: userB } = await setupTrader();
			const callerA = await createTestCaller(userA.clerkId, userA);
			const callerB = await createTestCaller(userB.clerkId, userB);

			// User A creates a preset
			const presetA = await callerA.analytics.createFilterPreset({
				name: "User A Secret Preset",
				filters: JSON.stringify({ secret: true }),
			});

			// User B tries to access User A's preset via ID

			// Update attempt
			await expect(
				callerB.analytics.updateFilterPreset({
					id: presetA?.id ?? "",
					name: "Hijacked",
				}),
			).rejects.toThrow();

			// Delete attempt
			await expect(
				callerB.analytics.deleteFilterPreset({
					id: presetA?.id ?? "",
				}),
			).rejects.toThrow();

			// Set default attempt
			await expect(
				callerB.analytics.setDefaultPreset({
					id: presetA?.id ?? "",
				}),
			).rejects.toThrow();

			// Verify User A's preset is unchanged
			const presetsA = await callerA.analytics.getFilterPresets();
			const stillExists = presetsA.find((p) => p.id === presetA?.id);
			expect(stillExists).toBeDefined();
			expect(stillExists?.name).toBe("User A Secret Preset");
		});
	});

	// ============================================================================
	// EDGE CASES & VALIDATION
	// ============================================================================

	describe("Edge Cases and Validation", () => {
		it("should handle preset with very long name (max 100 chars)", async () => {
			const longName = "A".repeat(100);
			const result = await caller.analytics.createFilterPreset({
				name: longName,
				filters: JSON.stringify({}),
			});

			expect(result?.name).toBe(longName);
			expect(result?.name.length).toBe(100);
		});

		it("should reject preset with name exceeding 100 chars", async () => {
			const tooLongName = "A".repeat(101);

			await expect(
				caller.analytics.createFilterPreset({
					name: tooLongName,
					filters: JSON.stringify({}),
				}),
			).rejects.toThrow();
		});

		it("should reject preset with empty name", async () => {
			await expect(
				caller.analytics.createFilterPreset({
					name: "",
					filters: JSON.stringify({}),
				}),
			).rejects.toThrow();
		});

		it("should handle preset with very long description (max 500 chars)", async () => {
			const longDesc = "B".repeat(500);
			const result = await caller.analytics.createFilterPreset({
				name: "Long Desc Test",
				description: longDesc,
				filters: JSON.stringify({}),
			});

			expect(result?.description).toBe(longDesc);
			expect(result?.description?.length).toBe(500);
		});

		it("should reject preset with description exceeding 500 chars", async () => {
			const tooLongDesc = "B".repeat(501);

			await expect(
				caller.analytics.createFilterPreset({
					name: "Too Long Desc",
					description: tooLongDesc,
					filters: JSON.stringify({}),
				}),
			).rejects.toThrow();
		});

		it("should handle special characters in preset name", async () => {
			const specialName = "Test Preset - ES & NQ (2024) [Winners] @!#$%";
			const result = await caller.analytics.createFilterPreset({
				name: specialName,
				filters: JSON.stringify({}),
			});

			expect(result?.name).toBe(specialName);
		});

		it("should handle unicode characters in preset name", async () => {
			const unicodeName = "Trades Gagnants - Mon Preset Favori";
			const result = await caller.analytics.createFilterPreset({
				name: unicodeName,
				filters: JSON.stringify({}),
			});

			expect(result?.name).toBe(unicodeName);
		});

		it("should handle large complex filter objects", async () => {
			const largeFilters = {
				symbols: Array.from({ length: 50 }, (_, i) => `SYMBOL${i}`),
				dateRange: {
					from: "2020-01-01",
					to: "2024-12-31",
				},
				accounts: Array.from({ length: 10 }, (_, i) => `account-${i}`),
				directions: ["long", "short"],
				outcomes: ["win", "loss", "breakeven"],
				minPnl: -100000,
				maxPnl: 100000,
				tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
			};

			const result = await caller.analytics.createFilterPreset({
				name: "Large Filters",
				filters: JSON.stringify(largeFilters),
			});

			const parsedBack = JSON.parse(result?.filters ?? "{}");
			expect(parsedBack.symbols.length).toBe(50);
			expect(parsedBack.accounts.length).toBe(10);
		});
	});

	// ============================================================================
	// RETURN TYPE VERIFICATION
	// ============================================================================

	describe("Return Type Verification", () => {
		it("should return correct types for createFilterPreset", async () => {
			const result = await caller.analytics.createFilterPreset({
				name: "Type Check Create",
				description: "Test description",
				filters: JSON.stringify({ symbols: ["ES"] }),
				isDefault: false,
			});

			expect(typeof result?.id).toBe("string");
			expect(typeof result?.name).toBe("string");
			expect(typeof result?.filters).toBe("string");
			expect(typeof result?.isDefault).toBe("boolean");
			expect(typeof result?.userId).toBe("string");
			// description can be string or null
			expect(
				result?.description === null || typeof result?.description === "string",
			).toBe(true);
		});

		it("should return correct types for getFilterPresets", async () => {
			const results = await caller.analytics.getFilterPresets();

			expect(Array.isArray(results)).toBe(true);

			if (results.length > 0) {
				const preset = results[0];
				expect(typeof preset?.id).toBe("string");
				expect(typeof preset?.name).toBe("string");
				expect(typeof preset?.filters).toBe("string");
				expect(typeof preset?.isDefault).toBe("boolean");
				expect(typeof preset?.userId).toBe("string");
			}
		});

		it("should return correct types for getDefaultPreset", async () => {
			const { user: newUser } = await setupTrader();
			const newCaller = await createTestCaller(newUser.clerkId, newUser);

			// Test null case
			const nullResult = await newCaller.analytics.getDefaultPreset();
			expect(nullResult).toBeNull();

			// Create default and test non-null case
			await newCaller.analytics.createFilterPreset({
				name: "Default Type Check",
				filters: JSON.stringify({}),
				isDefault: true,
			});

			const result = await newCaller.analytics.getDefaultPreset();
			expect(result).not.toBeNull();
			expect(typeof result?.id).toBe("string");
			expect(typeof result?.isDefault).toBe("boolean");
			expect(result?.isDefault).toBe(true);
		});

		it("should return correct types for updateFilterPreset", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Type Check Update",
				filters: JSON.stringify({}),
			});

			const updated = await caller.analytics.updateFilterPreset({
				id: created?.id ?? "",
				name: "Updated Type Check",
			});

			expect(typeof updated?.id).toBe("string");
			expect(typeof updated?.name).toBe("string");
			expect(updated?.name).toBe("Updated Type Check");
		});

		it("should return correct types for deleteFilterPreset", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Type Check Delete",
				filters: JSON.stringify({}),
			});

			const result = await caller.analytics.deleteFilterPreset({
				id: created?.id ?? "",
			});

			expect(result).toEqual({ success: true });
			expect(typeof result.success).toBe("boolean");
		});

		it("should return correct types for setDefaultPreset", async () => {
			const created = await caller.analytics.createFilterPreset({
				name: "Type Check Set Default",
				filters: JSON.stringify({}),
			});

			// Non-null case
			const result = await caller.analytics.setDefaultPreset({
				id: created?.id ?? "",
			});
			expect(typeof result?.id).toBe("string");
			expect(typeof result?.isDefault).toBe("boolean");
			expect(result?.isDefault).toBe(true);

			// Null case
			const nullResult = await caller.analytics.setDefaultPreset({ id: null });
			expect(nullResult).toBeNull();
		});
	});
});
