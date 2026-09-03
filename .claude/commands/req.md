---
description: Turn a requirement into a specced, tested, verified PR
argument-hint: <requirement in a sentence or two>
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
   Workflow({ name: "deliver", args: { requirement: "<the requirement verbatim>", date: "<YYYY-MM-DD>" } })
   ```

   Pass the requirement text verbatim. Do not pre-classify it, do not write the spec yourself, do
   not pre-plan the implementation — the workflow's Spec and Recon stages do that, and doing it
   here duplicates the work and biases those stages.

4. The workflow runs unattended: spec, recon, build, verify, mutation, fix, PR. It takes a while.
   When the task notification arrives, report to the user: the spec path, the PR URL, the
   assumptions the spec agent recorded, any outstanding failures, and any balance numbers
   measured. Say plainly if `committed` came back false — that means it stopped short of the PR.

Do not implement anything yourself in this session, and do not merge the PR.
