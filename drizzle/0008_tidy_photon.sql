CREATE TABLE "daily_checklist_check" (
	"journal_id" text NOT NULL,
	"template_id" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	CONSTRAINT "daily_checklist_check_journal_id_template_id_pk" PRIMARY KEY("journal_id","template_id")
);
--> statement-breakpoint
CREATE TABLE "daily_checklist_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_journal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"content" text,
	"content_format" text DEFAULT 'html',
	"day_started_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journal_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL,
	"url" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "trade_log_sort" text;--> statement-breakpoint
ALTER TABLE "daily_checklist_check" ADD CONSTRAINT "daily_checklist_check_journal_id_daily_journal_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."daily_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklist_check" ADD CONSTRAINT "daily_checklist_check_template_id_daily_checklist_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."daily_checklist_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_checklist_template" ADD CONSTRAINT "daily_checklist_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_journal" ADD CONSTRAINT "daily_journal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_attachment" ADD CONSTRAINT "journal_attachment_journal_id_daily_journal_id_fk" FOREIGN KEY ("journal_id") REFERENCES "public"."daily_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_checklist_check_journal_id_idx" ON "daily_checklist_check" USING btree ("journal_id");--> statement-breakpoint
CREATE INDEX "daily_checklist_template_user_id_idx" ON "daily_checklist_template" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_journal_user_id_idx" ON "daily_journal" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_journal_user_date_idx" ON "daily_journal" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "journal_attachment_journal_id_idx" ON "journal_attachment" USING btree ("journal_id");