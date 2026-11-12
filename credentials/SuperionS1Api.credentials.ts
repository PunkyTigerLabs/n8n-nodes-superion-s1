import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SuperionS1Api implements ICredentialType {
	name = 'superionS1Api';

	displayName = 'Superion S1 API';

	icon: Icon = { light: 'file:../icons/superion.svg', dark: 'file:../icons/superion.dark.svg' };

	documentationUrl = 'https://punkytigerlabs.com/s1/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your Superion S1 key (s1k_…). Free key at https://punkytigerlabs.com/s1/.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.punkytigerlabs.com',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/usage',
			method: 'GET',
		},
	};
}
