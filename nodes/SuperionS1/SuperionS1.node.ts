import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type IDataObject,
	type IExecuteFunctions,
	type IHttpRequestOptions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type JsonObject,
} from 'n8n-workflow';
import { buildQuestions, summarize, type ApiQuestion, type QuestionInput } from './questions';

const DEFAULT_MODEL = 'superion-s1-v6-int4e-vllm-kv1@sha256:e6dc49dc';

export class SuperionS1 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Superion S1',
		name: 'superionS1',
		icon: { light: 'file:../../icons/superion.svg', dark: 'file:../../icons/superion.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Calibrated yes/no, choice and score decisions about any text in one call (Superion S1 by Punky Tiger Labs)',
		defaults: { name: 'Superion S1' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'superionS1Api', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Decide',
						value: 'decide',
						description: 'Ask typed questions about a text and get calibrated probabilities',
						action: 'Decide about a text',
					},
					{
						name: 'Get Usage',
						value: 'usage',
						description: 'Plan, today counters, limits and prepaid balance of the key',
						action: 'Get usage',
					},
					{
						name: 'List Models',
						value: 'models',
						description: 'Served model versions',
						action: 'List models',
					},
				],
				default: 'decide',
			},
			{
				displayName: 'Text (State)',
				name: 'state',
				type: 'string',
				typeOptions: { rows: 4 },
				default: '',
				required: true,
				placeholder: 'e.g. Ticket: My card was charged twice for order #4411',
				description: 'The text the questions are about: a message, ticket, document, transcript or action',
				displayOptions: { show: { operation: ['decide'] } },
			},
			{
				displayName: 'Questions',
				name: 'questions',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true, sortable: true },
				placeholder: 'Add Question',
				default: {},
				displayOptions: { show: { operation: ['decide'] } },
				options: [
					{
						displayName: 'Question',
						name: 'question',
						values: [
							{
						displayName: 'False Means',
						name: 'falseMeans',
						type: 'string',
						default: 'no',
							},
							{
						displayName: 'ID',
						name: 'id',
						type: 'string',
						default: '',
						placeholder: 'e.g. refund',
						description: 'Key of this answer in the output',
							},
							{
						displayName: 'Instructions',
						name: 'instructions',
						type: 'string',
						default: '',
						placeholder: 'e.g. Does the customer ask for a refund?',
						description: 'The question, written as you would for a careful human reviewer',
							},
							{
						displayName: 'Levels',
						name: 'levels',
						type: 'string',
						default: '',
						placeholder: 'low\nnormal\nhigh',
						description: '2 to 16 ordered levels, lowest first, one per line (or comma-separated)',
							},
							{
						displayName: 'Options',
						name: 'options',
						type: 'string',
						default: '',
						placeholder: 'billing:	payments and invoices\ntech:	technical problem\nsales',
						description: '2 to 255 options, one per line (or comma-separated). Optional description after a colon.',
							},
							{
						displayName: 'True Means',
						name: 'trueMeans',
						type: 'string',
						default: 'yes',
							},
							{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
									{
										name: 'Yes	/	No',
										value: 'noul',
									},
									{
										name: 'Choice',
										value: 'choice',
									},
									{
										name: 'Score',
										value: 'score',
									},
								],
						default: 'noul',
							},
					],
					},
				],
			},
			{
				displayName: 'Options',
				name: 'extra',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: { show: { operation: ['decide'] } },
				options: [
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: DEFAULT_MODEL,
						description: 'Immutable model version ID (see List Models)',
					},
					{
						displayName: 'Include Raw Response',
						name: 'includeRaw',
						type: 'boolean',
						default: false,
						description: 'Whether to also output the full API response',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('superionS1Api');
		const baseURL = String(credentials.baseUrl || 'https://api.punkytigerlabs.com').replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const request: IHttpRequestOptions = {
					method: 'GET',
					baseURL,
					url: operation === 'models' ? '/v1/models' : '/v1/usage',
					json: true,
					timeout: 120000,
				};
				if (operation === 'decide') {
					const state = this.getNodeParameter('state', i) as string;
					const extra = this.getNodeParameter('extra', i, {}) as IDataObject;
					const fc = this.getNodeParameter('questions', i, {}) as { question?: QuestionInput[] };
					const questions: Record<string, ApiQuestion> = buildQuestions(fc.question ?? []);
					if (!state) throw new NodeOperationError(this.getNode(), 'Text (State) is empty', { itemIndex: i });
					request.method = 'POST';
					request.url = '/v1/systemone';
					request.body = { model: (extra.model as string) || DEFAULT_MODEL, state, questions };
					const res = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'superionS1Api',
						request,
					)) as IDataObject;
					const json: IDataObject = {
						...summarize(res.answers as IDataObject, questions),
						usage: res.usage,
						model: res.model,
					};
					if (extra.includeRaw) json.raw = res;
					out.push({ json, pairedItem: { item: i } });
					continue;
				}
				const res = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'superionS1Api',
					request,
				)) as IDataObject;
				if (operation === 'models') {
					for (const m of (res.data as IDataObject[]) ?? []) out.push({ json: m, pairedItem: { item: i } });
				} else {
					out.push({ json: res, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if ((error as JsonObject).httpCode || (error as JsonObject).response) {
					throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}
		return [out];
	}
}
