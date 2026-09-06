import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export const REPORT_TOOL = "report";

export function defineReportTool(onReport: (synopsis: string) => void): ToolDefinition {
	return defineTool({
		name: REPORT_TOOL,
		label: "Report to caller",
		description:
			"Deliver your findings to the agent that started you. That agent sees this text and nothing " +
			"else from your session. Answer the brief you were given; omit process, dead ends, and anything " +
			"the caller did not ask for.",
		promptGuidelines: [
			"Call report as your final action when the brief is answered or you cannot answer it.",
			"If the orchestrator wakes you afterwards with new instructions, report again once those are answered.",
			"Ending a turn without report is how you ask a question; the answer comes back as a message.",
		],
		parameters: Type.Object({
			synopsis: Type.String({ description: "What the caller needs to know, judged against the brief." }),
		}),
		async execute(_toolCallId, params) {
			onReport(params.synopsis);
			return { content: [{ type: "text", text: "Reported." }], details: undefined, terminate: true };
		},
	}) as ToolDefinition;
}
