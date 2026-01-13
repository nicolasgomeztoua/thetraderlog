# UX Design Skill

A 3-step workflow for transforming rough MVP ideas into build-ready UI prompts through structured PRD generation, clarification, and UX specification.

## When to Use

- Starting a new feature and need UX foundations before coding
- Converting product ideas into mockup-ready specifications
- Preparing input for UI generation tools (v0, Bolt, Google Stitch, Figma AI)
- Need structured thinking before visual design

## The 3-Step Workflow

```
Step 1: Lite PRD (Sections 1-7)
         ↓
Step 2: PRD Clarifier (Interactive Q&A)
         ↓
Step 3: PRD → UX Spec (6 Forced Passes)
         ↓
Step 4: UX Spec → Build Prompts
```

---

## Step 1: Lite PRD Generator

Convert a rough MVP idea into a demo-grade PRD covering sections 1-7.

### Input

The user provides:
- A rough MVP or demo description
- Possibly vague, incomplete, or "vibe-level" ideas

Infer missing details but clearly label assumptions. Optimize for a believable demo, not production scale.

### Output Structure

#### 1. One-Sentence Problem

> [User] struggles to [do X] because [reason], resulting in [impact].

Pick the single most demo-worthy problem.

#### 2. Demo Goal (What Success Looks Like)

- What must work for this demo to be successful
- What outcome the demo should communicate
- Non-Goals (intentionally out of scope)

#### 3. Target User (Role-Based)

One primary user role:
- Role / context
- Skill level
- Key constraint (time, knowledge, access)

Avoid personas or demographics.

#### 4. Core Use Case (Happy Path)

Single most important end-to-end flow:
- Start condition
- Step-by-step flow (numbered)
- End condition

If this flow works, the demo works.

#### 5. Functional Decisions (What It Must Do)

| ID | Function | Notes |
|----|----------|-------|

- Phrase as capabilities, not implementation
- No "nice-to-haves"

#### 6. UX Decisions

**6.1 Entry Point**: How user starts, what they see first

**6.2 Inputs**: What user provides (if anything)

**6.3 Outputs**: What user receives and in what form

**6.4 Feedback & States**: How system communicates loading, success, failure, partial results

**6.5 Errors**: What happens when input is invalid, system fails, or user does nothing

#### 7. Data & Logic

**7.1 Inputs**: Where data comes from (user, API, static, generated)

**7.2 Processing**: High-level logic (input → transform → output)

**7.3 Outputs**: Where results go (UI only, temporarily stored, logged)

### After Step 1

Save to `plans/prd-[feature-name].md`, then proceed to Step 2.

---

## Step 2: PRD Clarifier

Refine the PRD through structured questioning using the AskUserQuestion tool.

### Initialization

1. **Create tracking document** in same directory as PRD:
   - `feature-x.md` → `feature-x-clarification-session.md`

2. **Ask depth preference**:

```json
{
  "questions": [{
    "question": "What depth of PRD analysis would you like?",
    "header": "Depth",
    "multiSelect": false,
    "options": [
      {"label": "Quick (5 questions)", "description": "Rapid surface-level review of critical ambiguities"},
      {"label": "Medium (10 questions)", "description": "Balanced analysis covering key requirement areas"},
      {"label": "Long (20 questions)", "description": "Comprehensive review with detailed exploration"},
      {"label": "Ultralong (35 questions)", "description": "Exhaustive deep-dive leaving no stone unturned"}
    ]
  }]
}
```

### Question Categories

Distribute questions across:
1. User/Stakeholder Clarity
2. Functional Requirements
3. Non-Functional Requirements
4. Technical Constraints
5. Edge Cases & Error Handling
6. Data Requirements
7. Business Rules
8. Acceptance Criteria
9. Scope Boundaries
10. Dependencies & Risks

### Tracking Format

After EACH question-answer pair, append to tracking document:

```markdown
## Question [N]
**Category**: [e.g., User Requirements]
**Ambiguity Identified**: [Brief description]
**Question Asked**: [Your question]
**User Response**: [Their answer]
**Requirement Clarified**: [How this resolves ambiguity]
```

### Rules

- ALWAYS use AskUserQuestion tool with 2-4 options
- Complete ALL questions based on selected depth
- Update tracking document after EVERY answer
- Each question must relate to genuine ambiguities

---

## Step 3: PRD to UX Spec

Translate the clarified PRD into UX foundations through 6 forced designer mindset passes.

### The Iron Law

```
NO VISUAL SPECS UNTIL ALL 6 PASSES COMPLETE
```

- Don't mention colors, typography, or spacing until Pass 6 is done
- Don't describe screen layouts until IA is explicit
- Don't design components until affordances are mapped

### The 6 Passes

Execute IN ORDER. Each pass produces required outputs before the next begins.

