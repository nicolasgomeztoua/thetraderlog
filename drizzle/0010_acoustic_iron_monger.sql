CREATE TYPE "public"."rule_type" AS ENUM('manual', 'auto', 'semi_auto');--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "rule_type" "rule_type" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "config_source" text;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "auto_condition" text;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "is_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "strategy_rule" ADD COLUMN "source_config_hash" text;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ADD COLUMN "evaluation_result" text;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ADD COLUMN "was_auto_evaluated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ADD COLUMN "user_override" boolean;--> statement-breakpoint
CREATE INDEX "strategy_rule_is_generated_idx" ON "strategy_rule" USING btree ("is_generated");