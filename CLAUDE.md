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

Run Vite from the repo root. Edits are live — there is no worktree to sync to.

```bash
npm run dev
```

Vite takes 5173 if it is free and steps to the next port if not, so read the
port off its own startup line rather than assuming 5173. A tool that reports a
different port may be proxying; the port Vite prints is the real one.

Earlier revisions of this file told agents to serve the site from
`.claude/worktrees/practical-solomon-0e623d/` and `cp` each edited file across.
That worktree was 229 commits behind `main` and has been removed — following
those instructions served a months-old site.

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

## Agent Orchestration Policy

Always read and follow [AGENT_POLICY.md](AGENT_POLICY.md) before dispatching subagents or delegating work. It governs when to delegate vs. do work directly, brief/report-back contracts, model routing, and verification requirements.

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
