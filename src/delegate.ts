import { defineTool, type ExtensionContext, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { adoptChild, type AdoptDeps } from "./adopt.ts";
import { hotkey } from "./key.ts";
import { renderDelegateCall, renderNothing } from "./render.ts";
import type { Brief, Child } from "./spawn.ts";
import { DELEGATE_TOOL } from "./tools.ts";

export interface DelegateDeps extends AdoptDeps {
	create(brief: Brief, ctx: ExtensionContext): Promise<Child>;
}

export function defineDelegateTool(deps: DelegateDeps): ToolDefinition {
	return defineTool({
		name: DELEGATE_TOOL,
		label: "Delegate to subagent",
		description:
			"Start a subagent in its own session to carry out a brief while you continue. " +
			"It runs concurrently. Whatever it says when it stops, and its final report, arrive later as messages; " +
			"answer a stopped subagent with the reply tool. The human can also steer it directly.",
		promptGuidelines: [
			"Write the brief as a complete, self-contained task: the subagent starts with no context but the brief.",
			"State in the brief what the report must contain; the subagent decides what else to leave out.",
		],
		parameters: Type.Object({
			name: Type.String({ description: "Short label for the subagent, shown to the human." }),
			brief: Type.String({ description: "The task, including what the report must contain." }),
			model: Type.Optional(
				Type.String({
					description:
						"Model for the subagent, in pi's --model form: a name or provider/id, with an optional " +
						":thinking suffix such as sonnet:high. Omit to use the configured default.",
				}),
			),
		}),
		renderCall: (args, theme) => renderDelegateCall(args, theme),
		renderResult: () => renderNothing(),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const entry = adoptChild(deps, params.name, await deps.create(params, ctx));
			return {
				content: [
					{
						type: "text",
						text: `Started subagent "${entry.name}" (${hotkey(entry.key ?? 0)}). What it says and its report will arrive as messages.`,
					},
				],
				details: undefined,
			};
		},
	}) as ToolDefinition;
}
