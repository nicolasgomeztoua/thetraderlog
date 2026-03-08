CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_messages_used" integer DEFAULT 0 NOT NULL,
	"chat_messages_date" date,
	"reports_used" integer DEFAULT 0 NOT NULL,
	"reports_month" integer,
	"reports_year" integer,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_user_chat_date_idx" ON "ai_usage" USING btree ("user_id", "chat_messages_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_usage_user_report_month_idx" ON "ai_usage" USING btree ("user_id", "reports_month", "reports_year");
