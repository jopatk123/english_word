export const AI_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    providerType: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'nvidia-nim',
    name: 'NVIDIA NIM',
    providerType: 'openai-compatible',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'groq',
    name: 'Groq',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'dashscope',
    name: '阿里通义千问',
    providerType: 'openai-compatible',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'doubao',
    name: '字节豆包（火山方舟）',
    providerType: 'openai-compatible',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
  },
  {
    id: 'qianfan',
    name: '百度文心一言（千帆）',
    providerType: 'openai-compatible',
    baseUrl: 'https://qianfan.baidubce.com/v2',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    providerType: 'openai-compatible',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'baichuan',
    name: '百川智能',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.baichuan-ai.com/v1',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'moonshot',
    name: 'Moonshot（Kimi）',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.moonshot.cn/v1',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.siliconflow.cn/v1',
  },
  {
    id: 'lingyiwanwu',
    name: '零一万物',
    providerType: 'openai-compatible',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
  },
];

export const DEFAULT_PROVIDER_ID = 'deepseek';

export const getProviderById = (providerId) =>
  AI_PROVIDERS.find((item) => item.id === providerId) || AI_PROVIDERS[0];
