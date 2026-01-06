---
description: Remove Git worktrees (single or all)
argument-hint: [branch-name or "all"]
---

Remove Git worktrees created for parallel development.

## Instructions

### If `$ARGUMENTS` is "all" or empty:

1. **List all worktrees** with `git worktree list`
2. **Show the user** which worktrees exist (excluding main working directory)
3. **Ask for confirmation** before removing each worktree
4. **Remove confirmed worktrees** and prune stale references
5. **Offer to delete branches** associated with removed worktrees

### If `$ARGUMENTS` is a specific branch name:

1. **Remove the worktree** at `../edgejournal-$ARGUMENTS`
2. **Prune stale worktrees** to clean up references
3. **Ask if the branch should be deleted** (local and remote)

## Commands

```bash
# List all worktrees
git worktree list

# Remove a specific worktree
git worktree remove ../edgejournal-<branch> --force

# Prune stale worktrees
git worktree prune

# Delete local branch (after user confirms)
git branch -D <branch>

# Delete remote branch (after user confirms)
git push origin --delete <branch>
```

## Important

- Never remove the main working directory (the one without `edgejournal-` prefix in parent folder)
- Always confirm with user before deleting branches
- If worktree has uncommitted changes, warn the user before force removal
