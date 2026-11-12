// Runs against the built package: npm run build && node --test test/
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildQuestions, parseOption, summarize } = require('../dist/nodes/SuperionS1/questions.js');

test('builds the exact API wire format', () => {
	const q = buildQuestions([
		{ id: 'refund', type: 'noul', instructions: 'Does the customer ask for a refund?' },
		{ id: 'team', type: 'choice', instructions: 'Which team?', options: 'billing: payments\ntech: bugs\nsales' },
		{ id: 'urgency', type: 'score', instructions: 'How urgent?', levels: 'low, normal, high' },
	]);
	assert.deepEqual(q, {
		refund: { type: 'noul', instructions: 'Does the customer ask for a refund?', criteria: { true: 'yes', false: 'no' } },
		team: { type: 'choice', instructions: 'Which team?', criteria: { billing: 'payments', tech: 'bugs', sales: 'sales' } },
		urgency: { type: 'score', instructions: 'How urgent?', criteria: ['low', 'normal', 'high'] },
	});
});

test('validates limits client-side', () => {
	assert.throws(() => buildQuestions([]), /at least one/);
	assert.throws(() => buildQuestions([{ id: 'c', type: 'choice', instructions: 'x', options: 'only' }]), /2 to 255/);
	const many = Array.from({ length: 17 }, (_, i) => `l${i}`).join('\n');
	assert.throws(() => buildQuestions([{ id: 's', type: 'score', instructions: 'x', levels: many }]), /2 to 16/);
	assert.throws(
		() => buildQuestions([{ id: 'a', type: 'noul', instructions: 'x' }, { id: 'a', type: 'noul', instructions: 'y' }]),
		/Duplicate/,
	);
});

test('parses options with and without descriptions', () => {
	assert.deepEqual(parseOption('billing: payments and invoices'), ['billing', 'payments and invoices']);
	assert.deepEqual(parseOption('sales'), ['sales', 'sales']);
});

test('summarizes the real API response', () => {
	const questions = buildQuestions([
		{ id: 'refund', type: 'noul', instructions: 'r?' },
		{ id: 'sentiment', type: 'choice', instructions: 's', options: 'pos,neg,neu' },
		{ id: 'urgency', type: 'score', instructions: 'u', levels: 'not urgent\nsomewhat urgent\nvery urgent' },
	]);
	const s = summarize(
		{
			refund: { type: 'noul', noul: 0.9997 },
			sentiment: { type: 'choice', probabilities: { pos: 0.0003, neg: 0.9943, neu: 0.0054 } },
			urgency: { type: 'score', probabilities: { '0': 0, '1': 0.1922, '2': 0.8078 } },
		},
		questions,
	);
	assert.deepEqual(s.refund, { answer: true, probability: 0.9997 });
	assert.deepEqual(s.sentiment, { answer: 'neg', probability: 0.9943 });
	const u = s.urgency;
	assert.equal(u.answer, 'very urgent');
	assert.equal(u.level, 2);
	assert.ok(Math.abs(u.expectedLevel - 1.8078) < 1e-9);
});
