#!/bin/bash
# Ralph - Autonomous AI Agent Loop (Enhanced Edition)
# Combines EdgeJournal's 4-phase workflow with Ralphy's multi-agent + parallel features
#
# Features stolen from Ralphy (michaelshimeles/ralphy):
#   - Multi-agent support (Claude, OpenCode, Cursor, Codex, Qwen, Copilot)
#   - Parallel execution with git worktrees
#   - Cost/token tracking
#   - GitHub Issues as task source
#   - Dry-run mode
#   - Exponential backoff retry
#   - Per-task branching with auto-merge
#   - Config file support
#
# Original EdgeJournal features preserved:
#   - 4-phase workflow (implementation → code quality → PR → Greptile review)
#   - AGENTS.md compound engineering
#   - Security + consistency audits
#
# Usage: ./ralph.sh [options]
#   --engine <name>       AI engine: claude (default), opencode, cursor, codex, qwen, copilot
#   --parallel [n]        Run n agents in parallel (default: 3)
#   --branch-per-task     Create separate branch per task
#   --create-pr           Create PR for each task branch (requires --branch-per-task)
#   --draft-pr            Create draft PRs instead
#   --issues <label>      Pull tasks from GitHub Issues with label
#   --dry-run             Preview what would happen without executing
#   --max-iterations <n>  Max iterations (default: 20)
#   --pr-cycles <n>       PR review cycles (default: 10)
#   --no-quality          Skip Phase 2 code quality review
#   --no-greptile         Skip Phase 4 Greptile review
#   --model <model>       Override model for the AI engine
#   --init                Initialize .ralph/config.yaml
#   --help                Show this help

set -e

# =============================================================================
# CONFIGURATION & DEFAULTS
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_DIR="$PROJECT_ROOT/.ralph"
CONFIG_FILE="$CONFIG_DIR/config.yaml"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
PR_NUMBER_FILE="$SCRIPT_DIR/.pr-number"
PROCESSED_COMMENTS_FILE="$SCRIPT_DIR/.processed-comments"
COST_LOG="$SCRIPT_DIR/.cost-log"
WORKTREE_DIR="$PROJECT_ROOT/.ralph-worktrees"

# Defaults
ENGINE="claude"
MAX_ITERATIONS=20
PR_REVIEW_CYCLES=10
PR_REVIEW_INTERVAL=240
PARALLEL_COUNT=0
BRANCH_PER_TASK=false
CREATE_PR=false
DRAFT_PR=false
DRY_RUN=false
SKIP_QUALITY=false
SKIP_GREPTILE=false
ISSUES_LABEL=""
MODEL_OVERRIDE=""
MAX_RETRIES=3
RETRY_DELAY=2

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
DIM='\033[2m'
NC='\033[0m'

# Cost tracking (per 1M tokens)
declare -A INPUT_COSTS=(
    ["claude"]=3.00
    ["opencode"]=3.00
    ["cursor"]=0.00
    ["codex"]=0.00
    ["qwen"]=0.00
    ["copilot"]=0.00
)
declare -A OUTPUT_COSTS=(
    ["claude"]=15.00
    ["opencode"]=15.00
    ["cursor"]=0.00
    ["codex"]=0.00
    ["qwen"]=0.00
    ["copilot"]=0.00
)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

show_help() {
    head -40 "$0" | tail -30 | sed 's/^# //' | sed 's/^#//'
    exit 0
}

log_info() { echo -e "${CYAN}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_dry() { echo -e "${BLUE}[DRY-RUN]${NC} $1"; }

check_requirements() {
    local missing=()

    command -v jq &>/dev/null || missing+=("jq")
    command -v git &>/dev/null || missing+=("git")
    command -v gh &>/dev/null || missing+=("gh (GitHub CLI)")

    case "$ENGINE" in
        claude)   command -v claude &>/dev/null || missing+=("claude (Claude Code CLI)") ;;
        opencode) command -v opencode &>/dev/null || missing+=("opencode") ;;
        cursor)   command -v cursor &>/dev/null || missing+=("cursor") ;;
        codex)    command -v codex &>/dev/null || missing+=("codex") ;;
        qwen)     command -v qwen-code &>/dev/null || missing+=("qwen-code") ;;
        copilot)  command -v gh &>/dev/null || missing+=("gh (for copilot)") ;;
    esac

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi
}

