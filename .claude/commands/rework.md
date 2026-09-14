---
description: Re-enter the delivery pipeline for a pushed branch after review
argument-hint: [--full] [--screen] <branch-name> <the review feedback, pasted verbatim>
allowed-tools: Bash(date:*), Bash(rtk git:*), Bash(git:*), Read, Workflow
---

Address review feedback on a branch this pipeline already pushed, and push the fix to the same
branch.

$ARGUMENTS

The first token is the branch name (e.g. `spec/2026-09-03-party-emblems-and-support`); everything
after it is the feedback. `--full` and `--screen` may precede the branch name, and mean exactly
what they mean on `/req` — see step 4. This project does not use the GitHub CLI, so the feedback is not fetched
from a pull request — the human pastes it in here, exactly as they received it (from the PR's
review comments, or however they read it). If no feedback follows the branch name, stop and ask for
it rather than guessing what changed.

Steps:

1. Run `date +%F`.
2. Find the spec this branch delivered: `git diff main...<branch> --name-only -- docs/specs/`. It
   should name exactly one file; read it for the `kind` in its frontmatter and its title. If it
   names more than one or none, stop and ask which spec this rework is against.
3. Check out the branch, bring it up to date with the remote, and confirm the tree is clean:
   `rtk git fetch origin`, `rtk git checkout <branch>`, `git pull --ff-only`, then
   `git status --short`. Unlike `/req`, this creates nothing: the branch exists and the rework
   continues on it, so the already-open pull request updates rather than a second one appearing.
4. **Read the flags, and read only the leading ones.** `/rework` takes the same three modes `/req`
   does, so a rework never costs more than the run that shipped the thing being reworked:

   - **quick is the default** — spec is skipped anyway, so a rework is build, gates and deliver.
     No adversarial audit; you confirm the reviewer's point was addressed by reading the diff.
   - **`--full`** restores recon-free verification in full: the audit, and whichever of playtest,
     balance and mutation the spec's `kind` calls for. Reach for it when the feedback was about
     behaviour rather than a detail.
   - **`--screen`** puts an agent at the browser. Off by default here as on `/req` — looking at
     the running game is a manual step on this project — and worth buying when the review comment
     is itself about layout, reachability or a Finnish string overflowing.

   `--full` and `--screen` are independent and combine. **Only tokens before the branch name are
   flags.** The feedback is pasted from a review and may well contain the word `--full` in prose;
   anything after the branch name is feedback, never a flag.

5. Invoke the `deliver` workflow in rework mode. Passing `reviewNotes` makes it skip the Spec and
   Recon stages and enter at Build:

   ```
   Workflow({ scriptPath: ".claude/workflows/deliver.js", args: {
     date: "<YYYY-MM-DD>",
     specPath: "docs/specs/<date>-<slug>.md",
     slug: "<slug>",
     kind: "<kind from the spec frontmatter>",
     title: "<spec title>",
     branch: "<branch>",
     reviewNotes: "<the feedback, verbatim, with any leading flags stripped>",
     quick: true,
     screen: false,
   } })
   ```

   Pass the feedback verbatim. Summarising it here is how a reviewer's point gets quietly dropped,
   and so is leaving a stripped flag in it. Address the script by path, never by
   `{ name: "deliver" }` — a name can resolve to a registry snapshot older than the file on disk.

   The Build stage runs on the expensive model for a rework, unlike a fresh `/req`: it is reading a
   human's words rather than a spec the pipeline wrote itself, and a misread review point is not
   something the audit would catch even when one runs.

6. When it finishes, report what changed, which review points were addressed, any the workflow
   pushed back on as false positives, and the updated `prBody` for the human to paste into the
   already-open pull request.

If the feedback changes what the requirement _is_ rather than how it was implemented, do not use
this command — edit the spec and run `/req` against the revised requirement instead, so the change
of intent is recorded in the spec rather than buried in a review thread.
