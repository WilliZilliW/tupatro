---
description: Turn a requirement into a specced, tested, verified branch, pushed and ready for a PR
argument-hint: [--quick] <requirement in a sentence or two>
allowed-tools: Bash(date:*), Bash(rtk git status:*), Bash(git status:*), Bash(rtk ls:*), Workflow
---

Deliver this requirement end to end:

$ARGUMENTS

Steps:

1. Run `date +%F` to get today's date — the workflow script cannot read the clock and needs it
   passed in.
2. Check `git status --short`. If the working tree is dirty, stop and tell the user: the workflow
   commits the tree and would carry unrelated changes into the PR.
3. Invoke the `deliver` workflow:

   ```
   Workflow({
     scriptPath: ".claude/workflows/deliver.js",
     args: { requirement: "<the requirement verbatim>", date: "<YYYY-MM-DD>", quick: false },
   })
   ```

   **Address the script by path, never by `{ name: "deliver" }`.** A name resolves through a
   registry snapshot that can predate the file on disk. The first real run of this pipeline spent
   an hour executing a version of the script that had been rewritten before it started, so none of
   the roles, stages or guards it was launched for actually ran.

   Pass the requirement text verbatim. Do not pre-classify it, do not write the spec yourself, do
   not pre-plan the implementation — the workflow's Spec and Recon stages do that, and doing it
   here duplicates the work and biases those stages.

4. **If the requirement starts with `--quick`**, strip that flag from the requirement text and pass
   `quick: true`. Quick mode runs four agents — spec, build, gates, deliver — and skips recon, the
   adversarial audit, playtest, the screen check, balance and mutation. It is for a change whose
   diff you will read yourself: a two-line fix, a string, a colour. The pull request says which
   stages were skipped, and the workflow escalates itself back to the full pipeline if the spec
   turns out to be `kind: rule` or `kind: scoring`, where skipping the audit is most dangerous.

   Do not pass `quick: true` on your own judgement. If the requirement looks small but the user did
   not ask for `--quick`, run the full pipeline and mention that `--quick` exists.

5. The workflow runs unattended: spec, recon, build, verify, mutation, fix, push. It takes a
   while. It never opens or merges a pull request — this project does not use the GitHub CLI, and
   opening the PR from the pushed branch is a manual step for the human. When the task notification
   arrives, report to the user: the spec path, the compare URL (`pr` in the result), the pull
   request body (`prBody` — give it to them so they can paste it in), the assumptions the spec agent
   recorded, any outstanding failures, and any balance numbers measured. Say plainly if `committed`
   came back false — that means it stopped short of even pushing.

Do not implement anything yourself in this session, and do not open or merge a pull request.