# Parse YAML config (simple parser, no yq dependency)
parse_config() {
    if [ -f "$CONFIG_FILE" ]; then
        # Extract values using grep/sed (basic YAML parsing)
        CONFIG_ENGINE=$(grep "^engine:" "$CONFIG_FILE" 2>/dev/null | sed 's/engine: *//' || echo "")
        CONFIG_MODEL=$(grep "^model:" "$CONFIG_FILE" 2>/dev/null | sed 's/model: *//' || echo "")
        CONFIG_MAX_RETRIES=$(grep "^max_retries:" "$CONFIG_FILE" 2>/dev/null | sed 's/max_retries: *//' || echo "")
        CONFIG_PARALLEL=$(grep "^parallel:" "$CONFIG_FILE" 2>/dev/null | sed 's/parallel: *//' || echo "")

        # Apply config defaults (CLI args override)
        [ -n "$CONFIG_ENGINE" ] && [ "$ENGINE" = "claude" ] && ENGINE="$CONFIG_ENGINE"
        [ -n "$CONFIG_MAX_RETRIES" ] && MAX_RETRIES="$CONFIG_MAX_RETRIES"
    fi
}

init_config() {
    mkdir -p "$CONFIG_DIR"

    if [ -f "$CONFIG_FILE" ]; then
        log_warn "Config already exists at $CONFIG_FILE"
        read -p "Overwrite? [y/N] " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && exit 0
    fi

    # Auto-detect project info
    local lang="typescript"
    local framework="nextjs"
    [ -f "$PROJECT_ROOT/package.json" ] && framework=$(jq -r '.dependencies | keys[]' "$PROJECT_ROOT/package.json" 2>/dev/null | grep -E "next|react|vue|angular" | head -1 || echo "unknown")

    cat > "$CONFIG_FILE" << 'EOF'
# Ralph Configuration
# Auto-generated - customize as needed

# AI Engine: claude, opencode, cursor, codex, qwen, copilot
engine: claude

# Model override (optional, engine-specific)
# model: claude-sonnet-4-20250514

# Execution settings
max_iterations: 20
max_retries: 3
retry_delay: 2

# Parallel execution (0 = sequential)
parallel: 0

# Quality gates (set to false to skip)
quality_review: true
greptile_review: true

# Project context
project:
  name: EdgeJournal
  language: typescript
  framework: nextjs

# Commands (auto-detected, customize if needed)
commands:
  test: bun run test
  lint: bun run check
  build: bun run build
  e2e: bun run test:e2e

# Rules injected into every prompt
rules:
  - Follow CLAUDE.md conventions
  - Use Terminal design system (dark theme, monospace, #d4ff00 accent)
  - Never hardcode constants - use src/lib/constants/
  - All API routes use protectedProcedure

# Files/directories AI must never modify
never_touch:
  - .env
  - .env.local
  - scripts/ralph/prd.json  # Only update passes field
EOF

    log_success "Created $CONFIG_FILE"
    log_info "Edit the config file to customize behavior"
    exit 0
}

# =============================================================================
# AI ENGINE RUNNERS
# =============================================================================

get_engine_command() {
    local prompt_file="$1"
    local model_flag=""

    [ -n "$MODEL_OVERRIDE" ] && model_flag="--model $MODEL_OVERRIDE"

    case "$ENGINE" in
        claude)
            echo "cat '$prompt_file' | claude --dangerously-skip-permissions $model_flag -p"
            ;;
        opencode)
            echo "cat '$prompt_file' | opencode --full-auto $model_flag"
            ;;
        cursor)
            echo "cursor --force $model_flag < '$prompt_file'"
            ;;
        codex)
            echo "codex $model_flag < '$prompt_file'"
            ;;
        qwen)
            echo "cat '$prompt_file' | qwen-code --approval-mode yolo $model_flag"
            ;;
        copilot)
            echo "gh copilot suggest -t shell '$prompt_file'"
            ;;
        *)
            log_error "Unknown engine: $ENGINE"
            exit 1
            ;;
    esac
}

