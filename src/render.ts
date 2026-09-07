import { getMarkdownTheme, type MessageRenderOptions } from "@earendil-works/pi-coding-agent";
import { Box, Container, Markdown, Spacer, Text, type Component } from "@earendil-works/pi-tui";
import { describeSource, type ChildMessage } from "./deliver.ts";
import { hotkey } from "./key.ts";

export interface Paint {
	fg(color: "accent" | "error" | "toolTitle" | "customMessageLabel" | "customMessageText", text: string): string;
	bg(color: "customMessageBg", text: string): string;
	bold(text: string): string;
}

function titled(title: string, body: string, paint: Paint): Container {
	const container = new Container();
	container.addChild(new Text(paint.bold(title), 0, 0));
	if (body !== "") container.addChild(new Markdown(body, 1, 0, getMarkdownTheme()));
	return container;
}

function boxed(title: string, body: string, paint: Paint): Box {
	const box = new Box(1, 1, (text) => paint.bg("customMessageBg", text));
	box.addChild(new Text(paint.fg("customMessageLabel", paint.bold(title)), 0, 0));
	box.addChild(new Spacer(1));
	box.addChild(new Markdown(body, 0, 0, getMarkdownTheme(), { color: (text) => paint.fg("customMessageText", text) }));
	return box;
}

export function renderChildMessage(message: ChildMessage, _options: MessageRenderOptions, paint: Paint): Component {
	const { kind, text } = message.details;
	const who = describeSource(message.details);
	if (kind === "report") return boxed(`report from ${who}`, text, paint);
	if (kind === "failure") return titled(paint.fg("error", `${who} failed`), text, paint);
	return titled(paint.fg("accent", `${who} says`), text, paint);
}

export function renderReplyCall(
	args: { key?: number; name?: string; message: string },
	nameOf: (key: number) => string | undefined,
	paint: Paint,
): Container {
	return titled(paint.fg("toolTitle", `reply to ${describeTarget(args, nameOf)}`), args.message, paint);
}

function describeTarget(args: { key?: number; name?: string }, nameOf: (key: number) => string | undefined): string {
	if (args.key === undefined) return args.name === undefined ? "subagent" : `subagent "${args.name}"`;
	const name = nameOf(args.key);
	return name === undefined ? `subagent ${hotkey(args.key)}` : `subagent "${name}" (${hotkey(args.key)})`;
}

export function renderDelegateCall(args: { name: string; brief: string; model?: string }, paint: Paint): Container {
	const model = args.model === undefined ? "" : ` (${args.model})`;
	return titled(paint.fg("toolTitle", `delegate to subagent "${args.name}"${model}`), args.brief, paint);
}

export function renderNothing(): Container {
	return new Container();
}
