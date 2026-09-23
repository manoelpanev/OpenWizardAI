/**
 * The pill's whole value is the STATUS, not the presence of a marker. A gate
 * that will pause the run and one that has already been passed look identical
 * in the source text, so these tests pin the difference.
 */

import { describe, it, expect } from 'vitest';
import {
	scanOpenWizardAIMarkers,
	findPendingHitlGate,
	detectHaltMarker,
	findHaltMarker,
	hasOpenWizardAIMarker,
} from '../../shared/autorunMarkers';

describe('scanOpenWizardAIMarkers - HITL', () => {
	it('marks a gate live when an unchecked task sits below it', () => {
		const doc = [
			'<!-- OPENWIZARDAI:HITL reason="Add the API key" artifact=".env" -->',
			'- [ ] Send the welcome mail',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc)).toEqual([
			{
				kind: 'hitl',
				status: 'live',
				line: 0,
				scope: 'document',
				reason: 'Add the API key',
				artifact: '.env',
			},
		]);
	});

	it('marks a gate spent once the box below it is ticked', () => {
		// Identical source text to the live case apart from one character, which
		// is precisely why reading the raw document cannot answer the question.
		const doc = [
			'<!-- OPENWIZARDAI:HITL reason="Add the API key" -->',
			'- [x] Send the welcome mail',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc)[0].status).toBe('spent');
	});

	it('marks a trailing gate spent because it gates nothing', () => {
		const doc = ['- [ ] Real work', '<!-- OPENWIZARDAI:HITL reason="Nothing below me" -->'].join(
			'\n'
		);
		expect(scanOpenWizardAIMarkers(doc)[0].status).toBe('spent');
	});

	it('resolves a chain of gates together', () => {
		const doc = [
			'<!-- OPENWIZARDAI:HITL reason="One" -->',
			'<!-- OPENWIZARDAI:HITL reason="Two" -->',
			'- [ ] Task',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.status)).toEqual(['live', 'live']);
	});

	it('agrees with the engine about which gate pauses the run', () => {
		// The pill must not claim a gate is live that findPendingHitlGate ignores,
		// or the user removes the wrong marker.
		const doc = [
			'<!-- OPENWIZARDAI:HITL reason="Already done" -->',
			'- [x] Approved',
			'<!-- OPENWIZARDAI:HITL reason="Still waiting" -->',
			'- [ ] Blocked',
		].join('\n');
		const scanned = scanOpenWizardAIMarkers(doc);
		expect(scanned.map((m) => m.status)).toEqual(['spent', 'live']);
		expect(findPendingHitlGate(doc)?.reason).toBe('Still waiting');
	});

	it('supplies the default reason when the attribute is missing', () => {
		expect(scanOpenWizardAIMarkers('<!-- OPENWIZARDAI:HITL -->\n- [ ] x')[0].reason).toBe(
			'Human review requested'
		);
	});
});

describe('scanOpenWizardAIMarkers - halt', () => {
	it('always reports a halt as live, wherever it sits', () => {
		// A halt blocks the NEXT run from anywhere in the document, so unlike a
		// HITL gate there is no position that makes it inert.
		const doc = ['- [x] Done', '<!-- openwizardai:halt: build is broken -->'].join('\n');
		expect(scanOpenWizardAIMarkers(doc)).toEqual([
			{ kind: 'halt', status: 'live', line: 1, scope: 'document', reason: 'build is broken' },
		]);
	});

	it('handles the bare form with no reason', () => {
		expect(scanOpenWizardAIMarkers('<!-- openwizardai:halt -->')[0].reason).toBeUndefined();
	});
});

