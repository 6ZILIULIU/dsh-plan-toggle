/**
 * Host half: registers the `plan-mode` skill with the harness.
 *
 * The workflow is adapted from Codex's plan mode: its phase ordering — ground the
 * facts first, confirm intent, lock the implementation, then present the plan —
 * is what makes it dependable, so this bundle carries that structure and wires it
 * into the Harness skill mechanism.
 *
 * The body here is the single authoritative copy for this repository. It used to
 * live in `~/.agents/skills/plan-mode/SKILL.md`; registering it from the bundle
 * means installing this package is enough to get `/plan-mode`, with no separate
 * skill directory to keep in sync.
 *
 * Scope note: `ctx.skills.register` binds to the calling context's scope. This
 * plugin is mounted at the profile root, so the skill is global — every session
 * of every preset sees it, and it shadows a same-named file-system skill because
 * runtime entries rank ahead of provider entries (250 vs 600).
 */

/** The skill body: the plan-mode workflow adapted from Codex, verbatim. */
const CONTENT = `# Plan Mode

Use this skill only when the user explicitly invokes \`$plan-mode\`.

The outcome is a plan another engineer can implement without making material
product or technical decisions. Do not implement the plan while this skill is
active.

## 1. Ground In Facts

Inspect the repository, relevant documentation, existing code, tests, and
configuration before asking questions.

- Use read-only exploration to resolve every discoverable fact.
- Preserve the current worktree; do not edit tracked files, run rewriting
  tools, or perform migrations.
- Ask only for a decision, preference, or missing business fact that cannot be
  discovered locally.

Completion criterion: the remaining unknowns are product decisions, not facts
that can be found in the environment.

## 2. Confirm Intent

Establish the goal, success criteria, audience, scope boundaries, constraints,
current state, and important tradeoffs.

- Ask one high-impact question at a time when its answer changes the plan.
- Give concrete options and a recommended default for real tradeoffs.
- If a reasonable default is necessary, state it explicitly as an assumption.

Completion criterion: no unresolved high-impact intent ambiguity remains.

## 3. Lock The Implementation

Decide how the work will be built and verified.

- Define the affected behavior, public interfaces or data contracts when they
  change, data flow, failure behavior, migration needs, and acceptance tests.
- Follow existing repository patterns unless an intentional deviation is part
  of the decision.
- Scale tests to the feature's risk and blast radius.

Completion criterion: an implementer can execute the work without choosing
among materially different designs.

## Final Response

Output exactly one concise plan in this format:

<proposed_plan>
# Title

## Summary
- Goal and intended result.

## Implementation Changes
- Grouped behavior-level changes, including public API or data changes.

## Test Plan
- Automated checks and manual acceptance scenarios.

## Assumptions
- Explicit defaults and intentional boundaries.
</proposed_plan>

Keep the plan specific enough to implement and short enough to scan. Do not
bind ordinary plans to a GitHub issue, commit sequence, or framework unless the
user requested that deliverable.

## Ask Before Executing

After the plan, use \`ask_user_question\` to ask whether to carry it out. Make it
the last thing you do in that turn; do not start implementing while waiting.

- One question, two options: \`Execute the plan\` (description: start implementing
  from the next step) and \`Keep planning\` (description: stay in this planning
  pass and revise with the user's feedback).
- The plan itself belongs in your reply, not in the question: the tool carries a
  prompt and options, not a document, so never paste the whole plan into it.
- Execute only when the user picks \`Execute the plan\`. Any other answer — a
  different option, custom text, or no answer — means revise the plan and ask
  again. Treat the answer as the only approval signal; a reply that merely
  sounds positive does not count.`;

/** Host services this half needs. */
export const inject = ["skills"];

/**
 * Register the plan-mode skill for every session in this profile.
 * @param {object} ctx - the host plugin context.
 */
export function apply(ctx) {
  const dispose = ctx.skills.register({
    name: "plan-mode",
    description: "A manual workflow for producing a decision-complete implementation plan.",
    content: CONTENT,
    invocation: { modelInvocable: true, userInvocable: true }
  });
  ctx.effect(() => dispose, "dsh-plan-toggle: plan-mode skill");
}
