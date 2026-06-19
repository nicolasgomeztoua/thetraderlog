ALTER TABLE "trade" ADD COLUMN "trade_hash" text;--> statement-breakpoint
CREATE INDEX "trade_hash_idx" ON "trade" USING btree ("trade_hash");