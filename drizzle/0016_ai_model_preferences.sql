ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "chat_model" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "report_model" text;
