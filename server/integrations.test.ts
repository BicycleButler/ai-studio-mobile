// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import http from "node:http";
import crypto from "node:crypto";
import { AddressInfo } from "node:net";
import { createApp } from "../server";
import { ServerStateStore } from "./stateStore";
import { encodeFirestoreFields, decodeFirestoreFields } from "./utils/integrations";

describe("Cloud & Developer Integrations REST proxy (/api/integrations/*)", () => {
  let server: http.Server;
  let baseUrl: string;
  let stateStore: ServerStateStore;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    stateStore = new ServerStateStore(":memory:");
    const { app } = createApp({ stateStore });
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    global.fetch = originalFetch;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    stateStore.close();
  });

  beforeEach(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("encodes and decodes Cloud Firestore typed values round-trip", () => {
    const sample = {
      title: "Bi-directional sync",
      count: 42,
      rating: 4.5,
      published: true,
      tags: ["firebase", "gcp"],
      meta: { nested: "ok", empty: null },
    };
    const encoded = encodeFirestoreFields(sample);
    expect(encoded.title).toEqual({ stringValue: "Bi-directional sync" });
    expect(encoded.count).toEqual({ integerValue: "42" });
    expect(encoded.rating).toEqual({ doubleValue: 4.5 });
    expect(encoded.published).toEqual({ booleanValue: true });

    const decoded = decodeFirestoreFields(encoded);
    expect(decoded).toEqual(sample);
  });

  it("reports OAuth availability and returns 400 on invalid payloads", async () => {
    const cfgRes = await originalFetch(`${baseUrl}/api/integrations/oauth/config`);
    expect(cfgRes.status).toBe(200);
    const cfg = (await cfgRes.json()) as Record<string, boolean>;
    expect(typeof cfg.firebase).toBe("boolean");
    expect(typeof cfg.github).toBe("boolean");

    const badVerify = await originalFetch(`${baseUrl}/api/integrations/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentials: { providerId: "unknown" } }),
    });
    expect(badVerify.status).toBe(400);
  });

  it("verifies Service Account JSON (real RS256 JWT) and reads/writes Firestore documents", async () => {
    const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const saJson = JSON.stringify({
      type: "service_account",
      project_id: "test-fb-project",
      client_email: "tester@test-fb-project.iam.gserviceaccount.com",
      private_key: pem,
    });

    const recordedCalls: Array<{ url: string; method: string; body?: string }> = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }
      recordedCalls.push({
        url,
        method: init?.method || "GET",
        body: typeof init?.body === "string" ? init.body : undefined,
      });

      if (url === "https://oauth2.googleapis.com/token") {
        const params = new URLSearchParams(String(init?.body || ""));
        expect(params.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
        const assertion = params.get("assertion") || "";
        expect(assertion.split(".")).toHaveLength(3);
        return new Response(JSON.stringify({ access_token: "minted-sa-token", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.includes(":listCollectionIds")) {
        return new Response(JSON.stringify({ collectionIds: ["notes", "settings"] }), { status: 200 });
      }

      if (url.includes("/documents/notes/note-1") && (init?.method || "GET") === "PATCH") {
        return new Response(
          JSON.stringify({
            name: "projects/test-fb-project/databases/(default)/documents/notes/note-1",
            fields: encodeFirestoreFields({ title: "Updated", count: 7 }),
            updateTime: "2026-01-01T00:00:00Z",
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const creds = {
      providerId: "firebase",
      authMethod: "service_account",
      serviceAccountJson: saJson,
      projectId: "test-fb-project",
      databaseId: "(default)",
    };

    const verifyRes = await originalFetch(`${baseUrl}/api/integrations/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credentials: creds }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyJson = (await verifyRes.json()) as { valid: boolean; projectId: string };
    expect(verifyJson.valid).toBe(true);
    expect(verifyJson.projectId).toBe("test-fb-project");

    const writeRes = await originalFetch(`${baseUrl}/api/integrations/firebase/documents/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        collectionPath: "notes",
        docId: "note-1",
        data: { title: "Updated", count: 7 },
        merge: true,
      }),
    });
    expect(writeRes.status).toBe(200);
    const writeJson = (await writeRes.json()) as { document: { id: string; data: Record<string, unknown> } };
    expect(writeJson.document.id).toBe("note-1");
    expect(writeJson.document.data).toEqual({ title: "Updated", count: 7 });
    expect(recordedCalls.some((c) => c.url.includes("updateMask.fieldPaths=title"))).toBe(true);
  });

  it("supports bi-directional GCP Cloud Storage reads and uploads", async () => {
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }

      if (url.includes("storage.googleapis.com/upload/storage/v1/b/my-bucket/o")) {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe('{"hello":"world"}');
        return new Response(
          JSON.stringify({
            name: "config/app.json",
            bucket: "my-bucket",
            size: "17",
            contentType: "application/json",
          }),
          { status: 200 }
        );
      }

      if (url.includes("storage.googleapis.com/storage/v1/b/my-bucket/o/config%2Fapp.json?alt=media")) {
        return new Response('{"hello":"world"}', {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const creds = { providerId: "gcp", authMethod: "token", token: "ya29.mock", projectId: "gcp-proj" };

    const uploadRes = await originalFetch(`${baseUrl}/api/integrations/gcp/objects/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        bucket: "my-bucket",
        objectName: "config/app.json",
        content: '{"hello":"world"}',
        contentType: "application/json",
      }),
    });
    expect(uploadRes.status).toBe(200);
    const uploadJson = (await uploadRes.json()) as { object: { name: string; size: number } };
    expect(uploadJson.object.name).toBe("config/app.json");
    expect(uploadJson.object.size).toBe(17);

    const readRes = await originalFetch(`${baseUrl}/api/integrations/gcp/objects/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        bucket: "my-bucket",
        objectName: "config/app.json",
      }),
    });
    expect(readRes.status).toBe(200);
    const readJson = (await readRes.json()) as { content: string };
    expect(readJson.content).toBe('{"hello":"world"}');
  });

  it("supports bi-directional GitHub file reads and atomic batch pushes", async () => {
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }

      if (url.includes("/repos/octo/demo/contents/README.md")) {
        return new Response(
          JSON.stringify({
            type: "file",
            path: "README.md",
            sha: "blobsha1",
            size: 11,
            content: Buffer.from("# Demo Repo").toString("base64"),
            encoding: "base64",
          }),
          { status: 200 }
        );
      }

      if (url.endsWith("/repos/octo/demo/git/ref/heads/main") && (init?.method || "GET") === "GET") {
        return new Response(JSON.stringify({ object: { sha: "basecommitsha" } }), { status: 200 });
      }
      if (url.endsWith("/repos/octo/demo/git/commits/basecommitsha")) {
        return new Response(JSON.stringify({ tree: { sha: "basetreesha" } }), { status: 200 });
      }
      if (url.endsWith("/repos/octo/demo/git/blobs")) {
        return new Response(JSON.stringify({ sha: "newblobsha" }), { status: 201 });
      }
      if (url.endsWith("/repos/octo/demo/git/trees")) {
        return new Response(JSON.stringify({ sha: "newtreesha" }), { status: 201 });
      }
      if (url.endsWith("/repos/octo/demo/git/commits")) {
        return new Response(
          JSON.stringify({ sha: "newcommitsha", html_url: "https://github.com/octo/demo/commit/newcommitsha" }),
          { status: 201 }
        );
      }
      if (url.endsWith("/repos/octo/demo/git/refs/heads/main") && init?.method === "PATCH") {
        return new Response(JSON.stringify({ ref: "refs/heads/main" }), { status: 200 });
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const creds = { providerId: "github", authMethod: "token", token: "ghp_test" };

    const readRes = await originalFetch(`${baseUrl}/api/integrations/github/file/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        owner: "octo",
        repo: "demo",
        path: "README.md",
        branch: "main",
      }),
    });
    expect(readRes.status).toBe(200);
    const readJson = (await readRes.json()) as { content: string; sha: string };
    expect(readJson.content).toBe("# Demo Repo");
    expect(readJson.sha).toBe("blobsha1");

    const pushRes = await originalFetch(`${baseUrl}/api/integrations/github/files/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        owner: "octo",
        repo: "demo",
        branch: "main",
        message: "feat: push from IDE",
        files: [{ path: "src/app.ts", content: "console.log('hi');" }],
      }),
    });
    expect(pushRes.status).toBe(200);
    const pushJson = (await pushRes.json()) as { commitSha: string; filesCount: number };
    expect(pushJson.commitSha).toBe("newcommitsha");
    expect(pushJson.filesCount).toBe(1);
  });

  it("supports bi-directional Vercel env upserts and deployments", async () => {
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }

      if (url.includes("/v10/projects/prj_1/env") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            created: {
              id: "env_123",
              key: "NEXT_PUBLIC_APP_MODE",
              value: "prod",
              type: "encrypted",
              target: ["production"],
            },
          }),
          { status: 200 }
        );
      }

      if (url.includes("/v13/deployments") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            id: "dpl_999",
            name: "demo-site",
            url: "demo-site-abc.vercel.app",
            readyState: "BUILDING",
            target: "production",
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const creds = { providerId: "vercel", authMethod: "token", token: "vcel_test", teamId: "team_xyz" };

    const envRes = await originalFetch(`${baseUrl}/api/integrations/vercel/env/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        projectId: "prj_1",
        key: "NEXT_PUBLIC_APP_MODE",
        value: "prod",
        target: ["production"],
        type: "encrypted",
      }),
    });
    expect(envRes.status).toBe(200);
    const envJson = (await envRes.json()) as { env: { id: string; key: string } };
    expect(envJson.env.key).toBe("NEXT_PUBLIC_APP_MODE");

    const deployRes = await originalFetch(`${baseUrl}/api/integrations/vercel/deploy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: creds,
        projectId: "prj_1",
        name: "demo-site",
        target: "production",
        files: [{ file: "index.html", data: "<h1>Hello</h1>" }],
      }),
    });
    expect(deployRes.status).toBe(200);
    const deployJson = (await deployRes.json()) as { deployment: { uid: string; url: string } };
    expect(deployJson.deployment.uid).toBe("dpl_999");
    expect(deployJson.deployment.url).toBe("https://demo-site-abc.vercel.app");
  });

  it("auto-discovers Firebase project & Google user info on OAuth verify without manual projectId and lists Firebase projects & Vercel teams", async () => {
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }

      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return new Response(JSON.stringify({ email: "dev@example.com", name: "Dev User" }), { status: 200 });
      }

      if (url.startsWith("https://firebase.googleapis.com/v1beta1/projects")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                projectId: "auto-fb-proj",
                displayName: "Auto Firebase App",
                resources: { realtimeDatabaseInstance: "auto-fb-proj-default-rtdb" },
              },
            ],
          }),
          { status: 200 }
        );
      }

      if (url.includes(":listCollectionIds")) {
        return new Response(JSON.stringify({ collectionIds: ["users"] }), { status: 200 });
      }

      if (url.startsWith("https://api.vercel.com/v2/teams")) {
        return new Response(
          JSON.stringify({
            teams: [{ id: "team_auto1", slug: "acme-studio", name: "Acme Studio" }],
          }),
          { status: 200 }
        );
      }

      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    // 1. OAuth verify with no manual projectId provided
    const verifyRes = await originalFetch(`${baseUrl}/api/integrations/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: {
          providerId: "firebase",
          authMethod: "oauth",
          token: "ya29.oauth-user-token",
        },
      }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyJson = (await verifyRes.json()) as {
      valid: boolean;
      accountLabel?: string;
      projectId?: string;
    };
    expect(verifyJson.valid).toBe(true);
    expect(verifyJson.accountLabel).toBe("dev@example.com");
    expect(verifyJson.projectId).toBe("auto-fb-proj");

    // 2. List Firebase projects endpoint
    const fbProjectsRes = await originalFetch(`${baseUrl}/api/integrations/firebase/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: { providerId: "firebase", authMethod: "oauth", token: "ya29.oauth-user-token" },
      }),
    });
    expect(fbProjectsRes.status).toBe(200);
    const fbProjectsJson = (await fbProjectsRes.json()) as {
      projects: Array<{ projectId: string; displayName: string; rtdbUrl?: string }>;
    };
    expect(fbProjectsJson.projects).toHaveLength(1);
    expect(fbProjectsJson.projects[0].projectId).toBe("auto-fb-proj");
    expect(fbProjectsJson.projects[0].rtdbUrl).toBe("https://auto-fb-proj-default-rtdb.firebaseio.com");

    // 3. List Vercel teams endpoint
    const teamsRes = await originalFetch(`${baseUrl}/api/integrations/vercel/teams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credentials: { providerId: "vercel", authMethod: "oauth", token: "vcel_oauth_tok" },
      }),
    });
    expect(teamsRes.status).toBe(200);
    const teamsJson = (await teamsRes.json()) as {
      teams: Array<{ id: string; slug: string; name: string }>;
    };
    expect(teamsJson.teams).toHaveLength(1);
    expect(teamsJson.teams[0].slug).toBe("acme-studio");
  });
});
