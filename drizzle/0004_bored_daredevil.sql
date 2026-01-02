ALTER TABLE "account_group" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account_group" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "account_group" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "linked_account_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "group_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_conversation" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_conversation" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "ai_conversation" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_message" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "ai_message" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "ai_message" ALTER COLUMN "conversation_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candle_cache" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "candle_cache" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "filter_preset" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "filter_preset" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "filter_preset" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strategy" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strategy" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "strategy" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strategy_rule" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "strategy_rule" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "strategy_rule" ALTER COLUMN "strategy_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "tag" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_execution" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_execution" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "trade_execution" ALTER COLUMN "trade_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ALTER COLUMN "trade_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_rule_check" ALTER COLUMN "rule_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "trade_screenshot" ALTER COLUMN "trade_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_tag" ALTER COLUMN "trade_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade_tag" ALTER COLUMN "tag_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "account_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "trade" ALTER COLUMN "strategy_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "user_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" DROP IDENTITY;