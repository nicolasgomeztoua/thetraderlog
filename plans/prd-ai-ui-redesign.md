# PRD: AI Section UI Redesign

## Overview

The AI section (Chat + Reports) currently has a brutalist, unpolished UI that doesn't match the quality bar of modern chat applications or the rest of EdgeJournal. This redesign transforms it into a fully-featured, tasteful interface — preserving the Terminal design identity while bringing the polish and micro-interactions users expect from apps like ChatGPT, Claude.ai, and T3 Chat.

**Scope**: Primarily UI/UX. One backend enhancement: granular report progress tracking (new DB columns + Trigger.dev task updates + tRPC endpoint changes) to replace the current fake progress percentages with real pipeline stages.

## Goals

- Elevate the AI section from "functional prototype" to "polished product"
- Match the quality of modern AI chat interfaces while maintaining Terminal design identity
- Add tasteful micro-interactions that improve UX without being annoying
- Make the report interface feel like a first-class feature, not an afterthought
- Full mobile responsiveness with slide-over sidebar drawer
- Typewriter streaming effect that reinforces the terminal aesthetic
- Real progress tracking for report generation (replace fake percentages with actual pipeline stages)

## User Stories

### US-000: Audit Existing AI Components and Shared Utilities

**Description**: As a developer, I want to audit all existing AI section components, shared UI utilities, and animation patterns before redesigning so that we reuse existing code and maintain consistency.

**Acceptance Criteria**:
- [ ] Catalog all components in `src/app/(protected)/ai/_components/` with their current props and styling
- [ ] Search `src/components/ui/` for reusable components (Sheet, Drawer, Dialog, Tooltip, etc.) already available from shadcn
- [ ] Search for existing animation utilities, transition patterns, or shared hooks in `src/lib/` and `src/hooks/`
- [ ] Check `globals.css` for existing keyframes and animation classes (pulse-dot, fade-in-up, cursor-blink, etc.)
- [ ] Document findings in `scripts/ralph/progress.txt`:
  - Available shadcn components to leverage (with file paths)
  - Existing animation keyframes/classes to reuse
  - Shared hooks or utilities available
  - Components that need to be installed (`bunx shadcn@latest add <component>`)
- [ ] Typecheck passes (`bun run check`)

**Search Commands**:
```bash
# Available shadcn components
ls src/components/ui/
# Existing animations
grep -rn "keyframes\|@keyframes\|animate-" src/app/globals.css
# Existing hooks
ls src/hooks/
# Shared utilities
grep -rn "export function\|export const" src/lib/utils.ts
```

---

### US-001: Redesign Chat Empty State — Rich Branded Welcome

**Description**: As a trader, I want a polished, welcoming empty state when I open the AI chat so that I immediately understand what it can do and feel confident using it.

**Acceptance Criteria**:
- [ ] Vertically centered content in the message area
- [ ] Terminal-styled AI icon/logo at top (use `Terminal` or `Sparkles` lucide icon inside a subtle bordered circle with `bg-accent/5 border-accent/20`)
- [ ] **Time-aware greeting**: Headline changes based on time of day — "Good morning", "Good afternoon", "Good evening" — followed by the user's first name if available from Clerk, otherwise just the greeting. `font-bold text-xl sm:text-2xl tracking-tight text-foreground`
- [ ] Subtitle: `font-mono text-sm text-muted-foreground` — e.g. "Ask questions about your trades, analyze patterns, and get insights"
- [ ] Capability pills row: 3-4 inline pills showing capabilities (e.g. "SQL Queries", "Pattern Analysis", "Market Data", "Chart Generation") using `rounded border border-white/10 bg-white/2 px-2.5 py-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider`
- [ ] Suggested queries as polished cards below: `rounded border border-white/5 bg-white/2 p-3 hover:border-primary/30 hover:bg-primary/2 transition-all cursor-pointer` with icon + title + description
- [ ] Each suggested query card has a subtle lucide icon (e.g. `TrendingUp`, `BarChart3`, `Target`, `Calendar`) in `text-muted-foreground` that transitions to `text-primary` on hover
- [ ] **Card arrow indicator**: Each suggested query card shows a small `ArrowRight` icon `h-3 w-3` on the right side, `opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-primary` — slides in on hover
- [ ] Responsive: 2-column grid on desktop, single column on mobile
- [ ] Smooth `animate-fade-in-up` on initial render (staggered: icon 0ms, text 100ms, pills 200ms, cards 300ms — use `animation-delay` via inline style)
- [ ] **Keyboard shortcut hint**: Below suggested queries, `font-mono text-[10px] text-muted-foreground/30` — "Press / to focus input" (if implementing global shortcut in US-014)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-002: Redesign Chat Message Layout — Enhanced Terminal Style

**Description**: As a trader, I want clearly differentiated user and AI messages with better visual hierarchy so that conversations are easy to scan and read.