#### Pass 1: User Intent & Mental Model

**Question**: "What does the user think is happening?"

```markdown
## Pass 1: Mental Model

**Primary user intent:** [One sentence]

**Likely misconceptions:**
- [Misconception 1]
- [Misconception 2]

**UX principle to reinforce/correct:** [Specific principle]
```

#### Pass 2: Information Architecture

**Question**: "What exists, and how is it organized?"

```markdown
## Pass 2: Information Architecture

**All user-visible concepts:**
- [Concept 1]
- [Concept 2]

**Grouped structure:**

### [Group Name]
- [Concept]: [Primary/Secondary/Hidden]
- Rationale: [One sentence why this grouping]
```

#### Pass 3: Affordances & Action Clarity

**Question**: "What actions are obvious without explanation?"

```markdown
## Pass 3: Affordances

| Action | Visual/Interaction Signal |
|--------|---------------------------|
| [Action] | [What makes it obvious] |

**Affordance rules:**
- If user sees X, they should assume Y
```

#### Pass 4: Cognitive Load & Decision Minimization

**Question**: "Where will the user hesitate?"

```markdown
## Pass 4: Cognitive Load

**Friction points:**
| Moment | Type | Simplification |
|--------|------|----------------|
| [Where] | Choice/Uncertainty/Waiting | [How to reduce] |

**Defaults introduced:**
- [Default 1]: [Rationale]
```

#### Pass 5: State Design & Feedback

**Question**: "How does the system talk back?"

```markdown
## Pass 5: State Design

### [Element/Screen]

| State | User Sees | User Understands | User Can Do |
|-------|-----------|------------------|-------------|
| Empty | | | |
| Loading | | | |
| Success | | | |
| Partial | | | |
| Error | | | |
```

#### Pass 6: Flow Integrity Check

**Question**: "Does this feel inevitable?"

```markdown
## Pass 6: Flow Integrity

**Flow risks:**
| Risk | Where | Mitigation |
|------|-------|------------|
| [Risk] | [Location] | [Guardrail/Nudge] |

**Visibility decisions:**
- Must be visible: [List]
- Can be implied: [List]

**UX constraints:** [Hard rules for visual phase]
```

### Output Location

Write UX spec to same directory as source PRD:
- `feature-x.md` → `feature-x-ux-spec.md`

---

## Step 4: UX Spec to Build Prompts

Transform UX spec into sequenced, self-contained prompts for UI generation tools.

### Build Order

```
1. Foundation     → Design tokens, shared types, base styles
2. Layout Shell   → Page structure, navigation, panels
3. Core Components → Primary UI elements
4. Interactions   → Drag-drop, connections, pickers
5. States         → Empty, loading, error, success
6. Polish         → Animations, responsive, edge cases
```

### Prompt Structure

Each prompt follows this template:

```markdown
## [Feature Name]

### Context
[What this feature is and where it fits]

### Requirements
- [Specific behavior/appearance requirement]
- [Include relevant specs: dimensions, colors, states]

### States
- Default: [description]
- [Other states]

### Interactions
- [How user interacts]
- [Keyboard support if applicable]

### Constraints
- [Technical or design constraints]
- [What NOT to include]
```

### Self-Containment Rules

Each prompt MUST include:
- Enough context to understand the feature in isolation
- All visual specs relevant to that feature
- All states that feature can be in
- All interactions for that feature

Each prompt MUST NOT:
- Reference "see previous prompt"
- Assume knowledge from other prompts
- Leave specs vague ("appropriate styling")

### Output

Generate markdown document with all prompts in build order:

```markdown
# Build-Order Prompts: [Project Name]

## Overview
[1-2 sentence summary]

## Build Sequence
1. [Prompt name] - [brief description]
2. [Prompt name] - [brief description]

---

## Prompt 1: [Feature Name]
[Full self-contained prompt]

---

## Prompt 2: [Feature Name]
[Full self-contained prompt]
```

Save to: `plans/[feature-name]-build-prompts.md`

---

## Red Flags - STOP and Restart

| Violation | What You're Skipping |
|-----------|---------------------|
| Describing colors/fonts early | All foundational passes |
| "The main screen shows..." | Pass 1-2 (mental model, IA) |
| Designing components before actions mapped | Pass 3 (affordances) |
| No friction point analysis | Pass 4 (cognitive load) |
| States only in component specs | Pass 5 (holistic state design) |
| No "where could they fail?" | Pass 6 (flow integrity) |

## Output Files Summary

| Step | Output File |
|------|-------------|
| Step 1 | `plans/prd-[feature].md` |
| Step 2 | `plans/prd-[feature]-clarification-session.md` |
| Step 3 | `plans/[feature]-ux-spec.md` |
| Step 4 | `plans/[feature]-build-prompts.md` |
