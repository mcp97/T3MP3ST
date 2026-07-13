import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { LLMBackbone as LLMBackboneType } from '../llm/index.js';
import type * as ConfigModule from '../config/index.js';

describe('Codex account provider', () => {
  let configDir: string;
  let savedHome: string | undefined;
  let savedForceUnconfigured: string | undefined;
  let configModule: typeof ConfigModule;
  let LLMBackbone: typeof LLMBackboneType;

  beforeAll(async () => {
    savedHome = process.env.HOME;
    savedForceUnconfigured = process.env.T3MP3ST_FORCE_UNCONFIGURED;
    configDir = mkdtempSync(join(tmpdir(), 't3mp3st-config-test-'));
    process.env.HOME = configDir;
    process.env.T3MP3ST_FORCE_UNCONFIGURED = '1';
    vi.resetModules();
    configModule = await import('../config/index.js');
    ({ LLMBackbone } = await import('../llm/index.js'));
  });

  afterAll(() => {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    if (savedForceUnconfigured === undefined) delete process.env.T3MP3ST_FORCE_UNCONFIGURED;
    else process.env.T3MP3ST_FORCE_UNCONFIGURED = savedForceUnconfigured;
    rmSync(configDir, { recursive: true, force: true });
  });

  it('does not silently fall back when the selected API-key provider has no key', () => {
    const { config, isProviderConfigured } = configModule;

    const cfg = config.getLLMConfig('openrouter', 'anthropic/claude-opus-4.8');

    expect(cfg.provider).toBe('openrouter');
    expect(cfg.model).toBe('anthropic/claude-opus-4.8');
    expect(cfg.apiKey).toBeUndefined();
    expect(isProviderConfigured(cfg.provider)).toBe(false);
  });

  it('uses Codex when it is explicitly selected as the default provider', () => {
    const { config, isProviderConfigured } = configModule;

    config.setDefaultProvider('codex');

    const cfg = config.getLLMConfig();

    expect(cfg.provider).toBe('codex');
    expect(cfg.model).toBe('codex-default');
    expect(cfg.apiKey).toBeUndefined();
    expect(cfg.timeout).toBeGreaterThanOrEqual(120000);
    expect(isProviderConfigured(cfg.provider)).toBe(true);
  });

  it('treats Codex as configured without an API key', () => {
    const { isProviderConfigured, providerNeedsApiKey } = configModule;

    expect(providerNeedsApiKey('codex')).toBe(false);
    expect(isProviderConfigured('codex')).toBe(true);
  });

  it('infers API-key providers before using a keyless default provider', () => {
    const { inferProviderFromApiKey, resolveProviderForRequest } = configModule;

    expect(inferProviderFromApiKey('sk-ant-test-key')).toBe('anthropic');
    expect(inferProviderFromApiKey('sk-or-v1-test-key')).toBe('openrouter');
    expect(inferProviderFromApiKey('sk-proj-test-key')).toBe('openai');
    expect(inferProviderFromApiKey('opaque-test-key')).toBeUndefined();

    expect(resolveProviderForRequest(undefined, 'sk-ant-test-key', 'codex')).toBe('anthropic');
    expect(resolveProviderForRequest(undefined, 'opaque-test-key', 'codex')).toBe('openrouter');
    expect(resolveProviderForRequest(undefined, 'opaque-test-key', 'openrouter')).toBe('openrouter');
    expect(resolveProviderForRequest('venice', 'sk-ant-test-key', 'codex')).toBe('venice');
  });

  it('exposes Codex as an API-keyless planning backend', () => {
    const llm = new LLMBackbone({
      provider: 'codex',
      model: 'codex-default',
    });

    expect(llm.getProvider()).toBe('codex');
    expect(llm.getModel()).toBe('codex-default');
    expect(llm.validateConfig()).toEqual({ valid: true });
  });
});