run_agent() {
    local prompt_file="$1"
    local task_id="$2"
    local attempt=1
    local output=""
    local start_time=$(date +%s)

    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Running $ENGINE agent (attempt $attempt/$MAX_RETRIES)..."

        if [ "$DRY_RUN" = true ]; then
            log_dry "Would execute: $(get_engine_command "$prompt_file")"
            return 0
        fi

        local cmd=$(get_engine_command "$prompt_file")
        output=$(cd "$PROJECT_ROOT" && eval "$cmd" 2>&1 | tee /dev/stderr) || true

        # Check for success signals
        if echo "$output" | grep -qE "<promise>COMPLETE</promise>|Task completed|Success"; then
            local end_time=$(date +%s)
            local duration=$((end_time - start_time))

            # Extract and log token usage if available
            track_cost "$output" "$task_id" "$duration"

            return 0
        fi

        # Check for rate limit or transient errors
        if echo "$output" | grep -qiE "rate.limit|timeout|connection|503|502"; then
            local delay=$((RETRY_DELAY * (2 ** (attempt - 1))))
            log_warn "Transient error, retrying in ${delay}s..."
            sleep $delay
            ((attempt++))
            continue
        fi

        # Non-retryable failure
        break
    done

    log_error "Agent failed after $attempt attempts"
    return 1
}

track_cost() {
    local output="$1"
    local task_id="$2"
    local duration="$3"

    # Try to extract token counts from output (format varies by engine)
    local input_tokens=$(echo "$output" | grep -oE "input.tokens?[:\s]+[0-9]+" | grep -oE "[0-9]+" | tail -1 || echo "0")
    local output_tokens=$(echo "$output" | grep -oE "output.tokens?[:\s]+[0-9]+" | grep -oE "[0-9]+" | tail -1 || echo "0")

    if [ "$input_tokens" != "0" ] || [ "$output_tokens" != "0" ]; then
        local input_cost=$(echo "scale=4; $input_tokens * ${INPUT_COSTS[$ENGINE]} / 1000000" | bc 2>/dev/null || echo "0")
        local output_cost=$(echo "scale=4; $output_tokens * ${OUTPUT_COSTS[$ENGINE]} / 1000000" | bc 2>/dev/null || echo "0")
        local total_cost=$(echo "scale=4; $input_cost + $output_cost" | bc 2>/dev/null || echo "0")

        echo "$(date -Iseconds) | $task_id | $ENGINE | ${duration}s | in:$input_tokens out:$output_tokens | \$$total_cost" >> "$COST_LOG"
        log_info "Cost: \$$total_cost (${input_tokens} in / ${output_tokens} out)"
    fi
}

# =============================================================================
# PARALLEL EXECUTION WITH WORKTREES
# =============================================================================

create_worktree() {
    local task_id="$1"
    local branch_name="ralph/parallel-$task_id"
    local worktree_path="$WORKTREE_DIR/$task_id"

    if [ "$DRY_RUN" = true ]; then
        log_dry "Would create worktree at $worktree_path"
        return 0
    fi

    mkdir -p "$WORKTREE_DIR"

    # Create branch from current HEAD
    git branch -f "$branch_name" HEAD 2>/dev/null || true

    # Create worktree
    git worktree add "$worktree_path" "$branch_name" 2>/dev/null || {
        log_warn "Worktree exists, resetting..."
        git worktree remove "$worktree_path" --force 2>/dev/null || true
        git worktree add "$worktree_path" "$branch_name"
    }

    echo "$worktree_path"
}

cleanup_worktree() {
    local worktree_path="$1"

    if [ -d "$worktree_path" ]; then
        git worktree remove "$worktree_path" --force 2>/dev/null || true
    fi
}

