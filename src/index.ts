import { statSync } from "node:fs";
import {
	getAgentDir,
	SessionManager,
	type ExtensionAPI,
	type ExtensionContext,
	type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { adoptChild } from "./adopt.ts";
import { unwatch, watch } from "./attention.ts";
import { findChildren, mergeChildren, type LiveChild } from "./children.ts";
import { defineDelegateTool } from "./delegate.ts";
import { buildChildMessage, CHILD_MESSAGE_TYPE, type ChildMessage, type ChildMessageKind } from "./deliver.ts";
import { buildEnvironment, loadShared, type Shared } from "./environment.ts";
import { HOTKEYS } from "./key.ts";
import { chooseModel } from "./model.ts";
import { ChildOverlay, OVERLAY_OPTIONS } from "./overlay.ts";
import { pickOne } from "./pick.ts";
import { createRegistry, type Entry } from "./registry.ts";
import { renderChildMessage } from "./render.ts";
import { defineReplyTool } from "./reply.ts";
import { createChild, resumeChild, type Child, type ChildEnvironment } from "./spawn.ts";
import { renderWidgetLines, snapshotChild } from "./widget.ts";

const WIDGET_KEY = "delegate";

function modifiedAt(path: string | undefined): Date | undefined {
	if (!path) return undefined;
	try {
		return statSync(path).mtime;
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	const registry = createRegistry<Child>();
	let shared: Promise<Shared> | undefined;
	let ui: ExtensionUIContext | undefined;

	const sharedFor = (ctx: ExtensionContext) => (shared ??= loadShared({ cwd: ctx.cwd, agentDir: getAgentDir() }));

	const deliver = (entry: Entry<Child>, kind: ChildMessageKind, text: string) =>
		pi.sendMessage(
			buildChildMessage(
				{
					key: entry.key,
					name: entry.name,
					model: entry.child.session.model?.id ?? "unknown model",
					sessionFile: entry.child.session.sessionFile,
				},
				kind,
				text,
			),
			{ triggerTurn: true, deliverAs: "followUp" },
		);

	const refreshWidget = () =>
		ui?.setWidget(
			WIDGET_KEY,
			renderWidgetLines(registry.running().map((entry) => snapshotChild(entry.key ?? 0, entry.name, entry.child))),
		);

	const followed = new WeakSet<Child>();
	registry.subscribe(() => {
		for (const entry of registry.all()) {
			if (followed.has(entry.child)) continue;
			followed.add(entry.child);
			entry.child.session.subscribe(refreshWidget);
		}
		refreshWidget();
	});

	const childrenOnDisk = async (ctx: ExtensionContext) => {
		const parentFile = ctx.sessionManager.getSessionFile();
		if (!parentFile) return [];
		return findChildren(await SessionManager.list(ctx.cwd), parentFile);
	};

	const environmentFor = async (ctx: ExtensionContext, modelPattern: string | undefined): Promise<ChildEnvironment> => {
		if (!ctx.model) throw new Error("No model is selected, so no subagent can start.");
		const shared = await sharedFor(ctx);
		const parent = { model: ctx.model, thinkingLevel: ctx.thinkingLevel };
		return buildEnvironment(shared, {
			...chooseModel(modelPattern ?? shared.defaults.model, parent, shared.modelRuntime),
			parentSessionFile: ctx.sessionManager.getSessionFile(),
		});
	};

	pi.registerTool(
		defineDelegateTool({
			registry,
			create: async (brief, ctx) => createChild(await environmentFor(ctx, brief.model), brief),
			deliver,
		}),
	);
	pi.registerTool(
		defineReplyTool({
			registry,
			revive: async (name, ctx) => {
				const match = (await childrenOnDisk(ctx))
					.filter((child) => child.name === name)
					.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
				if (!match) return undefined;
				return adoptChild({ registry, deliver }, name, await resumeChild(await environmentFor(ctx, undefined), match.path), "reported");
			},
		}),
	);
	pi.registerMessageRenderer<ChildMessage["details"]>(CHILD_MESSAGE_TYPE, (message, options, theme) =>
		renderChildMessage(message as ChildMessage, options, theme),
	);

	const scopeInto = async (ctx: ExtensionContext, entry: Entry<Child> | undefined) => {
		if (!entry) return ctx.ui.notify("No subagent there.", "info");
		watch(entry);
		try {
			await ctx.ui.custom(
				(tui, theme, _keybindings, done) => new ChildOverlay(entry.name, entry.child, tui, () => done(undefined), theme),
				{ overlay: true, overlayOptions: OVERLAY_OPTIONS },
			);
		} finally {
			unwatch(entry, (held) => deliver(entry, "stop", held));
		}
	};

	HOTKEYS.forEach((hotkey, index) => {
		pi.registerShortcut(hotkey, {
			description: `Scope into the subagent at ${hotkey}`,
			handler: (ctx) => scopeInto(ctx, registry.byKey(index + 1)),
		});
	});


	const liveChildren = (): LiveChild<Child>[] =>
		registry.all().map((entry) => ({
			entry,
			path: entry.child.session.sessionFile,
			streaming: entry.child.session.isStreaming,
			modified: modifiedAt(entry.child.session.sessionFile),
		}));

	pi.registerCommand("sub", {
		description: "Scope into a subagent: running, finished, or left on disk",
		handler: async (_args, ctx) => {
			const rows = mergeChildren(liveChildren(), await childrenOnDisk(ctx), new Date());
			if (rows.length === 0) return ctx.ui.notify("No subagents belong to this session.", "info");
			const row = await pickOne(rows, (options: string[]) => ctx.ui.select("Subagents", options));
			if (!row) return;
			const entry =
				row.live ??
				adoptChild({ registry, deliver }, row.name, await resumeChild(await environmentFor(ctx, undefined), row.path!), "reported");
			await scopeInto(ctx, entry);
		},
	});

	pi.on("session_start", (_event, ctx) => {
		ui = ctx.hasUI ? ctx.ui : undefined;
		refreshWidget();
	});

	pi.on("session_shutdown", () => {
		for (const entry of registry.all()) entry.child.session.dispose();
	});
}
