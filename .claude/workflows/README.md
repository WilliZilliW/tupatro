# The delivery pipeline

How a requirement becomes a pull request in this project. This lives outside `CLAUDE.md` on
purpose: every agent in the pipeline reads `CLAUDE.md` on every run, and none of them needs to know
how the pipeline that spawned it works. Keeping it here costs ~2k tokens per agent less.

Work enters this project as a **spec**, not as a chat message. `docs/specs/<date>-<slug>.md` is the
contract; `docs/specs/TEMPLATE.md` is its shape. The spec is committed in the same PR as the code
it describes, so the requirement and the implementation are reviewed together and stay together.

```bash
/req "the requirement, in a sentence or two"   # requirement -> spec -> code -> PR
/rework 42                                     # re-enter after review, same branch
```

`/req` runs the `deliver` workflow (`.claude/workflows/deliver.js`) unattended, about twelve
agents. The script is orchestration only; each role's stance, tools and reasoning effort live in
its own `.claude/agents/tupatro-*.md`, so a prompt change is a readable diff and a role can be
spawned on its own from the main thread:

| Stage        | Agents             | Writes?  | Does                                                   |
| ------------ | ------------------ | -------- | ------------------------------------------------------ |
| **Spec**     | 1                  | the spec | Classifies the `kind`, writes checkable criteria       |
| **Recon**    | 3, parallel        | no       | Touch points, i18n impact, test plan                   |
| **Build**    | 1                  | yes      | Implements to green typecheck and tests                |
| **Verify**   | 2–5, parallel      | temp     | Gates, audit, playtest, balance, the screen            |
| **Mutation** | 1, `rule\|scoring` | yes      | Breaks the rule on purpose, proves a test bites        |
| **Fix**      | ≤2 rounds          | yes      | Repairs what verify reported, re-runs only what failed |
| **Deliver**  | 1                  | commit   | Branch, commit, `gh pr create`. Never merges           |

Which verification stages run is decided by the spec's `kind`:

| stage        | runs for                        | what only it can catch                                     |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| **gates**    | always                          | lint, types, format, tests, build, stray files             |
| **audit**    | always                          | a law broken, a criterion nearly met                       |
| **playtest** | `rule` `scoring` `balance` `ui` | a phase that never advances — a run that cannot finish     |
| **balance**  | `rule` `scoring` `balance`      | a mechanic that moves the numbers                          |
| **screen**   | `ui` `i18n`                     | a button the player cannot reach; Finnish text overflowing |

Six things about it are deliberate:

- **Parallel means read-only; every writer is serial.** Two agents editing `reducer.ts` at once
  corrupts the tree. Verify fans out because it only reads; Build, Fix, Mutation and
  Deliver run one at a time.
- **There is no human gate mid-flight, so the spec's Assumptions section carries the review.** A
  subagent cannot ask a question. Every ambiguity it resolves goes in that section, and the PR body
  repeats it — that is where a misread requirement gets caught, in one place, before the diff.
- **The auditor is not given a checklist.** Every role gets the shared `LAW` block from the script
  except `tupatro-audit`, which derives the rules from this file itself. Handing the auditor the
  same list the builder worked from turns verification into agreement — a law missing from `LAW`
  would then be missed twice. Keep that asymmetry if you touch the script.
- **Only the screen stage looks at the screen, and only the playtest stage finishes a run.** The
  render tests prove the game does not crash; they cannot prove the RAMI/NOLO buttons are reachable
  at a 500 px window height — a bug this project has shipped twice. Nor can a unit test show a
  phase that never advances. Those two stages exist for exactly the failures jsdom structurally
  cannot see.
- **The PR body is the acceptance criteria, ticked.** Review against the spec, not just the diff.
- **The mutation stage never uses `git checkout --` or `git stash` to restore.** The tree holds
  uncommitted work at that point; it copies the file aside and moves it back, chained with `;` so
  the restore runs even when the test command fails.

**The pipeline is tuned for token cost, because a 5-hour quota is the binding constraint.** What the
two measured runs cost, and what changed after each:

| run                                      | agents | subagent tokens |
| ---------------------------------------- | ------ | --------------- |
| first (stale script, no guards)          | 14     | 1,482,717       |
| second (roles, guards, `gates` on haiku) | 14     | 1,098,749       |

Cost is ~2,500 tokens per tool call, and the distribution is flat — the largest agent was 10%. There
is no hotspot, so cost is cut by removing agents, cheapening tiers, and not re-running the expensive
verifiers:

- **Recon is one agent, not three.** All three questions needed the same reading of the same files;
  three agents paid for that reading three times, for 26% of the run.
