import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  FieldValue,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  UpdateData,
  updateDoc,
  where,
  Firestore,
  Unsubscribe,
} from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import {
  ChatMessage,
  ChatSession,
  ProjectInfo,
  PromptConfig,
  PromptTemplate,
  SavedPrompt,
} from "../types";
import {
  getFirebaseAuthInstance,
  getFirestoreInstance,
  handleFirestoreError,
  OperationType,
} from "./firebase";
import { ILogger, DefaultLoggerFactory } from "../utils/logger";

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function sanitizeFirestoreId(raw: string, fallbackPrefix = "doc"): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .slice(0, 128);
  return cleaned.length > 0 && VALID_ID_REGEX.test(cleaned)
    ? cleaned
    : `${fallbackPrefix}_${Date.now()}`;
}

function truncateString(val: unknown, maxLen: number): string {
  const str = typeof val === "string" ? val : "";
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function sanitizePromptConfig(config: PromptConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {
    model: truncateString(config.model || "gemini-2.5-flash", 128) || "gemini-2.5-flash",
    temperature: typeof config.temperature === "number" ? config.temperature : 0.7,
  };
  if (config.providerId) out.providerId = truncateString(config.providerId, 64);
  if (config.connectionId) out.connectionId = truncateString(config.connectionId, 128);
  if (typeof config.systemInstruction === "string") {
    out.systemInstruction = truncateString(config.systemInstruction, 30000);
  }
  if (typeof config.topP === "number") out.topP = config.topP;
  if (typeof config.topK === "number") out.topK = config.topK;
  if (typeof config.maxOutputTokens === "number") out.maxOutputTokens = config.maxOutputTokens;
  if (config.responseMimeType) out.responseMimeType = truncateString(config.responseMimeType, 64);
  if (typeof config.responseSchemaText === "string") {
    out.responseSchemaText = truncateString(config.responseSchemaText, 20000);
  }
  return out;
}

function sanitizeMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  return (messages || [])
    .filter((m) => !m.isStreaming)
    .slice(-200)
    .map((m, idx) => {
      const msg: Record<string, unknown> = {
        id: sanitizeFirestoreId(m.id || `msg_${idx}`, "msg"),
        role: m.role === "model" ? "model" : "user",
        text: truncateString(m.text, 50000),
        timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
      };
      if (typeof m.tokenCount === "number") msg.tokenCount = m.tokenCount;
      if (typeof m.durationMs === "number") msg.durationMs = m.durationMs;
      if (typeof m.error === "string" && m.error) msg.error = truncateString(m.error, 1000);
      if (Array.isArray(m.templateIds) && m.templateIds.length > 0) {
        msg.templateIds = m.templateIds.slice(0, 20).map((t) => truncateString(t, 128));
      }
      if (typeof m.rawUserText === "string") msg.rawUserText = truncateString(m.rawUserText, 50000);
      if (typeof m.modelName === "string") msg.modelName = truncateString(m.modelName, 128);
      if (typeof m.providerId === "string") msg.providerId = truncateString(m.providerId, 64);
      return msg;
    });
}

export interface FirestoreSyncCallbacks {
  onRemotePrompts?: (prompts: SavedPrompt[]) => void;
  onRemoteChatSessions?: (sessions: ChatSession[]) => void;
  onRemoteTemplates?: (templates: PromptTemplate[]) => void;
  onRemoteProjects?: (projects: Array<Omit<ProjectInfo, "apiKey">>) => void;
}

export interface IFirestoreSyncService {
  ensureUserDocuments(user: FirebaseUser): Promise<void>;
  syncSavedPrompt(prompt: SavedPrompt): Promise<void>;
  deleteSavedPrompt(promptId: string): Promise<void>;
  syncChatSession(session: ChatSession): Promise<void>;
  deleteChatSession(sessionId: string): Promise<void>;
  syncCustomTemplate(template: PromptTemplate): Promise<void>;
  deleteCustomTemplate(templateId: string): Promise<void>;
  syncWorkspaceProject(project: ProjectInfo): Promise<void>;
  deleteWorkspaceProject(projectId: string): Promise<void>;
  subscribeUserData(callbacks: FirestoreSyncCallbacks): () => void;
}

export class FirestoreSyncService implements IFirestoreSyncService {
  private logger: ILogger;
  private ensuredUid: string | null = null;
  private ensuringPromise: Promise<void> | null = null;

  constructor(logger: ILogger = new DefaultLoggerFactory().createLogger()) {
    this.logger = logger;
  }

