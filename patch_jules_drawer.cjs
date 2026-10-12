const fs = require('fs');
let code = fs.readFileSync('src/components/JulesSessionDrawer.tsx', 'utf8');

// Wrap toggleSelectAll in useCallback
code = code.replace(
  `  const toggleSelectAll = (filteredList: JulesSession[]) => {
    if (selectedSessionIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredList.map((s) => s.id)));
    }
  };`,
  `  const toggleSelectAll = useCallback((filteredList: JulesSession[]) => {
    if (selectedSessionIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredList.map((s) => s.id)));
    }
  }, [selectedSessionIds.size]);`
);

// Update Escape key handler
code = code.replace(
  `  // Keyboard shortcuts (Cmd/Ctrl+A to select all, Esc to clear selection)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSessionIds.size > 0) {
        clearSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isCreating) {
        // Prevent default browser select all
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const filtered = searchQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.repository.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : sessions;
          toggleSelectAll(filtered);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedSessionIds.size, isCreating, sessions, searchQuery, clearSelection]);`,
  `  // Keyboard shortcuts (Cmd/Ctrl+A to select all, Esc to clear selection)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSessionIds.size > 0) {
          clearSelection();
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isCreating) {
        // Prevent default browser select all
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const filtered = searchQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.repository.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : sessions;
          toggleSelectAll(filtered);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedSessionIds.size, isCreating, sessions, searchQuery, clearSelection, onClose, toggleSelectAll]);`
);


// Add high-risk threshold state
code = code.replace(
  `  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);`,
  `  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleteConfirmationText, setBulkDeleteConfirmationText] = useState("");`
);

// High-risk threshold UI logic
code = code.replace(
  `                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                  >
                    Delete {selectedSessionIds.size} {selectedSessionIds.size === 1 ? 'Session' : 'Sessions'}
                  </button>
                </div>
              </motion.div>`,
  `                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={selectedSessionIds.size > 100 && bulkDeleteConfirmationText !== selectedSessionIds.size.toString()}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                  >
                    Delete {selectedSessionIds.size} {selectedSessionIds.size === 1 ? 'Session' : 'Sessions'}
                  </button>
                </div>
              </motion.div>`
);

code = code.replace(
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected Jules agent sessions and their chat history from your local storage.
                </p>
              </div>`,
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected Jules agent sessions and their chat history from your local storage.
                </p>
                {selectedSessionIds.size > 100 && (
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Type the exact quantity ({selectedSessionIds.size}) to confirm:
                    </label>
                    <input
                      type="text"
                      value={bulkDeleteConfirmationText}
                      onChange={(e) => setBulkDeleteConfirmationText(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={selectedSessionIds.size.toString()}
                    />
                  </div>
                )}
              </div>`
);

code = code.replace(
  `    clearSelection();
    setShowBulkDeleteConfirm(false);
    refreshSessions();
  };`,
  `    clearSelection();
    setShowBulkDeleteConfirm(false);
    setBulkDeleteConfirmationText("");
    refreshSessions();
  };`
);


fs.writeFileSync('src/components/JulesSessionDrawer.tsx', code);
