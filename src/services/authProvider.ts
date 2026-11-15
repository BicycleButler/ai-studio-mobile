import { GoogleUser } from "../types";

export interface AuthSignInResult {
  user: Partial<GoogleUser>;
  accessToken: string;
  idToken?: string;
}

export interface IAuthProvider {
  signIn(): Promise<AuthSignInResult>;
  signInWithScopes?(scopes: string[]): Promise<AuthSignInResult>;
  signOut(): Promise<void>;
  getIdToken?(): Promise<string | null>;
  onAuthStateChanged(
    callback: (user: Partial<GoogleUser> | null, accessToken: string | null) => void
  ): () => void;
}
