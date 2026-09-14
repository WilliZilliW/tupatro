---
description: Turn a requirement into a specced, tested, verified branch, pushed and ready for a PR
argument-hint: [--full] <requirement in a sentence or two>
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
   the adversarial audit, playtest, the screen check, balance and mutation. It costs roughly 240k
   tokens instead of 820k, and a 5-hour quota is the binding constraint on this project. The pull
   request says which stages were skipped, so **you read the diff yourself**: the audit is the
   stage that found every real defect in the two measured runs, and quick mode moves that job to
   the human.

   **If the requirement starts with `--full`**, strip that flag from the requirement text and pass
   `quick: false`. That runs the whole pipeline — recon, the audit, and whichever of playtest,
   balance, the screen check and mutation the spec's `kind` calls for. Reach for it when the change
   is one you would not want to review unaided: a new mechanic, a scoring change, anything
   multi-file, or anything you cannot hold in your head.

   Two things happen without either flag. The workflow **escalates itself back to the full
   pipeline** when the spec turns out to be `kind: rule` or `kind: scoring` — the two kinds where
   skipping the audit and the mutation stage is most dangerous — so tuppi's rules are never
   under-verified by default. And the branch is created first either way: quick mode skips
   verification, never the branch.

   Do not pass `quick: false` on your own judgement. If the requirement looks large but the user
   did not ask for `--full`, run quick and mention that `--full` exists.

6. The workflow runs unattended: spec, build, gates, push — plus recon, verification, mutation and
   the fix rounds under `--full`. It takes a while. It never opens or merges a pull request — this project does not use the GitHub CLI, and
   opening the PR from the pushed branch is a manual step for the human. When the task notification
   arrives, report to the user: the spec path, the compare URL (`pr` in the result), the pull
   request body (`prBody` — give it to them so they can paste it in), the assumptions the spec agent
   recorded, any outstanding failures, and any balance numbers measured. Say plainly if `committed`
   came back false — that means it stopped short of even pushing.

   The branch exists either way. If the run fails or is interrupted, the work is still on it and the
   user is still standing on it; say so, and do not switch back to `main` on their behalf.

Do not implement anything yourself in this session, and do not open or merge a pull request.