describe('scanOpenWizardAIMarkers - model', () => {
	it('marks a document hint live above the first unfinished task', () => {
		const doc = ['<!-- OPENWIZARDAI:MODEL tier="high" effort="high" -->', '- [ ] Design'].join(
			'\n'
		);
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('live');
		expect(marker.hint).toMatchObject({ tier: 'high', effort: 'high' });
	});

	it('marks a hint governing a later task upcoming, not spent', () => {
		// Regression: a single "have we passed a task yet" latch stamped every
		// marker below the first unchecked task as spent, so a document-wide low
		// with a high phase further down drew the high one as expired - under a
		// tooltip saying it no longer affected the run, while it was in fact the
		// setting that phase was about to be dispatched at.
		const doc = [
			'<!-- OPENWIZARDAI:MODEL tier="high" -->',
			'- [ ] Next up',
			'<!-- OPENWIZARDAI:MODEL tier="low" -->',
			'- [ ] Later',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.status)).toEqual(['live', 'upcoming']);
	});

	it('marks a hint spent once a nearer one supersedes it', () => {
		// Nothing to govern: no task falls between the two, so the first never
		// applies to anything and the second is what the next dispatch reads.
		const doc = [
			'<!-- OPENWIZARDAI:MODEL tier="high" -->',
			'<!-- OPENWIZARDAI:MODEL tier="low" -->',
			'- [ ] Only task',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.status)).toEqual(['spent', 'live']);
	});

	it('marks a hint spent when every task below it is finished', () => {
		const doc = [
			'- [ ] Still open',
			'<!-- OPENWIZARDAI:MODEL tier="high" -->',
			'- [x] Already done',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.status)).toEqual(['spent']);
	});

	it('keeps a hint alive across the checked tasks inside its own section', () => {
		// A half-finished section still needs the setting the rest of it runs at,
		// so a checked task must not consume the hint the way it consumes a gate.
		const doc = ['<!-- OPENWIZARDAI:MODEL tier="high" -->', '- [x] Done', '- [ ] Not done'].join(
			'\n'
		);
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.status)).toEqual(['live']);
	});

	it('marks an inline hint on a later unfinished task upcoming', () => {
		const doc = ['- [ ] First', '- [ ] Design <!-- OPENWIZARDAI:MODEL tier="high" -->'].join('\n');
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('upcoming');
		expect(marker.scope).toBe('task');
	});

	it('marks a marker that sets no level spent however much it explains', () => {
		const doc = ['<!-- OPENWIZARDAI:MODEL reason="This is only prose." -->', '- [ ] Task'].join(
			'\n'
		);
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('spent');
		expect(marker.hint?.reason).toBe('This is only prose.');
	});

	it('carries the reason through to the marker for the pill to show', () => {
		const doc = [
			'<!-- OPENWIZARDAI:MODEL tier="high" effort="high" reason="Lock ordering across three services. Getting it wrong corrupts data." -->',
			'- [ ] Design',
		].join('\n');
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('live');
		expect(marker.hint?.reason).toBe(
			'Lock ordering across three services. Getting it wrong corrupts data.'
		);
	});

	it('marks an inline hint on a checked task spent', () => {
		const doc = ['- [x] Designed <!-- OPENWIZARDAI:MODEL tier="high" -->', '- [ ] Apply'].join(
			'\n'
		);
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('spent');
		expect(marker.scope).toBe('task');
	});

	it('marks an inline hint on the next unfinished task live', () => {
		const doc = ['- [ ] Design <!-- OPENWIZARDAI:MODEL tier="high" -->'].join('\n');
		const [marker] = scanOpenWizardAIMarkers(doc);
		expect(marker.status).toBe('live');
		expect(marker.scope).toBe('task');
	});

	it('flags a misspelled value as invalid rather than showing it as live', () => {
		// The author believes this is doing something. Rendering it as a normal
		// hint would confirm that belief; the run will ignore it.
		const [marker] = scanOpenWizardAIMarkers('<!-- OPENWIZARDAI:MODEL tier="hgih" -->\n- [ ] x');
		expect(marker.status).toBe('invalid');
		expect(marker.hint?.invalid).toEqual([{ attribute: 'tier', value: 'hgih' }]);
	});
});

describe('scanOpenWizardAIMarkers - shared rules', () => {
	it('ignores every marker kind inside a fenced code block', () => {
		// Drawing a pill on a documentation example would state something false
		// about the document. The docs themselves contain all three forms.
		const doc = [
			'```markdown',
			'<!-- OPENWIZARDAI:HITL reason="example" -->',
			'<!-- openwizardai:halt: example -->',
			'<!-- OPENWIZARDAI:MODEL tier="high" -->',
			'```',
			'- [ ] The real task',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc)).toEqual([]);
	});

	it('returns markers in source order across kinds', () => {
		const doc = [
			'<!-- OPENWIZARDAI:MODEL tier="low" -->',
			'<!-- OPENWIZARDAI:HITL reason="check" -->',
			'- [ ] Task',
			'<!-- openwizardai:halt: stopped -->',
		].join('\n');
		expect(scanOpenWizardAIMarkers(doc).map((m) => m.kind)).toEqual(['model', 'hitl', 'halt']);
	});

	it('finds nothing in an ordinary document', () => {
		expect(scanOpenWizardAIMarkers('# Title\n\n- [ ] Do the thing')).toEqual([]);
		expect(hasOpenWizardAIMarker('- [ ] Do the thing')).toBe(false);
		expect(hasOpenWizardAIMarker('<!-- OPENWIZARDAI:MODEL tier="low" -->')).toBe(true);
	});

	it('does not fire on an unrelated HTML comment', () => {
		expect(scanOpenWizardAIMarkers('<!-- TODO: halt later -->\n- [ ] x')).toEqual([]);
	});
});

