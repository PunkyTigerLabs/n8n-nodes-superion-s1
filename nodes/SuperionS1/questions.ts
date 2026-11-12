import type { IDataObject } from 'n8n-workflow';

export type QuestionType = 'noul' | 'choice' | 'score';

export interface QuestionInput {
	id: string;
	type: QuestionType;
	instructions: string;
	trueMeans?: string;
	falseMeans?: string;
	options?: string;
	levels?: string;
}

export type ApiQuestion =
	| { type: 'noul'; instructions: string; criteria: { true: string; false: string } }
	| { type: 'choice'; instructions: string; criteria: Record<string, string> }
	| { type: 'score'; instructions: string; criteria: string[] };

/** One item per line; a single line may also be comma-separated. */
const lines = (text = ''): string[] =>
	(text.includes('\n') ? text.split(/\r?\n/) : text.split(','))
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

/** "billing: payments and invoices" -> ["billing", "payments and invoices"]; "billing" -> ["billing", "billing"] */
export function parseOption(line: string): [string, string] {
	const i = line.indexOf(':');
	if (i <= 0) return [line, line];
	return [line.slice(0, i).trim(), line.slice(i + 1).trim() || line.slice(0, i).trim()];
}

export function buildQuestion(q: QuestionInput): ApiQuestion {
	if (!q.id) throw new Error('Every question needs an ID');
	if (!q.instructions) throw new Error(`Question "${q.id}" needs instructions`);
	if (q.type === 'noul') {
		return {
			type: 'noul',
			instructions: q.instructions,
			criteria: { true: q.trueMeans || 'yes', false: q.falseMeans || 'no' },
		};
	}
	if (q.type === 'choice') {
		const criteria = Object.fromEntries(lines(q.options).map(parseOption));
		const n = Object.keys(criteria).length;
		if (n < 2 || n > 255) throw new Error(`Question "${q.id}": a choice needs 2 to 255 options (got ${n})`);
		return { type: 'choice', instructions: q.instructions, criteria };
	}
	const levels = lines(q.levels);
	if (levels.length < 2 || levels.length > 16) {
		throw new Error(`Question "${q.id}": a score needs 2 to 16 levels, lowest first (got ${levels.length})`);
	}
	return { type: 'score', instructions: q.instructions, criteria: levels };
}

export function buildQuestions(inputs: QuestionInput[]): Record<string, ApiQuestion> {
	if (!inputs.length) throw new Error('Add at least one question');
	const out: Record<string, ApiQuestion> = {};
	for (const q of inputs) {
		if (out[q.id]) throw new Error(`Duplicate question ID "${q.id}"`);
		out[q.id] = buildQuestion(q);
	}
	return out;
}

/** Adds a flat, workflow-friendly summary next to the raw answers. */
export function summarize(answers: IDataObject, questions: Record<string, ApiQuestion>): IDataObject {
	const summary: IDataObject = {};
	for (const [id, raw] of Object.entries(answers)) {
		const a = raw as IDataObject;
		if (a.type === 'noul') {
			const p = a.noul as number;
			summary[id] = { answer: p >= 0.5, probability: p };
			continue;
		}
		const probs = a.probabilities as Record<string, number>;
		const best = Object.entries(probs).sort((x, y) => y[1] - x[1])[0];
		if (a.type === 'choice') {
			summary[id] = { answer: best[0], probability: best[1] };
		} else {
			const q = questions[id];
			const labels = q && q.type === 'score' ? q.criteria : [];
			const expected = Object.entries(probs).reduce((s, [k, p]) => s + Number(k) * p, 0);
			summary[id] = {
				answer: labels[Number(best[0])] ?? best[0],
				level: Number(best[0]),
				probability: best[1],
				expectedLevel: expected,
			};
		}
	}
	return summary;
}
