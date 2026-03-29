---
name: security-audit
description: Run security-focused audits and identify vulnerabilities in the codebase.
---

# Security Audit Skill

Run comprehensive security analysis on the TheTraderLog codebase.

## When to Use
- Before major releases
- After adding new API endpoints
- When handling user input or financial data
- Periodic security reviews

## Audit Checklist

### 1. SQL Injection
- [ ] Search for `sql.raw()` with user input
- [ ] Check string concatenation before `sql` template literals
- [ ] Verify all user input is validated via Zod before SQL usage
- [ ] Review dynamic query construction

### 2. XSS (Cross-Site Scripting)
- [ ] Search for `dangerouslySetInnerHTML`
- [ ] Check user input rendered without sanitization
- [ ] Review markdown/HTML rendering

### 3. Authentication & Authorization
- [ ] Verify all protected routes use `protectedProcedure`
- [ ] Check user ownership validation (`userId` checks)
- [ ] Review Clerk middleware configuration
- [ ] Ensure no user ID trusted from client

### 4. Sensitive Data Exposure
- [ ] Search for hardcoded API keys/secrets
- [ ] Check `.env` files not committed
- [ ] Review error messages for data leakage
- [ ] Verify secrets not logged

### 5. Input Validation
- [ ] All tRPC inputs validated with Zod
- [ ] File upload validation (if applicable)
- [ ] URL/redirect validation

### 6. Dependencies
- [ ] Run `bun audit` for known vulnerabilities
- [ ] Check for outdated packages with security issues

### 7. API Security
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] CSP headers set

## Commands to Run

```bash
# Check for sql.raw usage
grep -r "sql.raw" src/

# Check for dangerouslySetInnerHTML
grep -r "dangerouslySetInnerHTML" src/

# Check for hardcoded secrets patterns
grep -rE "(api_key|apikey|secret|password)\s*[:=]\s*['\"][^'\"]+['\"]" src/ --include="*.ts" --include="*.tsx"

# Check .gitignore includes sensitive files
cat .gitignore | grep -E "\.env|credentials"

# Audit dependencies
bun audit 2>/dev/null || npm audit
```

## Report Format

Generate findings as:
```
## Security Audit Report - [DATE]

### Critical
- [Finding with file:line reference]

### High
- [Finding]

### Medium
- [Finding]

### Low
- [Finding]

### Passed Checks
- [What looks good]
```
