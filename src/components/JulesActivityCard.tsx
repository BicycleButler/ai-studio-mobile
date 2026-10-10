import React, { useState } from "react";
import {
  Bot,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  FileCode,
  GitPullRequest,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  RefreshCw,
  Layers,
} from "lucide-react";
import { JulesActivity } from "../types";

interface JulesActivityCardProps {
  activity: JulesActivity;
  onApprovePlan?: (taskId: string) => void;
  onRejectPlan?: (taskId: string) => void;
  isApproving?: boolean;
}

export const JulesActivityCard: React.FC<JulesActivityCardProps> = ({
  activity,
  onApprovePlan,
  onRejectPlan,
  isApproving = false,
}) => {
  const [isStepsOpen, setIsStepsOpen] = useState(true);
  const [isDiffOpen, setIsDiffOpen] = useState(false);

  const getStatusBadge = () => {
    switch (activity.status) {
      case "planning":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin text-primary" />
            <span>Analyzing Repository & Planning</span>
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-primary" />
            <span>Plan Ready — Review Requested</span>
          </span>
        );
      case "executing":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1.5">
            <PlayCircle className="w-3 h-3 animate-spin text-primary" />
            <span>Autonomous Coding in Progress</span>
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-primary" />
            <span>Task Completed & PR Ready</span>
          </span>
        );
      case "failed":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3 text-muted-foreground" />
            <span>Execution Failed</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full my-2 rounded-2xl bg-card border border-border overflow-hidden shadow-lg animate-in fade-in">
      {/* Activity Card Header */}
      <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">
              {activity.title || "Jules Agent Execution"}
            </div>
            {activity.taskId && (
              <div className="text-[10px] text-muted-foreground font-mono">
                Task ID: {activity.taskId.slice(0, 12)}...
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0">{getStatusBadge()}</div>
      </div>

      {/* Plan Description */}
      {activity.planDescription && (
        <div className="p-3 text-xs text-foreground leading-relaxed border-b border-border bg-card">
          <p>{activity.planDescription}</p>
        </div>
      )}

      {/* Steps Checklist */}
      {activity.steps && activity.steps.length > 0 && (
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setIsStepsOpen(!isStepsOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted bg-muted/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Execution Steps ({activity.steps.length})</span>
            </div>
            {isStepsOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {isStepsOpen && (
            <div className="p-2.5 space-y-2 bg-background">
              {activity.steps.map((step, idx) => {
                const isCompleted = step.status === "completed";
                const isInProgress = step.status === "in_progress";
                const isFailed = step.status === "failed";

                return (
                  <div
                    key={step.id || idx}
                    className={`p-2 rounded-xl border text-xs transition-colors flex items-start gap-2.5 ${
                      isCompleted
                        ? "bg-muted/40 border-border text-foreground"
                        : isInProgress
                        ? "bg-primary/10 border-primary/30 text-foreground"
                        : isFailed
                        ? "bg-muted/40 border-border text-foreground"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      ) : isInProgress ? (
                        <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                      ) : isFailed ? (
                        <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-border flex items-center justify-center text-[9px] font-mono text-muted-foreground">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{step.title}</div>
                      {step.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {step.description}
                        </div>
                      )}
                      {step.filesChanged && step.filesChanged.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {step.filesChanged.map((file, fIdx) => (
                            <span
                              key={fIdx}
                              className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] text-muted-foreground font-mono flex items-center gap-1"
                            >
                              <FileCode className="w-2.5 h-2.5 text-primary" />
                              <span>{file}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Code Diff Inspection */}
      {activity.diffContent && (
        <div className="border-b border-border">
          <button
            type="button"
            onClick={() => setIsDiffOpen(!isDiffOpen)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted bg-muted/20 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-primary" />
              <span>Inspect Code Changes / Diff</span>
            </div>
            {isDiffOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>

          {isDiffOpen && (
            <div className="p-2.5 bg-muted/30 overflow-x-auto">
              <pre className="text-[11px] font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                {activity.diffContent}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Pull Request Card */}
      {activity.pullRequest && (
        <div className="p-3 bg-muted/40 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <GitPullRequest className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {activity.pullRequest.title || `PR #${activity.pullRequest.number}`}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  Branch: {activity.pullRequest.branch}
                </div>
              </div>
            </div>

            <a
              href={activity.pullRequest.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>View PR #{activity.pullRequest.number}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Approval Actions (When status === awaiting_approval) */}
      {activity.status === "awaiting_approval" && (
        <div className="p-3 bg-muted/50 flex items-center justify-between gap-2 animate-in fade-in">
          <div className="text-xs text-foreground flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
            <span>Please review the plan before Jules starts editing files.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRejectPlan && activity.taskId && (
              <button
                type="button"
                onClick={() => onRejectPlan(activity.taskId!)}
                className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium border border-border transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            )}

            {onApprovePlan && activity.taskId && (
              <button
                type="button"
                onClick={() => onApprovePlan(activity.taskId!)}
                disabled={isApproving}
                className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-md active:scale-95 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Execute</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {(activity.error || activity.errorMessage) && (
        <div className="p-3 bg-muted/40 border-t border-destructive/20 text-destructive text-xs flex items-center gap-2 error-banner">
          <AlertCircle className="w-4 h-4 shrink-0 text-destructive error-icon" />
          <span>{activity.error || activity.errorMessage}</span>
        </div>
      )}
    </div>
  );
};
