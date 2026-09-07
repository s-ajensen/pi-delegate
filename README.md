# pi-delegate

Concurrent subagents for [pi](https://pi.dev) that you can step into.

The agent in your session (the orchestrator) calls `delegate` with a name and a
brief. That starts a child session in the same process, running in the
background, and returns at once. The child is an ordinary pi session with its
own file on disk: it can be resumed with `pi --session`, elided, tagged, or
opened in a meta thread like any other. Several children can run at the same
time.

## Steering a child

A running child holds a key, `alt+N`, from the moment it starts until it
reports. It takes the lowest free number, and keeps it while others finish. The
key is how the child is named everywhere: in the widget, in its messages, and
in the orchestrator's replies.

A widget above the editor lists the running children:

```
alt+1  finder  working  bash
alt+3  reader  waiting  Which file?
```

Press the key to open the child in a bordered overlay that fills the terminal.
You see its transcript as it streams and can type to it: your text becomes a
steering message while it is working and a new prompt while it is idle. The
child sees your messages prefixed `Human:`. `esc` closes the overlay and
leaves the child running. `ctrl+x` aborts the child's current turn. The mouse
wheel scrolls the transcript, and so do `pgup` and `pgdn`. In pi's regular
TUI mode the overlay turns on terminal mouse tracking while it is open, so the
terminal's own scrollback is off until it closes; in fullscreen mode pi owns
the mouse already and the overlay takes wheel events from it. The line under
the transcript shows
the child's model, context share, and cost so far.

A message you send while the child is mid-turn is queued, and pi delivers it
after the current tool call finishes. The overlay lists queued messages above
the editor until the child takes them; `ctrl+x` interrupts a long tool call.

A child has no `delegate` or `reply` of its own. It does the work itself.

`/sub` lists every child of this session, running ones first by key, then
finished ones by how long ago they last wrote to their session file. That
includes children left on disk by an earlier run of pi. Choosing a finished
child opens it; if it is not in memory, it is resumed first on the configured
model.

On macOS, VS Code's terminal needs `terminal.integrated.macOptionIsMeta` set
to `true` for option+digit to reach pi.

## How a child talks back

Two things reach the orchestrator from a child, both as messages that start
its next turn:

- **A report.** The child has one extra tool, `report`. What it passes there is
  the result of the job, and it gives up its key at that moment. Nothing else
  from its session reaches the orchestrator by that route.
- **A stop.** When the child ends a turn without reporting, it is asking a
  question or presenting a plan. If you have its overlay open, the text stays
  with you and you answer. If not, the orchestrator receives it and may answer
  with `reply`, addressed by the child's key. If you close the overlay without
  answering, the orchestrator receives it then.

Messages from the orchestrator arrive in the child prefixed
`Orchestrator (<model>):`, and messages from you prefixed `Human:`. The child's
brief tells it that the human outranks the orchestrator, and that the
orchestrator will read its report against the brief.

`reply` addresses a running child by its key and a finished one by name,
meaning the most recent child of that name. A finished child wakes with its
whole history, takes a key again, and its next stop or report arrives as
usual. If it exists only on disk, it is resumed first. `reply` refuses while
you have that child's overlay open.

## Which model a child runs

By default a child runs on the model set in `~/.pi/agent/delegate.json`:

```json
{ "model": "openai-codex/gpt-6-astra:medium" }
```

The value uses the same grammar as pi's `--model` flag: a name or
`provider/id`, with an optional `:thinking` suffix. The `delegate` tool takes an
optional `model` argument in the same grammar that overrides the file for one
child. With neither, the child inherits the parent's model and thinking level.

A short name such as `opus-5` is matched first against the models you are
authenticated for; pi's catalogue lists the same model under many providers,
and only if none of yours match does the full catalogue apply. A child that
cannot make its first model call, for that reason or any other, reports the
error to the orchestrator as a failure message.

## Reloading pi

`/reload` replaces the extension. Running children abort where they are and
finished ones leave memory; all of them stay on disk, where `/sub` finds them.

## Install

Copy `pi-delegate/` into `~/.pi/agent/extensions/`, or publish and add
`"npm:pi-delegate"` to `packages` in `settings.json`.

## Develop

```
bun test            # hermetic: faux model, in-memory sessions, temp dirs
bun run typecheck
```
