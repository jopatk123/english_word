export const baseAiConfig = {
  apiKey: 'sk-test12345678',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  providerId: 'openai',
  providerType: 'openai-compatible',
  temperature: 0.2,
};

export const validPrompts = {
  systemPrompt: '你是助手',
  userPrompt: '请返回JSON',
};

export const validRootItem = { name: 'spect', meaning: '看' };

export const validWordItem = {
  name: 'inspect',
  meaning: '检查；视察',
  phonetic: '/ɪnˈspekt/',
  partOfSpeech: [{ type: 'v.', meaning: '检查' }],
};

export const validExampleItem = {
  sentence: 'She inspects the room carefully.',
  translation: '她仔细检查了房间。',
};