window.__ModuleLoader__.load({
	id: "dsh-codex-plan-toggle",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		/**
		 * Cordis services this browser plugin binds to.
		 *
		 * `slots` is required for the composer buttons; `conversation` is deliberately
		 * absent because its controller is mounted through `ctx.plugin` after apply,
		 * so naming it here would park this plugin before `apply` ever ran. Official
		 * client plugins reach it with `ctx.get(...)` at call time instead, which is
		 * what the shell lookup below does.
		 */
		const inject = ["shortcuts", "sessions", "slots"];

		/**
		 * React comes from the platform seed table.
		 *
		 * A client plugin is one self-contained bundle: the module table resolves a
		 * `require` through seed words, already-materialized modules, or a registered
		 * factory; intra-bundle relative requires are unavailable, so every module
		 * this plugin needs lives in this one file.
		 */
		const react = require("react");
		const jsx = require("react/jsx-runtime");

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
				console.warn("dsh-codex-plan-toggle: input shell unavailable:", error);
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
				console.warn("dsh-codex-plan-toggle: conversation.sendSession is unavailable");
				return;
			}
			const binding = ctx.sessions.binding(sessionId);
			if (binding === void 0) {
				console.warn("dsh-codex-plan-toggle: session binding disappeared before send");
				return;
			}
			conversation.sendSession(binding.session, IMPLEMENT_LINE, [], "queue", void 0).then(onSent, onSendFailed);
		}

		/** @param {unknown} _result - the admitted send resolves without a payload. */
		function onSent(_result) {}

		/** @param {unknown} reason - transport or admission failure. */
		function onSendFailed(reason) {
			console.warn("dsh-codex-plan-toggle: implement plan send failed:", reason);
		}

		/**
		 * Register one shortcut command without letting a collision escape apply.
		 *
		 * `ctx.shortcuts.register` validates every declared default and throws when a
		 * chord is already taken by another command. Inside apply that throw aborts
		 * the whole plugin, so this wrapper turns it into a warning: a conflicting
		 * chord costs that one shortcut only.
		 * @param {object} ctx - the plugin context.
		 * @param {object} command - the shortcut definition.
		 */
		function registerCommand(ctx, command) {
			try {
				ctx.effect(() => ctx.shortcuts.register(command), `dsh-codex-plan-toggle: ${command.id}`);
			} catch (error) {
				console.warn(`dsh-codex-plan-toggle: shortcut "${command.id}" registration failed:`, error);
			}
		}

		/**
		 * Register both shortcuts.
		 *
		 * Desktop bindings use Alt+P / Alt+I; the Web bindings add `primary` because
		 * the shortcut service rejects bare Alt combinations in the browser.
		 *
		 * Registration is wrapped per command: `ctx.shortcuts.register` throws on a
		 * colliding default, and an uncaught throw inside apply takes the whole
		 * plugin down (also dropping the composer-button slots this plugin never
		 * provides). A colliding chord should cost one shortcut, never the boot.
		 */
		function apply(ctx) {
			registerCommand(ctx, {
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
			});

			registerCommand(ctx, {
				id: "plan.implement",
				label: () => "Send implement plan",
				aliases: ["implement plan", "approve plan"],
				defaults: {
					"desktop:macos": { code: "KeyI", modifiers: ["alt"] },
					"desktop:windows": { code: "KeyI", modifiers: ["alt"] },
					"desktop:linux": { code: "KeyI", modifiers: ["alt"] },
					"web:macos": { code: "KeyI", modifiers: ["primary", "alt"] },
					"web:windows": { code: "KeyI", modifiers: ["primary", "alt"] }
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
			});

			registerButtons(ctx);
		}

		/** Button styling shared by both composer buttons. */
		const BUTTON_STYLE = {
			border: "0.5px solid var(--dsw-alias-border-l3)",
			borderRadius: "var(--dsw-radius-sm)",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			font: "inherit",
			fontSize: "12px",
			lineHeight: "18px",
			padding: "4px 8px",
			cursor: "pointer",
			whiteSpace: "nowrap"
		};

		/** Highlight applied while the draft already carries the marker. */
		const ACTIVE_STYLE = {
			...BUTTON_STYLE,
			borderColor: "var(--dsw-alias-state-business-primary)",
			color: "var(--dsw-alias-state-business-primary)"
		};

		/**
		 * The plan-mode toggle button: the mouse equivalent of the toggle shortcut.
		 * The active style mirrors the draft, so it reads as on only while the
		 * marker line is present.
		 * @param {object} props - slot props carrying the per-session accessors.
		 * @returns {object} the rendered button.
		 */
		function PlanButton({ toggle }) {
			const [active, setActive] = react.useState(false);
			react.useEffect(() => {
				const unsubscribe = toggle.subscribe(setActive);
				setActive(toggle.read());
				return unsubscribe;
			}, [toggle]);
			return jsx.jsx("button", {
				type: "button",
				style: active ? ACTIVE_STYLE : BUTTON_STYLE,
				"aria-pressed": active,
				// reflect the marker state for screen readers
				onMouseDown: onKeepFocus,
				onClick: () => toggle.flip(),
				// toggle the marker line on click
			});
		}

		/**
		 * The implement-plan button: sends the prompt without touching the draft.
		 * @param {object} props - slot props carrying the per-session accessors.
		 * @returns {object} the rendered button.
		 */
		function ImplementButton({ implement }) {
			const [enabled, setEnabled] = react.useState(false);
			react.useEffect(() => {
				const unsubscribe = implement.subscribe(setEnabled);
				setEnabled(implement.read());
				return unsubscribe;
			}, [implement]);
			return jsx.jsx("button", {
				type: "button",
				style: enabled ? BUTTON_STYLE : { ...BUTTON_STYLE, opacity: "0.5", cursor: "default" },
				disabled: !enabled,
				// dim the button unless a plain, retained draft is present
				onMouseDown: onKeepFocus,
				onClick: () => implement.send(),
				// fire the implement prompt
			});
		}

		/** Keep the composer focus where it was when a button is pressed. */
		function onKeepFocus(event) {
			event.preventDefault();
		}

		/**
		 * Mount the two composer buttons.
		 *
		 * Both slots are official extension points that the composer renders only for
		 * a live session, so each entry resolves its session lazily through accessors
		 * instead of closing over a shell that may have been replaced. A failed
		 * registration is a warning, not a boot failure, for the same reason the
		 * shortcut wrapper swallows collisions.
		 * @param {object} ctx - the plugin context.
		 */
		function registerButtons(ctx) {
			const visible = () => {
				const sessionId = currentSessionId(ctx.sessions);
				if (sessionId === void 0) return void 0;
				const shell = shellOf(ctx, sessionId);
				if (shell === void 0) return void 0;
				const state = shell.state.getSnapshot();
				if (state.phase === "submitting" || state.phase === "adjudicating") return void 0;
				return { sessionId, shell };
			};
			const toggle = {
				read: () => {
					const target = visible();
					if (target === void 0) return false;
					return (target.shell.state.getSnapshot().draft ?? "").split("\n").some(carriesMarker);
				},
				subscribe: (listener) => {
					const target = visible();
					if (target === void 0) return () => {};
					return target.shell.state.subscribe((state) => {
						listener((state.draft ?? "").split("\n").some(carriesMarker));
					});
				},
				flip: () => {
					const target = visible();
					if (target === void 0) return;
					target.shell.actions.setDraft(toggleMarker(target.shell.state.getSnapshot().draft ?? ""));
				}
			};
			const implement = {
				read: () => visible() !== void 0,
				subscribe: (listener) => {
					const target = visible();
					if (target === void 0) return () => {};
					return target.shell.state.subscribe((state) => listener(state.phase === "plain"));
				},
				send: () => {
					const target = visible();
					if (target === void 0) return;
					sendImplementPlan(ctx, target.sessionId);
				}
			};
			const entries = [
				{ name: "conversation.input.left", props: { toggle }, component: PlanButton },
				{ name: "conversation.input.right", props: { implement }, component: ImplementButton }
			];
			for (let index = 0; index < entries.length; index += 1) {
				const entry = entries[index];
				try {
					ctx.effect(() => ctx.slots.inject(entry.name, () => ctx.slots.register({
						name: entry.name,
						inject: () => entry.props
					}, entry.component)), `dsh-codex-plan-toggle: ${entry.name}`);
				} catch (error) {
					console.warn(`dsh-codex-plan-toggle: slot "${entry.name}" registration failed:`, error);
				}
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
