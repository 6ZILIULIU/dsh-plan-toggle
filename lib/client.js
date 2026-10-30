window.__ModuleLoader__.load({
	id: "@local/dsh-plan-toggle",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		/** Cordis services this browser plugin binds to. */
		const inject = ["shortcuts", "sessions", "conversation"];

		/** The draft token that carries the plan-mode skill for one turn. */
		const MARKER = "/plan-mode";

		/** The prompt sent by the implement shortcut. */
		const IMPLEMENT_LINE = "implement plan";

		/**
		 * The session currently retained by the main view, matching how the
		 * workspace and sidebar commands pick their target.
		 * @param {object} sessions - the Session controller service.
		 * @returns {string|undefined} the session id, or undefined when none is on screen.
		 */
		function currentSessionId(sessions) {
			const snapshot = sessions.list.getSnapshot();
			if (snapshot === void 0 || snapshot === null) return void 0;
			const rows = Object.values(snapshot.byId);
			for (let index = 0; index < rows.length; index += 1) {
				const row = rows[index];
				if (row !== void 0 && (row.retainedBy.mainView ?? 0) > 0) return row.id;
			}
			return void 0;
		}

		/**
		 * The resident input shell of one session, or undefined when the session is
		 * not retained or the conversation hub is unavailable.
		 * @param {object} ctx - the plugin context.
		 * @param {string} sessionId - target session id.
		 * @returns {object|undefined} the shell carrying `state` and `actions`.
		 */
		function shellOf(ctx, sessionId) {
			const binding = ctx.sessions.binding(sessionId);
			if (binding === void 0) return void 0;
			const conversation = ctx.get("conversation");
			if (conversation === void 0 || conversation.input === void 0) return void 0;
			try {
				return conversation.input.shellFor(binding);
			} catch (error) {
				console.warn("plan-toggle: input shell unavailable:", error);
				return void 0;
			}
		}

		/**
		 * Whether a draft line already carries the marker as a standalone token.
		 * @param {string} line - one draft line.
		 * @returns {boolean} true when the line is exactly the marker (ignoring outer spaces).
		 */
		function carriesMarker(line) {
			return line.trim() === MARKER;
		}

		/**
		 * Add or remove the marker line, leaving every other line untouched.
		 *
		 * Only a marker line is recognized as the switch, so hand-written prose that
		 * mentions `/plan-mode` mid-sentence is never rewritten. A blank draft takes
		 * the marker alone; otherwise the marker becomes the first line and the
		 * previous content follows verbatim.
		 * @param {string} draft - the current draft text.
		 * @returns {string} the toggled draft text.
		 */
		function toggleMarker(draft) {
			const lines = draft.split("\n");
			let markerIndex = -1;
			for (let index = 0; index < lines.length; index += 1) {
				if (!carriesMarker(lines[index])) continue;
				markerIndex = index;
				break;
			}
			if (markerIndex >= 0) {
				lines.splice(markerIndex, 1);
				const remainder = lines.join("\n");
				return remainder.trim() === "" ? "" : remainder;
			}
			const body = draft.replace(/^\n+/, "");
			return body === "" ? `${MARKER} ` : `${MARKER} \n${body}`;
		}

		/**
		 * Send the implement prompt straight to the session, bypassing the draft.
		 *
		 * `conversation.sendSession` admits a prompt through the same host path the
		 * composer uses, so the draft is never read, replaced, or restored: whatever
		 * the user was typing stays exactly where it was.
		 * @param {object} ctx - the plugin context.
		 * @param {string} sessionId - target session id.
		 */
		function sendImplementPlan(ctx, sessionId) {
			const conversation = ctx.get("conversation");
			if (conversation === void 0 || typeof conversation.sendSession !== "function") {
				console.warn("plan-toggle: conversation.sendSession is unavailable");
				return;
			}
			const binding = ctx.sessions.binding(sessionId);
			if (binding === void 0) {
				console.warn("plan-toggle: session binding disappeared before send");
				return;
			}
			conversation.sendSession(binding.session, IMPLEMENT_LINE, [], "queue", void 0).then(onSent, onSendFailed);
		}

		/** @param {unknown} _result - the admitted send resolves without a payload. */
		function onSent(_result) {}

		/** @param {unknown} reason - transport or admission failure. */
		function onSendFailed(reason) {
			console.warn("plan-toggle: implement plan send failed:", reason);
		}

		/**
		 * Register both shortcuts.
		 *
		 * Desktop bindings use Alt+P; the Web binding uses Ctrl/Cmd+Shift+P because
		 * the shortcut service rejects bare Alt combinations in the browser. The
		 * action only edits the composer draft: nothing is written to disk, no
		 * global configuration changes, and other sessions are untouched.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.shortcuts.register({
				id: "plan.toggle",
				label: () => "Toggle plan-mode skill in the draft",
				aliases: ["plan mode", "plan-mode skill", "toggle plan"],
				defaults: {
					"desktop:macos": { code: "KeyP", modifiers: ["alt"] },
					"desktop:windows": { code: "KeyP", modifiers: ["alt"] },
					"desktop:linux": { code: "KeyP", modifiers: ["alt"] },
					"web:macos": { code: "KeyP", modifiers: ["primary", "shift"] },
					"web:windows": { code: "KeyP", modifiers: ["primary", "shift"] }
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					const sessionId = currentSessionId(ctx.sessions);
					if (sessionId === void 0) return { status: "pass" };
					const shell = shellOf(ctx, sessionId);
					if (shell === void 0) return { status: "pass" };
					const state = shell.state.getSnapshot();
					if (state.phase === "submitting" || state.phase === "adjudicating") return { status: "pass" };
					return {
						status: "handled",
						run: () => {
							shell.actions.setDraft(toggleMarker(state.draft ?? ""));
						}
					};
				}
			}), "plan-toggle: shortcut");

			ctx.effect(() => ctx.shortcuts.register({
				id: "plan.implement",
				label: () => "Send implement plan",
				aliases: ["implement plan", "approve plan"],
				defaults: {
					"desktop:macos": { code: "Enter", modifiers: ["alt"] },
					"desktop:windows": { code: "Enter", modifiers: ["alt"] },
					"desktop:linux": { code: "Enter", modifiers: ["alt"] },
					"web:macos": { code: "Enter", modifiers: ["primary", "alt"] },
					"web:windows": { code: "Enter", modifiers: ["primary", "alt"] }
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					const sessionId = currentSessionId(ctx.sessions);
					if (sessionId === void 0) return { status: "pass" };
					const shell = shellOf(ctx, sessionId);
					if (shell === void 0) return { status: "pass" };
					const state = shell.state.getSnapshot();
					if (state.phase !== "plain") return { status: "pass" };
					return {
						status: "handled",
						run: () => {
							sendImplementPlan(ctx, sessionId);
						}
					};
				}
			}), "plan-toggle: implement shortcut");
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
