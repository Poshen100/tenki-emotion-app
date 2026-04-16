# Plan Mode — TENKI Workflow

Execute the following steps in order:

1. Read `ANTIGRAVITY.md` Section 15 (Build Order) to confirm current Phase progress
2. Read `MEMORY.md` Last Session + Next Steps to understand where we left off
3. Identify the next unfinished item(s) based on Phase priority
4. Produce a structured plan in this format:

```
## Plan: <title>

### Context
- Current Phase: <phase>
- Last completed: <what>
- This plan covers: <scope>

### Tasks
- [ ] Task 1 — <description> → commit: `<type>(<scope>): <msg>`
- [ ] Task 2 — <description> → commit: `<type>(<scope>): <msg>`
- ...

### Files to create/modify
- `path/to/file.ts` — <what changes>

### Verification
- [ ] `npx vitest run` passes
- [ ] `npx tsc --noEmit` zero errors
- [ ] No deprecated terms (TEI/PR99/PEAK/OPTIMAL)

### Risks / Questions for Founder
- <any ambiguity that needs human decision>
```

5. **STOP and wait for Founder confirmation** before executing any code
6. After confirmation, execute each task one at a time, committing after each
