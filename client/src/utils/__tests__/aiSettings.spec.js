import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_SETTINGS_STORAGE_KEY } from '../aiSettings.js';
import {
  addCustomModel,
  deleteCustomModel,
  deleteCustomProvider,
  getAllModels,
  getAllProviders,
  getCustomModels,
  getCustomProviders,
  loadAiSettings,
  loadProviderSettings,
  maskApiKey,
  saveAiSettings,
  saveCustomProvider,
} from '../aiSettings.js';

// ── localStorage mock ─────────────────────────────────────────
const makeLocalStorageMock = () => {
  let store = {};
  return {
    getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    _reset: () => {
      store = {};
    },
  };
};

const localStorageMock = makeLocalStorageMock();

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  localStorageMock._reset();
});

// ── maskApiKey ────────────────────────────────────────────────

describe('maskApiKey', () => {
  it('空值返回"未配置"', () => {
    expect(maskApiKey('')).toBe('未配置');
    expect(maskApiKey(null)).toBe('未配置');
    expect(maskApiKey(undefined)).toBe('未配置');
  });

  it('8位及以下返回"已配置"', () => {
    expect(maskApiKey('12345678')).toBe('已配置');
    expect(maskApiKey('abc')).toBe('已配置');
  });

  it('超过8位返回掩码格式', () => {
    expect(maskApiKey('sk-abcdefgh1234')).toBe('sk-a****1234');
  });
});

// ── 内置厂商 ──────────────────────────────────────────────────

describe('getAllProviders (无自定义)', () => {
  it('返回内置厂商列表（不为空）', () => {
    const providers = getAllProviders();
    expect(providers.length).toBeGreaterThan(0);
  });

  it('包含 deepseek', () => {
    const providers = getAllProviders();
    expect(providers.some((p) => p.id === 'deepseek')).toBe(true);
  });
});

// ── 自定义厂商 ────────────────────────────────────────────────

describe('saveCustomProvider / getCustomProviders', () => {
  it('可以新增自定义厂商', () => {
    const p = saveCustomProvider('My LLM', 'http://localhost:11434/v1');
    expect(p.id).toMatch(/^custom_/);
    expect(p.name).toBe('My LLM');
    expect(p.baseUrl).toBe('http://localhost:11434/v1');
    expect(p.providerType).toBe('openai-compatible');
    expect(p.models).toEqual([]);
  });

  it('自定义厂商出现在 getCustomProviders 中', () => {
    saveCustomProvider('Test Provider', 'https://example.com/v1');
    const customs = getCustomProviders();
    expect(customs.length).toBe(1);
    expect(customs[0].name).toBe('Test Provider');
  });

  it('自定义厂商出现在 getAllProviders 中', () => {
    const p = saveCustomProvider('Extra', 'https://extra.example.com/v1');
    const all = getAllProviders();
    expect(all.some((x) => x.id === p.id)).toBe(true);
  });

  it('新增多个自定义厂商都被保留', () => {
    saveCustomProvider('A', 'https://a.example.com/v1');
    saveCustomProvider('B', 'https://b.example.com/v1');
    expect(getCustomProviders().length).toBe(2);
  });
});

describe('deleteCustomProvider', () => {
  it('删除后不再出现在 getCustomProviders', () => {
    const p = saveCustomProvider('ToDelete', 'https://del.example.com/v1');
    deleteCustomProvider(p.id);
    expect(getCustomProviders().some((x) => x.id === p.id)).toBe(false);
  });

  it('删除后也不出现在 getAllProviders', () => {
    const p = saveCustomProvider('Gone', 'https://gone.example.com/v1');
    deleteCustomProvider(p.id);
    expect(getAllProviders().some((x) => x.id === p.id)).toBe(false);
  });

  it('删除时同步清除该厂商的自定义模型', () => {
    const p = saveCustomProvider('C', 'https://c.example.com/v1');
    addCustomModel(p.id, 'model-x');
    deleteCustomProvider(p.id);
    expect(getCustomModels(p.id)).toEqual([]);
  });
});

