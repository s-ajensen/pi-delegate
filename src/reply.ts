import { defineTool, type ExtensionContext, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { prefixOrchestrator } from "./deliver.ts";
import { hotkey } from "./key.ts";
import type { Entry, Registry } from "./registry.ts";
import { renderNothing, renderReplyCall } from "./render.ts";
import type { Child } from "./spawn.ts";
import { REPLY_TOOL } from "./tools.ts";

export interface ReplyDeps {
	registry: Registry<Child>;
	revive(name: string, ctx: ExtensionContext): Promise<Entry<Child> | undefined>;
}

export function defineReplyTool(deps: ReplyDeps): ToolDefinition {
	return defineTool({
		name: REPLY_TOOL,
		label: "Reply to subagent",
		description:
			"Send a message to a subagent. Address a running one by the number in its alt+N key, or a finished one by " +
			"name, which wakes it with its whole history. Its next stop or report arrives later as a message.",
		promptGuidelines: [
			"Answer a subagent's plan or question yourself when the human already ratified the work it is doing.",
			"Do not reply while the human is watching that subagent; the tool refuses, and the human is answering.",
		],
		parameters: Type.Object({
			key: Type.Optional(Type.Number({ description: "The N in a running subagent's alt+N." })),
			name: Type.Optional(Type.String({ description: "A finished subagent's name; the most recent of that name." })),
			message: Type.String({ description: "What to tell the subagent." }),
		}),
		renderCall: (args, theme) => renderReplyCall(args, (key) => deps.registry.byKey(key)?.name, theme),
		renderResult: () => renderNothing(),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const entry = await locate(deps, params, ctx);
			if (entry.watched) throw new Error(`The human is watching subagent "${entry.name}"; do not reply now.`);
			const model = ctx.model?.id ?? "unknown model";
			entry.child.send(prefixOrchestrator(model, params.message)).catch(() => {});
			return { content: [{ type: "text", text: `Delivered to subagent "${entry.name}".` }], details: undefined };
		},
	}) as ToolDefinition;
}

async function locate(deps: ReplyDeps, params: { key?: number; name?: string }, ctx: ExtensionContext): Promise<Entry<Child>> {
	if (params.key !== undefined) {
		const entry = deps.registry.byKey(params.key);
		if (!entry) throw new Error(`No running subagent at ${hotkey(params.key)}.`);
		return entry;
	}
	if (params.name !== undefined) {
		const entry = deps.registry.byName(params.name) ?? (await deps.revive(params.name, ctx));
		if (!entry) throw new Error(`No subagent named "${params.name}" belongs to this session.`);
		return entry;
	}
	throw new Error("Give either key (for a running subagent) or name (for a finished one).");
}
