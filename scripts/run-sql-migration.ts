import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

// Load env vars from .env file
config();

const sqlFile = process.argv[2] as string | undefined;

if (!sqlFile) {
	console.error(
		"❌ Usage: npx tsx scripts/run-sql-migration.ts <path-to-sql-file>",
	);
	console.error(
		"   Example: npx tsx scripts/run-sql-migration.ts drizzle/0003_prefixed_uuid_migration.sql",
	);
	process.exit(1);
}

const sqlFilePath: string = sqlFile;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	console.error("❌ No DATABASE_URL found in environment");
	process.exit(1);
}

console.log(`📄 SQL File: ${sqlFilePath}`);
console.log("🔌 Connecting to database...\n");

const client = postgres(connectionString, {
	connect_timeout: 30,
	idle_timeout: 0,
});

async function runMigration() {
	try {
		// Read the SQL file
		const sqlContent = readFileSync(sqlFilePath, "utf-8");

		// Split by drizzle statement breakpoint marker OR by semicolons
		let statements: string[];

		if (sqlContent.includes("--> statement-breakpoint")) {
			// Drizzle-style migration file
			statements = sqlContent
				.split("--> statement-breakpoint")
				.map((s) => s.trim())
				// Remove leading comment lines from each statement
				.map((s) => {
					const lines = s.split("\n");
					// Skip leading comment and empty lines
					let firstLine = lines[0];
					while (
						lines.length > 0 &&
						firstLine &&
						(firstLine.trim().startsWith("--") || firstLine.trim() === "")
					) {
						lines.shift();
						firstLine = lines[0];
					}
					return lines.join("\n").trim();
				})
				.filter((s) => s.length > 0);
		} else {
			// Regular SQL file - split by semicolons
			statements = sqlContent
				.split(";")
				.map((s) => s.trim())
				.filter((s) => s.length > 0 && !s.startsWith("--"));
		}

		console.log(`📦 Found ${statements.length} SQL statements to execute\n`);
		console.log("─".repeat(60));

		let completed = 0;
		let skipped = 0;
		const startTime = Date.now();

		for (const statement of statements) {
			const preview = statement.replace(/\s+/g, " ").slice(0, 70);
			process.stdout.write(
				`[${completed + skipped + 1}/${statements.length}] ${preview}...`,
			);

			try {
				await client.unsafe(statement);
				completed++;
				console.log(" ✓");
			} catch (e) {
				const error = e as Error & { code?: string };
				if (
					error.code === "42701" || // duplicate_column
					error.code === "42710" || // duplicate_object
					error.code === "42P07" || // duplicate_table
					error.message.includes("already exists")
				) {
					skipped++;
					console.log(" ⚠️ skipped (already exists)");
				} else {
					console.log(" ❌");
					console.error(`\n❌ Failed at statement ${completed + skipped + 1}:`);
					console.error(`   Error code: ${error.code || "unknown"}`);
					console.error(`   Error: ${error.message}`);
					console.error(`\n   Full statement:\n   ${statement}\n`);
					throw e;
				}
			}
		}

		const duration = ((Date.now() - startTime) / 1000).toFixed(2);
		console.log("─".repeat(60));
		console.log(`\n✅ Migration complete!`);
		console.log(`   Executed: ${completed} statements`);
		console.log(`   Skipped:  ${skipped} statements`);
		console.log(`   Duration: ${duration}s`);
	} catch (e) {
		const error = e as Error;
		console.error("\n❌ Migration failed:", error.message);
		console.error(
			"\n💡 If partially completed, you may need to restore from backup.",
		);
		process.exit(1);
	} finally {
		await client.end();
		console.log("\n🔌 Database connection closed");
	}
}

runMigration();
