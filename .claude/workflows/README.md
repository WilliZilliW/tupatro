# The delivery pipeline

How a requirement becomes a pull request in this project. This lives outside `CLAUDE.md` on
purpose: every agent in the pipeline reads `CLAUDE.md` on every run, and none of them needs to know
how the pipeline that spawned it works. Keeping it here costs ~2k tokens per agent less.

Work enters this project as a **spec**, not as a chat message. `docs/specs/<date>-<slug>.md` is the
contract; `docs/specs/TEMPLATE.md` is its shape. The spec is committed in the same PR as the code
it describes, so the requirement and the implementation are reviewed together and stay together.

```bash
/req "the requirement, in a sentence or two"   # quick: spec -> build -> gates -> push
/req --full "..."                              # + recon, audit, playtest, balance, mutation
/req --screen "..."                            # + an agent at the browser; combines with --full
/rework <branch> "<the review feedback>"       # re-enter after review, same three modes
```

**The branch comes first.** `/req` derives a slug from the requirement, then runs
`git fetch origin` and `git checkout -b spec/<date>-<slug> --no-track origin/main` **before** it
invokes the workflow, and passes the branch in `args`. Every stage — spec, build, fix — works on
that branch, and the deliver stage only commits and pushes it. Two reasons the branch is not created
at the end any more: work was happening on whatever was checked out, so an interrupted or failed run
left the tree dirty on `main`; and a local `main` that was behind the remote silently became the
base of the pull request. `--no-track` matters — without it the new branch's upstream is
`origin/main` and the final `git push` either refuses on the name mismatch or aims at `main`. The
same slug names the branch and the spec file, so the two cannot drift; the spec agent still decides
the `kind`, the title and the criteria. The script refuses to run without `args.branch`, and the
deliver agent refuses to commit if HEAD is `main`.

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
| **Deliver**  | 1                  | commit   | Commits and pushes. Never opens or merges a PR         |

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

**Both figures predate the quick default, the browser move and the sonnet draft**, and every
percentage derived from them below is a reading of that older pipeline. They are kept because the
_shape_ they showed — a flat distribution with no hotspot — is what every tuning decision since has
rested on. Re-measure before tuning anything further; do not quote them as what a run costs today.

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
- **The expensive tier is `spec`, `audit`, and repair — not the first draft.** `build` is sonnet
  when it is drafting from a spec, and **`fix` is opus**: the Fix stage only exists once
  verification has shown the draft got something wrong, so it is the one place the expensive model
  is known in advance to be worth paying for. A rework's build is opus too, because it is reading a
  human's words rather than a spec the pipeline wrote itself, and a misread review point is not in
  the spec for an audit to catch. `gates` is haiku; `recon`, `screen`, `playtest`, `mutation` and
  `deliver` are sonnet. All of it comes out of one `tupatro-build` role — `agent()`'s `model` option
  overrides the frontmatter, so there is no second agent file to keep in step.
- **Quick is the default now, and `--full` is the opt-in.** `/req "..."` runs four agents — spec,
  build, gates, deliver — for roughly 240k instead of 820k. It skips recon, the audit, playtest,
  the screen check, balance and mutation, and names every one of them in the pull request body under
  **Not verified**. It does **not** escalate itself on a `rule` or `scoring` spec — it used to, and
  that was removed: spending a full run's quota on a flag nobody passed is how the next change stops
  being deliverable at all. The audit is the stage that found every real defect in both measured runs,
  so the default moves that job to you: **read the diff**. `/req --full "..."` buys it back, and is
  what a new mechanic, a scoring change or a multi-file diff is worth. The flip is a quota
  decision, not a claim that verification stopped paying — a 5-hour quota is the binding
  constraint, and one full run is most of it.
- **The browser reading did not stop happening; it moved to the human.** `screen` is the slowest
  and costliest verifier and the one stage that needs a dev server, and whoever reviews a `ui`
  change opens the game regardless — so it runs only on `--screen`, `--full` included. It is not
  filed under **Not verified**: when the spec's kind and the build's files say a browser is wanted
  and no agent ran one, the pull request body carries **Look at this in the browser** — both
  locales, a 500 px height, a phone width if the rail or the felt moved, the console — which is
  the screen agent's own ground handed to the reviewer. The kind and touch gates apply to both, so
  an `infra` spec gets neither the agent nor the checklist. `/rework` passes no `screen`, so a rework never opens a
  browser unless the script is given one.
- **Both commands take the same three modes.** `/rework` is quick by default like `/req`, with the
  same `--full` and `--screen`: a rework whose feedback was a typo should not cost more than the
  `/req` that shipped the typo. What a quick rework leans on instead of the audit is its opus build.
  Only tokens before the branch name are flags there — the feedback is pasted prose and may contain
  the word `--full` innocently.
- **A cheap tier needs an unambiguous prompt.** The first quick run's `gates` agent, on haiku,
  reported the change under review as a dirty tree and cost a fix round plus a re-verify — 23% of
  that run on a non-bug, more than the downgrade saved. The opus agent before it had inferred that
  an untracked spec file was legitimate. The role now enumerates exactly what counts as stray and
  says that an uncertain file belongs to the change. Downgrade a role's model and its prompt has to
  stop relying on inference.
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

**Downgrading a role is only safe where a failure is loud.** The first run cost 1.48M subagent
tokens across fourteen agents, and the distribution was flat — six agents between 7% and 10%, the
largest 14%. There is no hotspot to fix, so the tempting move is to downgrade the mechanical roles.
It went to `gates` first, which runs five commands and quotes the failing line, and then to `build`,
where the same argument holds for a different reason: a draft that goes wrong goes wrong _visibly_,
against the gates or the audit, and the Fix stage that catches it is opus. `recon` is the
counter-example and stays where it is: cheapened further it fails **silently**, by missing a touch
point nobody then looks for, and buys a fix round on the expensive model — a bad downgrade is net
negative, not net neutral. `deliver` is the last gate before the tree ships. The audit was the
largest single bucket at 26% and is deliberately left alone — it ran three times because it kept
finding real defects, and making it cheaper optimises away the stage that worked. That profile
predates the guards above, the quick default and the sonnet draft, so re-measure before tuning
anything else.

**Deliver never calls the GitHub CLI.** It commits, pushes and stops. It still composes the pull
request body — the acceptance criteria ticked, the assumptions, what verification actually checked
— and returns it as `prBody` alongside the compare URL as `prUrl`, so the human pastes both in when
they open the pull request by hand. This was a fallback for a machine that lacked `gh`; it is the
only path now. `/rework` matches it: it takes a branch name and the review feedback as plain
arguments instead of fetching them from a pull request, because there is no `gh pr view` to fetch
them with.

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