describe('relocated engine helpers still behave', () => {
	it('detectHaltMarker keeps its case-insensitive contract', () => {
		expect(detectHaltMarker('<!-- OPENWIZARDAI:HALT: nope -->')).toEqual({
			halted: true,
			reason: 'nope',
		});
		expect(detectHaltMarker('<!-- openwizardai:something -->')).toEqual({ halted: false });
	});

	it('detectHaltMarker ignores a fenced example, agreeing with the pill', () => {
		// Reversed deliberately: authoring agents document this syntax far more
		// often than executing agents mis-indent a real halt, and a halt that
		// blocked the run while drawing no pill was an invisible cause.
		const doc = ['```', '<!-- openwizardai:halt: documented, not requested -->', '```'].join('\n');
		expect(detectHaltMarker(doc).halted).toBe(false);
		expect(scanOpenWizardAIMarkers(doc)).toEqual([]);
	});
});

describe('halt marker - description vs instruction', () => {
	it('obeys a marker standing alone in the document body', () => {
		const doc = [
			'# Plan',
			'',
			'- [ ] Ship it',
			'',
			'<!-- openwizardai:halt: build is broken -->',
		].join('\n');
		expect(findHaltMarker(doc)).toEqual({ reason: 'build is broken', line: 4 });
		expect(detectHaltMarker(doc)).toEqual({ halted: true, reason: 'build is broken' });
	});

	it('ignores a marker quoted in inline backticks', () => {
		const doc =
			'If the build is broken, write `<!-- openwizardai:halt: build broken -->` and stop.';
		expect(findHaltMarker(doc)).toBeNull();
		expect(detectHaltMarker(doc).halted).toBe(false);
	});

	it('ignores a marker riding a checkbox line', () => {
		const doc = '- [ ] Run the tests. On failure emit <!-- openwizardai:halt: tests failed -->';
		expect(findHaltMarker(doc)).toBeNull();
		expect(detectHaltMarker(doc).halted).toBe(false);
	});

	it('does not let a described halt block a playbook that has real work', () => {
		// The field bug: an authoring agent writes the marker as a conditional and
		// the playbook refuses to start before its first task ever runs.
		const doc = [
			'# Migration',
			'',
			'If any step below fails irrecoverably, halt with `<!-- openwizardai:halt: reason -->`.',
			'',
			'- [ ] Write the migration',
			'- [ ] Apply the migration <!-- openwizardai:halt: only if the DB is unreachable -->',
			'',
			'```markdown',
			'<!-- openwizardai:halt: brief reason here -->',
			'```',
		].join('\n');
		expect(detectHaltMarker(doc).halted).toBe(false);
	});

	it('reports the first obeyed marker line so the error can point at it', () => {
		const doc = ['a', '<!-- openwizardai:halt -->', '<!-- openwizardai:halt: second -->'].join(
			'\n'
		);
		expect(findHaltMarker(doc)).toEqual({ reason: undefined, line: 1 });
	});

	it('draws a spent pill for a described halt and a live one for a real halt', () => {
		const doc = [
			'- [ ] Apply it <!-- openwizardai:halt: describe only -->',
			'<!-- openwizardai:halt: really stopped -->',
		].join('\n');
		const halts = scanOpenWizardAIMarkers(doc).filter((m) => m.kind === 'halt');
		expect(halts).toEqual([
			expect.objectContaining({ status: 'spent', scope: 'task', line: 0 }),
			expect.objectContaining({ status: 'live', scope: 'document', line: 1 }),
		]);
	});

	it('draws no pill for a halt quoted in prose', () => {
		const doc = 'Emit `<!-- openwizardai:halt: reason -->` to stop the run.';
		expect(scanOpenWizardAIMarkers(doc)).toEqual([]);
	});
});
