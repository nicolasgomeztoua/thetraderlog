# PRD: Admin Panel

## Overview

A full management platform for EdgeJournal administrators. Secured via the existing `users.role = 'admin'` database column, the admin panel provides complete visibility into platform operations: bug report triage, user management, AI usage monitoring, platform analytics, and system health. Follows the Terminal design system with a dedicated `/admin` route group.

## Goals

- Provide admins full visibility into all user data, AI usage, and platform activity
- Enable bug report triage with status management
- Surface platform-level analytics (growth, usage, engagement)
- Monitor AI token consumption and system health
- Maintain Terminal design system consistency

## Non-Goals (Out of Scope)

- Clerk Organizations integration (using DB role only)
- Modifying user data (trades, accounts) — admin is read + status updates only
- Billing/payment management
- Real-time websocket updates (polling/refresh is fine)
- Public-facing status page
- User impersonation / acting as a user

## Architecture

### Auth Pattern

```
protectedProcedure → adminProcedure (checks ctx.user.role === 'admin')
```

New `adminProcedure` middleware rejects non-admins with `FORBIDDEN` error. All admin routes use this.

### Route Structure

```
src/app/(admin)/
├── admin/
│   ├── layout.tsx          # Admin layout with admin sidebar
│   ├── page.tsx            # Dashboard overview (redirects or shows summary)
│   ├── bug-reports/
│   │   └── page.tsx        # Bug report triage
│   ├── users/
│   │   ├── page.tsx        # User list
│   │   └── [userId]/
│   │       └── page.tsx    # User detail (trades, AI, activity)
│   ├── ai/
│   │   └── page.tsx        # AI usage & conversations
│   ├── analytics/
│   │   └── page.tsx        # Platform analytics
│   └── system/
│       └── page.tsx        # System health
```

### Router Structure

```
src/server/api/routers/admin/
├── index.ts                # Admin merged router
├── bugReports.ts           # Bug report management
├── users.ts                # User management
├── ai.ts                   # AI usage queries
├── analytics.ts            # Platform analytics
└── system.ts               # System health metrics
```

---

## User Stories

### US-001: Admin Procedure Middleware

**Description**: As a developer, I want an `adminProcedure` tRPC middleware so that all admin endpoints enforce role-based access.

**Acceptance Criteria**:
- [ ] Create `adminProcedure` in `src/server/api/trpc.ts` that extends `protectedProcedure`
- [ ] Middleware checks `ctx.user.role === 'admin'`, throws `FORBIDDEN` TRPCError if not
- [ ] Export `adminProcedure` alongside existing procedures
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-002: Admin Route Group & Layout

**Description**: As an admin, I want a dedicated admin layout with sidebar navigation so that I can access all admin panels.

**Acceptance Criteria**:
- [ ] Create `(admin)` route group with `layout.tsx`
- [ ] Admin sidebar with navigation: Overview, Bug Reports, Users, AI Usage, Analytics, System
- [ ] Terminal design system: dark theme, chartreuse accents, monospace labels
- [ ] "Back to App" link to return to normal dashboard
- [ ] Layout rejects non-admin users (redirect to `/dashboard` or show unauthorized)
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-003: Admin Navigation Link in Main Sidebar

**Description**: As an admin, I want a link to the admin panel in the main app sidebar so that I can quickly access it.

**Acceptance Criteria**:
- [ ] Conditionally show "Admin" nav item in `app-sidebar.tsx` when user role is admin
- [ ] Use a distinct icon (e.g., Shield or Settings2)
- [ ] Links to `/admin`
- [ ] Hidden for non-admin users
- [ ] Create tRPC query or use existing user data to check role on client
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-004: Admin Overview Dashboard Page

**Description**: As an admin, I want a dashboard overview page showing key platform metrics at a glance.

**Acceptance Criteria**:
- [ ] Create `/admin` page with summary cards
- [ ] Cards: Total Users, Active Users (last 7 days), Total Trades, Open Bug Reports, AI Conversations (last 7 days), Total AI Tokens Used
- [ ] Each card links to its detailed panel
- [ ] Terminal design: monospace numbers, chartreuse highlights for key metrics
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-005: Admin Overview Backend — Platform Stats Endpoint