// ── 自定义模型 ────────────────────────────────────────────────

describe('addCustomModel / getCustomModels', () => {
  it('为内置厂商添加自定义模型', () => {
    addCustomModel('deepseek', 'my-fine-tuned-v1');
    expect(getCustomModels('deepseek')).toContain('my-fine-tuned-v1');
  });

  it('为自定义厂商添加模型', () => {
    const p = saveCustomProvider('Ollama', 'http://localhost:11434/v1');
    addCustomModel(p.id, 'llama3');
    expect(getCustomModels(p.id)).toContain('llama3');
  });

  it('重复添加同名模型不会产生重复条目', () => {
    addCustomModel('deepseek', 'dup-model');
    addCustomModel('deepseek', 'dup-model');
    const models = getCustomModels('deepseek');
    expect(models.filter((m) => m === 'dup-model').length).toBe(1);
  });

  it('空字符串不被添加', () => {
    addCustomModel('deepseek', '  ');
    expect(getCustomModels('deepseek')).toEqual([]);
  });
});

describe('getAllModels', () => {
  it('内置模型 + 自定义模型都出现在 getAllModels', () => {
    addCustomModel('deepseek', 'custom-deepseek-model');
    const models = getAllModels('deepseek');
    expect(models).toContain('deepseek-chat'); // 内置
    expect(models).toContain('custom-deepseek-model'); // 自定义
  });

  it('未知厂商返回空数组（自定义厂商无内置模型）', () => {
    const p = saveCustomProvider('X', 'https://x.example.com/v1');
    expect(getAllModels(p.id)).toEqual([]);
    addCustomModel(p.id, 'phi3');
    expect(getAllModels(p.id)).toEqual(['phi3']);
  });
});

describe('deleteCustomModel', () => {
  it('删除后模型不再出现', () => {
    addCustomModel('deepseek', 'to-remove');
    deleteCustomModel('deepseek', 'to-remove');
    expect(getCustomModels('deepseek')).not.toContain('to-remove');
  });

  it('删除不存在的模型不报错', () => {
    expect(() => deleteCustomModel('deepseek', 'nonexistent')).not.toThrow();
  });
});

// ── loadAiSettings / loadProviderSettings / saveAiSettings ───

describe('loadAiSettings', () => {
  it('首次加载返回默认 deepseek 配置', () => {
    const s = loadAiSettings();
    expect(s.providerId).toBe('deepseek');
    expect(s.apiKey).toBe('');
  });

  it('保存后再加载能恢复配置', () => {
    saveAiSettings({
      providerId: 'openai',
      providerType: 'openai-compatible',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345',
    });
    const s = loadAiSettings();
    expect(s.providerId).toBe('openai');
    expect(s.model).toBe('gpt-4o');
    expect(s.apiKey).toBe('sk-test-key-12345');
  });
});

describe('loadProviderSettings', () => {
  it('未保存的厂商返回空 apiKey', () => {
    const s = loadProviderSettings('openai');
    expect(s.apiKey).toBe('');
    expect(s.providerId).toBe('openai');
  });

  it('包含自定义模型的厂商可正常加载', () => {
    const p = saveCustomProvider('Local', 'http://localhost:11434/v1');
    addCustomModel(p.id, 'mixtral');
    const s = loadProviderSettings(p.id);
    // 首次加载没有保存 apiKey，应返回默认
    expect(s.providerId).toBe(p.id);
    expect(s.model).toBe('mixtral'); // 自定义模型作为默认
  });

  it('custom model 保存后 loadProviderSettings 能读回', () => {
    const p = saveCustomProvider('Remote', 'https://remote.example.com/v1');
    addCustomModel(p.id, 'my-model');
    saveAiSettings({
      providerId: p.id,
      providerType: 'openai-compatible',
      baseUrl: 'https://remote.example.com/v1',
      model: 'my-model',
      apiKey: 'key-123456789',
    });
    const s = loadProviderSettings(p.id);
    expect(s.model).toBe('my-model');
    expect(s.apiKey).toBe('key-123456789');
  });
});
