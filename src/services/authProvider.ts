import { GoogleUser } from "../types";

export interface AuthSignInResult {
  user: Partial<GoogleUser>;
  accessToken: string;
}

export interface IAuthProvider {
  signIn(): Promise<AuthSignInResult>;
  signOut(): Promise<void>;
  onAuthStateChanged(
    callback: (user: Partial<GoogleUser> | null, accessToken: string | null) => void
  ): () => void;
}
