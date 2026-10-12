const fs = require('fs');
let code = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf8');

// Wrap toggleSelectAllProjects in useCallback
code = code.replace(
  `  const toggleSelectAllProjects = () => {
    if (selectedProjectIds.size === projects.length && projects.length > 0) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(projects.map((p) => p.id)));
    }
  };`,
  `  const toggleSelectAllProjects = useCallback(() => {
    if (selectedProjectIds.size === projects.length && projects.length > 0) {
      setSelectedProjectIds(new Set());
    } else {
      setSelectedProjectIds(new Set(projects.map((p) => p.id)));
    }
  }, [selectedProjectIds.size, projects]);`
);

// Keyboard shortcuts (Cmd/Ctrl + A, and Escape behavior)
code = code.replace(
  `  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopPreview();
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);`,
  `  // Keyboard shortcuts and Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProjectIds.size > 0 && activeTab === "account") {
          clearProjectSelection();
        } else {
          stopPreview();
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && activeTab === "account") {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAllProjects();
        }
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose, activeTab, selectedProjectIds.size, clearProjectSelection, toggleSelectAllProjects]);`
);

// Clear selection on tab switch
code = code.replace(
  `  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [isOpen, initialTab]);`,
  `  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(resolveTab(initialTab));
    }
  }, [isOpen, initialTab]);

  // Clear project selection when switching tabs (ADR 0047)
  useEffect(() => {
    clearProjectSelection();
  }, [activeTab, clearProjectSelection]);`
);

// Add high-risk threshold for bulk delete
code = code.replace(
  `  const [lastSelectedProjectId, setLastSelectedProjectId] = useState<string | null>(null);
  const [showBulkDeleteProjectsConfirm, setShowBulkDeleteProjectsConfirm] = useState(false);`,
  `  const [lastSelectedProjectId, setLastSelectedProjectId] = useState<string | null>(null);
  const [showBulkDeleteProjectsConfirm, setShowBulkDeleteProjectsConfirm] = useState(false);
  const [bulkDeleteConfirmationText, setBulkDeleteConfirmationText] = useState("");`
);

code = code.replace(
  `                <button
                  type="button"
                  onClick={handleBulkDeleteProjects}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedProjectIds.size} {selectedProjectIds.size === 1 ? 'Project' : 'Projects'}
                </button>
              </div>
            </motion.div>`,
  `                <button
                  type="button"
                  onClick={handleBulkDeleteProjects}
                  disabled={selectedProjectIds.size > 100 && bulkDeleteConfirmationText !== selectedProjectIds.size.toString()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedProjectIds.size} {selectedProjectIds.size === 1 ? 'Project' : 'Projects'}
                </button>
              </div>
            </motion.div>`
);

code = code.replace(
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected {selectedProjectIds.size === 1 ? 'project' : 'projects'} and their configuration from your local storage.
                </p>
              </div>`,
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected {selectedProjectIds.size === 1 ? 'project' : 'projects'} and their configuration from your local storage.
                </p>
                {selectedProjectIds.size > 100 && (
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Type the exact quantity ({selectedProjectIds.size}) to confirm:
                    </label>
                    <input
                      type="text"
                      value={bulkDeleteConfirmationText}
                      onChange={(e) => setBulkDeleteConfirmationText(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={selectedProjectIds.size.toString()}
                    />
                  </div>
                )}
              </div>`
);

// Clear bulk text when closing modal or handling delete
code = code.replace(
  `    clearProjectSelection();
    setShowBulkDeleteProjectsConfirm(false);
  };`,
  `    clearProjectSelection();
    setShowBulkDeleteProjectsConfirm(false);
    setBulkDeleteConfirmationText("");
  };`
);


fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', code);
