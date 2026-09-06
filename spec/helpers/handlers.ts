import type { ChildHandlers } from "../../src/spawn.ts";

export const ignoreHandlers: ChildHandlers = { begin() {}, stop() {}, report() {}, fail() {} };
