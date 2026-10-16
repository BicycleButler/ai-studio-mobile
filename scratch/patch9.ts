import fs from 'fs';

let content = fs.readFileSync('src/components/settings/SettingsAccountTab.tsx', 'utf-8');

const search = `  onDeleteProject: (p: ProjectInfo) => void;
  liveModelsCount: number;
}`;

const replace = `  onDeleteProject: (p: ProjectInfo) => void;
  onBulkDeleteProjects?: (ids: string[]) => void;
  selectedProjectIds?: Set<string>;
  toggleProjectSelection?: (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList?: any[]) => void;
  toggleSelectAllProjects?: () => void;
  clearProjectSelection?: () => void;
  handleBulkDeleteProjects?: () => void;
  showBulkDeleteProjectsConfirm?: boolean;
  setShowBulkDeleteProjectsConfirm?: (show: boolean) => void;
  bulkDeleteConfirmationText?: string;
  setBulkDeleteConfirmationText?: (text: string) => void;
  liveModelsCount: number;
}`;

content = content.replace(search, replace);

const search2 = `  onDeleteProject,
  liveModelsCount
}) => {`;

const replace2 = `  onDeleteProject,
  liveModelsCount,
  onBulkDeleteProjects,
  selectedProjectIds,
  toggleProjectSelection,
  toggleSelectAllProjects,
  clearProjectSelection,
  handleBulkDeleteProjects,
  showBulkDeleteProjectsConfirm,
  setShowBulkDeleteProjectsConfirm,
  bulkDeleteConfirmationText,
  setBulkDeleteConfirmationText
}) => {`;

content = content.replace(search2, replace2);

const search3 = `              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-foreground">
                  Active Projects
                </h4>
                <button
                  onClick={onOpenImportProject}
                  className="text-[10px] uppercase font-bold tracking-wide text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                >
                  Import New
                </button>
              </div>

              <div className="space-y-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={\`p-3 rounded-lg border \${
                      activeProject?.id === p.id
                        ? "bg-blue-500/5 border-blue-500/30"
                        : "bg-muted/50 border-border/50"
                    }\`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelectProject(p)}
                      >`;

const replace3 = `              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-foreground">
                  Active Projects
                </h4>
                <button
                  onClick={onOpenImportProject}
                  className="text-[10px] uppercase font-bold tracking-wide text-blue-500 hover:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                >
                  Import New
                </button>
              </div>

              {projects.length > 0 && toggleSelectAllProjects && (
                <div className="py-2 border-b border-border bg-muted/40 flex flex-col gap-2 text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSelectAllProjects()}
                      className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center"
                      aria-label="Select all projects on this page"
                    >
                      {selectedProjectIds?.size === projects.length ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : selectedProjectIds?.size && selectedProjectIds.size > 0 ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Check className="w-4 h-4 opacity-50" />
                      )}
                    </button>
                    <span className="text-muted-foreground font-medium">
                      {selectedProjectIds?.size && selectedProjectIds.size > 0
                        ? \`\${selectedProjectIds.size} selected\`
                        : "Select all on this page"}
                    </span>
                  </div>
                </div>
              )}

              {/* Dataset Scope Banner (ADR 0047) */}
              <DatasetScopeBanner selectedCount={selectedProjectIds?.size || 0} totalCount={projects.length} />

              <div className="space-y-2">
                {projects.map((p, index) => {
                  const isSelected = selectedProjectIds?.has(p.id);
                  return (
                  <div
                    key={p.id}
                    className={\`p-3 rounded-lg border transition-colors flex items-center justify-between \${
                      isSelected ? "bg-primary/5 border-primary/30" : activeProject?.id === p.id
                        ? "bg-blue-500/5 border-blue-500/30"
                        : "bg-muted/50 border-border/50 hover:border-border"
                    }\`}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleProjectSelection && toggleProjectSelection(p.id, e, index)}
                      className="me-3 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={\`Select project \${p.name}\`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Check className="w-4 h-4 opacity-50" />
                      )}
                    </button>
                    <div className="flex items-center justify-between flex-1">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => onSelectProject(p)}
                      >`;

content = content.replace(search3, replace3);

const search4 = `                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};`;

const replace4 = `                )})}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Batch Action Bar for Projects */}
      <FloatingBatchActionBar
        isVisible={!!(selectedProjectIds && selectedProjectIds.size > 0)}
        selectedCount={selectedProjectIds?.size || 0}
        onDelete={() => setShowBulkDeleteProjectsConfirm && setShowBulkDeleteProjectsConfirm(true)}
        onClearSelection={() => clearProjectSelection && clearProjectSelection()}
      />

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteProjectsConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  Delete {selectedProjectIds?.size} selected {selectedProjectIds?.size === 1 ? 'project' : 'projects'}?
                </h3>
              </div>
              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected projects from your local storage.
                </p>
                {selectedProjectIds && selectedProjectIds.size > 100 && (
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Type the exact quantity ({selectedProjectIds.size}) to confirm:
                    </label>
                    <input
                      type="text"
                      value={bulkDeleteConfirmationText || ""}
                      onChange={(e) => setBulkDeleteConfirmationText && setBulkDeleteConfirmationText(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={selectedProjectIds.size.toString()}
                    />
                  </div>
                )}
              </div>
              <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteProjectsConfirm && setShowBulkDeleteProjectsConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteProjects}
                  disabled={selectedProjectIds && selectedProjectIds.size > 100 && bulkDeleteConfirmationText !== selectedProjectIds.size.toString()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedProjectIds?.size} {selectedProjectIds?.size === 1 ? 'Project' : 'Projects'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};`;

content = content.replace(search4, replace4);

const search5 = `import { GoogleUser, ProjectInfo } from "../../types";
import { GoogleAuthCard } from "../GoogleAuthCard";`;

const replace5 = `import { GoogleUser, ProjectInfo } from "../../types";
import { GoogleAuthCard } from "../GoogleAuthCard";
import { DatasetScopeBanner } from "../DatasetScopeBanner";
import { FloatingBatchActionBar } from "../FloatingBatchActionBar";
import { AnimatePresence, motion } from "motion/react";`;

content = content.replace(search5, replace5);

fs.writeFileSync('src/components/settings/SettingsAccountTab.tsx', content);
