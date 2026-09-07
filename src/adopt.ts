import { beginTurn, receiveStop } from "./attention.ts";
import type { ChildMessageKind } from "./deliver.ts";
import type { ChildState, Entry, Registry } from "./registry.ts";
import type { Child } from "./spawn.ts";

export interface AdoptDeps {
	registry: Registry<Child>;
	deliver(entry: Entry<Child>, kind: ChildMessageKind, text: string): void;
}

export function adoptChild(deps: AdoptDeps, name: string, child: Child, state: ChildState = "running"): Entry<Child> {
	const entry = deps.registry.add(name, child);
	if (state !== "running") deps.registry.mark(entry, state);
	void child.start({
		begin() {
			beginTurn(entry);
			deps.registry.mark(entry, "running");
		},
		stop(text) {
			receiveStop(entry, text, (held) => deps.deliver(entry, "stop", held));
		},
		report(synopsis) {
			deps.registry.mark(entry, "reported");
			deps.deliver(entry, "report", synopsis);
		},
		fail(message) {
			deps.deliver(entry, "failure", message);
			deps.registry.mark(entry, "failed");
		},
	});
	return entry;
}
