import { IPlatformService } from "./IPlatformService";
import { AuthSignInResult, IAuthProvider } from "./authProvider";
import { GoogleUser } from "../types";
import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
import { getFirebaseAuthInstance } from "./firebase";
import { ILogger, DefaultLoggerFactory } from "../utils/logger";
import { BrowserPlatformService } from "../services/platformService";


export class FirebaseAuthProvider implements IAuthProvider {
  private firebaseAuthInstance: Auth | null = null;
  private googleAuthProviderInstance: GoogleAuthProvider | null = null;
  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(
    logger: ILogger = new DefaultLoggerFactory().createLogger(),
    platformService: IPlatformService = new BrowserPlatformService()
  ) {
    this.logger = logger;
    this.platformService = platformService;
  }

  public getFirebaseAuth(): Auth | null {
    if (this.firebaseAuthInstance) return this.firebaseAuthInstance;

    try {
      if (!this.platformService.isBrowserEnv()) {
        return null;
      }

      this.firebaseAuthInstance = getFirebaseAuthInstance();
      return this.firebaseAuthInstance;
    } catch (err: unknown) {
      this.logger.error("Failed to initialize Firebase Auth:", err);
      return null;
    }
  }

  public getGoogleAuthProvider(): GoogleAuthProvider {
    if (!this.googleAuthProviderInstance) {
      this.googleAuthProviderInstance = new GoogleAuthProvider();
      this.googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.email");
      this.googleAuthProviderInstance.addScope("https://www.googleapis.com/auth/userinfo.profile");
      this.googleAuthProviderInstance.setCustomParameters({
        prompt: "select_account",
      });
    }
    return this.googleAuthProviderInstance;
  }

  async signIn(): Promise<AuthSignInResult> {
    return this.signInWithProvider(this.getGoogleAuthProvider());
  }

  async signInWithScopes(scopes: string[]): Promise<AuthSignInResult> {
    const provider = new GoogleAuthProvider();
    provider.addScope("https://www.googleapis.com/auth/userinfo.email");
    provider.addScope("https://www.googleapis.com/auth/userinfo.profile");
    for (const scope of scopes) {
      const clean = scope.trim();
      if (clean) provider.addScope(clean);
    }
    provider.setCustomParameters({
      prompt: "select_account consent",
    });
    return this.signInWithProvider(provider);
  }

  private async signInWithProvider(provider: GoogleAuthProvider): Promise<AuthSignInResult> {
    const auth = this.getFirebaseAuth();
    if (!auth) {
      throw new Error("Google authentication is not available in this environment.");
    }

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      const accessToken = credential?.accessToken || "";
      let idToken: string | undefined;
      try {
        idToken = await result.user.getIdToken();
      } catch {
        idToken = credential?.idToken || undefined;
      }

      const email = result.user.email;
      if (!email) {
        throw new Error("No verified email address found on the Google account.");
      }

      const name = result.user.displayName || email.split("@")[0];
      const picture = result.user.photoURL || undefined;
      const sub = result.user.uid;

      return {
        user: { email, name, picture, sub },
        accessToken,
        idToken,
      };
    } catch (error: unknown) {
      const errObj = error as { code?: string; message?: string };
      if (
        errObj?.code === "auth/popup-closed-by-user" ||
        errObj?.code === "auth/cancelled-popup-request"
      ) {
        throw new Error("Sign-in popup was closed before completing authentication.");
      }
      if (errObj?.code === "auth/popup-blocked") {
        throw new Error("Sign-in popup was blocked by the browser. Please allow popups for this site and try again.");
      }
      this.logger.error("Google sign in error:", error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  async getIdToken(): Promise<string | null> {
    const auth = this.getFirebaseAuth();
    if (!auth?.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    const auth = this.getFirebaseAuth();
    if (auth) {
      await firebaseSignOut(auth);
    }
  }

  onAuthStateChanged(
    callback: (user: Partial<GoogleUser> | null, accessToken: string | null) => void
  ): () => void {
    const auth = this.getFirebaseAuth();
    if (!auth) return () => {};

    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser && firebaseUser.email) {
        const email = firebaseUser.email;
        const name = firebaseUser.displayName || email.split("@")[0];
        const picture = firebaseUser.photoURL || undefined;
        const sub = firebaseUser.uid;

        // Since we cannot get the accessToken directly from onAuthStateChanged reliably without re-authenticating
        // We will just pass null or retrieve it if possible (Firebase handles token internally).
        callback({ email, name, picture, sub }, null);
      } else {
        callback(null, null);
      }
    });
  }
}
