import React, { useState, useEffect, useCallback } from "react";
import {
  Rocket,
  RefreshCw,
  Eye,
  Trash2,
  Plus,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import {
  IntegrationConnection,
  IntegrationCredentialsPayload,
  VercelDeploymentSummary,
  VercelEnvVarSummary,
  VercelProjectSummary,
  VercelTeamSummary,
} from "../../types/integrations";
import { IIntegrationApiService } from "../../services/integrationService";
import { getErrorMessage } from "../../utils/errorHandling";

export interface VercelExplorerPanelProps {
  connection: IntegrationConnection;
  credentials: IntegrationCredentialsPayload;
  apiService: IIntegrationApiService;
  activeIdeFile?: { path: string; name: string; content: string } | null;
  openedWorkspaceFiles?: Array<{ path: string; name: string; content: string }>;
  onSelectTeamId?: (teamId: string) => void;
}

type EnvTarget = "production" | "preview" | "development";

export const VercelExplorerPanel: React.FC<VercelExplorerPanelProps> = ({
  connection,
  credentials,
  apiService,
  activeIdeFile = null,
  openedWorkspaceFiles = [],
  onSelectTeamId,
}) => {
  const [teams, setTeams] = useState<VercelTeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState(credentials.teamId || connection.teamId || "");
  const [projects, setProjects] = useState<VercelProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(connection.projectId || "");
  const [subMode, setSubMode] = useState<"deployments" | "env" | "deploy">("deployments");

  const [deployments, setDeployments] = useState<VercelDeploymentSummary[]>([]);
  const [envs, setEnvs] = useState<VercelEnvVarSummary[]>([]);
  const [revealedEnv, setRevealedEnv] = useState<{ id: string; key: string; value: string } | null>(null);
  const [confirmDeleteEnvId, setConfirmDeleteEnvId] = useState<string | null>(null);

  // Env upsert state
  const [envKey, setEnvKey] = useState("");
  const [envValue, setEnvValue] = useState("");
  const [envTargets, setEnvTargets] = useState<EnvTarget[]>(["production", "preview", "development"]);
  const [envType, setEnvType] = useState<"encrypted" | "plain" | "sensitive">("encrypted");

  // Direct deploy state
  const [deployName, setDeployName] = useState("");
  const [deployTarget, setDeployTarget] = useState<"preview" | "production">("preview");
  const [deployFilePath, setDeployFilePath] = useState("index.html");
  const [deployFileContent, setDeployFileContent] = useState(
    "<!doctype html>\n<html>\n  <head><meta charset='utf-8'><title>Vercel Deployment</title></head>\n  <body><h1>Deployed from Mobile IDE</h1></body>\n</html>"
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const scopedCreds = useCallback(
    (teamOverride?: string): IntegrationCredentialsPayload => ({
      ...credentials,
      teamId: (teamOverride ?? selectedTeamId).trim() || undefined,
    }),
    [credentials, selectedTeamId]
  );

  const loadProjects = useCallback(
    async (teamOverride?: string) => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const creds = scopedCreds(teamOverride);
        const [teamsRes, projRes] = await Promise.allSettled([
          apiService.listVercelTeams(creds),
          apiService.listVercelProjects(creds),
        ]);
        if (teamsRes.status === "fulfilled") {
          setTeams(teamsRes.value.teams || []);
        }
        if (projRes.status === "fulfilled") {
          setProjects(projRes.value.projects || []);
          if (projRes.value.projects.length > 0) {
            setSelectedProjectId((prev) =>
              projRes.value.projects.some((p) => p.id === prev) ? prev : projRes.value.projects[0].id
            );
            setDeployName((prev) => prev || projRes.value.projects[0].name);
          } else {
            setSelectedProjectId("");
          }
        } else {
          throw projRes.reason;
        }
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [apiService, scopedCreds]
  );

  const loadProjectDetails = useCallback(
    async (projectId: string) => {
      if (!projectId) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const creds = scopedCreds();
        if (subMode === "deployments") {
          const res = await apiService.listVercelDeployments(creds, projectId);
          setDeployments(res.deployments || []);
        } else if (subMode === "env") {
          const res = await apiService.listVercelEnvVars(creds, projectId);
          setEnvs(res.envs || []);
        }
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [apiService, scopedCreds, subMode]
  );

  useEffect(() => {
    setSelectedTeamId(credentials.teamId || connection.teamId || "");
    setProjects([]);
    setDeployments([]);
    setEnvs([]);
    setErrorMsg(null);
    setFeedbackMsg(null);
    void loadProjects(credentials.teamId || connection.teamId || "");
  }, [connection.id]);

  useEffect(() => {
    if (selectedProjectId && (subMode === "deployments" || subMode === "env")) {
      void loadProjectDetails(selectedProjectId);
    }
    const proj = projects.find((p) => p.id === selectedProjectId);
    if (proj && !deployName) {
      setDeployName(proj.name);
    }
  }, [selectedProjectId, subMode]);

  const handleToggleTarget = (t: EnvTarget) => {
    setEnvTargets((prev) => {
      if (prev.includes(t)) {
        return prev.length > 1 ? prev.filter((item) => item !== t) : prev;
      }
      return [...prev, t];
    });
  };

  const handleUpsertEnv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !envKey.trim()) {
      setErrorMsg("Select a project and enter an environment variable key.");
      return;
    }
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await apiService.upsertVercelEnvVar(scopedCreds(), {
        projectId: selectedProjectId,
        key: envKey.trim(),
        value: envValue,
        target: envTargets,
        type: envType,
      });
      setFeedbackMsg(`Saved environment variable '${envKey.trim()}'`);
      setEnvKey("");
      setEnvValue("");
      await loadProjectDetails(selectedProjectId);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleRevealEnv = async (env: VercelEnvVarSummary) => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.readVercelEnvVar(scopedCreds(), selectedProjectId, env.id);
      setRevealedEnv({
        id: env.id,
        key: res.env.key,
        value: res.env.value ?? "Encrypted / write-only value",
      });
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteEnv = async (envId: string) => {
    if (!selectedProjectId) return;
    setIsWriting(true);
    setErrorMsg(null);
    try {
      await apiService.deleteVercelEnvVar(scopedCreds(), selectedProjectId, envId);
      setEnvs((prev) => prev.filter((e) => e.id !== envId));
      setConfirmDeleteEnvId(null);
      setFeedbackMsg("Deleted environment variable");
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeploy = async (useOpenWorkspaceFiles: boolean) => {
    const projectObj = projects.find((p) => p.id === selectedProjectId);
    const resolvedName = (deployName.trim() || projectObj?.name || "ai-studio-preview").toLowerCase();
    const files =
      useOpenWorkspaceFiles && openedWorkspaceFiles.length > 0
        ? openedWorkspaceFiles.map((f) => ({ file: f.path.replace(/^\/+/, ""), data: f.content }))
        : [{ file: deployFilePath.trim() || "index.html", data: deployFileContent }];

    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await apiService.deployToVercel(scopedCreds(), {
        projectId: selectedProjectId || undefined,
        name: resolvedName,
        target: deployTarget,
        files,
      });
      const displayUrl = res.deployment.url.startsWith("http")
        ? res.deployment.url
        : `https://${res.deployment.url}`;
      setFeedbackMsg(`Triggered ${deployTarget} deployment: ${displayUrl} (${res.deployment.state})`);
      setSubMode("deployments");
      if (selectedProjectId) {
        await loadProjectDetails(selectedProjectId);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Scope (Team), Project & Sub-View Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div className="space-y-2">
          {teams.length > 0 && (
            <div className="space-y-1">
              <label htmlFor="vercel-team-select" className="text-xs font-medium text-foreground block">
                Account / Team
              </label>
              <select
                id="vercel-team-select"
                value={selectedTeamId}
                onChange={(e) => {
                  const nextTeam = e.target.value;
                  setSelectedTeamId(nextTeam);
                  onSelectTeamId?.(nextTeam);
                  void loadProjects(nextTeam);
                }}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Personal Account</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    Team: {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="vercel-proj-select" className="text-xs font-medium text-foreground block">
                Vercel Project
              </label>
              <button
                type="button"
                onClick={() => void loadProjects()}
                disabled={isLoading}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                <span>Reload</span>
              </button>
            </div>
            <select
              id="vercel-proj-select"
              value={selectedProjectId}
              onChange={(e) => {
                setSelectedProjectId(e.target.value);
                const found = projects.find((p) => p.id === e.target.value);
                if (found) setDeployName(found.name);
              }}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              {projects.length === 0 && <option value="">Select Vercel project...</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.framework || "static"})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl justify-self-start sm:justify-self-end">
          <button
            type="button"
            onClick={() => setSubMode("deployments")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "deployments" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deployments
          </button>
          <button
            type="button"
            onClick={() => setSubMode("env")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "env" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Env Vars
          </button>
          <button
            type="button"
            onClick={() => setSubMode("deploy")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "deploy" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deploy
          </button>
        </div>
      </div>

      {/* Deployments List */}
      {subMode === "deployments" && (
        <div className="space-y-2">
          {deployments.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-60 overflow-y-auto">
              {deployments.map((d) => (
                <div key={d.uid} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-foreground block truncate">{d.url}</span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {d.state} · {d.target || "preview"}
                      {d.createdAt ? ` · ${new Date(d.createdAt).toLocaleString()}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {d.url && (
                      <a
                        href={d.url.startsWith("http") ? d.url : `https://${d.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium flex items-center gap-1"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/30">
              {isLoading ? "Loading deployments..." : "No recent deployments found for this project."}
            </p>
          )}
        </div>
      )}

      {/* Environment Variables */}
      {subMode === "env" && (
        <div className="space-y-4">
          {envs.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-56 overflow-y-auto">
              {envs.map((env) => {
                const isConfirming = confirmDeleteEnvId === env.id;
                return (
                  <div key={env.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-mono font-semibold text-foreground block truncate">
                        {env.key}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {env.type} · {env.target.join(", ") || "all"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleRevealEnv(env)}
                        aria-label={`Read ${env.key}`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteEnv(env.id)}
                            className="px-2 py-1 rounded-lg bg-muted border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors text-[11px] font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteEnvId(null)}
                            className="px-2 py-1 rounded-lg bg-muted text-foreground text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteEnvId(env.id)}
                          aria-label={`Delete ${env.key}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No environment variables listed for this project.</p>
          )}

          {revealedEnv && (
            <div className="p-3 rounded-xl bg-muted/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-foreground">{revealedEnv.key}</span>
                <button
                  type="button"
                  onClick={() => setRevealedEnv(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Hide
                </button>
              </div>
              <pre className="text-xs font-mono text-foreground bg-background p-2.5 rounded-lg overflow-x-auto select-all">
                {revealedEnv.value}
              </pre>
            </div>
          )}

          {/* Add / Update Env Var */}
          <form onSubmit={(e) => void handleUpsertEnv(e)} className="p-3.5 rounded-xl bg-muted/30 space-y-3">
            <span className="text-xs font-semibold text-foreground block">Add or Update Environment Variable</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="vercel-env-key" className="text-xs font-medium text-foreground block">
                  Variable Name
                </label>
                <input
                  id="vercel-env-key"
                  type="text"
                  value={envKey}
                  onChange={(e) => setEnvKey(e.target.value)}
                  placeholder="NEXT_PUBLIC_API_URL"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="vercel-env-val" className="text-xs font-medium text-foreground block">
                  Value
                </label>
                <input
                  id="vercel-env-val"
                  type="password"
                  value={envValue}
                  onChange={(e) => setEnvValue(e.target.value)}
                  placeholder="Enter value..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {(["production", "preview", "development"] as EnvTarget[]).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer capitalize">
                    <input
                      type="checkbox"
                      checked={envTargets.includes(t)}
                      onChange={() => handleToggleTarget(t)}
                      className="rounded text-primary focus:ring-primary cursor-pointer"
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
              <select
                aria-label="Env variable security type"
                value={envType}
                onChange={(e) => setEnvType(e.target.value as "encrypted" | "plain" | "sensitive")}
                className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="encrypted">Encrypted</option>
                <option value="sensitive">Sensitive</option>
                <option value="plain">Plain</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isWriting || !selectedProjectId || !envKey.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Upsert Env Variable</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Trigger Deployment */}
      {subMode === "deploy" && (
        <div className="p-3.5 rounded-xl bg-muted/30 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">Create Live Vercel Deployment</span>
            {activeIdeFile && (
              <button
                type="button"
                onClick={() => {
                  setDeployFilePath(activeIdeFile.path.replace(/^\/+/, ""));
                  setDeployFileContent(activeIdeFile.content);
                }}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Load Active IDE File ({activeIdeFile.name})</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="vercel-deploy-name" className="text-xs font-medium text-foreground block">
                Deployment Project Name
              </label>
              <input
                id="vercel-deploy-name"
                type="text"
                value={deployName}
                onChange={(e) => setDeployName(e.target.value)}
                placeholder="my-vercel-app"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="vercel-deploy-target" className="text-xs font-medium text-foreground block">
                Environment Target
              </label>
              <select
                id="vercel-deploy-target"
                value={deployTarget}
                onChange={(e) => setDeployTarget(e.target.value as "preview" | "production")}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
              >
                <option value="preview">Preview</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="vercel-deploy-path" className="text-xs font-medium text-foreground block">
              Single File Path (or deploy all open IDE files below)
            </label>
            <input
              id="vercel-deploy-path"
              type="text"
              value={deployFilePath}
              onChange={(e) => setDeployFilePath(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="vercel-deploy-content" className="text-xs font-medium text-foreground block">
              File Payload
            </label>
            <textarea
              id="vercel-deploy-content"
              rows={5}
              value={deployFileContent}
              onChange={(e) => setDeployFileContent(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-y"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {openedWorkspaceFiles.length > 0 && (
              <button
                type="button"
                disabled={isWriting}
                onClick={() => void handleDeploy(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Deploy All Open IDE Files ({openedWorkspaceFiles.length})</span>
              </button>
            )}
            <button
              type="button"
              disabled={isWriting}
              onClick={() => void handleDeploy(false)}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
              <span>Deploy File to Vercel</span>
            </button>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-muted/50 text-foreground text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span className="break-all">{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
