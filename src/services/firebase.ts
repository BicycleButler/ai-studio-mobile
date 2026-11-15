import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore, doc, getDocFromServer } from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const isTestEnv =
  typeof import.meta !== "undefined" &&
  Boolean((import.meta as unknown as { env?: { VITEST?: unknown } }).env?.VITEST);

const isBrowser = typeof window !== "undefined";

let firebaseAppInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let firebaseAuthInstance: Auth | null = null;

function ensureFirebaseApp(): FirebaseApp {
  if (!firebaseAppInstance) {
    firebaseAppInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  }
  return firebaseAppInstance;
}

export const app: FirebaseApp | null = isBrowser && !isTestEnv ? ensureFirebaseApp() : null;
export const db: Firestore | null = app
  ? (firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId))
  : null;
export const auth: Auth | null = app ? (firebaseAuthInstance = getAuth(app)) : null;

export function getFirebaseAuthInstance(): Auth | null {
  if (!isBrowser || isTestEnv) return null;
  if (firebaseAuthInstance) return firebaseAuthInstance;
  const appInst = ensureFirebaseApp();
  firebaseAuthInstance = getAuth(appInst);
  return firebaseAuthInstance;
}

export function getFirestoreInstance(): Firestore | null {
  if (!isBrowser || isTestEnv) return null;
  if (firestoreInstance) return firestoreInstance;
  const appInst = ensureFirebaseApp();
  firestoreInstance = getFirestore(appInst, firebaseConfig.firestoreDatabaseId);
  return firestoreInstance;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = getFirebaseAuthInstance()?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (connectionTested || !isBrowser || isTestEnv) return;
  connectionTested = true;
  const database = getFirestoreInstance();
  if (!database) return;

  try {
    await getDocFromServer(doc(database, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

if (isBrowser && !isTestEnv) {
  void testConnection();
}
