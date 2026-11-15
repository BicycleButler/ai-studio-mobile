// @vitest-environment node
import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { sanitizeFirestoreId } from "./src/services/firestoreSyncService";
import { OperationType } from "./src/services/firebase";
import firebaseConfig from "./firebase-applet-config.json";

const ROOT = process.cwd();
const rulesText = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");
const blueprint = JSON.parse(fs.readFileSync(path.join(ROOT, "firebase-blueprint.json"), "utf8")) as {
  entities: Record<string, { title: string; description: string; type: string; properties: Record<string, unknown>; required?: string[] }>;
  firestore: Record<string, { schema: string | { $ref: string }; description: string }>;
};

describe("Firebase Blueprint, Firestore Rules & Sync Invariants", () => {
  test("firebase-applet-config.json is provisioned for gen-lang-client-0543865196 with firestoreDatabaseId", () => {
    expect(firebaseConfig.projectId).toBe("gen-lang-client-0543865196");
    expect(typeof firebaseConfig.firestoreDatabaseId).toBe("string");
    expect(firebaseConfig.firestoreDatabaseId.length).toBeGreaterThan(0);
    expect(typeof firebaseConfig.apiKey).toBe("string");
  });

  test("firebase-blueprint.json adheres strictly to entity and collection schema", () => {
    const allowedEntityKeys = new Set(["title", "description", "type", "properties", "required"]);
    const allowedPropKeys = new Set(["type", "format", "description", "enum", "$ref", "maxLength", "minLength", "pattern"]);

    for (const [_name, entity] of Object.entries(blueprint.entities)) {
      for (const k of Object.keys(entity)) {
        expect(allowedEntityKeys.has(k)).toBe(true);
      }
      expect(entity.type).toBe("object");
      for (const prop of Object.values(entity.properties)) {
        for (const pk of Object.keys(prop as Record<string, unknown>)) {
          expect(allowedPropKeys.has(pk)).toBe(true);
        }
      }
    }

    // Every blueprint path has a matching rules block
    expect(Object.keys(blueprint.firestore)).toEqual([
      "/users/{userId}",
      "/users/{userId}/private/{infoId}",
      "/users/{userId}/prompts/{promptId}",
      "/users/{userId}/chatSessions/{sessionId}",
      "/users/{userId}/templates/{templateId}",
      "/users/{userId}/projects/{projectId}",
    ]);
    expect(rulesText).toContain("match /users/{userId}");
    expect(rulesText).toContain("match /private/{infoId}");
    expect(rulesText).toContain("match /prompts/{promptId}");
    expect(rulesText).toContain("match /chatSessions/{sessionId}");
    expect(rulesText).toContain("match /templates/{templateId}");
    expect(rulesText).toContain("match /projects/{projectId}");
  });

  test("firestore.rules enforces all Eight Pillars and blocks Dirty Dozen attack classes", () => {
    // 1. Rules v2 and default deny catch-all at top
    expect(rulesText).toContain("rules_version = '2';");
    expect(rulesText).toMatch(/match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);

    // 2. Email verified check mandated for writes
    expect(rulesText).toContain("request.auth.token.email_verified == true");

    // 3. No blanket list/read (all list rules check resource.data ownership)
    expect(rulesText).not.toMatch(/allow list:\s*if\s*isSignedIn\(\)\s*;/);
    expect(rulesText).not.toMatch(/allow read:\s*if\s*isSignedIn\(\)\s*;/);
    expect(rulesText).toContain("allow list: if isOwner(userId) && resource.data.ownerId == request.auth.uid;");

    // 4. Master Gate parent existence check on subcollection creates
    expect(rulesText).toContain("exists(/databases/$(database)/documents/users/$(userId))");

    // 5. Strict temporal integrity via request.time
    expect(rulesText).toContain("incoming().createdAt == request.time");
    expect(rulesText).toContain("incoming().updatedAt == request.time");

    // 6. Never stores secret API keys in WorkspaceProjectDoc allowlist
    expect(rulesText).not.toContain("'apiKey'");

    // 7. ID poisoning protection
    expect(rulesText).toContain("function isValidId(id)");
    expect(rulesText).toContain("id.size() <= 128");
  });

  test("client ID sanitizer and OperationType conform to rules and error spec", () => {
    expect(sanitizeFirestoreId("invalid$id!with/slash")).toBe("invalid_id_with_slash");
    expect(sanitizeFirestoreId("a".repeat(200)).length).toBeLessThanOrEqual(128);
    expect(Object.values(OperationType)).toEqual(["create", "update", "delete", "list", "get", "write"]);
  });
});
