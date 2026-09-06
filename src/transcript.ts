import type { AgentMessage } from "@earendil-works/pi-agent-core";
import {
	AssistantMessageComponent,
	CustomMessageComponent,
	getMarkdownTheme,
	ToolExecutionComponent,
	UserMessageComponent,
	type AgentSession,
	type AgentSessionEvent,
} from "@earendil-works/pi-coding-agent";
import { Container, type TUI } from "@earendil-works/pi-tui";

export class ChildTranscript extends Container {
	private readonly tools = new Map<string, ToolExecutionComponent>();
	private streaming: AssistantMessageComponent | undefined;

	constructor(
		private readonly session: AgentSession,
		private readonly tui: TUI,
	) {
		super();
		for (const message of session.messages) this.appendHistory(message);
	}

	follow(): () => void {
		return this.session.subscribe((event) => {
			this.apply(event);
			this.tui.requestRender();
		});
	}

	private apply(event: AgentSessionEvent): void {
		switch (event.type) {
			case "message_start":
				if (event.message.role === "assistant") {
					this.streaming = new AssistantMessageComponent(undefined, false, getMarkdownTheme());
					this.addChild(this.streaming);
					this.streaming.updateContent(event.message, true);
				} else {
					this.appendHistory(event.message);
				}
				break;
			case "message_update":
				if (this.streaming && event.message.role === "assistant") {
					this.streaming.updateContent(event.message, true);
					this.trackToolCalls(event.message);
				}
				break;
			case "message_end":
				if (this.streaming && event.message.role === "assistant") {
					this.streaming.updateContent(event.message, false);
					this.trackToolCalls(event.message);
					for (const tool of this.tools.values()) tool.setArgsComplete();
					this.streaming = undefined;
				}
				break;
			case "tool_execution_start":
				this.toolFor(event.toolCallId, event.toolName, event.args).markExecutionStarted();
				break;
			case "tool_execution_update":
				this.tools.get(event.toolCallId)?.updateResult({ ...event.partialResult, isError: false }, true);
				break;
			case "tool_execution_end":
				this.tools.get(event.toolCallId)?.updateResult({ ...event.result, isError: event.isError });
				this.tools.delete(event.toolCallId);
				break;
		}
	}

	private appendHistory(message: AgentMessage): void {
		switch (message.role) {
			case "user":
				this.addChild(new UserMessageComponent(textOf(message.content), getMarkdownTheme()));
				break;
			case "assistant":
				this.addChild(new AssistantMessageComponent(message, false, getMarkdownTheme()));
				this.trackToolCalls(message);
				break;
			case "toolResult":
				this.tools.get(message.toolCallId)?.updateResult({ ...message, isError: message.isError ?? false });
				this.tools.delete(message.toolCallId);
				break;
			case "custom":
				this.addChild(new CustomMessageComponent(message, undefined, getMarkdownTheme()));
				break;
		}
	}

	private trackToolCalls(message: AgentMessage & { role: "assistant" }): void {
		for (const block of message.content) {
			if (block.type !== "toolCall") continue;
			const existing = this.tools.get(block.id);
			if (existing) existing.updateArgs(block.arguments);
			else this.toolFor(block.id, block.name, block.arguments);
		}
	}

	private toolFor(id: string, name: string, args: unknown): ToolExecutionComponent {
		const existing = this.tools.get(id);
		if (existing) return existing;
		const component = new ToolExecutionComponent(
			name,
			id,
			args,
			undefined,
			this.session.getToolDefinition(name),
			this.tui,
			this.session.sessionManager.getCwd(),
		);
		this.addChild(component);
		this.tools.set(id, component);
		return component;
	}
}

function textOf(content: string | { type: string; text?: string }[]): string {
	if (typeof content === "string") return content;
	return content
		.filter((block) => block.type === "text")
		.map((block) => block.text ?? "")
		.join("\n");
}
