---
description: Re-enter the delivery pipeline for a pushed branch after review
argument-hint: <branch-name> <the review feedback, pasted verbatim>
allowed-tools: Bash(date:*), Bash(rtk git:*), Bash(git:*), Read, Workflow
---

Address review feedback on a branch this pipeline already pushed, and push the fix to the same
branch.

$ARGUMENTS

The first token is the branch name (e.g. `spec/2026-09-03-party-emblems-and-support`); everything
after it is the feedback. This project does not use the GitHub CLI, so the feedback is not fetched
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
4. Invoke the `deliver` workflow in rework mode. Passing `reviewNotes` makes it skip the Spec and
   Recon stages and enter at Build:

   ```
   Workflow({ scriptPath: ".claude/workflows/deliver.js", args: {
     date: "<YYYY-MM-DD>",
     specPath: "docs/specs/<date>-<slug>.md",
     slug: "<slug>",
     kind: "<kind from the spec frontmatter>",
     title: "<spec title>",
     branch: "<branch>",
     reviewNotes: "<the feedback, verbatim>",
   } })
   ```

   Pass the feedback verbatim. Summarising it here is how a reviewer's point gets quietly dropped.
   Address the script by path, never by `{ name: "deliver" }` — a name can resolve to a registry
   snapshot older than the file on disk.

5. When it finishes, report what changed, which review points were addressed, any the workflow
   pushed back on as false positives, and the updated `prBody` for the human to paste into the
   already-open pull request.

If the feedback changes what the requirement _is_ rather than how it was implemented, do not use
this command — edit the spec and run `/req` against the revised requirement instead, so the change
of intent is recorded in the spec rather than buried in a review thread.