**Acceptance Criteria**:
- [ ] **User messages**: Keep `$` prefix in `text-primary`. Add subtle left border: `border-l-2 border-primary/30 pl-3`. Text remains `font-mono text-sm text-foreground`. Compact feel.
- [ ] **AI messages**: Wrap in a subtle card: `rounded border border-white/5 bg-white/1 p-3 sm:p-4`. Keep `→` prefix in `text-accent` inside the card. Content rendered via MessageRenderer inside the card.
- [ ] **Message spacing**: `space-y-4 sm:space-y-5` between messages for better breathing room
- [ ] **Timestamps**: Add relative timestamp on hover (e.g. "2m ago") — `absolute -top-5 left-0 opacity-0 group-hover:opacity-100 transition-opacity font-mono text-[10px] text-muted-foreground`. Tooltip-style: slight delay before showing (150ms via CSS `transition-delay`)
- [ ] **Fade-in animation**: New messages slide in with `animate-fade-in-up` (opacity 0→1, translateY 8px→0, duration 300ms)
- [ ] **Pending user message**: Use `opacity-70` instead of `text-primary/60` for clearer visual
- [ ] **Pending AI response**: Show three animated dots `· · ·` bouncing sequentially inside an AI card skeleton (`animate-bounce` with staggered delays: 0ms, 150ms, 300ms), plus subtle text "Thinking..." in `text-muted-foreground/40 text-[10px]` below the dots
- [ ] **Copy button**: Move from absolute `-right-8` to inside the AI card footer: `flex justify-end pt-2 border-t border-white/5 mt-3` — only shows on hover of the card. After clicking, show "Copied" text for 2s next to the checkmark: `font-mono text-[10px] text-profit` — then fades back to copy icon
- [ ] **Message selection highlight**: Clicking on any message adds a brief flash highlight `bg-white/3` that fades out over 500ms (confirms the click target, useful for copy)
- [ ] **Long message collapse**: AI messages longer than 80 lines get a "Show more" toggle at the bottom: `font-mono text-[10px] text-accent cursor-pointer hover:text-accent/80`. Default collapsed height: `max-h-[500px] overflow-hidden` with a bottom fade overlay `bg-linear-to-t from-white/1 to-transparent h-12`. Clicking expands fully with smooth height transition.
- [ ] **Max message container**: Keep `max-w-3xl mx-auto` but add `px-4 sm:px-6` for better mobile padding
- [ ] **Scroll-to-bottom button**: When user scrolls up more than 200px from bottom, show a floating button: `absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-card/90 backdrop-blur-sm p-2 shadow-lg hover:border-white/20 transition-all cursor-pointer` with `ChevronDown` icon `h-4 w-4 text-muted-foreground`. Clicking scrolls smoothly to bottom. Button fades in/out with `transition-opacity`.
- [ ] **Unread indicator on scroll-to-bottom**: If new messages arrived while scrolled up, show a small dot badge `h-2 w-2 rounded-full bg-primary absolute -top-0.5 -right-0.5` on the scroll-to-bottom button
- [ ] **First message in conversation**: The very first AI response in a new conversation gets a subtle top border decoration: `border-t border-accent/10 pt-4 mt-2` — visually marks the start of the exchange
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-003: Redesign Tool Call Badges

**Description**: As a trader, I want polished tool-use indicators on AI messages so that I can see what the AI did to generate its response.

**Acceptance Criteria**:
- [ ] Tool badges render inside the AI message card, above the content
- [ ] Each badge: `inline-flex items-center gap-1.5 rounded border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[10px] text-accent uppercase tracking-wider`
- [ ] Icons sized at `h-3 w-3` (currently using various sizes)
- [ ] Badge container: `flex flex-wrap gap-1.5 mb-3`
- [ ] When tools are actively running (pending state), badges pulse: `animate-pulse` and show a tiny spinner `h-2.5 w-2.5 animate-spin` before the icon
- [ ] After completion, badges are static with a subtle checkmark: swap spinner for `Check` icon `h-2.5 w-2.5 text-accent/50`
- [ ] **Tool count summary**: If more than 3 tool calls, show first 3 badges + overflow pill: `+2 more` in `text-accent/60 font-mono text-[10px]`. Clicking expands to show all.
- [ ] Tool label mapping stays the same: Running SQL, Analyzing data, Fetching market data, Generating chart
- [ ] **Collapsible tool section**: Tool badges section is collapsible — small toggle arrow `ChevronDown` `h-3 w-3` next to badges. Default: expanded for latest message, collapsed for older messages. Remembers state per-session.
- [ ] Graceful fallback if tool JSON parsing fails (show generic "Processing" badge instead of silently hiding)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-004: Typewriter Streaming Effect for AI Responses

**Description**: As a trader, I want AI responses to appear progressively with a blinking cursor so that the interface feels alive and matches the terminal aesthetic.

**Acceptance Criteria**:
- [ ] Create a `useTypewriter` hook in `src/app/(protected)/ai/_hooks/use-typewriter.ts`
- [ ] Hook accepts `text: string`, `speed?: number` (default 8ms per char), `enabled?: boolean`
- [ ] Returns `{ displayedText: string, isComplete: boolean }`
- [ ] While typing, show a blinking block cursor `▌` in `text-accent` after the displayed text using the `cursor-blink` keyframe from globals.css
- [ ] The typewriter only activates for the **latest AI message** in a conversation (older messages render instantly)
- [ ] When a new conversation is loaded from history, all messages render instantly (no typewriter replay)
- [ ] **Adaptive speed**: Start at 4ms/char for the first 50 chars (fast initial burst), then settle to 8ms/char. Markdown headings (`#`) get a tiny 50ms pause before them for visual rhythm. Code blocks render instantly as a whole block (not character by character — that looks wrong for code).
- [ ] User can click anywhere on the message to "skip" and show full text immediately
- [ ] **Esc key to skip**: Pressing `Escape` while typewriter is running skips to full text (same as clicking)
- [ ] **Scroll follows cursor**: Auto-scroll keeps the blinking cursor visible as text is being typed, but stops auto-scrolling if user manually scrolls up (respects user intent)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-005: Redesign Chat Input Area

**Description**: As a trader, I want a polished input area that feels responsive and provides clear visual feedback during AI generation.

