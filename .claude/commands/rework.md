---
description: Re-enter the delivery pipeline for an open PR after review
argument-hint: <pr-number>
allowed-tools: Bash(date:*), Bash(rtk gh:*), Bash(gh:*), Bash(rtk git:*), Bash(git:*), Read, Workflow
---

Address the review feedback on PR $ARGUMENTS and push the fixes to the same branch.

Steps:

1. Run `date +%F`.
2. Read the PR: `rtk gh pr view $ARGUMENTS --json number,title,headRefName,body,reviews,comments`.
   Collect every review body, review comment and issue comment that asks for a change. Ignore
   approvals and chatter.
3. Find the spec path — it is quoted in the PR body as `docs/specs/<date>-<slug>.md`. Read that
   spec so you can pass its kind through.
4. Check out the PR branch and confirm the tree is clean: `git checkout <headRefName>` then
   `git status --short`.
5. Invoke the `deliver` workflow in rework mode. Passing `reviewNotes` makes it skip the Spec and
   Recon stages and enter at Build:

   ```
   Workflow({ name: "deliver", args: {
     date: "<YYYY-MM-DD>",
     specPath: "docs/specs/<date>-<slug>.md",
     slug: "<slug>",
     kind: "<kind from the spec frontmatter>",
     title: "<PR title>",
     branch: "<headRefName>",
     reviewNotes: "<every change request, verbatim, one per line>",
   } })
   ```

   Pass the feedback verbatim. Summarising it here is how a reviewer's point gets quietly dropped.

6. When it finishes, report what changed, which review points were addressed, and any the workflow
   pushed back on as false positives.

If the feedback changes what the requirement _is_ rather than how it was implemented, do not use
this command — edit the spec and run `/req` against the revised requirement instead, so the change
of intent is recorded in the spec rather than buried in a review thread.