  private getReadyContext(): { db: Firestore; user: FirebaseUser } | null {
    const auth = getFirebaseAuthInstance();
    const db = getFirestoreInstance();
    const user = auth?.currentUser;
    if (!db || !user || !user.emailVerified) {
      return null;
    }
    return { db, user };
  }

  public async ensureUserDocuments(user: FirebaseUser): Promise<void> {
    if (!user.emailVerified || !user.email) return;
    if (this.ensuredUid === user.uid) return;
    if (this.ensuringPromise) return this.ensuringPromise;

    const db = getFirestoreInstance();
    if (!db) return;

    this.ensuringPromise = (async () => {
      const userPath = `users/${user.uid}`;
      const privatePath = `users/${user.uid}/private/info`;

      try {
        const userRef = doc(db, "users", user.uid);
        const existingUser = await getDoc(userRef);
        const displayName = truncateString(
          user.displayName || user.email?.split("@")[0] || "User",
          120
        );
        const photoURL = user.photoURL ? truncateString(user.photoURL, 1024) : undefined;

        if (!existingUser.exists()) {
          await setDoc(userRef, {
            uid: user.uid,
            displayName,
            ...(photoURL ? { photoURL } : {}),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(userRef, {
            displayName,
            ...(photoURL ? { photoURL } : {}),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, userPath);
      }

      try {
        const privateRef = doc(db, "users", user.uid, "private", "info");
        const existingPrivate = await getDoc(privateRef);
        const email = truncateString(user.email, 254);

        if (!existingPrivate.exists()) {
          await setDoc(privateRef, {
            uid: user.uid,
            email,
            authSource: "google_oauth",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(privateRef, {
            email,
            authSource: "google_oauth",
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, privatePath);
      }

      this.ensuredUid = user.uid;
    })();

    try {
      await this.ensuringPromise;
    } finally {
      this.ensuringPromise = null;
    }
  }

  public async syncSavedPrompt(prompt: SavedPrompt): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    await this.ensureUserDocuments(ctx.user);

    const promptId = sanitizeFirestoreId(prompt.id, "prompt");
    const path = `users/${ctx.user.uid}/prompts/${promptId}`;
    const docRef = doc(ctx.db, "users", ctx.user.uid, "prompts", promptId);

    try {
      const existing = await getDoc(docRef);
      const validType = ["chat", "code", "stubs"].includes(prompt.type) ? prompt.type : "chat";
      const validProjectId =
        prompt.projectId && VALID_ID_REGEX.test(prompt.projectId)
          ? truncateString(prompt.projectId, 128)
          : undefined;

      const basePayload: Record<string, FieldValue | string | number | Record<string, unknown> | Array<Record<string, unknown>> | undefined> = {
        title: truncateString(prompt.title || "Untitled Prompt", 200) || "Untitled Prompt",
        config: sanitizePromptConfig(prompt.config),
        messages: sanitizeMessages(prompt.messages || []),
        ...(typeof prompt.freeformText === "string"
          ? { freeformText: truncateString(prompt.freeformText, 50000) }
          : {}),
        ...(validProjectId ? { projectId: validProjectId } : {}),
        clientUpdatedAt: prompt.updatedAt || Date.now(),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) {
        await setDoc(docRef, {
          id: promptId,
          ownerId: ctx.user.uid,
          type: validType,
          ...basePayload,
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, basePayload as UpdateData<DocumentData>);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteSavedPrompt(promptId: string): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const safeId = sanitizeFirestoreId(promptId, "prompt");
    const path = `users/${ctx.user.uid}/prompts/${safeId}`;
    try {
      await deleteDoc(doc(ctx.db, "users", ctx.user.uid, "prompts", safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async syncChatSession(session: ChatSession): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx || !session.messages?.length) return;
    await this.ensureUserDocuments(ctx.user);

    const sessionId = sanitizeFirestoreId(session.id, "sess");
    const path = `users/${ctx.user.uid}/chatSessions/${sessionId}`;
    const docRef = doc(ctx.db, "users", ctx.user.uid, "chatSessions", sessionId);

    try {
      const existing = await getDoc(docRef);
      const validProjectId =
        session.projectId && VALID_ID_REGEX.test(session.projectId)
          ? truncateString(session.projectId, 128)
          : undefined;

      const basePayload: Record<string, FieldValue | string | number | Record<string, unknown> | Array<Record<string, unknown>> | undefined> = {
        title: truncateString(session.title || "Conversation", 200) || "Conversation",
        messages: sanitizeMessages(session.messages),
        ...(session.model ? { model: truncateString(session.model, 128) } : {}),
        ...(validProjectId ? { projectId: validProjectId } : {}),
        clientUpdatedAt: session.updatedAt || Date.now(),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) {
        await setDoc(docRef, {
          id: sessionId,
          ownerId: ctx.user.uid,
          ...basePayload,
          clientCreatedAt: session.createdAt || Date.now(),
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, basePayload as UpdateData<DocumentData>);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteChatSession(sessionId: string): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const safeId = sanitizeFirestoreId(sessionId, "sess");
    const path = `users/${ctx.user.uid}/chatSessions/${safeId}`;
    try {
      await deleteDoc(doc(ctx.db, "users", ctx.user.uid, "chatSessions", safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async syncCustomTemplate(template: PromptTemplate): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx || template.isBuiltin) return;
    await this.ensureUserDocuments(ctx.user);

    const templateId = sanitizeFirestoreId(template.id, "tpl");
    const path = `users/${ctx.user.uid}/templates/${templateId}`;
    const docRef = doc(ctx.db, "users", ctx.user.uid, "templates", templateId);

    try {
      const existing = await getDoc(docRef);
      const validCategory = ["coding", "reasoning", "tone", "formatting", "analysis", "custom"].includes(
        template.category
      )
        ? template.category
        : "custom";

      const basePayload: Record<string, FieldValue | string | number | undefined> = {
        title: truncateString(template.title || "Template", 160) || "Template",
        ...(typeof template.description === "string"
          ? { description: truncateString(template.description, 500) }
          : {}),
        content: truncateString(template.content || " ", 20000) || " ",
        category: validCategory,
        clientUpdatedAt: template.updatedAt || Date.now(),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) {
        await setDoc(docRef, {
          id: templateId,
          ownerId: ctx.user.uid,
          ...basePayload,
          clientCreatedAt: template.createdAt || Date.now(),
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, basePayload as UpdateData<DocumentData>);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteCustomTemplate(templateId: string): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const safeId = sanitizeFirestoreId(templateId, "tpl");
    const path = `users/${ctx.user.uid}/templates/${safeId}`;
    try {
      await deleteDoc(doc(ctx.db, "users", ctx.user.uid, "templates", safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async syncWorkspaceProject(project: ProjectInfo): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    await this.ensureUserDocuments(ctx.user);

    const projectId = sanitizeFirestoreId(project.id, "proj");
    const path = `users/${ctx.user.uid}/projects/${projectId}`;
    const docRef = doc(ctx.db, "users", ctx.user.uid, "projects", projectId);

    try {
      const existing = await getDoc(docRef);
      const validStatus =
        project.status && ["active", "invalid_key", "attention_required", "revoked"].includes(project.status)
          ? project.status
          : "active";

      // Security guarantee: apiKey is intentionally omitted and NEVER written to Firestore
      const basePayload: Record<string, FieldValue | string | number | undefined> = {
        name: truncateString(project.name || "Untitled Project", 160) || "Untitled Project",
        defaultModel: truncateString(project.defaultModel || "gemini-2.5-flash", 128) || "gemini-2.5-flash",
        status: validStatus,
        clientUpdatedAt: project.updatedAt || Date.now(),
        updatedAt: serverTimestamp(),
      };

      if (!existing.exists()) {
        await setDoc(docRef, {
          id: projectId,
          ownerId: ctx.user.uid,
          ...basePayload,
          clientCreatedAt: project.createdAt || Date.now(),
          createdAt: serverTimestamp(),
        });
      } else {
        await updateDoc(docRef, basePayload as UpdateData<DocumentData>);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteWorkspaceProject(projectId: string): Promise<void> {
    const ctx = this.getReadyContext();
    if (!ctx) return;
    const safeId = sanitizeFirestoreId(projectId, "proj");
    const path = `users/${ctx.user.uid}/projects/${safeId}`;
    try {
      await deleteDoc(doc(ctx.db, "users", ctx.user.uid, "projects", safeId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public subscribeUserData(callbacks: FirestoreSyncCallbacks): () => void {
    const auth = getFirebaseAuthInstance();
    const db = getFirestoreInstance();
    if (!auth || !db) return () => {};

    let activeUnsubs: Unsubscribe[] = [];

    const clearSnapshots = () => {
      for (const unsub of activeUnsubs) {
        try {
          unsub();
        } catch {
          // ignore cleanup failure
        }
      }
      activeUnsubs = [];
    };

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      clearSnapshots();
      if (!firebaseUser) {
        this.ensuredUid = null;
        return;
      }

      if (!firebaseUser.emailVerified) {
        this.logger.warn("Firestore sync skipped: user email is not verified.");
        return;
      }

      try {
        await this.ensureUserDocuments(firebaseUser);
      } catch (err) {
        this.logger.warn("Failed ensuring user documents in Firestore:", err);
        return;
      }

      const uid = firebaseUser.uid;

      if (callbacks.onRemotePrompts) {
        const promptsPath = `users/${uid}/prompts`;
        const q = query(collection(db, "users", uid, "prompts"), where("ownerId", "==", uid));
        activeUnsubs.push(
          onSnapshot(
            q,
            (snapshot) => {
              const items = snapshot.docs.map((d) => {
                const raw = d.data() as Record<string, unknown>;
                return {
                  id: String(raw.id || d.id),
                  title: String(raw.title || "Untitled Prompt"),
                  type: (raw.type as SavedPrompt["type"]) || "chat",
                  config: raw.config as PromptConfig,
                  messages: (raw.messages as ChatMessage[]) || [],
                  freeformText: typeof raw.freeformText === "string" ? raw.freeformText : undefined,
                  projectId: typeof raw.projectId === "string" ? raw.projectId : undefined,
                  updatedAt: Number(raw.clientUpdatedAt || Date.now()),
                };
              });
              callbacks.onRemotePrompts?.(items);
            },
            (error) => {
              handleFirestoreError(error, OperationType.LIST, promptsPath);
            }
          )
        );
      }

      if (callbacks.onRemoteChatSessions) {
        const sessionsPath = `users/${uid}/chatSessions`;
        const q = query(collection(db, "users", uid, "chatSessions"), where("ownerId", "==", uid));
        activeUnsubs.push(
          onSnapshot(
            q,
            (snapshot) => {
              const items = snapshot.docs.map((d) => {
                const raw = d.data() as Record<string, unknown>;
                return {
                  id: String(raw.id || d.id),
                  title: String(raw.title || "Conversation"),
                  messages: (raw.messages as ChatMessage[]) || [],
                  model: typeof raw.model === "string" ? raw.model : undefined,
                  projectId: typeof raw.projectId === "string" ? raw.projectId : undefined,
                  createdAt: Number(raw.clientCreatedAt || Date.now()),
                  updatedAt: Number(raw.clientUpdatedAt || Date.now()),
                };
              });
              callbacks.onRemoteChatSessions?.(items);
            },
            (error) => {
              handleFirestoreError(error, OperationType.LIST, sessionsPath);
            }
          )
        );
      }

      if (callbacks.onRemoteTemplates) {
        const templatesPath = `users/${uid}/templates`;
        const q = query(collection(db, "users", uid, "templates"), where("ownerId", "==", uid));
        activeUnsubs.push(
          onSnapshot(
            q,
            (snapshot) => {
              const items = snapshot.docs.map((d) => {
                const raw = d.data() as Record<string, unknown>;
                return {
                  id: String(raw.id || d.id),
                  title: String(raw.title || "Template"),
                  description: typeof raw.description === "string" ? raw.description : undefined,
                  content: String(raw.content || ""),
                  category: (raw.category as PromptTemplate["category"]) || "custom",
                  isBuiltin: false,
                  createdAt: Number(raw.clientCreatedAt || Date.now()),
                  updatedAt: Number(raw.clientUpdatedAt || Date.now()),
                };
              });
              callbacks.onRemoteTemplates?.(items);
            },
            (error) => {
              handleFirestoreError(error, OperationType.LIST, templatesPath);
            }
          )
        );
      }

      if (callbacks.onRemoteProjects) {
        const projectsPath = `users/${uid}/projects`;
        const q = query(collection(db, "users", uid, "projects"), where("ownerId", "==", uid));
        activeUnsubs.push(
          onSnapshot(
            q,
            (snapshot) => {
              const items = snapshot.docs.map((d) => {
                const raw = d.data() as Record<string, unknown>;
                return {
                  id: String(raw.id || d.id),
                  name: String(raw.name || "Project"),
                  defaultModel: String(raw.defaultModel || "gemini-2.5-flash"),
                  status: (raw.status as ProjectInfo["status"]) || "active",
                  createdAt: Number(raw.clientCreatedAt || Date.now()),
                  updatedAt: Number(raw.clientUpdatedAt || Date.now()),
                };
              });
              callbacks.onRemoteProjects?.(items);
            },
            (error) => {
              handleFirestoreError(error, OperationType.LIST, projectsPath);
            }
          )
        );
      }
    });

    return () => {
      clearSnapshots();
      unsubAuth();
    };
  }
}

export const firestoreSyncService = new FirestoreSyncService();
