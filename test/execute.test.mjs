// Drives SuperionS1.execute() with a minimal IExecuteFunctions double.
// Mocked by default; with S1_LIVE=1 and SUPERION_API_KEY it calls the real API (3 requests).
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SuperionS1 } = require('../dist/nodes/SuperionS1/SuperionS1.node.js');
const LIVE = process.env.S1_LIVE && process.env.SUPERION_API_KEY;

function context(params, calls) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		getCredentials: async () => ({ apiKey: process.env.SUPERION_API_KEY || 's1k_test', baseUrl: 'https://api.punkytigerlabs.com' }),
		getNode: () => ({ name: 'Superion S1', type: 'superionS1', typeVersion: 1, parameters: {} }),
		continueOnFail: () => false,
		helpers: {
			async httpRequestWithAuthentication(credName, req) {
				calls.push({ credName, ...req });
				if (!LIVE) {
					if (req.url === '/v1/systemone') {
						return {
							model: req.body.model, usage: { input_tokens: 120, output_tokens: 0 },
							answers: {
								refund: { type: 'noul', noul: 0.12 },
								team: { type: 'choice', probabilities: { billing: 0.97, tech: 0.02, sales: 0.01 } },
								urgency: { type: 'score', probabilities: { 0: 0.05, 1: 0.15, 2: 0.8 } },
							},
						};
					}
					return req.url === '/v1/models' ? { data: [{ id: 'm1' }, { id: 'm2' }] } : { plan: 'free' };
				}
				const r = await fetch(req.baseURL + req.url, {
					method: req.method,
					headers: { Authorization: `Bearer ${process.env.SUPERION_API_KEY}`, 'Content-Type': 'application/json' },
					body: req.body ? JSON.stringify(req.body) : undefined,
				});
				assert.equal(r.status, 200, await r.clone().text());
				return r.json();
			},
		},
	};
}

const decideParams = {
	operation: 'decide',
	state: 'Ticket: My card was charged twice for order #4411. Please fix it today.',
	questions: {
		question: [
			{ id: 'refund', type: 'noul', instructions: 'Does the customer ask for money back?', trueMeans: 'yes', falseMeans: 'no' },
			{ id: 'team', type: 'choice', instructions: 'Which team should handle this ticket?', options: 'billing: payments\ntech: bugs\nsales: plans' },
			{ id: 'urgency', type: 'score', instructions: 'How urgent is a reply?', levels: 'low\nnormal\nhigh' },
		],
	},
	extra: {},
};

test('decide', async () => {
	const calls = [];
	const [[item]] = await new SuperionS1().execute.call(context(decideParams, calls));
	assert.equal(calls[0].credName, 'superionS1Api');
	assert.equal(calls[0].method, 'POST');
	assert.equal(calls[0].url, '/v1/systemone');
	assert.deepEqual(Object.keys(calls[0].body.questions), ['refund', 'team', 'urgency']);
	assert.equal(item.json.team.answer, 'billing');
	assert.ok(item.json.team.probability > 0.8);
	assert.equal(item.json.urgency.answer, 'high');
	assert.equal(item.json.usage.output_tokens, 0);
	assert.equal(typeof item.json.refund.probability, 'number');
});

test('list models and usage', async () => {
	const calls = [];
	const models = await new SuperionS1().execute.call(context({ operation: 'models' }, calls));
	assert.ok(models[0].length >= 2);
	const usage = await new SuperionS1().execute.call(context({ operation: 'usage' }, calls));
	assert.ok(usage[0][0].json.plan);
	assert.deepEqual(calls.map((c) => c.url), ['/v1/models', '/v1/usage']);
});
