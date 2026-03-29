  │ Daily Journal Feature - Implementation Plan                                                        │
     │                                                                                                    │
     │ Target: TheTraderLog Trading Journal                                                                │
     │ Scope: Daily journaling with rich text, file uploads, checklists, and trade sync                   │
     │ Execution: Ralph autonomous loop (33 user stories)                                                 │
     │                                                                                                    │
     │ ---                                                                                                │
     │ Overview                                                                                           │
     │                                                                                                    │
     │ A comprehensive daily journaling system inspired by TradeZella, featuring:                         │
     │ - Calendar-based navigation with P&L color coding                                                  │
     │ - Rich markdown editor (Tiptap-based, like Slack/Notion)                                           │
     │ - File/image uploads via Bun S3 + Sevalla                                                          │
     │ - Daily checklist system for adherence tracking                                                    │
     │ - Syncs with trade detail view                                                                     │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 1. Database Schema                                                                                 │
     │                                                                                                    │
     │ Add to src/server/db/schema.ts:                                                                    │
     │                                                                                                    │
     │ 1.1 Daily Journals Table                                                                           │
     │                                                                                                    │
     │ export const dailyJournals = createTable(                                                          │
     │   "daily_journal",                                                                                 │
     │   {                                                                                                │
     │     id: text("id").primaryKey().$defaultFn(() => ids.dailyJournal()),                              │
     │     userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),         │
     │     date: timestamp("date", { withTimezone: true }).notNull(), // Normalized to midnight UTC       │
     │     content: text("content"), // Tiptap JSON                                                       │
     │     contentFormat: text("content_format").default("tiptap"),                                       │
     │     createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new      │
     │ Date()),                                                                                           │
     │     updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(() => new Date()),        │
     │   },                                                                                               │
     │   (t) => [                                                                                         │
     │     uniqueIndex("daily_journal_user_date_idx").on(t.userId, t.date),                               │
     │     index("daily_journal_user_id_idx").on(t.userId),                                               │
     │   ]                                                                                                │
     │ );                                                                                                 │
     │                                                                                                    │
     │ 1.2 Daily Checklist Templates Table                                                                │
     │                                                                                                    │
     │ export const dailyChecklistTemplates = createTable(                                                │
     │   "daily_checklist_template",                                                                      │
     │   {                                                                                                │
     │     id: text("id").primaryKey().$defaultFn(() => ids.checklistTemplate()),                         │
     │     userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),         │
     │     text: text("text").notNull(),                                                                  │
     │     order: integer("order").notNull().default(0),                                                  │
     │     isActive: boolean("is_active").default(true),                                                  │
     │     createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new      │
     │ Date()),                                                                                           │
     │   },                                                                                               │
     │   (t) => [index("daily_checklist_template_user_id_idx").on(t.userId)]                              │
     │ );                                                                                                 │
     │                                                                                                    │
     │ 1.3 Daily Checklist Checks Table                                                                   │
     │                                                                                                    │
     │ export const dailyChecklistChecks = createTable(                                                   │
     │   "daily_checklist_check",                                                                         │
     │   {                                                                                                │
     │     journalId: text("journal_id").notNull().references(() => dailyJournals.id, { onDelete:         │
     │ "cascade" }),                                                                                      │
     │     templateId: text("template_id").notNull().references(() => dailyChecklistTemplates.id, {       │
     │ onDelete: "cascade" }),                                                                            │
     │     checked: boolean("checked").notNull().default(false),                                          │
     │     checkedAt: timestamp("checked_at", { withTimezone: true }),                                    │
     │   },                                                                                               │
     │   (t) => [                                                                                         │
     │     primaryKey({ columns: [t.journalId, t.templateId] }),                                          │
     │     index("daily_checklist_check_journal_id_idx").on(t.journalId),                                 │
     │   ]                                                                                                │
     │ );                                                                                                 │
     │                                                                                                    │
     │ 1.4 Journal Attachments Table                                                                      │
     │                                                                                                    │
     │ export const journalAttachments = createTable(                                                     │
     │   "journal_attachment",                                                                            │
     │   {                                                                                                │
     │     id: text("id").primaryKey().$defaultFn(() => ids.journalAttachment()),                         │
     │     journalId: text("journal_id").notNull().references(() => dailyJournals.id, { onDelete:         │
     │ "cascade" }),                                                                                      │
     │     url: text("url").notNull(),                                                                    │
     │     key: text("key").notNull(), // S3 key for deletion                                             │
     │     filename: text("filename").notNull(),                                                          │
     │     mimeType: text("mime_type").notNull(),                                                         │
     │     size: integer("size").notNull(),                                                               │
     │     caption: text("caption"),                                                                      │
     │     createdAt: timestamp("created_at", { withTimezone: true }).notNull().$defaultFn(() => new      │
     │ Date()),                                                                                           │
     │   },                                                                                               │
     │   (t) => [index("journal_attachment_journal_id_idx").on(t.journalId)]                              │
     │ );                                                                                                 │
     │                                                                                                    │
     │ 1.5 ID Generators                                                                                  │
     │                                                                                                    │
     │ Add to src/lib/shared/id.ts:                                                                       │
     │ dailyJournal: () => createId("dj"),                                                                │
     │ checklistTemplate: () => createId("ct"),                                                           │
     │ journalAttachment: () => createId("ja"),                                                           │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 2. tRPC Router Structure                                                                           │
     │                                                                                                    │
     │ Create src/server/api/routers/dailyJournal.ts:                                                     │
     │                                                                                                    │
     │ Core Journal Operations                                                                            │
     │                                                                                                    │
     │ - getByDate - Get journal for date (auto-creates if not exists)                                    │
     │ - updateContent - Update journal content                                                           │
     │ - getRange - Get journals for date range (calendar)                                                │
     │ - getWithTrades - Get journal + trades for date                                                    │
     │                                                                                                    │
     │ Checklist Template Operations                                                                      │
     │                                                                                                    │
     │ - getTemplates - Get all user's templates                                                          │
     │ - createTemplate - Create new template item                                                        │
     │ - updateTemplate - Update template text/order/active                                               │
     │ - deleteTemplate - Delete template                                                                 │
     │ - reorderTemplates - Bulk reorder templates                                                        │
     │                                                                                                    │
     │ Daily Check Operations                                                                             │
     │                                                                                                    │
     │ - getChecks - Get checks for a date                                                                │
     │ - toggleCheck - Toggle a check (auto-creates journal)                                              │
     │ - bulkUpdateChecks - Update multiple checks                                                        │
     │                                                                                                    │
     │ Attachment Operations                                                                              │
     │                                                                                                    │
     │ - getUploadUrl - Get presigned S3 URL                                                              │
     │ - confirmUpload - Create attachment record                                                         │
     │ - deleteAttachment - Delete from S3 + DB                                                           │
     │                                                                                                    │
     │ Analytics                                                                                          │
     │                                                                                                    │
     │ - getStreak - Consecutive journaling days                                                          │
     │ - getComplianceStats - Checklist adherence over time                                               │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 3. UI Components                                                                                   │
     │                                                                                                    │
     │ Page Layout                                                                                        │
     │                                                                                                    │
     │ src/app/(protected)/daily-journal/page.tsx                                                         │
     │ ├── ResizablePanelGroup (horizontal)                                                               │
     │ │   ├── Left Panel (30%)                                                                           │
     │ │   │   ├── DateNavigation (prev/next/today/picker)                                                │
     │ │   │   ├── CalendarSidebar (month grid, P&L colors)                                               │
     │ │   │   └── DailyChecklist (checkboxes + settings)                                                 │
     │ │   └── Right Panel (70%)                                                                          │
     │ │       ├── JournalEditor (Tiptap rich text)                                                       │
     │ │       ├── AttachmentGallery (uploaded files)                                                     │
     │ │       └── TradesSummary (trades for day)                                                         │
     │                                                                                                    │
     │ Components to Create                                                                               │
     │                                                                                                    │
     │ src/components/daily-journal/                                                                      │
     │ ├── calendar-sidebar.tsx      # Month calendar with P&L colors                                     │
     │ ├── date-navigation.tsx       # Prev/Next/Today + date picker                                      │
     │ ├── daily-checklist.tsx       # Checklist items with optimistic updates                            │
     │ ├── checklist-settings.tsx    # Template management modal                                          │
     │ ├── journal-editor.tsx        # Tiptap editor wrapper                                              │
     │ ├── editor-toolbar.tsx        # Format buttons                                                     │
     │ ├── attachment-upload.tsx     # Drag-drop + file select                                            │
     │ ├── attachment-gallery.tsx    # Image/file grid with lightbox                                      │
     │ ├── trades-summary.tsx        # Trades for selected date                                           │
     │ ├── daily-journal-preview.tsx # Compact view for trade detail                                      │
     │ └── index.ts                                                                                       │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 4. File Upload Flow (Bun S3)                                                                       │
     │                                                                                                    │
     │ Environment Variables                                                                              │
     │                                                                                                    │
     │ S3_ENDPOINT=https://s3.sevalla.hosting.com                                                         │
     │ S3_REGION=auto                                                                                     │
     │ S3_ACCESS_KEY_ID=xxx                                                                               │
     │ S3_SECRET_ACCESS_KEY=xxx                                                                           │
     │ S3_BUCKET=traderlog-uploads                                                                      │
     │                                                                                                    │
     │ S3 Client                                                                                          │
     │                                                                                                    │
     │ Create src/lib/storage/s3.ts:                                                                      │
     │ import { S3Client } from "bun";                                                                    │
     │                                                                                                    │
     │ export const s3 = new S3Client({                                                                   │
     │   endpoint: process.env.S3_ENDPOINT,                                                               │
     │   region: process.env.S3_REGION,                                                                   │
     │   accessKeyId: process.env.S3_ACCESS_KEY_ID,                                                       │
     │   secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,                                               │
     │ });                                                                                                │
     │                                                                                                    │
     │ Upload Flow                                                                                        │
     │                                                                                                    │
     │ 1. Client calls getUploadUrl(filename, mimeType, size)                                             │
     │ 2. Server generates presigned PUT URL (key: journals/{userId}/{date}/{uuid}-{filename})            │
     │ 3. Client uploads directly to S3                                                                   │
     │ 4. Client calls confirmUpload to create DB record                                                  │
     │ 5. For inline images: insert URL into Tiptap editor                                                │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 5. Trade Detail Integration                                                                        │
     │                                                                                                    │
     │ Update content-panel.tsx                                                                           │
     │                                                                                                    │
     │ Replace "Daily Journal" tab placeholder with:                                                      │
     │ <TabsContent value="daily-journal">                                                                │
     │   <DailyJournalPreview                                                                             │
     │     date={trade.entryTime}                                                                         │
     │     readOnly={false}                                                                               │
     │   />                                                                                               │
     │ </TabsContent>                                                                                     │
     │                                                                                                    │
     │ DailyJournalPreview Component                                                                      │
     │                                                                                                    │
     │ - Shows journal content for trade's date                                                           │
     │ - Displays checklist compliance badge                                                              │
     │ - Link to full journal page                                                                        │
     │ - Editable or read-only mode                                                                       │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 6. Navigation                                                                                      │
     │                                                                                                    │
     │ Add to src/app/(protected)/_components/app-sidebar.tsx:                                            │
     │ {                                                                                                  │
     │   title: "Daily Journal",                                                                          │
     │   href: "/daily-journal",                                                                          │
     │   icon: Calendar,                                                                                  │
     │ }                                                                                                  │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 7. Dependencies                                                                                    │
     │                                                                                                    │
     │ Add to package.json:                                                                               │
     │ {                                                                                                  │
     │   "@tiptap/react": "^2.x",                                                                         │
     │   "@tiptap/pm": "^2.x",                                                                            │
     │   "@tiptap/starter-kit": "^2.x",                                                                   │
     │   "@tiptap/extension-link": "^2.x",                                                                │
     │   "@tiptap/extension-image": "^2.x",                                                               │
     │   "@tiptap/extension-placeholder": "^2.x"                                                          │
     │ }                                                                                                  │
     │                                                                                                    │
     │ Bun S3 is built-in (no package needed).                                                            │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 8. User Stories for Ralph PRD                                                                      │
     │                                                                                                    │
     │ Phase 1: Database Foundation (4 stories)                                                           │
     │ ┌─────┬────────────────────────────────┬───────────────────────────────────────────────────────────│
     │ ────┐                                                                                              │
     │ │ ID  │             Title              │                          Description                      │
     │     │                                                                                              │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────────────────────────────│
     │ ────┤                                                                                              │
     │ │ 1.1 │ Add daily journals schema      │ Add dailyJournals table, ID generator, relations, run     │
     │ db:push │                                                                                          │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────────────────────────────│
     │ ────┤                                                                                              │
     │ │ 1.2 │ Add checklist templates schema │ Add dailyChecklistTemplates table, ID generator, relations│
     │     │                                                                                              │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────────────────────────────│
     │ ────┤                                                                                              │
     │ │ 1.3 │ Add checklist checks schema    │ Add dailyChecklistChecks junction table, relations        │
     │     │                                                                                              │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────────────────────────────│
     │ ────┤                                                                                              │
     │ │ 1.4 │ Add journal attachments schema │ Add journalAttachments table, ID generator, relations     │
     │     │                                                                                              │
     │ └─────┴────────────────────────────────┴───────────────────────────────────────────────────────────│
     │ ────┘                                                                                              │
     │                                                                                                    │
     │                                                                                                    │
     │                                                                                                    │
     │ Phase 2: Core tRPC Router (4 stories)                                                              │
     │ ID: 2.1                                                                                            │
     │ Title: Create dailyJournal router                                                                  │
     │ Description: Create router file, getByDate query (auto-creates), register in root.ts               │
     │ ────────────────────────────────────────                                                           │
     │ ID: 2.2                                                                                            │
     │ Title: Add updateContent mutation                                                                  │
     │ Description: Upsert journal content by date                                                        │
     │ ────────────────────────────────────────                                                           │
     │ ID: 2.3                                                                                            │
     │ Title: Add getRange query                                                                          │
     │ Description: Get journals between dates for calendar view                                          │
     │ ────────────────────────────────────────                                                           │
     │ ID: 2.4                                                                                            │
     │ Title: Add getWithTrades query                                                                     │
     │ Description: Get journal + trades for a specific date                                              │
     │ Phase 3: Checklist tRPC (3 stories)                                                                │
     │ ┌─────┬───────────────────────────────┬────────────────────────────────────────────────────────────│
     │ ─────┐                                                                                             │
     │ │ ID  │             Title             │                           Description                      │
     │      │                                                                                             │
     │ ├─────┼───────────────────────────────┼────────────────────────────────────────────────────────────│
     │ ─────┤                                                                                             │
     │ │ 3.1 │ Add checklist template CRUD   │ getTemplates, createTemplate, updateTemplate,              │
     │ deleteTemplate    │                                                                                │
     │ ├─────┼───────────────────────────────┼────────────────────────────────────────────────────────────│
     │ ─────┤                                                                                             │
     │ │ 3.2 │ Add reorderTemplates mutation │ Bulk update template order values                          │
     │      │                                                                                             │
     │ ├─────┼───────────────────────────────┼────────────────────────────────────────────────────────────│
     │ ─────┤                                                                                             │
     │ │ 3.3 │ Add daily check operations    │ getChecks, toggleCheck, bulkUpdateChecks (auto-creates     │
     │ journal) │                                                                                         │
     │ └─────┴───────────────────────────────┴────────────────────────────────────────────────────────────│
     │ ─────┘                                                                                             │
     │                                                                                                    │
     │                                                                                                    │
     │ Phase 4: S3 Upload Infrastructure (4 stories)                                                      │
     │ ┌─────┬───────────────────────────────┬──────────────────────────────────────────────┐             │
     │ │ ID  │             Title             │                 Description                  │             │
     │ ├─────┼───────────────────────────────┼──────────────────────────────────────────────┤             │
     │ │ 4.1 │ Set up S3 client utility      │ Create src/lib/storage/s3.ts, env validation │             │
     │ ├─────┼───────────────────────────────┼──────────────────────────────────────────────┤             │
     │ │ 4.2 │ Add getUploadUrl mutation     │ Generate presigned PUT URL                   │             │
     │ ├─────┼───────────────────────────────┼──────────────────────────────────────────────┤             │
     │ │ 4.3 │ Add confirmUpload mutation    │ Create attachment DB record                  │             │
     │ ├─────┼───────────────────────────────┼──────────────────────────────────────────────┤             │
     │ │ 4.4 │ Add deleteAttachment mutation │ Delete from S3 + database                    │             │
     │ └─────┴───────────────────────────────┴──────────────────────────────────────────────┘             │
     │ Phase 5: Calendar & Navigation UI (4 stories)                                                      │
     │ ┌─────┬──────────────────────────────────┬────────────────────────────────────────────┐            │
     │ │ ID  │              Title               │                Description                 │            │
     │ ├─────┼──────────────────────────────────┼────────────────────────────────────────────┤            │
     │ │ 5.1 │ Create daily-journal page layout │ Resizable panels, date state management    │            │
     │ ├─────┼──────────────────────────────────┼────────────────────────────────────────────┤            │
     │ │ 5.2 │ Create DateNavigation component  │ Prev/Next/Today buttons, date picker       │            │
     │ ├─────┼──────────────────────────────────┼────────────────────────────────────────────┤            │
     │ │ 5.3 │ Create CalendarSidebar component │ Month grid, P&L colors, journal indicators │            │
     │ ├─────┼──────────────────────────────────┼────────────────────────────────────────────┤            │
     │ │ 5.4 │ Add Daily Journal to sidebar nav │ Update app-sidebar.tsx                     │            │
     │ └─────┴──────────────────────────────────┴────────────────────────────────────────────┘            │
     │ Phase 6: Checklist UI (2 stories)                                                                  │
     │ ┌─────┬─────────────────────────────────┬──────────────────────────────────────────┐               │
     │ │ ID  │              Title              │               Description                │               │
     │ ├─────┼─────────────────────────────────┼──────────────────────────────────────────┤               │
     │ │ 6.1 │ Create DailyChecklist component │ Fetch items, check/uncheck, compliance % │               │
     │ ├─────┼─────────────────────────────────┼──────────────────────────────────────────┤               │
     │ │ 6.2 │ Create ChecklistSettings modal  │ Add/edit/delete/reorder templates        │               │
     │ └─────┴─────────────────────────────────┴──────────────────────────────────────────┘               │
     │ Phase 7: Rich Text Editor (4 stories)                                                              │
     │ ┌─────┬────────────────────────────────┬───────────────────────────────────┐                       │
     │ │ ID  │             Title              │            Description            │                       │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────┤                       │
     │ │ 7.1 │ Install and configure Tiptap   │ Add dependencies, basic setup     │                       │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────┤                       │
     │ │ 7.2 │ Create EditorToolbar component │ Format and insert buttons         │                       │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────┤                       │
     │ │ 7.3 │ Create JournalEditor component │ Tiptap wrapper, auto-save, states │                       │
     │ ├─────┼────────────────────────────────┼───────────────────────────────────┤                       │
     │ │ 7.4 │ Add markdown shortcuts         │ bold, italic, # headings, - lists │                       │
     │ └─────┴────────────────────────────────┴───────────────────────────────────┘                       │
     │ Phase 8: Attachments UI (3 stories)                                                                │
     │ ┌─────┬────────────────────────────────────┬──────────────────────────────────┐                    │
     │ │ ID  │               Title                │           Description            │                    │
     │ ├─────┼────────────────────────────────────┼──────────────────────────────────┤                    │
     │ │ 8.1 │ Create AttachmentUpload component  │ Drag-drop, file select, progress │                    │
     │ ├─────┼────────────────────────────────────┼──────────────────────────────────┤                    │
     │ │ 8.2 │ Create AttachmentGallery component │ Grid view, lightbox, delete      │                    │
     │ ├─────┼────────────────────────────────────┼──────────────────────────────────┤                    │
     │ │ 8.3 │ Integrate image upload into editor │ Paste/drop images, insert URL    │                    │
     │ └─────┴────────────────────────────────────┴──────────────────────────────────┘                    │
     │ Phase 9: Trade Integration (3 stories)                                                             │
     │ ┌─────┬──────────────────────────────────────┬───────────────────────────────────┐                 │
     │ │ ID  │                Title                 │            Description            │                 │
     │ ├─────┼──────────────────────────────────────┼───────────────────────────────────┤                 │
     │ │ 9.1 │ Create TradesSummary component       │ Trades for date, links to detail  │                 │
     │ ├─────┼──────────────────────────────────────┼───────────────────────────────────┤                 │
     │ │ 9.2 │ Create DailyJournalPreview component │ Compact view for trade detail tab │                 │
     │ ├─────┼──────────────────────────────────────┼───────────────────────────────────┤                 │
     │ │ 9.3 │ Integrate preview into trade detail  │ Update content-panel.tsx          │                 │
     │ └─────┴──────────────────────────────────────┴───────────────────────────────────┘                 │
     │ Phase 10: Analytics & Polish (3 stories)                                                           │
     │ ┌──────┬──────────────────────────────┬─────────────────────────────────────────┐                  │
     │ │  ID  │            Title             │               Description               │                  │
     │ ├──────┼──────────────────────────────┼─────────────────────────────────────────┤                  │
     │ │ 10.1 │ Add getStreak query          │ Consecutive journaling days calculation │                  │
     │ ├──────┼──────────────────────────────┼─────────────────────────────────────────┤                  │
     │ │ 10.2 │ Add getComplianceStats query │ Checklist adherence over time           │                  │
     │ ├──────┼──────────────────────────────┼─────────────────────────────────────────┤                  │
     │ │ 10.3 │ Add streak and compliance UI │ Display in calendar sidebar             │                  │
     │ └──────┴──────────────────────────────┴─────────────────────────────────────────┘                  │
     │ Total: 34 user stories                                                                             │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 9. Critical Files to Modify                                                                        │
     │ ┌─────────────────────────────────────────────────┬──────────────────────────────┐                 │
     │ │                      File                       │           Purpose            │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/server/db/schema.ts                         │ Add 4 new tables             │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/lib/shared/id.ts                            │ Add 3 ID generators          │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/server/api/root.ts                          │ Register dailyJournal router │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/server/api/routers/dailyJournal.ts          │ New router (create)          │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/lib/storage/s3.ts                           │ S3 client (create)           │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/app/(protected)/daily-journal/page.tsx      │ Main page (create)           │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/components/daily-journal/*.tsx              │ 10 new components            │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/components/trade-detail/content-panel.tsx   │ Add journal preview          │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ src/app/(protected)/_components/app-sidebar.tsx │ Add nav item                 │                 │
     │ ├─────────────────────────────────────────────────┼──────────────────────────────┤                 │
     │ │ package.json                                    │ Add Tiptap dependencies      │                 │
     │ └─────────────────────────────────────────────────┴──────────────────────────────┘                 │
     │ ---                                                                                                │
     │ 10. Verification                                                                                   │
     │                                                                                                    │
     │ Manual Testing                                                                                     │
     │                                                                                                    │
     │ 1. Navigate to /daily-journal                                                                      │
     │ 2. Select date in calendar                                                                         │
     │ 3. Add checklist template items in settings                                                        │
     │ 4. Check/uncheck items, verify persistence                                                         │
     │ 5. Write journal content with formatting                                                           │
     │ 6. Upload image via toolbar                                                                        │
     │ 7. Verify auto-save works                                                                          │
     │ 8. Navigate to trade detail, check Daily Journal tab shows content                                 │
     │ 9. Create journal from trade detail tab                                                            │
     │ 10. Verify checklist compliance displays correctly                                                 │
     │                                                                                                    │
     │ Integration Tests                                                                                  │
     │                                                                                                    │
     │ - All tRPC endpoints tested with Testcontainers PostgreSQL                                         │
     │ - Ownership verification (users cannot access others' journals)                                    │
     │ - Date normalization across timezones                                                              │
     │ - S3 upload flow (mock S3 in tests)                                                                │
     │                                                                                                    │
     │ ---                                                                                                │
     │ 11. Notes                                                                                          │
     │                                                                                                    │
     │ - Date handling: Normalize to user's timezone midnight, store as UTC                               │
     │ - Auto-save: 500ms debounce on content changes                                                     │
     │ - Checklist soft delete: Mark isActive: false instead of hard delete                               │
     │ - Image compression: Consider client-side compression for large images                             │
     │ - Calendar P&L: Reuse logic from calendar-heatmap.tsx           