cleanup_all_worktrees() {
    if [ -d "$WORKTREE_DIR" ]; then
        log_info "Cleaning up worktrees..."
        for wt in "$WORKTREE_DIR"/*; do
            [ -d "$wt" ] && git worktree remove "$wt" --force 2>/dev/null || true
        done
        rmdir "$WORKTREE_DIR" 2>/dev/null || true
    fi
}

run_parallel_agent() {
    local task_id="$1"
    local task_json="$2"
    local worktree_path="$3"

    # Create task-specific prompt
    local task_prompt="$worktree_path/.ralph-task-prompt.md"

    cat > "$task_prompt" << EOF
# Single Task Execution

You are working on a single task in an isolated worktree.

## Task
$(echo "$task_json" | jq -r '.')

## Instructions
1. Read CLAUDE.md for conventions
2. Implement ONLY this task
3. Run quality checks: bun run check && bun run build
4. Commit with message: feat: [$task_id] - $(echo "$task_json" | jq -r '.title')
5. Do NOT update prd.json (main process handles this)

When complete, output: <promise>COMPLETE</promise>
EOF

    # Run agent in worktree
    (cd "$worktree_path" && run_agent "$task_prompt" "$task_id")
}

merge_worktree_branch() {
    local task_id="$1"
    local branch_name="ralph/parallel-$task_id"

    if [ "$DRY_RUN" = true ]; then
        log_dry "Would merge $branch_name"
        return 0
    fi

    log_info "Merging $branch_name..."

    # Try merge
    if ! git merge "$branch_name" --no-edit 2>/dev/null; then
        log_warn "Merge conflict detected, attempting AI resolution..."

        # Get conflicted files
        local conflicts=$(git diff --name-only --diff-filter=U)

        if [ -n "$conflicts" ]; then
            # Create conflict resolution prompt
            local resolve_prompt=$(mktemp)
            cat > "$resolve_prompt" << EOF
# Merge Conflict Resolution

You need to resolve merge conflicts in the following files:
$conflicts

## Instructions
1. For each file, examine the conflict markers (<<<<<<, =======, >>>>>>>)
2. Choose the best resolution that preserves both changes where possible
3. Remove all conflict markers
4. Stage the resolved files with git add
5. Do NOT commit - just resolve and stage

Current branch: $(git branch --show-current)
Merging from: $branch_name
EOF

            run_agent "$resolve_prompt" "merge-$task_id"
            rm "$resolve_prompt"

            # Check if resolved
            if [ -z "$(git diff --name-only --diff-filter=U)" ]; then
                git commit --no-edit
                log_success "Conflicts resolved via AI"
            else
                log_error "Could not auto-resolve conflicts in: $conflicts"
                git merge --abort
                return 1
            fi
        fi
    fi

    # Cleanup branch
    git branch -d "$branch_name" 2>/dev/null || true

    log_success "Merged $branch_name"
}

run_parallel_tasks() {
    local tasks="$1"
    local task_count=$(echo "$tasks" | jq -r 'length')
    local batch_size=$PARALLEL_COUNT
    local completed=0
    local failed=()

    log_info "Running $task_count tasks with $batch_size parallel agents"

    # Process in batches
    for ((i=0; i<task_count; i+=batch_size)); do
        local batch_end=$((i + batch_size))
        [ $batch_end -gt $task_count ] && batch_end=$task_count

        log_info "Starting batch: tasks $((i+1))-$batch_end of $task_count"

        local pids=()
        local task_ids=()
        local worktrees=()

        # Spawn agents
        for ((j=i; j<batch_end; j++)); do
            local task=$(echo "$tasks" | jq -r ".[$j]")
            local task_id=$(echo "$task" | jq -r '.id')

            task_ids+=("$task_id")

            if [ "$DRY_RUN" = true ]; then
                log_dry "Would spawn agent for $task_id"
                continue
            fi

            local wt=$(create_worktree "$task_id")
            worktrees+=("$wt")

            # Run in background
            (run_parallel_agent "$task_id" "$task" "$wt") &
            pids+=($!)

            log_info "Spawned agent for $task_id (PID: ${pids[-1]})"
        done

        [ "$DRY_RUN" = true ] && continue

        # Wait for batch
        for ((k=0; k<${#pids[@]}; k++)); do
            local pid=${pids[$k]}
            local task_id=${task_ids[$k]}

            if wait $pid; then
                log_success "$task_id completed"
                ((completed++))

                # Mark as passed in PRD
                jq --arg id "$task_id" '(.userStories[] | select(.id == $id)).passes = true' "$PRD_FILE" > "$PRD_FILE.tmp"
                mv "$PRD_FILE.tmp" "$PRD_FILE"
            else
                log_error "$task_id failed"
                failed+=("$task_id")
            fi
        done

        # Merge completed branches
        for task_id in "${task_ids[@]}"; do
            if [[ ! " ${failed[*]} " =~ " ${task_id} " ]]; then
                merge_worktree_branch "$task_id" || true
            fi
        done

        # Cleanup worktrees
        for wt in "${worktrees[@]}"; do
            cleanup_worktree "$wt"
        done
    done

    log_info "Parallel execution complete: $completed succeeded, ${#failed[@]} failed"

    if [ ${#failed[@]} -gt 0 ]; then
        log_warn "Failed tasks: ${failed[*]}"
        return 1
    fi
}

# =============================================================================
# GITHUB ISSUES INTEGRATION
# =============================================================================

fetch_issues_as_tasks() {
    local label="$1"

    log_info "Fetching GitHub Issues with label: $label"

    if [ "$DRY_RUN" = true ]; then
        log_dry "Would fetch issues with label '$label'"
        return 0
    fi

    local issues=$(gh issue list --label "$label" --state open --json number,title,body --limit 50)
    local count=$(echo "$issues" | jq -r 'length')

    if [ "$count" -eq 0 ]; then
        log_warn "No open issues found with label: $label"
        exit 0
    fi

    log_info "Found $count issues, converting to PRD format..."

    # Convert to PRD format
    local branch_name="ralph/issues-$(date +%Y%m%d-%H%M%S)"
    local prd=$(cat << EOF
{
  "project": "EdgeJournal",
  "branchName": "$branch_name",
  "description": "Tasks from GitHub Issues (label: $label)",
  "source": "github-issues",
  "issueLabel": "$label",
  "userStories": $(echo "$issues" | jq '[.[] | {
    id: ("ISSUE-" + (.number | tostring)),
    title: .title,
    description: .body,
    acceptanceCriteria: ["Implementation complete", "Tests pass", "Build passes"],
    priority: (.number),
    passes: false,
    githubIssue: .number,
    notes: ""
  }]')
}
EOF
)

    echo "$prd" > "$PRD_FILE"
    log_success "Created PRD from $count issues"
}

close_completed_issues() {
    # Check if PRD was sourced from issues
    local source=$(jq -r '.source // empty' "$PRD_FILE")
    [ "$source" != "github-issues" ] && return 0

    log_info "Closing completed GitHub Issues..."

    jq -r '.userStories[] | select(.passes == true) | .githubIssue // empty' "$PRD_FILE" | while read -r issue_num; do
        [ -z "$issue_num" ] && continue

        if [ "$DRY_RUN" = true ]; then
            log_dry "Would close issue #$issue_num"
        else
            gh issue close "$issue_num" --comment "Completed by Ralph autonomous agent" 2>/dev/null || true
            log_success "Closed issue #$issue_num"
        fi
    done
}

# =============================================================================
# PHASE 1: IMPLEMENTATION LOOP
# =============================================================================

run_implementation_phase() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN} PHASE 1: Implementation Loop${NC}"
    echo -e "${CYAN} Engine: $ENGINE | Max iterations: $MAX_ITERATIONS${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    # Get incomplete tasks
    local tasks=$(jq '[.userStories[] | select(.passes == false)]' "$PRD_FILE")
    local task_count=$(echo "$tasks" | jq 'length')

    if [ "$task_count" -eq 0 ]; then
        log_success "All stories already complete!"
        return 0
    fi

    # Parallel mode
    if [ "$PARALLEL_COUNT" -gt 0 ]; then
        run_parallel_tasks "$tasks"
        return $?
    fi

    # Sequential mode
    for i in $(seq 1 $MAX_ITERATIONS); do
        echo ""
        echo -e "${CYAN}─── Iteration $i of $MAX_ITERATIONS ───${NC}"

        local remaining=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
        log_info "Remaining stories: $remaining"

        if [ "$remaining" -eq 0 ]; then
            log_success "All stories complete!"
            break
        fi

        # Run agent
        if ! run_agent "$SCRIPT_DIR/prompt.md" "iteration-$i"; then
            log_warn "Iteration $i had issues, continuing..."
        fi

        # Check for completion signal
        if [ "$DRY_RUN" = true ]; then
            log_dry "Would check for completion signal"
            break
        fi

        sleep 2
    done

    # Final check
    local remaining=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
    if [ "$remaining" -gt 0 ]; then
        log_error "Implementation incomplete: $remaining stories remaining"
        return 1
    fi
}

# =============================================================================
# PHASE 2: CODE QUALITY REVIEW
# =============================================================================

run_quality_phase() {
    [ "$SKIP_QUALITY" = true ] && return 0

    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA} PHASE 2: Code Quality Review${NC}"
    echo -e "${MAGENTA} Security audit + Consistency audit${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

    run_agent "$SCRIPT_DIR/code-review-prompt.md" "quality-review"

    log_success "Code quality review complete"
}

# =============================================================================
# PHASE 3: CREATE PULL REQUEST
# =============================================================================

run_pr_phase() {
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA} PHASE 3: Create Pull Request${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

    local branch_name=$(jq -r '.branchName' "$PRD_FILE")
    local feature_desc=$(jq -r '.description' "$PRD_FILE")

    if [ "$DRY_RUN" = true ]; then
        log_dry "Would push branch: $branch_name"
        log_dry "Would create PR: feat: $feature_desc"
        return 0
    fi

    # Push to remote
    log_info "Pushing branch to remote..."
    git push -u origin "$branch_name" 2>&1 || true

    # Check if PR exists
    local existing_pr=$(gh pr list --head "$branch_name" --json number --jq '.[0].number' 2>/dev/null || echo "")

    if [ -n "$existing_pr" ]; then
        log_info "PR #$existing_pr already exists"
        echo "$existing_pr" > "$PR_NUMBER_FILE"
        return 0
    fi

    # Create PR body
    local pr_body=$(cat << EOF
## Summary
$feature_desc

## User Stories Completed
$(jq -r '.userStories[] | "- [x] \(.id): \(.title)"' "$PRD_FILE")

## Test Plan
- [ ] All integration tests pass (\`bun run test\`)
- [ ] Type checks pass (\`bun run check\`)
- [ ] Build succeeds (\`bun run build\`)

## Cost Summary
$([ -f "$COST_LOG" ] && cat "$COST_LOG" | tail -20 || echo "No cost data available")

---
Generated by Ralph autonomous agent loop (Enhanced Edition)
Engine: $ENGINE | Mode: $([ "$PARALLEL_COUNT" -gt 0 ] && echo "parallel ($PARALLEL_COUNT)" || echo "sequential")
EOF
)

    local draft_flag=""
    [ "$DRAFT_PR" = true ] && draft_flag="--draft"

    local pr_url=$(gh pr create \
        --title "feat: $feature_desc" \
        --body "$pr_body" \
        --base main \
        $draft_flag \
        2>&1) || {
        log_error "Failed to create PR"
        return 1
    }

    local pr_number=$(echo "$pr_url" | grep -oE '[0-9]+$')
    echo "$pr_number" > "$PR_NUMBER_FILE"

    log_success "Created PR #$pr_number: $pr_url"

    # Close GitHub Issues if applicable
    close_completed_issues
}

# =============================================================================
# PHASE 4: GREPTILE REVIEW LOOP
# =============================================================================

run_greptile_phase() {
    [ "$SKIP_GREPTILE" = true ] && return 0
    [ ! -f "$PR_NUMBER_FILE" ] && return 0

    local pr_number=$(cat "$PR_NUMBER_FILE")

    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA} PHASE 4: Greptile Review Loop${NC}"
    echo -e "${MAGENTA} PR #$pr_number | Checking every 4 minutes for $PR_REVIEW_CYCLES cycles${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

    touch "$PROCESSED_COMMENTS_FILE"

    local no_comments_count=0
    local claude_complete=false

    for cycle in $(seq 1 $PR_REVIEW_CYCLES); do
        echo ""
        log_info "Review cycle $cycle of $PR_REVIEW_CYCLES"

        if [ "$DRY_RUN" = true ]; then
            log_dry "Would check for Greptile comments on PR #$pr_number"
            break
        fi

        # Fetch Greptile comments
        local review_comments=$(gh api "repos/{owner}/{repo}/pulls/$pr_number/comments" \
            --jq '.[] | select(.user.login | test("greptile"; "i")) | {id: .id, body: .body, path: .path, line: .line}' \
            2>/dev/null || echo "")

        local issue_comments=$(gh api "repos/{owner}/{repo}/issues/$pr_number/comments" \
            --jq '.[] | select(.user.login | test("greptile"; "i")) | {id: .id, body: .body, path: "", line: 0}' \
            2>/dev/null || echo "")

        local all_comments="$review_comments"$'\n'"$issue_comments"

        # Filter processed
        local new_comments=""
        while IFS= read -r comment; do
            [ -z "$comment" ] && continue
            local cid=$(echo "$comment" | jq -r '.id')
            if ! grep -q "^$cid$" "$PROCESSED_COMMENTS_FILE" 2>/dev/null; then
                new_comments="$new_comments"$'\n'"$comment"
            fi
        done <<< "$all_comments"

        new_comments=$(echo "$new_comments" | sed '/^$/d')

        if [ -z "$new_comments" ]; then
            log_info "No new Greptile comments"
            ((no_comments_count++))

            if [ "$claude_complete" = true ]; then
                log_success "Review complete (Claude signaled + no new comments)"
                break
            fi

            if [ "$no_comments_count" -ge 2 ]; then
                log_success "Review complete (2 cycles with no comments)"
                break
            fi
        else
            no_comments_count=0
            claude_complete=false

            local count=$(echo "$new_comments" | grep -c '^{' || echo "0")
            log_info "Found $count new Greptile comment(s)"

            # Save for Claude
            echo "$new_comments" | jq -s '.' > "$SCRIPT_DIR/.greptile-comments.json"

            # Run agent
            local output=$(run_agent "$SCRIPT_DIR/pr-review-prompt.md" "greptile-cycle-$cycle" 2>&1 | tee /dev/stderr) || true

            # Mark processed
            echo "$new_comments" | jq -r '.id' >> "$PROCESSED_COMMENTS_FILE"

            if echo "$output" | grep -q "<review>COMPLETE</review>"; then
                log_success "Claude signaled review complete"
                claude_complete=true
                continue
            fi
        fi

        [ "$cycle" -eq "$PR_REVIEW_CYCLES" ] && break
        [ "$claude_complete" = false ] && { log_info "Waiting 4 minutes..."; sleep $PR_REVIEW_INTERVAL; }
    done
}

# =============================================================================
# MAIN
# =============================================================================

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --engine)       ENGINE="$2"; shift 2 ;;
        --parallel)     PARALLEL_COUNT="${2:-3}"; shift; [[ "$1" =~ ^[0-9]+$ ]] && shift ;;
        --branch-per-task) BRANCH_PER_TASK=true; shift ;;
        --create-pr)    CREATE_PR=true; shift ;;
        --draft-pr)     DRAFT_PR=true; CREATE_PR=true; shift ;;
        --issues)       ISSUES_LABEL="$2"; shift 2 ;;
        --dry-run)      DRY_RUN=true; shift ;;
        --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
        --pr-cycles)    PR_REVIEW_CYCLES="$2"; shift 2 ;;
        --no-quality)   SKIP_QUALITY=true; shift ;;
        --no-greptile)  SKIP_GREPTILE=true; shift ;;
        --model)        MODEL_OVERRIDE="$2"; shift 2 ;;
        --init)         init_config ;;
        --help|-h)      show_help ;;
        *)              log_error "Unknown option: $1"; show_help ;;
    esac
done

# Load config
parse_config

# Check requirements
check_requirements

# Fetch issues if requested
[ -n "$ISSUES_LABEL" ] && fetch_issues_as_tasks "$ISSUES_LABEL"

# Check PRD exists
if [ ! -f "$PRD_FILE" ]; then
    log_error "No prd.json found at $PRD_FILE"
    echo "Create a prd.json file or use --issues <label> to pull from GitHub Issues"
    exit 1
fi

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
        DATE=$(date +%Y-%m-%d)
        FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
        ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

        log_info "Archiving previous run: $LAST_BRANCH"
        mkdir -p "$ARCHIVE_FOLDER"
        [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
        [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
        [ -f "$COST_LOG" ] && cp "$COST_LOG" "$ARCHIVE_FOLDER/"
        [ -f "$PR_NUMBER_FILE" ] && rm "$PR_NUMBER_FILE"
        [ -f "$PROCESSED_COMMENTS_FILE" ] && rm "$PROCESSED_COMMENTS_FILE"

        echo "# Ralph Progress Log" > "$PROGRESS_FILE"
        echo "Started: $(date)" >> "$PROGRESS_FILE"
        echo "Engine: $ENGINE" >> "$PROGRESS_FILE"
        echo "---" >> "$PROGRESS_FILE"
    fi
fi

# Track current branch
CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
[ -n "$CURRENT_BRANCH" ] && echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"

# Initialize progress file
if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "Engine: $ENGINE" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
fi

# Banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        Ralph - Autonomous AI Agent Loop (Enhanced)        ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Engine: $(printf '%-12s' $ENGINE) | Parallel: $(printf '%-3s' ${PARALLEL_COUNT:-0})                    ║"
echo "║  Iterations: $(printf '%-3s' $MAX_ITERATIONS)         | PR Cycles: $(printf '%-3s' $PR_REVIEW_CYCLES)                  ║"
[ "$DRY_RUN" = true ] && echo "║  >>> DRY RUN MODE - No changes will be made <<<           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Show PRD status
echo -e "${YELLOW}Current PRD Status:${NC}"
jq -r '.userStories[] | "  [\(if .passes then "✓" else " " end)] \(.id): \(.title)"' "$PRD_FILE"
echo ""

# Trap for cleanup
trap cleanup_all_worktrees EXIT

# Run phases
run_implementation_phase || { log_error "Implementation failed"; exit 1; }
run_quality_phase
run_pr_phase
run_greptile_phase

# Final banner
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Ralph Complete!                        ║${NC}"
echo -e "${GREEN}╠═══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  ✓ All user stories implemented                          ║${NC}"
echo -e "${GREEN}║  ✓ Code quality review passed                            ║${NC}"
[ -f "$PR_NUMBER_FILE" ] && echo -e "${GREEN}║  ✓ Pull request: #$(cat "$PR_NUMBER_FILE")                                      ║${NC}"
echo -e "${GREEN}║  ✓ Greptile review complete                              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

# Show cost summary
if [ -f "$COST_LOG" ]; then
    echo ""
    echo -e "${DIM}Cost Summary:${NC}"
    local total=$(awk -F'|' '{sum += $NF} END {print sum}' "$COST_LOG" 2>/dev/null | tr -d '$' || echo "0")
    echo -e "${DIM}  Total: \$${total}${NC}"
    echo -e "${DIM}  See $COST_LOG for details${NC}"
fi

[ -f "$PR_NUMBER_FILE" ] && {
    PR_URL=$(gh pr view "$(cat "$PR_NUMBER_FILE")" --json url --jq '.url' 2>/dev/null || echo "")
    [ -n "$PR_URL" ] && echo -e "\n${CYAN}PR URL: $PR_URL${NC}"
}