- **`screen` and `playtest` run once.** They are the two most expensive verifiers and their findings
  are one-shot observations. The re-verify after a fix runs `gates` and `audit` only — the tradeoff
  is that a fix which breaks layout is not caught, and that is why layout findings go in the pull
  request body.
- **One fix round, not two.** What is still failing goes into the pull request body under
  **Verification still failing** rather than being quietly dropped, because an audit or screen
  failure leaves the tree green and would otherwise reach the reviewer looking clean.
- **`screen` and `playtest` are also gated on what the build actually touched**, not only on the
  spec's `kind`. A `ui` spec that changed no CSS and no component has nothing for the screen stage
  to look at.
- **Only `spec`, `audit` and `build` run on the expensive tier.** They are where both runs' value
  came from — the audit alone found every real defect. `gates` is haiku; `recon`, `screen`,
  `playtest`, `mutation` and `deliver` are sonnet.
- **`--quick` exists for small changes.** `/req --quick "..."` runs four agents — spec, build,
  gates, deliver — for roughly 240k instead of 820k. It skips recon, the audit, playtest, the screen
  check, balance and mutation, names every one of them in the pull request body under **Not
  verified**, and escalates itself back to the full pipeline if the spec turns out to be `rule` or
  `scoring`. Use it when you will read the diff yourself; the audit is the stage that found every
  real defect in both measured runs, so quick mode moves that job to you.
- **This file is not in `CLAUDE.md`.** Every agent reads `CLAUDE.md` every run and none of them
  needs to know how the pipeline works; moving it out took ~2k tokens off each agent.

**Cost is bounded in four places, because none of them bound themselves.** The build and fix agents
are told to give a stubborn failure about five focused attempts and then report it — an agent
looping `npm test` until green is an unbounded loop inside one context window, and it dies having
returned nothing. Every array in the workflow's schemas carries a `maxItems`, so an audit with forty
findings cannot become a forty-finding prompt for the next stage; the failure arrays say "most
severe first" because the cap truncates the tail. The screen agent is capped at six screenshots at
`scale: 0.5` and told that `read_page` answers every question about text and structure for a
fraction of the cost. The playtest and balance agents report aggregates and never per-run output.

If a token target is set for the turn, the script reads `budget.remaining()` and spends what is left
on `gates` and `audit`, dropping `playtest`, `balance` and `screen` below 150k, the second fix round
below 80k, and the mutation stage below 60k. Every drop is logged and the pull request stops
claiming what was not checked — a silent cap reads as "covered everything" when it did not.

**Only `tupatro-gates` is pinned to a cheaper model.** The first run cost 1.48M subagent tokens
across fourteen agents, and the distribution was flat — six agents between 7% and 10%, the largest
14%. There is no hotspot to fix, so the tempting move is to downgrade the model on the mechanical
roles. Two reasons that stays limited to `gates`, which runs five commands and quotes the failing
line: a cheaper `recon` that misses a touch point buys a fix round on the expensive model, so a bad
downgrade there is net negative rather than net neutral; and `deliver` is the last gate before the
tree ships. The audit was the largest single bucket at 26% and is deliberately left alone — it ran
three times because it kept finding real defects, and making it cheaper optimises away the stage
that worked. That profile also predates the guards above, so it should be re-measured before
anything else is tuned.

**The pipeline needs the GitHub CLI, and this machine did not have it.** Without `gh` the deliver
stage still commits and pushes the branch — that part is safe — but it cannot open the pull request,
and it reports the compare URL and the reason instead. Install `gh` (`brew install gh`, then
`gh auth login`) to get the last step back.

**Invoke the workflow by `scriptPath`, never by name.** `Workflow({ name: "deliver" })` resolves
through a registry snapshot that can be older than `.claude/workflows/deliver.js`. On the first real
run it was: eleven agents spent an hour executing the pipeline as it had been two commits earlier,
without the roles, the screen and playtest stages, or the guards, and nothing announced the
substitution. `/req` and `/rework` pass `scriptPath: ".claude/workflows/deliver.js"` for that reason.

Stages that write temporary files pin their filenames (`src/test/tmp-balance.test.ts`,
`src/test/tmp-playtest.test.ts`) because they run in the same parallel fan-out. Scripts cannot read
the clock (`Date.now()` throws — it would break workflow resume), so `/req` passes `date` in `args`.

If the feedback on a PR changes what the requirement _is_, edit the spec and run `/req` again
rather than `/rework` — a change of intent belongs in the spec, not buried in a review thread.