**Description**: As a developer, I want a tRPC endpoint returning platform summary stats for the admin overview dashboard.

**Acceptance Criteria**:
- [ ] Create `admin.analytics.platformStats` query using `adminProcedure`
- [ ] Returns: totalUsers, activeUsersLast7d, totalTrades, openBugReports, aiConversationsLast7d, totalTokensUsed
- [ ] Active users = users with trades or AI conversations in last 7 days
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-006: Integration Tests for Admin Middleware & Platform Stats

**Description**: As a developer, I want integration tests for the admin middleware and platform stats endpoint.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin.test.ts`
- [ ] Test: non-admin user gets FORBIDDEN on admin endpoints
- [ ] Test: admin user can access platform stats
- [ ] Test: platform stats returns correct counts
- [ ] Use `setupTrader()` fixtures, manually set role to admin for admin user
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-007: Admin Bug Reports Backend — List & Update Endpoints

**Description**: As a developer, I want tRPC endpoints to list and update bug reports for admin triage.

**Acceptance Criteria**:
- [ ] Create `admin.bugReports.list` query — returns all bug reports with user info, supports filtering by status/category/severity, pagination (cursor-based or offset), sorted by newest first
- [ ] Create `admin.bugReports.updateStatus` mutation — updates bug report status (open → in_progress → resolved → closed)
- [ ] Create `admin.bugReports.getById` query — returns single bug report with full details
- [ ] All use `adminProcedure`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-008: Integration Tests for Admin Bug Reports Endpoints

**Description**: As a developer, I want integration tests for admin bug report management endpoints.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin-bug-reports.test.ts`
- [ ] Test: list returns bug reports with user info
- [ ] Test: filter by status works
- [ ] Test: updateStatus transitions correctly
- [ ] Test: getById returns full details
- [ ] Test: non-admin rejected
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-009: Bug Reports Admin Page — List View

**Description**: As an admin, I want a bug reports page to triage and manage reported issues.

**Acceptance Criteria**:
- [ ] Create `/admin/bug-reports` page
- [ ] Table view: title, category, severity, status, reporter (name/email), date
- [ ] Filters: status dropdown, category dropdown, severity dropdown
- [ ] Severity badges with colors (critical=red, high=orange, medium=yellow, low=gray)
- [ ] Status badges with colors (open=red, in_progress=yellow, resolved=green, closed=gray)
- [ ] Click row to expand/view full details (description, screenshot, page URL, user agent, metadata)
- [ ] Status update dropdown per row
- [ ] Terminal design: monospace table, data-dense layout
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-010: Admin Users Backend — List & Management Endpoints

**Description**: As a developer, I want tRPC endpoints to list users and update their roles.

**Acceptance Criteria**:
- [ ] Create `admin.users.list` query — returns all users with account count, trade count, last active date, role; supports search by name/email, pagination
- [ ] Create `admin.users.getById` query — returns single user with full details: accounts, recent trades (last 10), AI conversation count, bug report count
- [ ] Create `admin.users.updateRole` mutation — updates user role (user ↔ admin)
- [ ] All use `adminProcedure`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-011: Integration Tests for Admin Users Endpoints

