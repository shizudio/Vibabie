# Shizudio — Claude Guidelines

## Branching & Deployment

**Always push to `staging`, never directly to `main` for staging deployments.**

- Staging URL: https://vibabie-git-staging-shizudios-projects.vercel.app/
- Production URL: https://shizudio.me
- Staging branch: `staging`
- Production branch: `main`

When the user says "push to staging" or "deploy":
1. Commit changes to current branch
2. Merge/fast-forward `staging` to include the changes
3. `git push origin staging`

When the user says "push to production" or "go live":
1. Merge `staging` → `main`
2. `git push origin main`

## Dev Server

Vite dev server runs from the worktree at `.claude/worktrees/practical-solomon-0e623d/`.
After editing source files, sync to worktree:
```bash
cp <file> .claude/worktrees/practical-solomon-0e623d/<file>
```

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
