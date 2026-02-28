# UX Skill Reference

Detailed examples and patterns for the UX design workflow.

## Lite PRD Example

### Input
"I want a simple app that helps people track their water intake"

### Output

#### 1. One-Sentence Problem

> Health-conscious individuals struggle to remember to drink enough water throughout the day because they get absorbed in work/activities, resulting in dehydration and decreased energy.

#### 2. Demo Goal

**What must work:**
- User can log water intake with one tap
- User sees daily progress toward goal
- Visual feedback when goal is reached

**Non-Goals:**
- No reminders/notifications (demo scope)
- No historical data or trends
- No customizable container sizes

#### 3. Target User

- **Role**: Office worker trying to stay hydrated
- **Skill level**: Basic smartphone user
- **Key constraint**: Time—needs to log in <3 seconds

#### 4. Core Use Case

**Start**: User opens app, sees today's progress at 4/8 glasses

**Flow**:
1. User taps large "+" button
2. Glass count increments to 5/8
3. Progress ring animates
4. Brief success feedback

**End**: User closes app, continues work

#### 5. Functional Decisions

| ID | Function | Notes |
|----|----------|-------|
| F1 | Log single glass of water | One tap, fixed 8oz serving |
| F2 | Display daily progress | Glasses drunk / daily goal |
| F3 | Reset at midnight | Auto-reset, no user action |
| F4 | Goal completion celebration | Visual feedback at 8/8 |

#### 6. UX Decisions

**6.1 Entry Point**
- Opens directly to today's tracker
- No onboarding, no login

**6.2 Inputs**
- Single tap to log (no quantity input)
- Long-press to undo last entry

**6.3 Outputs**
- Current glass count
- Visual progress ring
- Goal status

**6.4 Feedback & States**
- Logging: Brief haptic + ring animation
- Goal reached: Celebration animation, color change
- No loading states (instant local storage)

**6.5 Errors**
- Can't log negative: Undo button disabled at 0
- Can't exceed goal: Allow over-logging (shows 9/8)

#### 7. Data & Logic

**7.1 Inputs**: User taps only (no external data)

**7.2 Processing**: count++ on tap, reset to 0 at midnight

**7.3 Outputs**: UI only, localStorage for persistence

---

## PRD Clarifier Question Examples

### User Requirements Category

```json
{
  "question": "When a user 'completes' tracking for the day, what should happen?",
  "header": "Completion",
  "multiSelect": false,
  "options": [
    {"label": "Nothing special", "description": "Just show 8/8, user closes app normally"},
    {"label": "Celebration modal", "description": "Full-screen celebration with stats"},
    {"label": "Subtle celebration", "description": "Confetti animation, no modal"}
  ]
}
```

### Edge Case Category

```json
{
  "question": "If user opens app at 11:59 PM and logs at 12:00 AM, what happens?",
  "header": "Midnight Edge",
  "multiSelect": false,
  "options": [
    {"label": "Log to previous day", "description": "If app was open, count toward yesterday"},
    {"label": "Log to new day", "description": "Always use current timestamp"},
    {"label": "Ask user", "description": "Show quick prompt asking which day"}
  ]
}
```

### Scope Boundary Category

```json
{
  "question": "Should users be able to customize their daily water goal?",
  "header": "Goal Setting",
  "multiSelect": false,
  "options": [
    {"label": "Fixed 8 glasses", "description": "Simpler demo, no settings needed"},
    {"label": "Adjustable goal", "description": "Settings screen to set 1-16 glasses"},
    {"label": "Smart suggestion", "description": "Calculate based on weight (requires onboarding)"}
  ]
}
```

---

## 6-Pass UX Spec Example

### Pass 1: Mental Model

**Primary user intent:** "I want to track how much water I've had today so I stay hydrated."

