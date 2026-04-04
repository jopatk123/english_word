export const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4o-mini'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    providerType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-sonnet', 'claude-3.5-sonnet', 'claude-3-opus'],
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    providerType: 'openai-compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['deepseek-ai/deepseek-v3', 'qwen/qwen3.5'],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  {
    id: 'groq',
    name: 'Groq',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama3-70b-8192', 'mixtral-8x7b-32768'],
  },
  {
    id: 'dashscope',
    name: '阿里通义千问',
    providerType: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen3.5-max', 'qwen3.5-plus', 'qwen3.5-flash'],
  },
  {
    id: 'doubao',
    name: '字节豆包（火山方舟）',
    providerType: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-seed-1-6-251015', 'doubao-1.5-pro', 'doubao-1.5-lite'],
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: ['hunyuan-turbos-latest', 'hunyuan-standard', 'hunyuan-lite'],
  },
  {
    id: 'qianfan',
    name: '百度文心一言（千帆）',
    providerType: 'openai-compatible',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    models: ['ernie-4.0', 'ernie-3.5', 'ernie-speed'],
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-4-flash', 'glm-4v'],
  },
  {
    id: 'baichuan',
    name: '百川智能',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-7B'],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
  },
  {
    id: 'moonshot',
    name: 'Moonshot（Kimi）',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
    models: ['deepseek-ai/DeepSeek-V3', 'qwen/qwen3.5', 'mistralai/Mixtral-8x7B'],
  },
  {
    id: 'lingyiwanwu',
    name: '零一万物',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    models: ['yi-large', 'yi-medium', 'yi-spark'],
  },
];

export const DEFAULT_PROVIDER_ID = 'deepseek';

export const getProviderById = (providerId) =>
  AI_PROVIDERS.find((item) => item.id === providerId) || AI_PROVIDERS[0];
