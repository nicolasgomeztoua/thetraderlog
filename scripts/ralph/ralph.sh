#!/bin/bash
# Ralph - Long-running Claude Code agent loop
# Adapted from https://github.com/snarktank/ralph for Claude Code CLI
# Usage: ./ralph.sh [options] [max_iterations] [pr_review_cycles]
#
# Options:
#   --base <branch>    PR target branch (skips interactive menu)
#   --work <branch>    Working branch (skips interactive menu)
#   --auto             Shorthand: use prd.json branchName as work, "main" as base
#
# Examples:
#   ./ralph.sh --auto                    # Non-interactive, branches from prd.json
#   ./ralph.sh --auto 20 5               # Non-interactive, 20 iters, 5 PR cycles
#   ./ralph.sh --base main --work ralph/my-feature 30

set -e

# Parse named flags
AUTO_MODE=false
CLI_BASE_BRANCH=""
CLI_WORK_BRANCH=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --auto)
            AUTO_MODE=true
            shift
            ;;
        --base)
            CLI_BASE_BRANCH="$2"
            shift 2
            ;;
        --work)
            CLI_WORK_BRANCH="$2"
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

MAX_ITERATIONS=${1:-30}
PR_REVIEW_CYCLES=${2:-10}
PR_REVIEW_INITIAL_WAIT=480   # 8 minutes — give Greptile time to finish
PR_REVIEW_INTERVAL=300       # 5 minutes between subsequent checks
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
PR_NUMBER_FILE="$SCRIPT_DIR/.pr-number"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Check for required tools
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: Claude Code CLI not found. Install it first.${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq not found. Install it with: brew install jq${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) not found. Install it with: brew install gh${NC}"
    exit 1
fi

# Check PRD exists
if [ ! -f "$PRD_FILE" ]; then
    echo -e "${RED}Error: prd.json not found at $PRD_FILE${NC}"
    echo "Create a prd.json file with your user stories first."
    echo "See prd.example.json for the expected format."
    exit 1
fi

# =============================================================================
# Branch Selection — interactive numbered menus
# =============================================================================
PRD_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
GIT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
cd "$PROJECT_ROOT"

# Fetch latest remote refs so the list is up-to-date
git fetch --prune origin 2>/dev/null || true

# Build a de-duped, sorted branch list (local + remote)
build_branch_list() {
    {
        git branch --format='%(refname:short)' 2>/dev/null
        git branch -r --format='%(refname:short)' 2>/dev/null | sed 's|^origin/||' | grep -v '^HEAD$'
    } | sort -u
}

# Display a numbered branch menu with a highlighted default.
# Args: <prompt_text> [default_branch]
# Sets SELECTED_BRANCH to the chosen branch name.
show_branch_menu() {
    local prompt_text="$1"
    local default_branch="${2:-$GIT_BRANCH}"

    # Build array — put default branch first, then current branch, then the rest
    BRANCH_LIST=()
    BRANCH_LIST+=("$default_branch")
    [ "$GIT_BRANCH" != "$default_branch" ] && BRANCH_LIST+=("$GIT_BRANCH")
    while IFS= read -r b; do
        [ "$b" = "$default_branch" ] && continue
        [ "$b" = "$GIT_BRANCH" ] && continue
        BRANCH_LIST+=("$b")
    done < <(build_branch_list)

    echo ""
    echo -e "${YELLOW}${prompt_text}${NC}"
    local i=1
    for b in "${BRANCH_LIST[@]}"; do
        local label="$b"
        local tags=""
        # Check if branch exists locally or on remote
        local b_exists=$(git branch --list "$b" 2>/dev/null | tr -d ' ')
        local b_remote=$(git branch -r --list "origin/$b" 2>/dev/null | tr -d ' ')
        [ -z "$b_exists" ] && [ -z "$b_remote" ] && tags="${tags} ${YELLOW}(new branch)${NC}"
        [ "$b" = "$GIT_BRANCH" ] && tags="${tags} ${GREEN}(current)${NC}"
        [ "$b" = "$PRD_BRANCH" ] && tags="${tags} ${CYAN}(prd.json)${NC}"
        [ "$i" -eq 1 ] && tags="${tags} ${MAGENTA}← default${NC}"
        echo -e "  ${i}) ${label}${tags}"
        i=$((i + 1))
    done
    echo ""
    read -r -p "Pick a number (Enter = default): " MENU_PICK || true
    MENU_PICK="${MENU_PICK:-1}"

    if [[ "$MENU_PICK" =~ ^[0-9]+$ ]] && [ "$MENU_PICK" -ge 1 ] && [ "$MENU_PICK" -le "${#BRANCH_LIST[@]}" ]; then
        SELECTED_BRANCH="${BRANCH_LIST[$((MENU_PICK - 1))]}"
    else
        echo -e "${RED}Invalid choice, using default.${NC}"
        SELECTED_BRANCH="${BRANCH_LIST[0]}"
    fi
}

# ---- Resolve branches (non-interactive if flags provided) ----
echo ""
echo -e "${CYAN}Branch Setup${NC}"
echo -e "  Current git branch: ${GREEN}$GIT_BRANCH${NC}"
[ -n "$PRD_BRANCH" ] && echo -e "  Branch in prd.json: ${GREEN}$PRD_BRANCH${NC}"

if [ "$AUTO_MODE" = true ]; then
    # --auto: use prd.json branchName as work branch, main as base
    PR_BASE_BRANCH="main"
    WORK_BRANCH="${PRD_BRANCH:-$GIT_BRANCH}"
    echo -e "${CYAN}Auto mode: work=$WORK_BRANCH → PR into $PR_BASE_BRANCH${NC}"
elif [ -n "$CLI_BASE_BRANCH" ] && [ -n "$CLI_WORK_BRANCH" ]; then
    # --base + --work: fully non-interactive
    PR_BASE_BRANCH="$CLI_BASE_BRANCH"
    WORK_BRANCH="$CLI_WORK_BRANCH"
    echo -e "${CYAN}CLI mode: work=$WORK_BRANCH → PR into $PR_BASE_BRANCH${NC}"
else
    # Interactive menus (original behavior)
    show_branch_menu "Which branch should the PR target?" "main"
    PR_BASE_BRANCH="$SELECTED_BRANCH"

    WORK_DEFAULT="${PRD_BRANCH:-$GIT_BRANCH}"
    show_branch_menu "Which branch should Ralph work on?" "$WORK_DEFAULT"
    WORK_BRANCH="$SELECTED_BRANCH"
fi

# ---- 3. Create / switch to the working branch ----
BRANCH_EXISTS=$(git branch --list "$WORK_BRANCH" 2>/dev/null | tr -d ' ')
REMOTE_EXISTS=$(git branch -r --list "origin/$WORK_BRANCH" 2>/dev/null | tr -d ' ')

if [ -z "$BRANCH_EXISTS" ] && [ -z "$REMOTE_EXISTS" ]; then
    echo -e "${YELLOW}Creating branch '$WORK_BRANCH' from '$PR_BASE_BRANCH'...${NC}"
    git checkout "$PR_BASE_BRANCH" 2>/dev/null
    git pull origin "$PR_BASE_BRANCH" 2>/dev/null || true
    git checkout -b "$WORK_BRANCH"
elif [ "$WORK_BRANCH" != "$GIT_BRANCH" ]; then
    echo -e "${YELLOW}Switching to branch: $WORK_BRANCH${NC}"
    git checkout "$WORK_BRANCH" 2>/dev/null || git checkout -b "$WORK_BRANCH"
fi

# Update prd.json branchName to match
if [ -n "$PRD_BRANCH" ] && [ "$PRD_BRANCH" != "$WORK_BRANCH" ]; then
    jq --arg b "$WORK_BRANCH" '.branchName = $b' "$PRD_FILE" > "$PRD_FILE.tmp" && mv "$PRD_FILE.tmp" "$PRD_FILE"
    echo -e "${YELLOW}Updated prd.json branchName to: $WORK_BRANCH${NC}"
fi

echo ""
echo -e "${GREEN}Working branch: $WORK_BRANCH → PR into: $PR_BASE_BRANCH${NC}"
echo ""

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
        # Archive the previous run
        DATE=$(date +%Y-%m-%d)
        FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
        ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

        echo -e "${YELLOW}Archiving previous run: $LAST_BRANCH${NC}"
        mkdir -p "$ARCHIVE_FOLDER"
        [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
        [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
        [ -f "$PR_NUMBER_FILE" ] && rm "$PR_NUMBER_FILE"
        echo -e "  Archived to: $ARCHIVE_FOLDER"

        # Reset progress file for new run
        echo "# Ralph Progress Log" > "$PROGRESS_FILE"
        echo "Started: $(date)" >> "$PROGRESS_FILE"
        echo "---" >> "$PROGRESS_FILE"
    fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    if [ -n "$CURRENT_BRANCH" ]; then
        echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
    fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
fi

# Helper: commit all uncommitted changes with a given message
commit_all_changes() {
    local msg="$1"
    cd "$PROJECT_ROOT"
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
        echo -e "${YELLOW}Committing uncommitted changes...${NC}"
        git add -A
        git status --short
        git commit -m "$msg" || true
        echo -e "${GREEN}Committed: $msg${NC}"
    else
        echo -e "${GREEN}Working tree clean — nothing to commit.${NC}"
    fi
}

# Commit any local changes before starting (prd.json updates, progress resets, etc.)
commit_all_changes "chore: ralph pre-run setup (prd.json, progress, branch config)"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           Ralph - Claude Code Agent Loop                  ║"
echo "║         Max iterations: $MAX_ITERATIONS | PR review cycles: $PR_REVIEW_CYCLES        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Show current PRD status
echo -e "${YELLOW}Current PRD Status:${NC}"
jq -r '.userStories[] | "  [\(if .passes then "✓" else " " end)] \(.id): \(.title)"' "$PRD_FILE"
echo ""

# =============================================================================
# PHASE 1: Implementation Loop
# =============================================================================

for i in $(seq 1 $MAX_ITERATIONS); do
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN} Ralph Implementation - Iteration $i of $MAX_ITERATIONS${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    # Check remaining stories
    REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
    echo -e "${YELLOW}Remaining stories: $REMAINING${NC}"

    if [ "$REMAINING" -eq 0 ]; then
        echo -e "${GREEN}All stories complete! Moving to PR phase...${NC}"
        break
    fi

    # Run Claude Code with the ralph prompt
    OUTPUT=$(cd "$PROJECT_ROOT" && cat "$SCRIPT_DIR/prompt.md" | claude --dangerously-skip-permissions -p 2>&1 | tee /dev/stderr) || true

    # Check for completion signal
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo -e "${GREEN}All tasks complete! Moving to PR phase...${NC}"
        break
    fi

    echo -e "${YELLOW}Iteration $i complete. Continuing in 2 seconds...${NC}"
    sleep 2
done

# Check if we completed or hit max iterations
REMAINING=$(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE")
if [ "$REMAINING" -gt 0 ]; then
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  Ralph reached max iterations without completing tasks    ║${NC}"
    echo -e "${RED}║  Remaining: $REMAINING stories                                      ║${NC}"
    echo -e "${RED}║  Skipping PR phase. Check progress.txt for status.       ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi

# =============================================================================
# PHASE 2: Code Quality Review
# =============================================================================

echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA} Ralph Code Quality Phase - Tests & Audits${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

# Run Claude with the code review prompt
OUTPUT=$(cd "$PROJECT_ROOT" && cat "$SCRIPT_DIR/code-review-prompt.md" | claude --dangerously-skip-permissions -p 2>&1 | tee /dev/stderr) || true

echo -e "${GREEN}Code quality review complete.${NC}"

# =============================================================================
# PHASE 3: Create Pull Request
# =============================================================================

echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA} Ralph PR Phase - Creating Pull Request${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

# Push branch and create PR
cd "$PROJECT_ROOT"
BRANCH_NAME=$(jq -r '.branchName' "$PRD_FILE")
FEATURE_DESC=$(jq -r '.description' "$PRD_FILE")

# Push to remote
echo -e "${YELLOW}Pushing branch to remote...${NC}"
git push -u origin "$BRANCH_NAME" 2>&1 || true

# Check if PR already exists
EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ]; then
    echo -e "${YELLOW}PR #$EXISTING_PR already exists for this branch${NC}"
    PR_NUMBER=$EXISTING_PR
else
    # Create PR
    echo -e "${YELLOW}Creating pull request...${NC}"

    # Generate PR body from PRD
    PR_BODY=$(cat <<EOF
## Summary
$FEATURE_DESC

## User Stories Completed
$(jq -r '.userStories[] | "- [x] \(.id): \(.title)"' "$PRD_FILE")

## Test Plan
- [ ] All integration tests pass (\`bun run test\`)
- [ ] Type checks pass (\`bun run check\`)
- [ ] Build succeeds (\`bun run build\`)

---
🤖 Generated by [Ralph](https://github.com/snarktank/ralph) autonomous agent loop
EOF
)

    PR_URL=$(gh pr create \
        --title "feat: $FEATURE_DESC" \
        --body "$PR_BODY" \
        --base "$PR_BASE_BRANCH" \
        2>&1) || {
        echo -e "${RED}Failed to create PR${NC}"
        exit 1
    }

    PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
    echo -e "${GREEN}Created PR #$PR_NUMBER: $PR_URL${NC}"
fi

# Save PR number for future runs
echo "$PR_NUMBER" > "$PR_NUMBER_FILE"

# =============================================================================
# PHASE 4: Greptile Review Loop
# =============================================================================

echo ""
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"
echo -e "${MAGENTA} Ralph PR Review Phase - Monitoring for Greptile Comments${NC}"
echo -e "${MAGENTA} Checking every 5 minutes for $PR_REVIEW_CYCLES cycles${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

# Track which comments we've already processed
PROCESSED_COMMENTS_FILE="$SCRIPT_DIR/.processed-comments"
touch "$PROCESSED_COMMENTS_FILE"

# Track consecutive cycles with no new comments for early exit
NO_COMMENTS_COUNT=0
# Track if Claude has signaled all reviews are complete
CLAUDE_SIGNALED_COMPLETE=false

echo -e "${YELLOW}Waiting 8 minutes for Greptile to complete its review...${NC}"
sleep $PR_REVIEW_INITIAL_WAIT

for cycle in $(seq 1 $PR_REVIEW_CYCLES); do
    echo ""
    echo -e "${CYAN}PR Review Cycle $cycle of $PR_REVIEW_CYCLES${NC}"

    # Get all review comments from Greptile
    GREPTILE_COMMENTS=$(gh api \
        "repos/{owner}/{repo}/pulls/$PR_NUMBER/comments" \
        --jq '.[] | select(.user.login | test("greptile"; "i")) | {id: .id, body: .body, path: .path, line: .line, commit_id: .commit_id}' \
        2>/dev/null || echo "")

    # Also check issue comments (general PR comments)
    GREPTILE_ISSUE_COMMENTS=$(gh api \
        "repos/{owner}/{repo}/issues/$PR_NUMBER/comments" \
        --jq '.[] | select(.user.login | test("greptile"; "i")) | {id: .id, body: .body, path: "", line: 0}' \
        2>/dev/null || echo "")

    ALL_COMMENTS="$GREPTILE_COMMENTS"$'\n'"$GREPTILE_ISSUE_COMMENTS"

    # Filter to only unprocessed comments
    NEW_COMMENTS=""
    while IFS= read -r comment; do
        [ -z "$comment" ] && continue
        COMMENT_ID=$(echo "$comment" | jq -r '.id')
        if ! grep -q "^$COMMENT_ID$" "$PROCESSED_COMMENTS_FILE" 2>/dev/null; then
            NEW_COMMENTS="$NEW_COMMENTS"$'\n'"$comment"
        fi
    done <<< "$ALL_COMMENTS"

    # Remove leading newline
    NEW_COMMENTS=$(echo "$NEW_COMMENTS" | sed '/^$/d')

    if [ -z "$NEW_COMMENTS" ]; then
        echo -e "${YELLOW}No new Greptile comments found.${NC}"
        NO_COMMENTS_COUNT=$((NO_COMMENTS_COUNT + 1))

        # Early exit conditions:
        # 1. Claude previously signaled completion AND no new comments = immediate exit
        # 2. No new comments for 2 consecutive cycles (original behavior)
        if [ "$CLAUDE_SIGNALED_COMPLETE" = true ]; then
            echo -e "${GREEN}Claude signaled completion and no new comments. All reviews complete!${NC}"
            break
        fi

        if [ "$NO_COMMENTS_COUNT" -ge 2 ]; then
            echo -e "${GREEN}No new Greptile comments for 2 consecutive cycles. All reviews complete!${NC}"
            break
        fi
    else
        # Reset counters when we find new comments
        NO_COMMENTS_COUNT=0
        CLAUDE_SIGNALED_COMPLETE=false

        COMMENT_COUNT=$(echo "$NEW_COMMENTS" | grep -c '^{' || echo "0")
        echo -e "${GREEN}Found $COMMENT_COUNT new Greptile comment(s)! Invoking Claude for review...${NC}"

        # Save comments to temp file for Claude to process
        COMMENTS_FILE="$SCRIPT_DIR/.greptile-comments.json"
        echo "$NEW_COMMENTS" | jq -s '.' > "$COMMENTS_FILE"

        # Run Claude with the PR review prompt
        OUTPUT=$(cd "$PROJECT_ROOT" && cat "$SCRIPT_DIR/pr-review-prompt.md" | claude --dangerously-skip-permissions -p 2>&1 | tee /dev/stderr) || true

        # Mark comments as processed
        echo "$NEW_COMMENTS" | jq -r '.id' >> "$PROCESSED_COMMENTS_FILE"

        # Check if Claude signaled all reviews are complete
        if echo "$OUTPUT" | grep -q "<review>COMPLETE</review>"; then
            echo -e "${GREEN}Claude signaled all reviews are addressed.${NC}"
            CLAUDE_SIGNALED_COMPLETE=true
            # Skip the wait - immediately check for new comments
            continue
        fi

        echo -e "${GREEN}Finished processing Greptile comments.${NC}"
    fi

    # Check if this is the last cycle
    if [ "$cycle" -eq "$PR_REVIEW_CYCLES" ]; then
        echo -e "${GREEN}Completed all PR review cycles.${NC}"
        break
    fi

    # Only wait if we haven't signaled completion
    if [ "$CLAUDE_SIGNALED_COMPLETE" = false ]; then
        echo -e "${YELLOW}Waiting 5 minutes before next check...${NC}"
        sleep $PR_REVIEW_INTERVAL
    fi
done

# =============================================================================
# COMPLETE
# =============================================================================

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           Ralph Complete!                                  ║${NC}"
echo -e "${GREEN}║                                                           ║${NC}"
echo -e "${GREEN}║  ✓ All user stories implemented                          ║${NC}"
echo -e "${GREEN}║  ✓ Tests passed (integration)                            ║${NC}"
echo -e "${GREEN}║  ✓ Pull request created: #$PR_NUMBER                              ║${NC}"
echo -e "${GREEN}║  ✓ Greptile review cycles complete                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

# Final commit — catch anything left behind (prd.json passes, progress.txt, etc.)
commit_all_changes "chore: ralph post-run cleanup (final state)"

# Push final changes
echo -e "${YELLOW}Pushing final changes...${NC}"
git push origin "$WORK_BRANCH" 2>&1 || true

PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url')
echo -e "${CYAN}PR URL: $PR_URL${NC}"
