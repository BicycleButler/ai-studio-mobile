// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { createApp } from '../server';
import { ServerStateStore } from './stateStore';
import { saveSpecContent, materializeSpec, sandSpec } from './stubsService';
import { ProcessRunner } from './utils/processRunner';

describe('Express server reliability & security', () => {
  let server: http.Server;
  let baseUrl: string;
  let stateStore: ServerStateStore;

  beforeAll(async () => {
    stateStore = new ServerStateStore(':memory:');
    const { app } = createApp({ stateStore });
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    stateStore.close();
  });

  it('GET /api/health reports status ok and dbOk true', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.dbOk).toBe(true);
  });

  it('GET /auth/callback uses console.error in client script instead of undefined defaultLogger', async () => {
    const res = await fetch(`${baseUrl}/auth/callback?error=access_denied`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('console.error("Callback error:", err)');
    expect(html).not.toContain('defaultLogger.error');
  });

  it('isolates /api/prompts and /api/projects per session cookie and supports PUT/POST/GET', async () => {
    // Session A saves prompts & projects
    const savePromptsA = await fetch(`${baseUrl}/api/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: [{ id: 'p1', title: 'Prompt A' }] }),
    });
    expect(savePromptsA.status).toBe(200);
    const setCookieHeader = savePromptsA.headers.get('set-cookie');
    expect(setCookieHeader).toBeTruthy();
    const cookieA = setCookieHeader!.split(';')[0];

    const saveProjectsA = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
      body: JSON.stringify({ projects: [{ id: 'proj1', name: 'Project A' }] }),
    });
    expect(saveProjectsA.status).toBe(200);

    // Session A reads back its items
    const getPromptsA = await fetch(`${baseUrl}/api/prompts`, { headers: { Cookie: cookieA } });
    expect((await getPromptsA.json()).prompts).toEqual([{ id: 'p1', title: 'Prompt A' }]);

    const getProjectsA = await fetch(`${baseUrl}/api/projects`, { headers: { Cookie: cookieA } });
    expect((await getProjectsA.json()).projects).toEqual([{ id: 'proj1', name: 'Project A' }]);

    // Separate Session B (no cookie) must NOT see Session A's data
    const getPromptsB = await fetch(`${baseUrl}/api/prompts`);
    expect((await getPromptsB.json()).prompts).toEqual([]);

    const getProjectsB = await fetch(`${baseUrl}/api/projects`);
    expect((await getProjectsB.json()).projects).toEqual([]);
  });

  it('returns structured 400 JSON from error middleware on malformed JSON body', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('returns curated fallback models with unique IDs for /api/models', async () => {
    const resNoKey = await fetch(`${baseUrl}/api/models`);
    expect(resNoKey.status).toBe(200);
    const data = await resNoKey.json();
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
    const ids = data.models.map((m: { id: string }) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const flash25 = data.models.find((m: { id: string; name: string }) => m.id === 'gemini-2.5-flash');
    expect(flash25?.name).toBe('Gemini 2.5 Flash');
  });

  it('rejects workspace path traversal attempts in stubsService', async () => {
    await expect(saveSpecContent('../outside.ts.md', 'bad')).rejects.toThrow(/outside workspace/i);
    await expect(materializeSpec('../outside.ts.md')).rejects.toThrow(/outside workspace/i);
    await expect(sandSpec('../outside.ts.md')).rejects.toThrow(/outside workspace/i);
    await expect(saveSpecContent('/tmp/outside.ts.md', 'bad')).rejects.toThrow(/outside workspace/i);
  });

  it('enforces execution timeout in ProcessRunner', async () => {
    const tmpScript = path.join(os.tmpdir(), `vitest-timeout-${Date.now()}.cjs`);
    fs.writeFileSync(tmpScript, 'setTimeout(() => {}, 5000);', 'utf8');
    const runner = new ProcessRunner();
    try {
      await expect(
        runner.runCommand(tmpScript, [], { timeoutMs: 80 })
      ).rejects.toThrow(/timed out/i);
    } finally {
      fs.rmSync(tmpScript, { force: true });
    }
  });

  it('returns 409 Conflict on stale baseVersion and allows force overwrite on /api/prompts', async () => {
    const res1 = await fetch(`${baseUrl}/api/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompts: [{ id: 'v1', title: 'First' }] }),
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.version).toBe(1);
    const cookie = res1.headers.get('set-cookie')!.split(';')[0];

    const res2 = await fetch(`${baseUrl}/api/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ prompts: [{ id: 'v2', title: 'Second' }], baseVersion: 1 }),
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.version).toBe(2);

    // Stale baseVersion: 1 should now fail with 409 and return remote data
    const conflictRes = await fetch(`${baseUrl}/api/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ prompts: [{ id: 'stale', title: 'Stale' }], baseVersion: 1 }),
    });
    expect(conflictRes.status).toBe(409);
    const conflictBody = await conflictRes.json();
    expect(conflictBody.remoteVersion).toBe(2);
    expect(conflictBody.remote).toEqual([{ id: 'v2', title: 'Second' }]);

    // Force overwrite bypasses baseVersion conflict and advances version to 3
    const forceRes = await fetch(`${baseUrl}/api/prompts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ prompts: [{ id: 'forced', title: 'Forced' }], baseVersion: 1, force: true }),
    });
    expect(forceRes.status).toBe(200);
    const forceBody = await forceRes.json();
    expect(forceBody.version).toBe(3);
  });

  it('rejects unverified POST /api/auth/google and accepts verified credentials', async () => {
    const localStore = new ServerStateStore(':memory:');
    const { app: verifiedApp } = createApp({
      stateStore: localStore,
      verifyGoogleCredentials: async ({ email, idToken }) => {
        if (idToken === 'valid-token-123') {
          return { verified: true, email, sub: 'sub-123', name: 'Verified User' };
        }
        return { verified: false, error: 'Invalid ID token' };
      },
    });
    const localServer = http.createServer(verifiedApp);
    await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', () => resolve()));
    const localBaseUrl = `http://127.0.0.1:${(localServer.address() as AddressInfo).port}`;

    try {
      const spoofRes = await fetch(`${localBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'victim@example.com', name: 'Spoofed' }),
      });
      expect(spoofRes.status).toBe(401);

      const okRes = await fetch(`${localBaseUrl}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', idToken: 'valid-token-123' }),
      });
      expect(okRes.status).toBe(200);
      const okData = await okRes.json();
      expect(okData.user.email).toBe('user@example.com');
      expect(okData.user.sub).toBe('sub-123');
    } finally {
      await new Promise<void>((resolve) => localServer.close(() => resolve()));
      localStore.close();
    }
  });

  it('expires and prunes old sessions in ServerStateStore', () => {
    const store = new ServerStateStore(':memory:');
    try {
      const now = 1_000_000_000;
      store.setSessionUser(
        'old-sid',
        {
          email: 'old@example.com',
          name: 'Old',
          authSource: 'google_oauth',
          authenticatedAt: now - 10_000,
          aiStudioSynced: true,
        },
        now - 10_000
      );
      store.setSessionUser(
        'fresh-sid',
        {
          email: 'fresh@example.com',
          name: 'Fresh',
          authSource: 'google_oauth',
          authenticatedAt: now,
          aiStudioSynced: true,
        },
        now
      );

      expect(store.getSessionUser('old-sid', now, 5_000)).toBeNull();
      expect(store.getSessionUser('fresh-sid', now, 5_000)?.email).toBe('fresh@example.com');

      const pruned = store.pruneExpiredSessions(5_000, now + 10_000);
      expect(pruned).toBe(1);
    } finally {
      store.close();
    }
  });

  it('streams initial event on /api/stubs/stream and cleans up listener on abort', async () => {
    const { stubsEvents } = await import('./stubsService');
    const beforeListeners = stubsEvents.listenerCount('log');
    const ac = new AbortController();
    const res = await fetch(`${baseUrl}/api/stubs/stream`, { signal: ac.signal });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const first = await reader.read();
    const text = new TextDecoder().decode(first.value);
    expect(text).toContain('Connected to Stubs PWM event bus');
    expect(stubsEvents.listenerCount('log')).toBe(beforeListeners + 1);
    ac.abort();
    await reader.cancel().catch(() => {});
    await new Promise((r) => setTimeout(r, 30));
    expect(stubsEvents.listenerCount('log')).toBe(beforeListeners);
  });

  it('blocks SSRF URLs on /api/providers/verify and /api/generate', async () => {
    const ssrfVerify = await fetch(`${baseUrl}/api/providers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'openai-compatible',
        apiKey: 'sk-test-1234',
        baseUrl: 'http://169.254.169.254/latest/meta-data',
      }),
    });
    expect(ssrfVerify.status).toBe(400);

    const loopbackVerify = await fetch(`${baseUrl}/api/providers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'openai',
        apiKey: 'sk-test-1234',
        baseUrl: 'http://127.0.0.1:8080/v1',
      }),
    });
    expect(loopbackVerify.status).toBe(400);

    const ollamaMetadata = await fetch(`${baseUrl}/api/providers/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: 'local-ollama',
        baseUrl: 'http://169.254.169.254',
      }),
    });
    expect(ollamaMetadata.status).toBe(400);

    const badSchemeGen = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        providerId: 'openai-compatible',
        baseUrl: 'file:///etc/passwd',
        messages: [{ role: 'user', text: 'hi' }],
      }),
    });
    expect(badSchemeGen.status).toBe(400);
  });

  it('blocks cross-origin mutations on /api/stubs/* routes with 403', async () => {
    const res = await fetch(`${baseUrl}/api/stubs/spec-save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious.example.com',
      },
      body: JSON.stringify({ path: 'src/App.tsx.md', content: 'test' }),
    });
    expect(res.status).toBe(403);
  });

  it('enforces per-client rate limiting with 429 and Retry-After', async () => {
    const localStore = new ServerStateStore(':memory:');
    const { app: limitedApp } = createApp({
      stateStore: localStore,
      rateLimits: {
        windowMs: 60_000,
        aiMaxPerMin: 2,
        aiMaxConcurrent: 4,
      },
    });
    const localServer = http.createServer(limitedApp);
    await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', () => resolve()));
    const localBaseUrl = `http://127.0.0.1:${(localServer.address() as AddressInfo).port}`;

    try {
      const payload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'openai', apiKey: 'sk-123', baseUrl: 'http://127.0.0.1:9999' }),
      };
      const r1 = await fetch(`${localBaseUrl}/api/providers/verify`, payload);
      expect(r1.status).toBe(400);
      const cookie = r1.headers.get('set-cookie')?.split(';')[0];

      const r2 = await fetch(`${localBaseUrl}/api/providers/verify`, {
        ...payload,
        headers: { ...payload.headers, ...(cookie ? { Cookie: cookie } : {}) },
      });
      expect(r2.status).toBe(400);

      const r3 = await fetch(`${localBaseUrl}/api/providers/verify`, {
        ...payload,
        headers: { ...payload.headers, ...(cookie ? { Cookie: cookie } : {}) },
      });
      expect(r3.status).toBe(429);
      expect(r3.headers.get('retry-after')).toBeTruthy();
    } finally {
      await new Promise<void>((resolve) => localServer.close(() => resolve()));
      localStore.close();
    }
  });

  it('maintains normalized scoped_item_entries, per-item upserts/deletes, and integrity ping in ServerStateStore', () => {
    const store = new ServerStateStore(':memory:');
    try {
      expect(store.ping()).toBe(true);
      store.setItems('session:s1', 'prompts', [
        { id: 'p1', title: 'Alpha' },
        { id: 'p2', title: 'Beta' },
      ]);
      expect(store.getItemEntries('session:s1', 'prompts').map((e) => e.itemId)).toEqual(['p1', 'p2']);

      const upserted = store.upsertScopedItem('session:s1', 'prompts', { id: 'p2', title: 'Beta v2' });
      expect(upserted.version).toBe(2);
      expect(store.getItems('session:s1', 'prompts')).toEqual([
        { id: 'p1', title: 'Alpha' },
        { id: 'p2', title: 'Beta v2' },
      ]);

      const del = store.deleteScopedItem('session:s1', 'prompts', 'p1');
      expect(del.deleted).toBe(true);
      expect(del.version).toBe(3);
      expect(store.getItemEntries('session:s1', 'prompts').map((e) => e.itemId)).toEqual(['p2']);
    } finally {
      store.close();
    }
  });

  it('retries transient 503 errors on /api/generate and aborts upstream signal with 504 on timeout', async () => {
    let generateAttempts = 0;
    let streamAttempts = 0;
    let observedAbortSignal: AbortSignal | undefined;

    const mockGenAiClient = {
      models: {
        generateContent: async () => {
          generateAttempts++;
          if (generateAttempts === 1) {
            const err = new Error('Temporary 503 unavailable') as Error & { status?: number };
            err.status = 503;
            throw err;
          }
          return { text: 'Recovered response', usageMetadata: { totalTokenCount: 5 } };
        },
        generateContentStream: async (params: { config?: { abortSignal?: AbortSignal } }) => {
          streamAttempts++;
          if (streamAttempts === 1) {
            observedAbortSignal = params.config?.abortSignal;
            // Hang until aborted when testing timeout, or throw 503 depending on prompt
            const err = new Error('Transient stream 503') as Error & { status?: number };
            err.status = 503;
            throw err;
          }
          return (async function* () {
            yield { text: 'Stream ' };
            yield { text: 'OK', usageMetadata: { totalTokenCount: 3 } };
          })();
        },
      },
    };

    const localStore = new ServerStateStore(':memory:');
    const { app: testApp } = createApp({
      stateStore: localStore,
      getGenAIClient: () => mockGenAiClient as unknown as ReturnType<typeof import('./utils/genai').getGenAIClient>,
      genAiCallTimeoutMs: 60,
      genAiStreamIdleTimeoutMs: 60,
    });
    const localServer = http.createServer(testApp);
    await new Promise<void>((resolve) => localServer.listen(0, '127.0.0.1', () => resolve()));
    const localBaseUrl = `http://127.0.0.1:${(localServer.address() as AddressInfo).port}`;

    try {
      // 1. Non-streaming transient 503 retry succeeds on attempt 2
      const genRes = await fetch(`${localBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', text: 'hello' }],
          stream: false,
        }),
      });
      expect(genRes.status).toBe(200);
      const genData = await genRes.json();
      expect(genData.text).toBe('Recovered response');
      expect(generateAttempts).toBe(2);

      // 2. Streaming transient 503 retry succeeds on attempt 2
      const streamRes = await fetch(`${localBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', text: 'hello stream' }],
          stream: true,
        }),
      });
      expect(streamRes.status).toBe(200);
      const sseText = await streamRes.text();
      expect(sseText).toContain('"text":"Stream "');
      expect(sseText).toContain('"text":"OK"');
      expect(sseText).toContain('"done":true');
      expect(streamAttempts).toBe(2);

      // 3. Hanging non-streaming call triggers timeout -> aborts signal and returns HTTP 504
      let timeoutAbortTriggered = false;
      mockGenAiClient.models.generateContent = async (params?: { config?: { abortSignal?: AbortSignal } }) => {
        observedAbortSignal = params?.config?.abortSignal;
        observedAbortSignal?.addEventListener('abort', () => {
          timeoutAbortTriggered = true;
        });
        await new Promise(() => {});
        return { text: 'never', usageMetadata: { totalTokenCount: 0 } };
      };

      const timeoutRes = await fetch(`${localBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', text: 'hang' }],
          stream: false,
        }),
      });
      expect(timeoutRes.status).toBe(504);
      const timeoutBody = await timeoutRes.json();
      expect(timeoutBody.error).toMatch(/timed out/i);
      expect(timeoutAbortTriggered).toBe(true);
    } finally {
      await new Promise<void>((resolve) => localServer.close(() => resolve()));
      localStore.close();
    }
  });
});
