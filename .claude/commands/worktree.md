---
description: Create a Git worktree for parallel development
argument-hint: <branch-name>
---

Create a Git worktree for parallel Claude Code development.

## Instructions

1. **Create the worktree** at `../edgejournal-$ARGUMENTS` with branch `$ARGUMENTS`
2. **Run bun install** in the new worktree to set up dependencies
3. **Confirm** the worktree is ready and provide the path

## Commands to run

```bash
# Create worktree with new branch based on current HEAD
git worktree add ../edgejournal-$ARGUMENTS $ARGUMENTS -b $ARGUMENTS 2>/dev/null || git worktree add ../edgejournal-$ARGUMENTS $ARGUMENTS

# Install dependencies
cd ../edgejournal-$ARGUMENTS && bun install

# Show result
git worktree list
```

## After creation

Tell me the full path to the new worktree so I can work there:
- Path: `../edgejournal-$ARGUMENTS/`
- Branch: `$ARGUMENTS`

Future work should be done in that directory.