**Description**: As a developer, I want integration tests for admin user management endpoints.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin-users.test.ts`
- [ ] Test: list returns users with counts
- [ ] Test: search by email works
- [ ] Test: getById returns full user details
- [ ] Test: updateRole toggles role correctly
- [ ] Test: non-admin rejected
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-012: Users Admin Page — List View

**Description**: As an admin, I want a users page to view and manage all platform users.

**Acceptance Criteria**:
- [ ] Create `/admin/users` page
- [ ] Table: name, email, role, accounts count, trades count, joined date, last active
- [ ] Search bar for name/email filtering
- [ ] Role badge (admin=chartreuse, user=gray)
- [ ] Click row to navigate to user detail page
- [ ] Pagination controls
- [ ] Terminal design: monospace table, data-dense
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-013: User Detail Admin Page

**Description**: As an admin, I want a user detail page to see a specific user's full activity.

**Acceptance Criteria**:
- [ ] Create `/admin/users/[userId]` page
- [ ] Header: user name, email, avatar, role, joined date
- [ ] Role toggle button (promote to admin / demote to user) with confirmation dialog
- [ ] Sections: Accounts list, Recent Trades (last 10 with P&L), AI Conversations summary, Bug Reports by this user
- [ ] Each section shows count and brief data
- [ ] Terminal design: data-dense, monospace values
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-014: Admin AI Usage Backend — Chat & Report Endpoints

**Description**: As a developer, I want tRPC endpoints to view AI usage across all users.

**Acceptance Criteria**:
- [ ] Create `admin.ai.listConversations` query — returns all AI conversations with user info, token count, message count, mode (chat/report), status; supports filtering by mode/status, pagination, sorted newest first
- [ ] Create `admin.ai.getConversation` query — returns single conversation with all messages
- [ ] Create `admin.ai.usageStats` query — returns total tokens used, tokens by model, conversations by mode, daily usage for last 30 days
- [ ] All use `adminProcedure`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-015: Integration Tests for Admin AI Endpoints

**Description**: As a developer, I want integration tests for admin AI usage endpoints.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin-ai.test.ts`
- [ ] Test: listConversations returns conversations with user info
- [ ] Test: filter by mode (chat vs report) works
- [ ] Test: getConversation returns messages
- [ ] Test: usageStats returns aggregated data
- [ ] Test: non-admin rejected
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-016: AI Usage Admin Page

**Description**: As an admin, I want an AI usage page to monitor conversations, reports, and token consumption.

**Acceptance Criteria**:
- [ ] Create `/admin/ai` page
- [ ] Top stats: total conversations, total reports, total tokens, avg tokens per conversation
- [ ] Token usage chart (daily for last 30 days) — simple bar/line chart
- [ ] Conversations table: user, title, mode (chat/report), status, messages count, tokens, date
- [ ] Filter by mode (chat/report) and status
- [ ] Click conversation to expand and view messages inline
- [ ] Terminal design: ice blue (`#00d4ff`) accent for AI section
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-017: Admin Platform Analytics Backend

**Description**: As a developer, I want tRPC endpoints for platform-wide analytics.

**Acceptance Criteria**:
- [ ] Create `admin.analytics.growth` query — returns daily new users and cumulative total for last 30 days
- [ ] Create `admin.analytics.tradingActivity` query — returns daily trade count, total P&L, avg trade size for last 30 days
- [ ] Create `admin.analytics.topTraders` query — returns top 10 users by total P&L with name, email, trade count, total P&L
- [ ] Create `admin.analytics.accountBreakdown` query — returns count of accounts by type (demo, live, prop_challenge, prop_funded)
- [ ] All use `adminProcedure`
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-018: Integration Tests for Admin Analytics Endpoints