**Acceptance Criteria**:
- [ ] **Input container**: Wrap in `rounded border border-white/10 bg-white/2 p-1.5` to create a "composer" feel (input + button inside a shared container)
- [ ] **Textarea**: Remove individual border. `bg-transparent resize-none font-mono text-sm px-3 py-2.5 placeholder:text-muted-foreground/40 focus:outline-none`. Min height 44px, max height 200px.
- [ ] **Focus state**: The outer container border changes to `border-primary/40` when textarea is focused
- [ ] **Send button**: Inside the container, bottom-right. `rounded bg-primary/10 hover:bg-primary/20 text-primary p-2 transition-all`. Arrow icon `h-4 w-4`. Disabled: `opacity-30 cursor-not-allowed`.
- [ ] **Shimmer during generation**: When `isLoading`, the outer container border animates with a subtle shimmer/pulse: `animate-pulse border-accent/30`
- [ ] **Stop button**: When `isLoading`, the send button transforms into a stop button: `rounded bg-loss/10 hover:bg-loss/20 text-loss p-2 transition-all` with `Square` icon `h-3 w-3` (filled square). Clicking it aborts the pending request (call the appropriate cancel/abort mechanism). Textarea remains interactive while loading. Smooth icon crossfade between send → stop → send.
- [ ] **Auto-focus**: Textarea auto-focuses on page load, after sending a message, and after selecting a conversation from sidebar. Use `ref.current?.focus()` in the right effects.
- [ ] **Cmd/Ctrl+Enter alternative**: Support `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows) as alternative send shortcut for users who prefer it
- [ ] **Empty state placeholder rotation**: When on the empty state (no conversation selected), the placeholder text cycles through contextual suggestions every 5 seconds with a fade transition: "Ask about your win rate this week...", "Compare your morning vs afternoon sessions...", "Analyze your best performing setups...", "Find patterns in your losing trades...". Once user starts typing, lock to static placeholder.
- [ ] **Paste handling**: When pasting text longer than 500 chars, auto-expand the textarea to show more content (up to max height). No jarring jump — smooth `transition-[height]` over 150ms.
- [ ] **Keyboard hint**: Below the input, small text: `font-mono text-[10px] text-muted-foreground/40` — "Enter to send · Shift+Enter for new line" — hidden on mobile
- [ ] **Character count**: Show character count when > 500 chars typed: `font-mono text-[10px] text-muted-foreground/40` on the right side below input. Changes to `text-loss/40` when approaching a limit (e.g. > 4000 chars).
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-006: Redesign Chat Sidebar — Desktop Polish

**Description**: As a trader, I want a polished sidebar for managing conversations with better visual hierarchy and interactions.

**Acceptance Criteria**:
- [ ] **Width**: Increase from `w-56` to `w-64` for more room
- [ ] **Header**: `flex items-center justify-between border-b border-white/5 bg-white/1 px-3 py-2.5`
- [ ] **"Conversations" label**: `font-mono text-[10px] text-muted-foreground uppercase tracking-wider`
- [ ] **New chat button**: Icon-only `Plus` button: `rounded bg-primary/10 hover:bg-primary/20 text-primary p-1.5 transition-all` with tooltip "New conversation". Also accessible via `Cmd+Shift+N` / `Ctrl+Shift+N` keyboard shortcut.
- [ ] **Date group headers**: Group conversations by time: "Today", "Yesterday", "Previous 7 Days", "Older". Each header: `font-mono text-[10px] text-muted-foreground/50 uppercase tracking-wider px-3 pt-3 pb-1`. Only show headers when there are conversations in that group. Headers stick to top while scrolling within their group (`sticky top-0 bg-card z-10`).
- [ ] **Conversation items**: `rounded px-3 py-2 cursor-pointer transition-all`
  - Active: `bg-primary/5 border border-primary/20 text-foreground` with a left accent bar: `border-l-2 border-primary`
  - Inactive: `hover:bg-white/2 text-muted-foreground hover:text-foreground`
  - Active item scrolls into view when conversation list loads (if offscreen)
- [ ] **Conversation title**: `font-mono text-xs truncate` (single line with ellipsis)
- [ ] **Conversation preview**: Below title, show first ~40 chars of the last AI response (not user message) in `font-mono text-[10px] text-muted-foreground/40 truncate`. Gives context without opening the conversation.
- [ ] **Conversation meta**: Below preview, `font-mono text-[10px] text-muted-foreground` — show relative time (e.g. "2h ago")
- [ ] **Message count**: Next to the relative time, show message count: `· 8 msgs` in `font-mono text-[10px] text-muted-foreground/50`
- [ ] **Delete button**: `opacity-0 group-hover:opacity-100 rounded p-1 hover:bg-loss/10 hover:text-loss transition-all` — Trash2 icon `h-3 w-3`
- [ ] **Delete animation**: When deleting a conversation, the item slides out to the left and fades (`translate-x-[-20px] opacity-0 transition-all duration-200`) before being removed from the list
- [ ] **Empty state**: Center-aligned: small `MessageSquare` icon `h-8 w-8 text-muted-foreground/20` + "No conversations yet" in `font-mono text-[10px] text-muted-foreground` + "Start a new chat to begin" in `font-mono text-[10px] text-muted-foreground/40`
- [ ] **Scroll fade**: Bottom fade gradient `bg-linear-to-t from-card to-transparent h-6` at bottom of scrollable area
- [ ] **Keyboard navigation**: Up/Down arrow keys navigate between conversations when sidebar is focused. Enter selects. Makes power-user navigation fast.
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-007: Mobile Sidebar Drawer

**Description**: As a trader on mobile, I want to access my conversation history via a slide-over drawer so that I can switch between conversations on any device.

**Acceptance Criteria**:
- [ ] Install shadcn Sheet component if not already available (`bunx shadcn@latest add sheet`)
- [ ] Add a hamburger/menu button in the chat header, visible only on `sm:hidden`
- [ ] Button: `rounded p-2 hover:bg-white/5 text-muted-foreground transition-all` with `Menu` icon
- [ ] Clicking opens a `Sheet` from the left side containing the full `ChatSidebar` component
- [ ] Sheet overlay: `bg-black/60 backdrop-blur-sm`
- [ ] Sheet panel: `w-72 bg-card border-r border-white/10`
- [ ] Selecting a conversation closes the drawer automatically with a slight delay (100ms) so the user sees their selection highlight before drawer closes
- [ ] Sheet close button in top-right: `X` icon with `hover:bg-white/5 rounded p-1 transition-all`
- [ ] **Swipe to close**: Sheet supports swipe-left gesture to close on touch devices (shadcn Sheet handles this by default)
- [ ] **Active conversation indicator**: If a conversation is active when drawer opens, it should be scrolled into view
- [ ] The sidebar component is reused — same component renders in both desktop sidebar and mobile sheet. Pass an `onSelect` callback that closes the drawer in mobile context.
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser (test at mobile viewport widths)

---

### US-008: Redesign Model Selector / Mode Toggle

**Description**: As a trader, I want a polished mode toggle between Chat and Report that clearly indicates which mode I'm in.

**Acceptance Criteria**:
- [ ] **Container**: `flex items-center gap-2 border-b border-white/5 px-3 py-2 sm:px-4`
- [ ] **Toggle group**: `flex rounded border border-white/10 bg-white/1 p-0.5`
- [ ] **Each toggle button**: `flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all`
  - Active: `bg-primary/10 text-primary`
  - Inactive: `text-muted-foreground hover:text-foreground hover:bg-white/2`
- [ ] **Icons**: `MessageSquare` icon for Chat (`h-3 w-3`), `FileText` icon for Report (`h-3 w-3`)
- [ ] Icons + text render together: `[icon] CHAT` and `[icon] REPORTS`
- [ ] **Active indicator slide**: The active background `bg-primary/10` should animate its position when switching tabs — use `transition-all duration-200` so it slides from one tab to the other, not just appears (CSS approach: an absolute-positioned highlight div that translates left/right)
- [ ] **Active report count badge**: When there are reports currently generating (`status === "queued" || "generating"`), show a small count badge on the Reports tab: `h-4 min-w-4 rounded-full bg-accent/20 text-accent font-mono text-[9px] flex items-center justify-center` — e.g. "1" or "2". Pulses gently when active.
- [ ] On mobile, the hamburger menu button for sidebar sits to the left of the toggle (same header row)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-009: Polish Message Renderer — Code Blocks, Tables, and Markdown

**Description**: As a trader, I want AI responses with properly styled code blocks, tables, and markdown so that data-heavy responses are readable and professional.

**Acceptance Criteria**:
- [ ] **Code blocks**: Add language label in top-left corner of header: `font-mono text-[10px] text-muted-foreground/50 uppercase`. Copy button in top-right. Header bar: `flex items-center justify-between border-b border-white/5 bg-white/2 px-3 py-1.5`
- [ ] **Code block container**: `rounded border border-white/5 bg-[#0a0a0a] overflow-hidden mb-3` (remove internal padding from pre, add to code content area). Content area: `p-3 overflow-x-auto`
- [ ] **Code block line numbers**: For code blocks longer than 5 lines, show line numbers in `text-muted-foreground/20 select-none pr-3 border-r border-white/5 mr-3` — helps traders reference specific lines when discussing analysis
- [ ] **Code copy feedback**: Copy button shows `Check` icon + "Copied" text `text-profit text-[10px]` for 2s after click, then fades back
- [ ] **Inline code**: `bg-white/5 border border-white/5 px-1.5 py-0.5 rounded font-mono text-xs text-primary`
- [ ] **Tables**: Wrap in horizontal scroll container: `overflow-x-auto rounded border border-white/5 mb-3`. Table: `w-full border-collapse font-mono text-xs`. Header row: `bg-white/2 border-b border-white/5`. Header cells: `px-3 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase tracking-wider`. Body cells: `px-3 py-2 text-foreground border-b border-white/2`. Alternating row shading: `even:bg-white/1`
- [ ] **Table row hover**: `hover:bg-white/3 transition-colors` — subtle highlight on row hover for easier reading of wide tables
- [ ] **Table numeric alignment**: Cells containing numbers (detected via regex) get `text-right tabular-nums`. Profit/loss values (starting with + or - and containing $) get `text-profit` or `text-loss` respectively — auto-colors P&L values in any table.
- [ ] **Table scroll indicator**: When table overflows horizontally, show a subtle right-edge fade `bg-linear-to-l from-white/3 to-transparent w-6` to indicate more content is scrollable
- [ ] **Blockquotes**: `border-l-2 border-accent/30 bg-accent/2 rounded-r pl-3 pr-2 py-2 mb-3`
- [ ] **Links**: `text-accent underline underline-offset-2 decoration-accent/30 hover:decoration-accent/60 transition-colors`. External links get a tiny `ExternalLink` icon `h-2.5 w-2.5 inline ml-0.5 opacity-50` after them.
- [ ] **Horizontal rules**: `border-white/5 my-4`
- [ ] **Lists**: Bullet color matches `text-muted-foreground/50`, item text `text-foreground`. Ordered lists use `text-accent/50` for the numbers.
- [ ] **Bold text in paragraphs**: `text-foreground font-medium` (upgrade from inheriting muted color)
- [ ] **Image rendering**: Images render with `rounded border border-white/5 overflow-hidden cursor-pointer hover:border-white/10 transition-all`. Clicking opens a simple lightbox overlay: `fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center` with the image at full size. Click or Esc to close.
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser with a variety of markdown content

---

### US-010A: Add Granular Progress Fields to Report Schema

**Description**: As a developer, I want new columns on the `aiReports` table to track granular generation progress so the frontend can show real pipeline stages instead of fake percentages.

**Acceptance Criteria**:
- [ ] Add `progressStage` column to `aiReports` in `src/server/db/schema.ts`: `text("progress_stage").default("queued")` — values: `"queued"`, `"building_context"`, `"analyzing"`, `"generating_pdf"`, `"uploading"`, `"complete"`, `"failed"`
- [ ] Add `currentRound` column: `integer("current_round").default(0)` — tracks which tool-calling round (1-20) the AI is on
- [ ] Add `totalToolCalls` column: `integer("total_tool_calls").default(0)` — total tool invocations so far
- [ ] Add `chartsGenerated` column: `integer("charts_generated").default(0)` — number of charts extracted
- [ ] Run `bun run db:push` to apply schema changes
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010B: Emit Progress Updates from Trigger.dev Report Task

**Description**: As a developer, I want the `generate-ai-report` Trigger.dev task to update the database at each pipeline stage so that progress is trackable in real-time.

**Acceptance Criteria**:
- [ ] In `src/trigger/generate-ai-report.ts`, add a helper: `async function updateProgress(reportId: string, updates: Partial<typeof aiReports.$inferInsert>)` that does a lightweight DB update
- [ ] Emit progress at these milestones:
  1. After ownership verified + before context building: `{ progressStage: "building_context" }`
  2. Before entering tool-calling loop: `{ progressStage: "analyzing", currentRound: 0 }`
  3. After each tool-calling round: `{ currentRound: round, totalToolCalls: totalCalls }`
  4. After tool-calling loop completes, before PDF: `{ progressStage: "generating_pdf", chartsGenerated: charts.length }`
  5. After PDF generated, before S3 upload: `{ progressStage: "uploading" }`
  6. On completion (existing): `{ progressStage: "complete" }` (alongside existing status update)
  7. On failure (existing): `{ progressStage: "failed" }` (alongside existing status update)
- [ ] Progress updates are fire-and-forget (don't block the main pipeline on DB write failures — wrap in try/catch)
- [ ] Keep existing `status` field updates as-is (queued → generating → complete/failed) for backward compatibility
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010C: Update getReportStatus Endpoint to Return Progress Data

**Description**: As a frontend developer, I want the `getReportStatus` tRPC endpoint to return granular progress fields so the UI can display real pipeline stages.

**Acceptance Criteria**:
- [ ] Update `getReportStatus` in `src/server/api/routers/ai.ts` to select and return:
  - `progressStage` (string)
  - `currentRound` (number)
  - `totalToolCalls` (number)
  - `chartsGenerated` (number)
- [ ] These are returned alongside existing fields (`status`, `pdfUrl`, `tokensUsed`, `completedAt`, `errorMessage`)
- [ ] Frontend polling interval remains 5 seconds (sufficient for these updates)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-010D: Integration Tests for Report Progress Tracking

**Description**: As a developer, I want integration tests for the new report progress fields so that we can verify progress updates work correctly.

**Acceptance Criteria**:
- [ ] Add tests to existing report test file or create `tests/integration/report-progress.test.ts`
- [ ] Test that `getReportStatus` returns the new progress fields
- [ ] Test that progress fields have correct defaults when a report is first created
- [ ] Test that `progressStage` field is included in the response shape
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-010: Redesign Report Interface — Form Section

**Description**: As a trader, I want a polished report generation form that feels premium and is easy to use.

**Acceptance Criteria**:
- [ ] **Form container**: Change from fixed `w-[400px]` to responsive: `w-full lg:w-[420px] shrink-0`
- [ ] **Form header**: `border-b border-white/5 bg-white/1 px-4 py-3` with `FileText` icon + "New Report" label in `font-mono text-xs text-foreground uppercase tracking-wider`
- [ ] **Section labels**: `font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block`
- [ ] **Prompt textarea**: Wrap in composer-style container matching chat input: `rounded border border-white/10 bg-white/1 p-1`. Textarea: `bg-transparent resize-none font-mono text-sm p-3 min-h-[100px] focus:outline-none`. Focus state: container border changes to `border-accent/40`
- [ ] **Date range inputs**: Side by side in a row with `→` separator in `text-muted-foreground/30`. Each input: `rounded border border-white/10 bg-white/1 px-3 py-2 font-mono text-xs text-foreground focus:border-accent/40 transition-all`. Add date validation: end date must be >= start date (show inline error in `text-loss text-[10px]` with shake animation `animate-[shake_200ms]`)
- [ ] **Quick date presets**: Row of preset buttons above date inputs: "Last 7 days", "Last 30 days", "This month", "Last month". Each: `rounded border border-white/10 bg-white/1 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:border-accent/30 hover:text-accent cursor-pointer transition-all`. Clicking auto-fills both date fields. Active preset gets `border-accent/30 text-accent`.
- [ ] **Generate button**: Full width. `rounded bg-accent/10 hover:bg-accent/20 text-accent font-mono text-xs uppercase tracking-wider py-3 transition-all`. Loading state: spinner + "Generating..." text. Disabled state for empty prompt: `opacity-30 cursor-not-allowed`. Subtle scale on click: `active:scale-[0.98]`.
- [ ] **Form reset**: After successful report submission, form smoothly clears — textarea fades prompt out, dates remain (user likely wants the same range for next report). Subtle success flash `bg-profit/5` on the form container for 500ms.
- [ ] **Suggested prompts section**: Label "Quick prompts" above. Each prompt: `rounded border border-white/5 bg-white/1 p-2.5 font-mono text-xs text-muted-foreground hover:border-accent/30 hover:text-accent cursor-pointer transition-all`. Add a small icon per prompt (e.g. `BarChart3`, `Shield`, `Clock`, `GitCompare`, `AlertTriangle`). Clicking fills the textarea with the prompt text (not sends — lets user edit first). Arrow icon on hover matching empty state pattern.
- [ ] **Prompt character count**: Show character count in `font-mono text-[10px] text-muted-foreground/30` bottom-right of textarea area. Changes to `text-loss/40` when > 2000 chars.
- [ ] **Spacing**: Consistent `space-y-4` between form sections
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-011: Redesign Report Interface — Report History Panel

**Description**: As a trader, I want a polished report history panel where I can see past reports with clear status indicators and easy access to downloads.

**Acceptance Criteria**:
- [ ] **Panel header**: `flex items-center justify-between border-b border-white/5 bg-white/1 px-4 py-3`. "Report History" label: `font-mono text-xs text-foreground uppercase tracking-wider` with report count badge: `text-muted-foreground/50 font-mono text-[10px] ml-1.5` — e.g. "(12)". Refresh button: `rounded p-1.5 hover:bg-white/5 text-muted-foreground transition-all` with `RefreshCw` icon `h-3.5 w-3.5`. Refresh icon spins briefly (`animate-spin` for 500ms) when clicked.
- [ ] **Report cards**: `rounded border border-white/5 bg-white/1 p-3 hover:border-white/10 transition-all`
  - Title: `font-mono text-xs text-foreground font-medium truncate`
  - Meta row: `flex items-center gap-2 mt-1.5`
  - Status badge styles:
    - QUEUED: `text-muted-foreground bg-white/5 border-white/10`
    - GENERATING: `text-accent bg-accent/5 border-accent/20 animate-pulse`
    - COMPLETE: `text-profit bg-profit/5 border-profit/20`
    - FAILED: `text-loss bg-loss/5 border-loss/20`
  - Badge: `inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider`
  - Date: `font-mono text-[10px] text-muted-foreground` — relative time (e.g. "3h ago"), full date on hover via title attribute
  - PDF download button: visible on complete reports — `rounded border border-white/10 bg-white/2 hover:border-primary/30 hover:text-primary px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-all` with `Download` icon. Opens in new tab.
- [ ] **Completed report card extras**:
  - Token usage: `font-mono text-[10px] text-muted-foreground/40` — e.g. "12.4k tokens" (format with k suffix)
  - Time to complete: If `completedAt` and `createdAt` both exist, show duration: `font-mono text-[10px] text-muted-foreground/40` — e.g. "2m 34s"
  - Subtle success left border on complete cards: `border-l-2 border-profit/20`
- [ ] **Active report progress**: Redesign with real pipeline data from `getReportStatus` (uses new `progressStage`, `currentRound`, `totalToolCalls`, `chartsGenerated` fields from US-010A-C)
  - Container: `rounded border border-accent/20 bg-accent/2 p-3`
  - Header: pulsing dot + stage label in `font-mono text-xs text-accent`
  - **Stage labels** (mapped from `progressStage`):
    - `"queued"` → "Queued — waiting to start..."
    - `"building_context"` → "Building context — loading your trading data..."
    - `"analyzing"` → "Analyzing — AI round {currentRound}..." (e.g. "AI round 3")
    - `"generating_pdf"` → "Generating PDF — {chartsGenerated} charts found..."
    - `"uploading"` → "Uploading report..."
  - **Real progress bar**: `h-1 rounded-full bg-white/5 overflow-hidden` with inner bar width mapped to stage:
    - `queued`: 5%
    - `building_context`: 15%
    - `analyzing`: 20% + (currentRound / 20 * 55%) — scales from 20% to 75% across rounds
    - `generating_pdf`: 80%
    - `uploading`: 95%
  - Inner bar: `bg-accent/50 transition-all duration-700 ease-out` (smooth width transitions as progress updates arrive)
  - **Stats row** (below progress bar, visible during "analyzing" stage): `flex gap-3 mt-2`
    - "Round {currentRound}" — `font-mono text-[10px] text-muted-foreground`
    - "{totalToolCalls} tool calls" — `font-mono text-[10px] text-muted-foreground`
    - "{chartsGenerated} charts" (only if > 0) — `font-mono text-[10px] text-accent`
- [ ] **Failed report card**: `border-l-2 border-loss/20`. Error text truncated with expand on click. Retry button: `rounded bg-loss/10 hover:bg-loss/20 text-loss px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all active:scale-[0.98]`
- [ ] **Delete button on failed reports**: `rounded p-1 hover:bg-loss/10 text-muted-foreground hover:text-loss transition-all`
- [ ] **New report appears at top**: When a new report is created, it smoothly slides in at the top of the list with `animate-fade-in-up`
- [ ] **Generating card highlight**: The actively-generating report card gets a subtle border glow: `border-accent/20 shadow-[0_0_8px_rgba(0,212,255,0.05)]` — very subtle, just enough to draw the eye
- [ ] **Empty state**: Center `FileText` icon `h-8 w-8 text-muted-foreground/20` (with subtle `animate-pulse` at very slow speed) + "No reports yet" in `font-mono text-sm text-muted-foreground` + "Generate your first analysis report" in `font-mono text-[10px] text-muted-foreground/40` + down arrow pointing toward the form on mobile (where form is above)
- [ ] **Card spacing**: `space-y-2` between report cards
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-012: Redesign Report Interface — Layout and Responsiveness

**Description**: As a trader, I want the report interface to work well on all screen sizes with a clean layout.

**Acceptance Criteria**:
- [ ] **Desktop layout**: Side-by-side: form on left, history on right. `flex gap-3 lg:gap-4 h-full`
- [ ] **Tablet layout** (md breakpoint): Same side-by-side but form narrows to `w-[340px]`
- [ ] **Mobile layout** (below lg): Stack vertically — form on top (full width), history below with `max-h-[50vh]` overflow scroll
- [ ] **Overall container**: `flex flex-col lg:flex-row gap-3 h-full overflow-hidden`
- [ ] **History panel**: `flex-1 flex flex-col overflow-hidden` with scroll on the report list
- [ ] **Bottom fade on scrollable areas**: `pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-card to-transparent`
- [ ] Mode selector header remains full width above both panels
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser at multiple viewport sizes

---

### US-013: Add Shimmer Animation Keyframe and Shared Transition Utilities

**Description**: As a developer, I want shared animation keyframes and utility classes for the redesign so that animations are consistent and reusable.

**Acceptance Criteria**:
- [ ] Add `shimmer` keyframe to `globals.css`: slides a highlight from left to right (for progress bars)
- [ ] Add `fade-in-up` keyframe if not already present: opacity 0→1, translateY 8→0px, 300ms ease-out
- [ ] Add `animate-fade-in-up` utility class
- [ ] Add `animate-shimmer` utility class
- [ ] Verify existing `cursor-blink` keyframe works for typewriter cursor
- [ ] Keep animations minimal — only the ones actually used in this redesign
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-014: Overall Layout Polish and Integration

**Description**: As a trader, I want the entire AI section to feel cohesive with consistent spacing, borders, and transitions throughout.

**Acceptance Criteria**:
- [ ] **Main container** (page.tsx): `h-[calc(100vh-4.5rem)] flex flex-col overflow-hidden` — ensure no content clips or double scrollbars
- [ ] **Chat area outer border**: `rounded border border-white/5 bg-card overflow-hidden` (consistent with card pattern)
- [ ] **Sidebar border**: `border-r border-white/5` (no separate rounded border — it's part of the chat area on desktop)
- [ ] **Sidebar + chat seamless**: On desktop, sidebar and chat share a single rounded container with the sidebar as left panel and chat as right panel. This means the sidebar gets `border-r border-white/5` and the outer container has `rounded border border-white/5 bg-card overflow-hidden`
- [ ] **Smooth page transitions**: When switching between Chat and Report modes, content fades in (`animate-fade-in-up` on mount). The outgoing mode should fade out first (100ms) then incoming fades in (200ms) — not a crossfade, a sequential transition.
- [ ] **Scrollbar styling**: Thin custom scrollbar for message area and sidebar: `::-webkit-scrollbar { width: 4px }`, `::-webkit-scrollbar-track { background: transparent }`, `::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 2px }`, `::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1) }`. Scope to AI section container only.
- [ ] **Auto-scroll to bottom**: Smooth scroll behavior `scroll-behavior: smooth` when new messages arrive. Debounce rapid updates (batch multiple within 100ms into one scroll).
- [ ] **No layout shift**: Loading skeletons match the dimensions of real content to prevent jarring shifts
- [ ] **Global keyboard shortcuts**:
  - `/` focuses the chat input (when not already focused) — matching the empty state hint
  - `Cmd+Shift+N` / `Ctrl+Shift+N` creates a new conversation
  - `Escape` blurs the input and deselects active conversation focus
  - Shortcuts only active when on the AI page (don't interfere with other pages)
- [ ] **Error boundary**: Wrap the AI section in a React error boundary. On crash, show a terminal-styled error: `font-mono text-loss text-sm` with error message + "Something went wrong" + retry button. Better than a white screen.
- [ ] **Focus management**: When switching conversations, focus returns to the input. When opening mobile drawer, focus traps inside the drawer. When closing, focus returns to trigger button.
- [ ] **Reduced motion**: Respect `prefers-reduced-motion` media query — disable typewriter, fade-in, and shimmer animations for users who prefer reduced motion. Use `motion-safe:` Tailwind prefix.
- [ ] Remove all hardcoded `#00d4ff` — use `text-accent` and `bg-accent` CSS variables throughout
- [ ] Remove all hardcoded border colors — use `border-white/N` opacity pattern consistently
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-015: E2E Tests for AI Chat UI Redesign

**Description**: As a developer, I want E2E tests for the redesigned AI chat interface so that we can verify the new UI works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/ai-chat.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Tests:
  - Empty state renders with welcome message, capability pills, and suggested query cards
  - Clicking a suggested query populates the input
  - Sidebar renders on desktop, hidden on mobile
  - Mobile drawer opens/closes on menu button click
  - Selecting a conversation from sidebar loads messages
  - Mode toggle switches between Chat and Reports
  - Chat input accepts text and shows send button enabled
  - Message layout: user messages have `$` prefix, AI messages in cards with `→` prefix
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

### US-016: E2E Tests for AI Reports UI Redesign

**Description**: As a developer, I want E2E tests for the redesigned reports interface so that we can verify the new UI works correctly.

**Acceptance Criteria**:
- [ ] Test file: `tests/e2e/ai-reports.spec.ts`
- [ ] All new UI elements have `data-testid` attributes
- [ ] Tests:
  - Report form renders with prompt textarea, date inputs, and generate button
  - Date validation: end date before start date shows error
  - Clicking suggested prompt fills the textarea
  - Report history panel renders with report cards
  - Status badges display correctly (complete/generating/failed/queued)
  - Layout is responsive: side-by-side on desktop, stacked on mobile
  - Generate button disabled when prompt is empty
- [ ] All tests pass (`bun run test:e2e`)
- [ ] Typecheck passes (`bun run check`)

---

## Functional Requirements

1. FR-001: All existing functionality (send message, create/delete conversations, generate/retry reports, download PDFs) must continue to work identically
2. FR-002: Backend changes limited to report progress tracking only — no other API changes
3. FR-003: Typewriter effect must not block user interaction (user can still type, scroll, or navigate while animation plays)
4. FR-004: Mobile drawer must not prevent background scroll on iOS (use proper modal behavior)
5. FR-005: All interactive elements must be keyboard accessible
6. FR-006: Loading skeletons must match real content dimensions to prevent layout shift
7. FR-007: Progress updates in Trigger.dev task must be fire-and-forget (never block the generation pipeline)
8. FR-008: Existing `status` enum (queued/generating/complete/failed) remains unchanged for backward compatibility — `progressStage` is additive

## Non-Goals (Out of Scope)

- No syntax highlighting library (Prism/Shiki) — keep code blocks styled via CSS only
- No conversation search/filter feature (future story)
- No conversation rename feature (future story)
- No delete confirmation dialog (future story — keep current click-to-delete)
- No rich text input / attachments
- No real-time streaming from the API (typewriter is client-side simulation)
- No theme changes to the Terminal design system itself
- No changes to the marketing pages or other app sections

## Technical Considerations

- **Shadcn Sheet**: May need to install for mobile drawer (`bunx shadcn@latest add sheet`)
- **CSS Keyframes**: Add shimmer and fade-in-up to `globals.css` if not already present
- **Tailwind v4**: All utilities must be compatible with Tailwind v4 syntax
- **Component reuse**: ChatSidebar must render identically in desktop panel and mobile sheet — no forking into separate components
- **Performance**: Typewriter hook must use `requestAnimationFrame` or `setInterval` — avoid re-rendering the entire message list on each character
- **Hardcoded colors**: Replace all `#00d4ff` with CSS variable references (`text-accent`, `bg-accent/N`, `border-accent/N`)
- **Schema migration**: New columns added via `bun run db:push` (Drizzle push) — no manual SQL migrations needed
- **Progress updates**: Lightweight DB updates from Trigger.dev task — wrapped in try/catch so they never block report generation
- **Backward compatibility**: `progressStage` is a new text column with default `"queued"` — existing reports without progress data will show the default stage

## Design Considerations

- **Terminal identity preserved**: `$` and `→` prefixes, monospace everywhere, sharp corners
- **Opacity-based depth**: `bg-white/1`, `bg-white/2`, `border-white/5` — never solid backgrounds
- **Accent color usage**: Ice Blue (`--accent`) for AI-specific elements, Chartreuse (`--primary`) for user actions and CTAs
- **Maximum border-radius**: `rounded` (4px) only — no `rounded-lg` or larger
- **Animations**: Subtle and fast (200-300ms). Never bouncy, never slow. Terminal aesthetic = crisp transitions.
- **Data density**: Don't add excessive whitespace — traders want information-dense layouts
- **No emojis in UI**: Keep the terminal aesthetic clean

## Success Metrics

- AI section visually matches the quality of the rest of EdgeJournal (dashboard, journal)
- Chat interface feels comparable to modern AI chat apps while maintaining Terminal identity
- Report interface feels like a premium feature, not an afterthought
- Full mobile usability via sidebar drawer
- Report progress shows real pipeline stages (round count, tool calls, charts found) instead of fake percentages
- Zero regressions in existing functionality
- All E2E and integration tests pass

## Story Dependency Order

```
US-000 (Audit)
  ↓
US-013 (Animation keyframes)
  ↓
┌─── Frontend Track ──────────────────────┐  ┌─── Backend Track ────────────────────┐
│                                         │  │                                      │
│ US-001 (Empty state) ──────┐            │  │ US-010A (Schema: progress fields)     │
│ US-002 (Message layout) ───┤            │  │   ↓                                  │
│ US-003 (Tool badges) ──────┤── Parallel │  │ US-010B (Trigger.dev: emit progress)  │
│ US-005 (Chat input) ───────┤            │  │   ↓                                  │
│ US-006 (Sidebar desktop) ──┘            │  │ US-010C (tRPC: return progress)       │
│   ↓                                     │  │   ↓                                  │
│ US-004 (Typewriter)                     │  │ US-010D (Integration tests)           │
│ US-007 (Mobile drawer)                  │  │                                      │
│ US-008 (Mode toggle)                    │  └──────────────────────────────────────┘
│ US-009 (Message renderer)               │
│   ↓                                     │
│ US-010 (Report form) ──────┐            │
│ US-011 (Report history) ───┤── Parallel │  ← US-011 depends on US-010C for progress data
│ US-012 (Report layout) ────┘            │
│   ↓                                     │
│ US-014 (Integration polish)             │
│   ↓                                     │
│ US-015 (E2E Chat tests) ──┐            │
│ US-016 (E2E Report tests) ┘            │
└─────────────────────────────────────────┘
```

## Open Questions

- None — scope is well-defined. Backend changes are limited to report progress tracking.
