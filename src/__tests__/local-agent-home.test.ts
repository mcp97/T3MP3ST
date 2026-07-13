/**
 * agentHome() — fix for "redirected HOME breaks local-agent detection".
 *
 * T3MP3ST may run with $HOME redirected (app-config storage), but the agent CLIs keep their
 * own auth artifacts (~/.claude.json, ~/.codex/auth.json, ~/.hermes/.env) in the REAL home.
 * If detection/spawn used the redirected HOME, an installed-and-authed agent would look
 * unavailable (dead Settings checkboxes). agentHome() resolves the real home independently.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { userInfo } from 'os';
import { agentHome, localAgentChildEnv } from '../agent/local-agents.js';

describe('agentHome — real CLI-auth home, independent of a redirected $HOME', () => {
  const saved = {
    override: process.env.T3MP3ST_AGENT_HOME,
    home: process.env.HOME,
    openai: process.env.OPENAI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  const restore = (
    k: 'T3MP3ST_AGENT_HOME' | 'HOME' | 'OPENAI_API_KEY' | 'OPENROUTER_API_KEY',
    v: string | undefined,
  ): void => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  afterEach(() => {
    restore('T3MP3ST_AGENT_HOME', saved.override);
    restore('HOME', saved.home);
    restore('OPENAI_API_KEY', saved.openai);
    restore('OPENROUTER_API_KEY', saved.openrouter);
  });

  it('prefers the explicit T3MP3ST_AGENT_HOME override over a redirected HOME', () => {
    process.env.T3MP3ST_AGENT_HOME = '/real/user/home';
    process.env.HOME = '/tmp/redirected';
    expect(agentHome()).toBe('/real/user/home');
  });

  it('auto-recovers the real home (OS user DB) when HOME is redirected and no override is set', () => {
    delete process.env.T3MP3ST_AGENT_HOME;
    process.env.HOME = '/tmp/redirected-should-be-ignored';
    // userInfo().homedir reads getpwuid, NOT $HOME → the true home
    expect(agentHome()).toBe(userInfo().homedir);
    expect(agentHome()).not.toBe('/tmp/redirected-should-be-ignored');
  });

  it('ignores a blank/whitespace override and falls through to the real home', () => {
    process.env.T3MP3ST_AGENT_HOME = '   ';
    expect(agentHome()).toBe(userInfo().homedir);
  });

  it('builds child CLI env from native agent auth, not provider API keys', () => {
    process.env.T3MP3ST_AGENT_HOME = '/real/user/home';
    process.env.HOME = '/tmp/redirected';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.OPENROUTER_API_KEY = 'sk-or-test';

    const env = localAgentChildEnv();

    expect(env.HOME).toBe('/real/user/home');
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });
});
