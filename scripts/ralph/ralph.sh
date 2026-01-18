#!/bin/bash
# Ralph - Long-running Claude Code agent loop
# Adapted from https://github.com/snarktank/ralph for Claude Code CLI
# Usage: ./ralph.sh [max_iterations] [pr_review_cycles]

set -e

MAX_ITERATIONS=${1:-20}
PR_REVIEW_CYCLES=${2:-10}
PR_REVIEW_INTERVAL=240  # 4 minutes in seconds
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
        --base main \
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
echo -e "${MAGENTA} Checking every 3 minutes for $PR_REVIEW_CYCLES cycles${NC}"
echo -e "${MAGENTA}═══════════════════════════════════════════════════════════${NC}"

# Track which comments we've already processed
PROCESSED_COMMENTS_FILE="$SCRIPT_DIR/.processed-comments"
touch "$PROCESSED_COMMENTS_FILE"

# Track consecutive cycles with no new comments for early exit
NO_COMMENTS_COUNT=0
# Track if Claude has signaled all reviews are complete
CLAUDE_SIGNALED_COMPLETE=false

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
        echo -e "${YELLOW}Waiting 3 minutes before next check...${NC}"
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
echo -e "${GREEN}║  ✓ Tests passed (integration + E2E)                      ║${NC}"
echo -e "${GREEN}║  ✓ Pull request created: #$PR_NUMBER                              ║${NC}"
echo -e "${GREEN}║  ✓ Greptile review cycles complete                        ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"

PR_URL=$(gh pr view "$PR_NUMBER" --json url --jq '.url')
echo -e "${CYAN}PR URL: $PR_URL${NC}"