**Likely misconceptions:**
- User might expect app to remind them (it doesn't)
- User might expect to log exact ml/oz (it's fixed servings)
- User might expect historical data (demo doesn't store)

**UX principle to reinforce:** Immediate feedback—every tap shows instant progress.

### Pass 2: Information Architecture

**All user-visible concepts:**
- Current glass count
- Daily goal
- Progress visualization
- Time until reset

**Grouped structure:**

#### Primary View
- Glass count: Primary
- Progress ring: Primary
- Goal number: Primary

#### Secondary (on-demand)
- Undo button: Secondary (appears after logging)
- Time until reset: Hidden (only relevant near midnight)

### Pass 3: Affordances

| Action | Visual/Interaction Signal |
|--------|---------------------------|
| Log water | Large prominent "+" button, elevated styling |
| Undo entry | "-" button appears only after logging |
| View progress | Ring fills proportionally, impossible to miss |

**Affordance rules:**
- If user sees the big button, they should tap it
- Progress ring should feel "fillable"—user wants to complete it

### Pass 4: Cognitive Load

**Friction points:**

| Moment | Type | Simplification |
|--------|------|----------------|
| "How much to log?" | Choice | Fixed 8oz—no choice needed |
| "Did it register?" | Uncertainty | Haptic + animation confirms |
| "Am I done for today?" | Uncertainty | Clear 8/8 with celebration |

**Defaults introduced:**
- 8oz per tap: Eliminates quantity decisions
- 8 glasses goal: Standard recommendation, no setup

### Pass 5: State Design

#### Main Screen

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Empty | "0/8" with empty ring | Fresh day, no water logged | Tap to log first glass |
| Partial | "4/8" with half-filled ring | Making progress | Continue logging |
| Complete | "8/8" with full ring + celebration | Goal achieved | Log more or close app |
| Over-goal | "10/8" with overflowing ring | Exceeded goal | Close app, feel accomplished |

### Pass 6: Flow Integrity

**Flow risks:**

| Risk | Where | Mitigation |
|------|-------|------------|
| Accidental tap | Log button | Undo button appears for 5 seconds |
| Forgot to log | All day | N/A for demo (no reminders) |
| Unclear reset | Midnight | Show countdown in last hour |

**Visibility decisions:**
- Must be visible: Count, progress ring, log button
- Can be implied: Goal (always 8), reset time

**UX constraints:**
- Log action must complete in <200ms
- No modals or interruptions for core flow

---

## Build-Order Prompts Example

### Overview
A minimal water tracking app with tap-to-log functionality and visual progress.

### Build Sequence
1. Design Tokens - Colors and typography
2. Progress Ring - Core visual component
3. Main Screen - Layout and composition
4. Interactions - Tap feedback and undo
5. States - Empty, partial, complete, over-goal

---

### Prompt 1: Design Tokens

#### Context
Foundation design tokens for a minimal water tracking app. Clean, health-focused aesthetic with calming blues.

#### Requirements
- Primary blue: #0EA5E9 (water-like)
- Background: #F8FAFC (light, clean)
- Text: #1E293B (readable contrast)
- Success: #22C55E (goal complete)
- Font: System sans-serif
- Spacing unit: 8px

#### Constraints
- Mobile-first (375px width minimum)
- Dark mode not required for demo
- No custom fonts (system only)

---

### Prompt 2: Progress Ring Component

#### Context
A circular progress indicator showing water intake progress. The primary visual feedback element users will watch fill up throughout the day.

#### Requirements
- Circular ring, 200px diameter
- Stroke width: 12px
- Background stroke: Light gray (#E2E8F0)
- Progress stroke: Primary blue (#0EA5E9)
- Center displays: Current count / Goal (e.g., "4/8")
- Count in large bold text (48px)
- Smooth animation when progress changes

#### States
- Empty (0%): Only background stroke visible
- Partial: Blue stroke fills clockwise from top
- Complete (100%): Full ring, changes to success green
- Over-goal (>100%): Ring stays full, count shows overflow (10/8)

#### Interactions
- No direct interaction (display only)
- Animates on value change (0.3s ease-out)

#### Constraints
- SVG-based for crisp rendering
- Must work at 2x scale for retina

---

### Prompt 3: Main Screen Layout

#### Context
The only screen in the app. Shows today's water intake progress with a prominent log button. Optimized for quick one-handed use.

#### Requirements
- Full viewport height layout
- Progress ring centered vertically, upper third
- Large "+" button below ring (64px diameter)
- "Log Water" label below button
- Current time/date at top (subtle)
- Generous padding (32px sides)

#### States
- Default: Progress ring + log button visible
- After logging: Undo button appears briefly (5 seconds)

#### Interactions
- Log button: Primary tap target, 44px minimum touch
- Pull-to-refresh: Not needed (local data)

#### Constraints
- Safe area insets for notched phones
- Button must be thumb-reachable in portrait

---

### Prompt 4: Tap Interactions

#### Context
Feedback when user logs water. Must feel instant and satisfying to encourage habit formation.

#### Requirements
- Tap log button: Increment count by 1
- Visual feedback: Ring animates, button scales down briefly
- Haptic feedback: Light impact (on supported devices)
- Undo appears: Small "-" button fades in for 5 seconds
- Undo tap: Decrement count, undo button disappears

#### States
- Pre-tap: Log button at rest
- During tap: Button scales to 0.95x
- Post-tap: Ring animates, undo appears
- Goal reached: Additional celebration (confetti or pulse)

#### Constraints
- Total feedback time <200ms
- Undo only affects last action (single level)
- No confirmation dialogs

---

### Prompt 5: All States

#### Context
Complete state coverage for the water tracker ensuring no dead ends or confusion.

#### Empty State (0/8)
- Ring: Background stroke only
- Count: "0/8" in default text color
- Message: "Tap to log your first glass" below button

#### Partial State (1-7/8)
- Ring: Proportionally filled
- Count: "N/8" with subtle progress color
- No additional message

#### Complete State (8/8)
- Ring: Full, green success color
- Count: "8/8" in success green, bold
- Celebration: Subtle confetti animation (once)
- Message: "Goal reached!" fades in briefly

#### Over-Goal State (9+/8)
- Ring: Stays full green
- Count: "N/8" shows actual count
- Message: "Bonus hydration!" (subtle, encouraging)

#### Constraints
- Celebration plays only once per day
- States transition smoothly (no jarring changes)
- Over-goal is positive, never penalizing
