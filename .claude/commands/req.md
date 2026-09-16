---
description: Turn a requirement into a specced, tested, verified branch, pushed and ready for a PR
argument-hint: [--full] [--screen] <requirement in a sentence or two>
allowed-tools: Bash(date:*), Bash(rtk git:*), Bash(git status:*), Bash(git fetch:*), Bash(git rev-parse:*), Bash(git checkout:*), Bash(git branch:*), Bash(rtk ls:*), Workflow
---

Deliver this requirement end to end:

$ARGUMENTS

Steps:

1. Run `date +%F` to get today's date — the workflow script cannot read the clock and needs it
   passed in.
2. Check `git status --short`. If the working tree is dirty, stop and tell the user: the workflow
   commits the tree and would carry unrelated changes into the PR.
3. **Create the development branch before anything else runs.** Derive a slug from the requirement
   first — English, kebab-case, three to six words, ASCII only (`resume-a-run-after-a-refresh`).
   That slug names both the branch and the spec file, so the two always match.

   ```bash
   rtk git fetch origin
   git rev-parse --verify --quiet refs/heads/spec/<date>-<slug>
   rtk git checkout -b spec/<date>-<slug> --no-track origin/main
   ```

   - `origin/main` and not local `main`: the branch has to start from what is on the remote, or the
     pipeline builds on a stale base and the pull request carries a diff nobody asked for.
   - `--no-track` on purpose. Without it the new branch's upstream is `origin/main`, and the deliver
     stage's `git push` then refuses on the name mismatch — or, worse, aims at `main`.
   - If `git rev-parse` prints a hash, the branch already exists. Stop and ask the user: either that
     requirement is already in flight (use `/rework`) or the slug needs to differ.

   Every stage after this — the spec, the build, the fix rounds — happens on that branch. Nothing in
   this pipeline touches `main` except reading it, and the deliver stage no longer creates a branch
   of its own.

4. Invoke the `deliver` workflow, passing the branch and slug you just created:

   ```
   Workflow({
     scriptPath: ".claude/workflows/deliver.js",
     args: {
       requirement: "<the requirement verbatim>",
       date: "<YYYY-MM-DD>",
       slug: "<slug>",
       branch: "spec/<date>-<slug>",
       quick: true,
       screen: false,
     },
   })
   ```

   **Address the script by path, never by `{ name: "deliver" }`.** A name resolves through a
   registry snapshot that can predate the file on disk. The first real run of this pipeline spent
   an hour executing a version of the script that had been rewritten before it started, so none of
   the roles, stages or guards it was launched for actually ran.

   Pass the requirement text verbatim. Do not pre-classify it, do not write the spec yourself, do
   not pre-plan the implementation — the workflow's Spec and Recon stages do that, and doing it
   here duplicates the work and biases those stages. The slug is naming, not classification: the
   spec agent still decides the `kind`, the title and every criterion.

5. **Quick mode is the default, and `quick: true` is what you pass unless the requirement starts
   with `--full`.** Quick mode runs four agents — spec, build, gates, deliver — and skips recon,
   the adversarial audit, playtest, balance and mutation. It costs roughly 240k
   tokens instead of 820k, and a 5-hour quota is the binding constraint on this project. The pull
   request says which stages were skipped, so **you read the diff yourself**: the audit is the
   stage that found every real defect in the two measured runs, and quick mode moves that job to
   the human.

   **If the requirement starts with `--full`**, strip that flag from the requirement text and pass
   `quick: false`. That runs recon, the audit, and whichever of playtest, balance and mutation the
   spec's `kind` calls for — everything but the browser, which is `--screen` below. Reach for it when the change
   is one you would not want to review unaided: a new mechanic, a scoring change, anything
   multi-file, or anything you cannot hold in your head.

   **Quick mode never escalates itself.** It used to, on `kind: rule` and `kind: scoring`, and that
   was removed: a run that quietly buys the full pipeline on a flag nobody passed spends most of a
   5-hour quota, which is the one cost that stops the next change being delivered at all. A rule
   spec therefore ships with the audit and mutation stages skipped unless you ask for `--full` —
   the pull request names them under **Not verified**, and reading the diff is the job that
   replaces them. `/verify` runs any of them afterwards, against the pushed branch or the landed
   merge, so a stage skipped here is deferred rather than lost. The branch is created either way:
   quick mode skips verification, never the branch.

   Do not pass `quick: false` on your own judgement. If the requirement looks large but the user
   did not ask for `--full`, run quick and mention that `--full` exists.

6. **Looking at the running game is a manual step on this project; the agent does it only on
   `--screen`.** Strip that flag from the requirement text and pass `screen: true`. It is the most
   expensive and slowest verifier in the pipeline, and the person reviewing the change opens the
   game anyway — so the default hands the reading to the human rather than dropping it. `npm test`
   renders every screen, panel, modal and phase in both languages already; layout, hit-testing and
   how the timing feels are what a browser adds. Ask for the agent when opening it yourself is
   inconvenient — a long sweep across phases, or a change you will not be at a keyboard for.

   When the change is one that wants a browser and no agent ran one, the pull request carries the
   checklist under **Look at this in the browser**: both locales, a 500 px window height, a phone
   width if the rail or the felt moved, and the console. That is the same ground the screen agent
   covers, written for you instead.

   `--screen` and `--full` are independent flags and combine: `--screen` alone still runs quick,
   which skips the audit. The kind gate applies on top either way — a spec that is not `ui` or
   `i18n`, or one whose build touched no CSS and no component, gets neither the agent nor the
   checklist, because there is nothing on screen to look at.

7. The workflow runs unattended: spec, build, gates, push — plus recon, verification, mutation and
   the fix rounds under `--full`. It takes a while. It never opens or merges a pull request — this project does not use the GitHub CLI, and
   opening the PR from the pushed branch is a manual step for the human. When the task notification
   arrives, report to the user: the spec path, the compare URL (`pr` in the result), the pull
   request body (`prBody` — give it to them so they can paste it in), the assumptions the spec agent
   recorded, any outstanding failures, and any balance numbers measured. Say plainly if `committed`
   came back false — that means it stopped short of even pushing.

   The branch exists either way. If the run fails or is interrupted, the work is still on it and the
   user is still standing on it; say so, and do not switch back to `main` on their behalf.

Do not implement anything yourself in this session, and do not open or merge a pull request.
