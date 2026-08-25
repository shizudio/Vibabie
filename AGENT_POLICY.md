# How I Use My Agents — Shina Foo, Working Policy

The main session is the orchestrator. Not the worker.

My context window is the most expensive resource in this setup: billed at the
strong-model rate, re-read on every turn, and judgment degrades once
compaction starts. Two rules protect it.

## Rule 1: Never Ingest Bulk

Ingestion fills the window. Not editing.

An edit costs a few hundred tokens. A log dump or multi-file read costs tens
of thousands. Send exploration, searches, log reads, and multi-file reads to
scout subagents that return conclusions plus machine-checkable evidence
pointers (file paths, line numbers, match counts, exit codes).

Scouts never return raw file contents.

Read a file myself only when:
- I am about to edit that exact file, or
- I must quote it verbatim.

## Rule 2: Delegate Implementation by Default

Spawn a briefed subagent when ANY of these is true:
- The work touches 2+ source files, or spans 2+ projects
- The work is mechanical or parallelizable (pattern fixes, boilerplate, batch
  renames, porting a change between sibling codebases)
- The work needs reads I haven't already done

Do the work myself ONLY when:
- It's a small edit where my window already holds the full context and
  writing the brief would be longer than writing the fix
- Files are my own operating machinery (docs, scripts, config, skills, hooks)
- I'm patching a subagent's near-miss, where a redo round-trip costs more
  than the fix

## Rule 3: Every Delegation Uses Two Contracts

### The Complete Brief

Diagnose first, in my own session. Then hand over a brief the agent never
has to re-investigate from:
- The verified root cause or task spec, with every id, path, and tooling
  pointer
- The exact change spec
- The explicit verification steps and the literal commands to run them
- Hard guards:
  - Never push to a production branch
  - Stage only the paths you changed, by name. Never `git add -A`
  - Do all the work yourself. Never spawn your own background subagents
  - Report evidence, not prose

One deliverable per agent.

### The Report-Back

Outcome first. Then machine-checkable evidence (exit codes, match counts,
row counts, screenshot paths). Then an explicit list of what was NOT
verified.

Roughly 300 words plus evidence, hard-capped. Never file dumps.

## Rule 4: Model Routing by Task Difficulty

| Task | Model |
|---|---|
| Scouts, greps, status checks, boilerplate | Haiku |
| Scoped implementation from a complete brief, ports, audits, reviews | Sonnet |
| Subagent needs extra reasoning power | Opus (only when explicitly requested per spawn) |

The orchestrator (main session) runs at my chosen session model and codes
only under the direct-work exceptions in Rule 2.

## Rule 5: Verification Stays With Me

Never accept a subagent's self-report as proof.

Verify with cheap, deterministic re-runs: grep the touched files for the
expected tokens, re-run the test or gate, do one targeted read.

Do NOT re-ingest the whole diff. That silently refunds the context the
delegation just saved.

Every spawned agent is a parallel editor on the same tree:
- Assume it may have touched files outside its brief
- Never let two agents own the same file at once

## Rule 6: Topology by Graph Engineering (see /graph-engineering skill)

A single briefed agent + independent verification is a loop. Prefer it until
it demonstrably fails. Reach for a graph (multiple coordinated agents) only
after running the Starting Checklist from the graph-engineering skill:

1. Can one well-scoped agent + an external verifier do it? → stay in a loop.
2. Does every proposed node have a genuine specialty (different context,
   model, toolset, or adversarial role) — not just "step N of a plan"?
3. Can the full topology be sketched in under 2 minutes? If not, simplify.
4. Where are the independent verifiers and the anchors the model cannot
   rewrite (executed tests, guard batteries, fingerprints, fail-closed
   scripts, human gates)?
5. What is the shared-state isolation plan, and the merge strategy?
6. Where are the hard stops (budget, spend approval, push-on-word-only)?

Standing topology rules for this setup:
- READ work (audits, investigations, verification sweeps) parallelizes as a
  diamond: fan-out specialized readers → independent checker with fresh
  context → merge. Readers never edit.
- WRITE work is sequential in the shared tree, or worktree-isolated with an
  explicit merge step. Two writers in one tree is the known failure mode —
  it has happened here; never again by design.
- Checkers never share context with the workers they check. A cold-read
  reviewer, a different model, or an executed test counts as independent;
  self-critique in the same context does not.
- Every important path ends at an anchor: a gate the model cannot rewrite.
  If a graph's output isn't anchored, it isn't verified.
