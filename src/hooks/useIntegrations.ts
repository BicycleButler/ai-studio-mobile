import { useState, useEffect, useCallback, useMemo } from "react";
import {
  IntegrationAuthMethod,
  IntegrationConnection,
  IntegrationCredentialsPayload,
  IntegrationProviderId,
} from "../types/integrations";
import { useServices } from "../services/ServiceContext";
import { OAuthProviderAvailability } from "../services/integrationService";
import { getIntegrationDefinition } from "../utils/integrationCatalog";
import { getErrorMessage } from "../utils/errorHandling";

export interface ConnectIntegrationInput {
  id?: string;
  providerId: IntegrationProviderId;
  name: string;
  authMethod: IntegrationAuthMethod;
  token?: string;
  serviceAccountJson?: string;
  projectId?: string;
  databaseId?: string;
  region?: string;
  bucket?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  teamId?: string;
  accountLabel?: string;
  skipVerification?: boolean;
}

const GOOGLE_INTEGRATION_SCOPES: Record<"firebase" | "gcp", string[]> = {
  firebase: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/datastore",
    "https://www.googleapis.com/auth/firebase",
  ],
  gcp: ["https://www.googleapis.com/auth/cloud-platform"],
};

export function useIntegrations() {
  const {
    integrationConnectionService,
    integrationApiService,
    googleAuthService,
    timeProvider,
  } = useServices();

  const [connections, setConnections] = useState<IntegrationConnection[]>(() =>
    integrationConnectionService.loadConnections()
  );
  const [serverOAuthAvailability, setServerOAuthAvailability] = useState<OAuthProviderAvailability>({
    firebase: false,
    gcp: false,
    github: false,
    vercel: false,
  });
  const [isVerifying, setIsVerifying] = useState(false);

  const supportsFirebaseGooglePopup = Boolean(googleAuthService?.supportsScopedSignIn?.());

  const oauthAvailability = useMemo<OAuthProviderAvailability>(
    () => ({
      firebase: supportsFirebaseGooglePopup || serverOAuthAvailability.firebase,
      gcp: supportsFirebaseGooglePopup || serverOAuthAvailability.gcp,
      github: serverOAuthAvailability.github,
      vercel: serverOAuthAvailability.vercel,
    }),
    [serverOAuthAvailability, supportsFirebaseGooglePopup]
  );

  useEffect(() => {
    const unsub = integrationConnectionService.connectionsObservable.subscribe((list) => {
      setConnections(list);
    });
    void integrationApiService
      .getOAuthAvailability()
      .then((avail) => setServerOAuthAvailability(avail))
      .catch(() => {
        // Keep defaults if server unreachable
      });

    return () => {
      unsub();
    };
  }, [integrationConnectionService, integrationApiService]);

  const enabledConnections = useMemo(
    () => connections.filter((c) => c.enabled),
    [connections]
  );

  const getCredentials = useCallback(
    (conn: IntegrationConnection): IntegrationCredentialsPayload =>
      integrationConnectionService.toCredentialsPayload(conn),
    [integrationConnectionService]
  );

  const verifyAndSaveConnection = useCallback(
    async (
      input: ConnectIntegrationInput
    ): Promise<{ connection: IntegrationConnection; valid: boolean; error?: string }> => {
      setIsVerifying(true);
      const def = getIntegrationDefinition(input.providerId);
      const credentials: IntegrationCredentialsPayload = {
        providerId: input.providerId,
        authMethod: input.authMethod,
        token: input.token?.trim() || undefined,
        serviceAccountJson: input.serviceAccountJson?.trim() || undefined,
        projectId: input.projectId?.trim() || undefined,
        databaseId: input.databaseId?.trim() || undefined,
        teamId: input.teamId?.trim() || undefined,
      };

      try {
        let valid = true;
        let resolvedProjectId = input.projectId?.trim() || "";
        let resolvedAccountLabel = input.accountLabel?.trim() || "";
        let statusMessage = "Connected";

        if (!input.skipVerification) {
          try {
            const check = await integrationApiService.verifyConnection(credentials);
            valid = Boolean(check.valid);
            if (!valid) {
              return {
                connection: {
                  id: input.id || "",
                  providerId: input.providerId,
                  name: input.name || def?.name || input.providerId,
                  authMethod: input.authMethod,
                  enabled: false,
                  status: "error",
                  statusMessage: check.error || "Verification failed.",
                  createdAt: timeProvider.now(),
                  updatedAt: timeProvider.now(),
                },
                valid: false,
                error: check.error || "Verification failed.",
              };
            }
            if (check.projectId) resolvedProjectId = check.projectId;
            if (check.accountLabel) resolvedAccountLabel = check.accountLabel;
            statusMessage = check.details || check.accountLabel || "Verified";
          } catch (err) {
            const msg = getErrorMessage(err) || "Verification failed.";
            return {
              connection: {
                id: input.id || "",
                providerId: input.providerId,
                name: input.name || def?.name || input.providerId,
                authMethod: input.authMethod,
                enabled: false,
                status: "error",
                statusMessage: msg,
                createdAt: timeProvider.now(),
                updatedAt: timeProvider.now(),
              },
              valid: false,
              error: msg,
            };
          }
        } else {
          statusMessage = "Saved (unverified)";
        }

        const existing = input.id ? integrationConnectionService.getConnectionById(input.id) : undefined;
        const resolvedName =
          input.name?.trim() ||
          existing?.name ||
          (resolvedAccountLabel ? `${def?.shortName || input.providerId} (${resolvedAccountLabel})` : def?.name || input.providerId);

        const saved = integrationConnectionService.upsertConnection({
          id: input.id,
          providerId: input.providerId,
          name: resolvedName,
          authMethod: input.authMethod,
          token: input.token?.trim() || "",
          serviceAccountJson: input.serviceAccountJson?.trim() || "",
          projectId: resolvedProjectId,
          databaseId: input.databaseId?.trim() || (input.providerId === "firebase" ? existing?.databaseId || "(default)" : ""),
          region: input.region?.trim() || existing?.region || "",
          bucket: input.bucket?.trim() || existing?.bucket || "",
          owner: input.owner?.trim() || existing?.owner || "",
          repo: input.repo?.trim() || existing?.repo || "",
          branch: input.branch?.trim() || existing?.branch || "",
          teamId: input.teamId?.trim() ?? existing?.teamId ?? "",
          accountLabel: resolvedAccountLabel,
          enabled: true,
          status: input.skipVerification ? "unverified" : "connected",
          statusMessage,
          lastVerifiedAt: timeProvider.now(),
        });

        return { connection: saved, valid: true };
      } finally {
        setIsVerifying(false);
      }
    },
    [integrationApiService, integrationConnectionService, timeProvider]
  );

  const refreshConnection = useCallback(
    async (id: string): Promise<{ valid: boolean; error?: string }> => {
      const conn = integrationConnectionService.getConnectionById(id);
      if (!conn) return { valid: false, error: "Connection not found" };
      setIsVerifying(true);
      try {
        const res = await integrationApiService.verifyConnection(
          integrationConnectionService.toCredentialsPayload(conn)
        );
        integrationConnectionService.upsertConnection({
          ...conn,
          projectId: res.projectId || conn.projectId,
          accountLabel: res.accountLabel || conn.accountLabel,
          status: res.valid ? "connected" : "error",
          statusMessage: res.valid ? res.details || res.accountLabel || "Verified" : res.error || "Verification failed",
          lastVerifiedAt: timeProvider.now(),
        });
        return { valid: Boolean(res.valid), error: res.error };
      } catch (err) {
        const msg = getErrorMessage(err) || "Verification failed";
        integrationConnectionService.upsertConnection({
          ...conn,
          status: "error",
          statusMessage: msg,
          lastVerifiedAt: timeProvider.now(),
        });
        return { valid: false, error: msg };
      } finally {
        setIsVerifying(false);
      }
    },
    [integrationApiService, integrationConnectionService, timeProvider]
  );

  const connectWithOAuth = useCallback(
    async (providerId: IntegrationProviderId) => {
      if ((providerId === "firebase" || providerId === "gcp") && googleAuthService?.supportsScopedSignIn?.() && googleAuthService.signInWithScopes) {
        const scopes = GOOGLE_INTEGRATION_SCOPES[providerId];
        const result = await googleAuthService.signInWithScopes(scopes);
        return {
          providerId,
          token: result.accessToken,
          accountLabel: result.user.email || result.user.name,
        };
      }
      return integrationApiService.openOAuthPopup(providerId);
    },
    [googleAuthService, integrationApiService]
  );

  const connectWithOAuthAndSave = useCallback(
    async (
      providerId: IntegrationProviderId,
      existingConnectionId?: string
    ): Promise<{ connection: IntegrationConnection; valid: boolean; error?: string }> => {
      const def = getIntegrationDefinition(providerId);
      const oauthResult = await connectWithOAuth(providerId);
      const existing = existingConnectionId
        ? integrationConnectionService.getConnectionById(existingConnectionId)
        : undefined;

      const label = oauthResult.accountLabel;
      const defaultName =
        existing?.name ||
        (label ? `${def?.shortName || providerId} (${label})` : def?.name || providerId);

      return verifyAndSaveConnection({
        id: existingConnectionId,
        providerId,
        name: defaultName,
        authMethod: "oauth",
        token: oauthResult.token,
        accountLabel: label,
        projectId: existing?.projectId,
        databaseId: existing?.databaseId,
        teamId: existing?.teamId,
      });
    },
    [connectWithOAuth, integrationConnectionService, verifyAndSaveConnection]
  );

  const updateConnectionDetails = useCallback(
    (id: string, patch: Partial<Pick<IntegrationConnection, "projectId" | "databaseId" | "teamId" | "bucket" | "name">>) => {
      const conn = integrationConnectionService.getConnectionById(id);
      if (!conn) return null;
      return integrationConnectionService.upsertConnection({
        ...conn,
        ...patch,
      });
    },
    [integrationConnectionService]
  );

  const toggleConnection = useCallback(
    (id: string, enabled?: boolean) => {
      integrationConnectionService.toggleConnectionEnabled(id, enabled);
    },
    [integrationConnectionService]
  );

  const deleteConnection = useCallback(
    (id: string) => {
      integrationConnectionService.deleteConnection(id);
    },
    [integrationConnectionService]
  );

  return {
    connections,
    enabledConnections,
    oauthAvailability,
    isVerifying,
    verifyAndSaveConnection,
    refreshConnection,
    connectWithOAuth,
    connectWithOAuthAndSave,
    updateConnectionDetails,
    toggleConnection,
    deleteConnection,
    getCredentials,
    integrationApiService,
  };
}
