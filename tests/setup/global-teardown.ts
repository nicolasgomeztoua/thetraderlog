// Global teardown is handled by the setup function's return value in Vitest
// This file exists as a placeholder and for explicit teardown if needed

export async function teardown() {
	// Container cleanup is handled automatically by the setup function's return
	console.log("🧹 Global teardown complete.");
}

export default teardown;
