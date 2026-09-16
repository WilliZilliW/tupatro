---
description: Run the verification stages /req quick mode skips — audit, mutation, balance, playtest, screen — against a diff that already exists
argument-hint: [audit|mutation|balance|playtest|screen|recon|all] [<branch|commit|--base <ref>>]
allowed-tools: Bash(rtk git:*), Bash(git:*), Bash(date:*), Bash(ls:*), Bash(sed:*), Bash(grep:*), Read, Grep, Glob, Agent
---

Run the verification stages against work that already exists.

$ARGUMENTS

`/req` is quick by default and does not escalate itself, so a `rule` or `scoring` change ships with
the audit and mutation stages skipped. This command is how you buy them back **afterwards** —
against a dirty tree, an unmerged branch, or a merge that already landed — without re-running the
pipeline or rebuilding anything. It writes no code and pushes nothing. Every stage here is a
**reader**; the one exception is mutation, which edits a file and restores it.

## 1. Work out what the diff is, and say so out loud

**This is the step that matters most, and getting it wrong makes every stage lie.** The agents were
written for the pipeline, where the change is always uncommitted — `tupatro-audit` opens with a bare
`git diff`. Against a merged branch that returns nothing, and the agent reports a clean pass on an
empty diff. **So you compute the range and put it in the brief explicitly.**

```bash
rtk git status --short
rtk git log --oneline -5
git rev-parse --abbrev-ref HEAD
```

Resolve in this order:

- **An explicit argument** — a branch name, a commit, or `--base <ref>`. Use it.
  A branch name means `origin/main...<branch>`; a merge commit means `<sha>^1..<sha>`.
- **A dirty working tree** and no argument: the uncommitted change, `git diff` plus `git diff --cached`.
  This is the pipeline's own case and the agents need no override.
- **A clean tree on a `spec/*` branch**: `origin/main...HEAD`.
- **A clean tree on `main`**: the last merge, `git log --merges -1 --format=%H` → `<sha>^1..<sha>`.
  Say which merge you picked and name the branch it came from — if the user meant a different one,
  they need to see that before they read the findings.

State the resolved range to the user in one line before spawning anything, and pass it into every
brief as `DIFF: <the exact command that shows it>`. Tell each agent to use that command **instead
of** any `git diff` its own instructions name.

## 2. Find the spec

The audit checks acceptance criteria, so it needs the spec the change was built from.

```bash
rtk ls docs/specs/
```

Pick the spec whose slug matches the branch, or the one added by the diff itself
(`git diff --name-only <range> -- docs/specs/`). If there is no spec — a hand-written change, or a
merge that predates the pipeline — say so and run the audit anyway: CLAUDE.md is the larger half of
what it enforces, and it derives its own checklist from there regardless.

## 3. Choose the stages

With no stage named, run **every stage quick mode skipped that applies to this diff**, using the
same gates `deliver.js` uses so this command and the pipeline agree:

| Stage      | Runs when                                                                             |
| ---------- | ------------------------------------------------------------------------------------- |
| `audit`    | always — it is the stage that found every real defect in the measured runs            |
| `mutation` | spec `kind` is `rule` or `scoring`                                                    |
| `balance`  | spec `kind` is `balance`, `rule` or `scoring`                                         |
| `playtest` | spec `kind` is `rule`, `scoring`, `balance` or `ui`, and the diff touches `src/game/` |
| `screen`   | spec `kind` is `ui` or `i18n`, and the diff touches a component or CSS                |

Named stages override the gates entirely — `/verify balance` measures balance whatever the kind is.
`all` runs all five. With no spec, run `audit` alone unless told otherwise.

**`recon` is opt-in only and never in the default set.** It is a _pre_-implementation stage: it maps
touch points for work not yet done. Run it before writing a requirement, not after building one.
If it is named explicitly, brief it with the requirement text rather than a diff range.

**Mutation wants a clean tree.** It edits source files and restores them, checking `git diff --stat`
to confirm the restore. Uncommitted changes make that check ambiguous. If the tree is dirty and
mutation is in the set, say so and ask before running it — a bad restore costs the user their
uncommitted work.

## 4. Run them in parallel, in one message

Spawn every chosen stage as an `Agent` call with its own `subagent_type`, **all in a single
message** so they run concurrently. Do not run them one at a time, and do not use the Workflow tool
— this is a fan-out, not a pipeline, and it needs none of that machinery.

Each brief is: the project preamble, the stage's one-line instruction, the resolved `DIFF:` range,
and the spec path. The preamble, for every stage **except audit**:

> Project: Tupatro — the Finnish trick-taking game tuppi in a Balatro roguelike structure.
> React 19 + TypeScript + Vite. One useReducer store over a pure, framework-free core.
> FIRST: read CLAUDE.md at the repo root and obey it literally. It is dense and non-negotiable.
> Read README.md too if the work touches rules or balance.

**The audit gets no preamble and no checklist, deliberately.** A list handed to it is the same list
the implementer worked from, so it would confirm their reading of the rules instead of checking the
rules. Tell it only what to audit, which spec to check criteria against, and the diff range. It
derives the rest from CLAUDE.md itself — that is why it is the stage that finds things.

Ask each agent to report: `pass` or `fail`, a list of findings each with what / file:line / the
concrete failure scenario, and any notes that are observations rather than defects.

## 5. Report

Give the user, per stage: pass or fail, and every finding in full — what, where, and why it
matters. Rank by severity across all stages rather than grouping by agent; the user wants the worst
thing first, not a tour of the pipeline.

Then say plainly:

- the diff range that was actually examined, and the spec used
- which stages ran, and which were gated out and why
- **for balance: the numbers.** Never relay a balance verdict without the measured figures. A
  measurement whose baseline was not itself re-measured is worth saying out loud — a stale "before"
  is how a change gets credited with an effect it did not have.
- for mutation: which rules were broken on purpose and whether a test caught each one. A mutation
  nothing catches is a missing test, and it is a finding.

**Fix nothing.** This command reads and reports. If the user wants the findings fixed, that is
`/rework <branch> "<the findings>"`, or an ordinary edit — their call, made after they have read
what came back.
