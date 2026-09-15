---
name: delegate
description: |
  Apply when starting a subagent with the `delegate` tool, when a message
  arrives from a subagent (it says, reports, or failed), or when answering one
  with `reply`. Covers what a brief must contain, how the exchange works, who
  answers a subagent's questions, and how to read its report.
---

# Delegating to a subagent

`delegate` starts a child session that runs concurrently with yours. You are
its orchestrator. It has your tools except `delegate` and `reply`, so it does
the work itself. It has no memory of this conversation: the brief is all it
knows.

## Writing the brief

- Make it complete and self-contained. Name the directory, the files, the
  constraints, and the definition of done. Do not refer to anything said in
  this conversation.
- Say what the report must contain. The subagent decides what to leave out,
  so name what you need: paths changed, the test command and its final line,
  decisions a reader could not guess from the code.
- Cap the length of the report when you only need a verdict.
- Set `model` only when the default is wrong for the job. Prefer
  `provider/id`; a bare name is matched against providers the human is
  authenticated for, and a name nobody can use fails the child.
- After calling `delegate`, end your turn. Do not poll or wait. What the
  subagent says, and its report, arrive as messages that start your next turn.

## Messages from a subagent

Every message names the subagent and, while it runs, its key `alt+N`.

- `… says:` — it stopped without reporting. It is asking a question or
  presenting a plan. If the human already ratified the work it is doing,
  answer it yourself with `reply`. Escalate to the human only when the
  question is one you cannot or should not decide.
- `… reports:` — the job is done as far as it is concerned. The report
  arrives with the review instruction attached; run that audit before
  speaking, then read the report against the brief you wrote. Check that
  every item you asked for is there.
  When something is missing or wrong, wake it by name with `reply` and say
  exactly what to fix; it reports again.
- `… failed:` — its model call did not go through. The text is the error.
  A model-resolution failure is fixed by retrying `delegate` with
  `provider/id`.

The human may open a subagent's overlay and talk to it directly. While they
are watching, `reply` refuses; the human is answering. The subagent sees the
human's messages prefixed `Human:` and yours prefixed `Orchestrator (<model>):`,
and knows the human outranks you.

## Addressing a subagent with `reply`

- Running: `reply({ key: N, message })`, with `N` from its `alt+N`.
- Finished: `reply({ name, message })`. This wakes the most recent subagent of
  that name with its whole history, and it takes a key again. A subagent that
  exists only on disk is resumed first.

Reply with instructions, not questions, unless you need its judgement. Keep
each reply to what changed; it already has the brief.

## What delegation is for

Work whose intermediate output would flood your context: reading many files,
running long test loops, exploring a codebase. Not work that needs the
conversation you are in, and not work small enough to do directly.
