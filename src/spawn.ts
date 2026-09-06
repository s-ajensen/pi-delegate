import type { AgentMessage, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import {
	createAgentSession,
	SessionManager,
	type AgentSession,
	type ModelRuntime,
	type ResourceLoader,
	type SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { defineReportTool } from "./report.ts";
import { buildChildName, buildSeed } from "./seed.ts";

export interface ChildEnvironment {
	cwd: string;
	agentDir: string;
	modelRuntime: ModelRuntime;
	model: Model<string>;
	thinkingLevel?: ThinkingLevel;
	resourceLoader: ResourceLoader;
	settingsManager: SettingsManager;
	openSession(): SessionManager;
}

export interface Brief {
	name: string;
	brief: string;
	model?: string;
}

export interface ChildHandlers {
	begin(): void;
	stop(text: string): void;
	report(synopsis: string): void;
	fail(message: string): void;
}

export interface Child {
	session: AgentSession;
	start(handlers: ChildHandlers): Promise<void>;
	send(text: string): Promise<void>;
}

export async function createChild(environment: ChildEnvironment, brief: Brief): Promise<Child> {
	const sessionManager = environment.openSession();
	sessionManager.appendSessionInfo(buildChildName(brief.name));
	return openChild(environment, sessionManager, buildSeed(brief.name, brief.brief));
}

export async function resumeChild(environment: ChildEnvironment, sessionFile: string): Promise<Child> {
	return openChild(environment, SessionManager.open(sessionFile), undefined);
}

async function openChild(
	environment: ChildEnvironment,
	sessionManager: SessionManager,
	firstPrompt: string | undefined,
): Promise<Child> {
	let report: (synopsis: string) => void = () => {};
	const { session } = await createAgentSession({
		cwd: environment.cwd,
		agentDir: environment.agentDir,
		modelRuntime: environment.modelRuntime,
		model: environment.model,
		thinkingLevel: environment.thinkingLevel,
		resourceLoader: environment.resourceLoader,
		settingsManager: environment.settingsManager,
		sessionManager,
		customTools: [defineReportTool((synopsis) => report(synopsis))],
	});
	const send = (text: string) => (session.isStreaming ? session.steer(text) : session.prompt(text));
	return {
		session,
		send,
		start(handlers) {
			let reportedThisTurn = false;
			report = (synopsis) => {
				reportedThisTurn = true;
				handlers.report(synopsis);
			};
			session.subscribe((event) => {
				if (event.type === "agent_start") {
					reportedThisTurn = false;
					handlers.begin();
				}
				if (event.type !== "agent_end" || reportedThisTurn) return;
				const last = session.messages.at(-1);
				if (last?.role === "assistant" && last.stopReason === "error") handlers.fail(last.errorMessage ?? "error");
				else handlers.stop(lastAssistantText(session.messages));
			});
			if (firstPrompt === undefined) return Promise.resolve();
			return session.prompt(firstPrompt).catch((error) => handlers.fail(error instanceof Error ? error.message : String(error)));
		},
	};
}

export function lastAssistantText(messages: AgentMessage[]): string {
	const last = messages.at(-1);
	if (!last || last.role !== "assistant") return "";
	return last.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}