**Description**: As a developer, I want integration tests for admin platform analytics endpoints.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin-analytics.test.ts`
- [ ] Test: growth returns daily user counts
- [ ] Test: tradingActivity returns daily trade data
- [ ] Test: topTraders returns ranked users
- [ ] Test: accountBreakdown returns correct counts per type
- [ ] Test: non-admin rejected
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-019: Platform Analytics Admin Page

**Description**: As an admin, I want a platform analytics page with growth and trading activity charts.

**Acceptance Criteria**:
- [ ] Create `/admin/analytics` page
- [ ] User growth chart (daily new + cumulative line)
- [ ] Trading activity chart (daily trades + P&L)
- [ ] Top 10 traders leaderboard table
- [ ] Account type breakdown (pie/donut or bar chart)
- [ ] Use recharts or simple SVG charts consistent with existing analytics page
- [ ] Terminal design: chartreuse for positive metrics, red for losses
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-020: Admin System Health Backend

**Description**: As a developer, I want a tRPC endpoint for system health metrics.

**Acceptance Criteria**:
- [ ] Create `admin.system.health` query using `adminProcedure`
- [ ] Returns: database row counts (users, trades, accounts, aiConversations, aiMessages, bugReports), database connection status (simple query), app version (from package.json), last user signup date, last trade date, last AI conversation date
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-021: Integration Tests for Admin System Health Endpoint

**Description**: As a developer, I want integration tests for the admin system health endpoint.

**Acceptance Criteria**:
- [ ] Test file: `tests/integration/admin-system.test.ts`
- [ ] Test: health endpoint returns all expected fields
- [ ] Test: database counts are accurate
- [ ] Test: non-admin rejected
- [ ] All tests pass (`bun run test`)
- [ ] Typecheck passes (`bun run check`)

---

### US-022: System Health Admin Page

**Description**: As an admin, I want a system health page showing database stats and system status.

**Acceptance Criteria**:
- [ ] Create `/admin/system` page
- [ ] Status indicator: database connection (green/red dot)
- [ ] Table counts: rows per table displayed as stat cards
- [ ] Last activity timestamps: last signup, last trade, last AI conversation
- [ ] App version from package.json
- [ ] Terminal design: green for healthy, red for issues
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser

---

### US-023: Admin Constants & Error Messages

**Description**: As a developer, I want shared constants for the admin panel so nothing is hardcoded.

**Acceptance Criteria**:
- [ ] Create `src/lib/constants/admin.ts` with: admin nav items, status/severity/category label maps, role labels, table page sizes
- [ ] Add admin error messages to `src/lib/constants/errors.ts`: `ERR_ADMIN_FORBIDDEN`, `ERR_ADMIN_USER_NOT_FOUND`, `ERR_ADMIN_INVALID_STATUS_TRANSITION`
- [ ] Admin pages import from constants, no hardcoded strings
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)

---

### US-024: Admin Middleware Guard on Routes

**Description**: As a developer, I want Next.js middleware to protect admin routes so non-admins can't access admin pages.

**Acceptance Criteria**:
- [ ] Update existing middleware or add client-side guard in admin layout
- [ ] Non-admin users accessing `/admin/*` are redirected to `/dashboard`
- [ ] Admin layout fetches user role and gates rendering
- [ ] Loading state while checking role
- [ ] Typecheck passes (`bun run check`)
- [ ] Build passes (`bun run build`)
- [ ] Verify in browser: non-admin user redirected, admin user sees panel

---

## Functional Requirements

1. **FR-001**: All admin endpoints use `adminProcedure` that checks `ctx.user.role === 'admin'`
2. **FR-002**: Admin can view all user data (trades, accounts, AI conversations, bug reports)
3. **FR-003**: Admin can update bug report status (open → in_progress → resolved → closed)
4. **FR-004**: Admin can promote/demote user roles (user ↔ admin) with confirmation
5. **FR-005**: Platform analytics cover user growth, trading activity, and account distribution
6. **FR-006**: AI usage monitoring shows token consumption, conversation history, and trends
7. **FR-007**: System health shows database status and table row counts
8. **FR-008**: All admin pages follow Terminal design system
9. **FR-009**: Admin navigation only visible to admin-role users

## Technical Considerations

- **Database**: No schema changes needed — existing `users.role` enum already supports `'admin'`
- **tRPC**: New `adminProcedure` middleware extends `protectedProcedure` with role check
- **Routing**: New `(admin)` route group with dedicated layout, separate from `(protected)`
- **Charts**: Use same charting approach as existing analytics page (recharts)
- **Pagination**: Cursor-based or offset pagination for large tables (users, conversations)
- **Performance**: Admin queries may scan large tables — add appropriate indexes if needed
- **Constants**: All labels, status maps, nav items in `src/lib/constants/admin.ts`

## Design Considerations

- Terminal design system: `bg-background: #050505`, monospace fonts
- Primary accent: Chartreuse `#d4ff00` for admin highlights and active states
- AI section accent: Ice Blue `#00d4ff` for AI usage page
- Data colors: Green `#00ff88` for healthy/profit, Red `#ff3b3b` for issues/losses
- Data-dense tables with compact rows, monospace values
- Status badges with color-coded backgrounds
- Admin sidebar distinct from main app sidebar (different nav items, admin branding)

## Success Metrics

- Admin can triage all bug reports without direct database access
- Admin can view any user's trading activity and AI usage
- Platform growth trends visible at a glance
- System health monitoring prevents issues from going unnoticed

## Open Questions

- Should there be email notifications when bug report status changes? (deferred — not in v1)
- Should admin actions be audit-logged? (deferred — not in v1)
- Token usage cost calculation? (deferred — requires pricing config)
