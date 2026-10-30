/**
 * Composer buttons for the plan-mode toggle and the implement-plan send.
 *
 * These are the mouse equivalents of the two shortcuts: the slot entries carry a
 * per-session `inject` so each button resolves its own session's input shell at
 * click time instead of closing over a stale one. Styling stays on the composer's
 * own classes and theme variables, so the buttons follow the active theme.
 */
const react = require("react");
const jsx = require("react/jsx-runtime");

/** The draft token that carries the plan-mode skill for one turn. */
const MARKER = "/plan-mode";

/** Button styling shared by both entries. */
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
 * Whether one draft line is the marker on its own.
 * @param {string} line - one draft line.
 * @returns {boolean} true when the line is exactly the marker.
 */
function carriesMarker(line) {
	return line.trim() === MARKER;
}

/**
 * Read the current draft of an input shell.
 * @param {object} shell - the session's input shell.
 * @returns {string} the draft text.
 */
function draftOf(shell) {
	return shell.state.getSnapshot().draft ?? "";
}

/**
 * The plan-mode toggle button.
 *
 * Clicking edits the draft exactly like the shortcut does. The active style
 * reflects the draft itself, so the button reads as "on" only while the marker
 * line is present.
 * @param {object} props - slot props carrying the per-session accessors.
 * @returns {object} the rendered button.
 */
function PlanButton({ toggle }) {
	const [active, setActive] = react.useState(false);

	react.useEffect(() => {
		const unsubscribe = toggle.subscribe((next) => setActive(next));
		setActive(toggle.read());
		return unsubscribe;
	}, [toggle]);

	return jsx.jsx("button", {
		type: "button",
		style: active ? ACTIVE_STYLE : BUTTON_STYLE,
		"aria-pressed": active,
		title: active ? "取消本轮 plan-mode（Alt+P）" : "本轮携带 plan-mode skill（Alt+P）",
		onMouseDown: (event) => event.preventDefault(),
		onClick: () => toggle.flip(),
		children: active ? "计划 ✓" : "计划"
	});
}

/**
 * The implement-plan button.
 * @param {object} props - slot props carrying the per-session accessors.
 * @returns {object} the rendered button.
 */
function ImplementButton({ implement }) {
	const [enabled, setEnabled] = react.useState(false);

	react.useEffect(() => {
		const unsubscribe = implement.subscribe((next) => setEnabled(next));
		setEnabled(implement.read());
		return unsubscribe;
	}, [implement]);

	return jsx.jsx("button", {
		type: "button",
		style: enabled ? BUTTON_STYLE : { ...BUTTON_STYLE, opacity: "0.5", cursor: "default" },
		disabled: !enabled,
		title: "发送 implement plan（Alt+I），不改动草稿",
		onMouseDown: (event) => event.preventDefault(),
		onClick: () => implement.send(),
		children: "开工"
	});
}

/**
 * Build the two slot entries.
 *
 * `shellOf` resolves the per-session shell from the root context; the entries
 * return plain accessors so the React components above stay free of service
 * lookups. A session whose shell cannot be resolved disables both buttons
 * instead of throwing during render.
 * @param {object} options - adapters supplied by the client plugin.
 * @param {object} options.ctx - the client plugin context.
 * @param {function(string): object} options.shellOf - session id to input shell.
 * @param {function(string): void} options.sendImplementPlan - send the prompt.
 * @param {function(string): string} options.toggleMarker - draft transform.
 * @param {function(): string} options.currentSessionId - the visible session.
 * @returns {object} entries keyed by slot name.
 */
function createEntries({ ctx, shellOf, sendImplementPlan, toggleMarker, currentSessionId }) {
	/** Resolve the visible session's shell, or undefined when unusable. */
	function visibleShell() {
		const sessionId = currentSessionId();
		if (sessionId === void 0) return void 0;
		const shell = shellOf(ctx, sessionId);
		if (shell === void 0) return void 0;
		const state = shell.state.getSnapshot();
		if (state.phase === "submitting" || state.phase === "adjudicating") return void 0;
		return { sessionId, shell };
	}

	/** @returns {object} the plan-toggle accessors. */
	function planAccessors() {
		return {
			read: () => {
				const target = visibleShell();
				if (target === void 0) return false;
				return draftOf(target.shell).split("\n").some(carriesMarker);
			},
			subscribe: (listener) => {
				const target = visibleShell();
				if (target === void 0) return () => {};
				return target.shell.state.subscribe((state) => {
					listener((state.draft ?? "").split("\n").some(carriesMarker));
				});
			},
			flip: () => {
				const target = visibleShell();
				if (target === void 0) return;
				target.shell.actions.setDraft(toggleMarker(draftOf(target.shell)));
			}
		};
	}

	/** @returns {object} the implement accessors. */
	function implementAccessors() {
		return {
			read: () => visibleShell() !== void 0,
			subscribe: (listener) => {
				const target = visibleShell();
				if (target === void 0) return () => {};
				return target.shell.state.subscribe((state) => {
					listener(state.phase === "plain");
				});
			},
			send: () => {
				const target = visibleShell();
				if (target === void 0) return;
				sendImplementPlan(ctx, target.sessionId);
			}
		};
	}

	return {
		"conversation.input.left": {
			create: () => ({ toggle: planAccessors() }),
			component: PlanButton
		},
		"conversation.input.right": {
			create: () => ({ implement: implementAccessors() }),
			component: ImplementButton
		}
	};
}

exports.createEntries = createEntries;
exports.PlanButton = PlanButton;
exports.ImplementButton = ImplementButton;
