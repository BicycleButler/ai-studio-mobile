const fs = require('fs');
let code = fs.readFileSync('src/components/LibraryModal.tsx', 'utf8');

// Wrap toggleSelectAll in useCallback
code = code.replace(
  `  const toggleSelectAll = () => {
    if (selectedPromptIds.size === savedPrompts.length && savedPrompts.length > 0) {
      setSelectedPromptIds(new Set());
    } else {
      setSelectedPromptIds(new Set(savedPrompts.map((p) => p.id)));
    }
  };`,
  `  const toggleSelectAll = useCallback(() => {
    if (selectedPromptIds.size === savedPrompts.length && savedPrompts.length > 0) {
      setSelectedPromptIds(new Set());
    } else {
      setSelectedPromptIds(new Set(savedPrompts.map((p) => p.id)));
    }
  }, [selectedPromptIds.size, savedPrompts]);`
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
  `                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedPromptIds.size} {selectedPromptIds.size === 1 ? 'Prompt' : 'Prompts'}
                </button>
              </div>
            </motion.div>`,
  `                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedPromptIds.size > 100 && bulkDeleteConfirmationText !== selectedPromptIds.size.toString()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedPromptIds.size} {selectedPromptIds.size === 1 ? 'Prompt' : 'Prompts'}
                </button>
              </div>
            </motion.div>`
);

code = code.replace(
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected saved prompts from your local storage.
                </p>
              </div>`,
  `              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected saved prompts from your local storage.
                </p>
                {selectedPromptIds.size > 100 && (
                  <div className="mt-4">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Type the exact quantity ({selectedPromptIds.size}) to confirm:
                    </label>
                    <input
                      type="text"
                      value={bulkDeleteConfirmationText}
                      onChange={(e) => setBulkDeleteConfirmationText(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder={selectedPromptIds.size.toString()}
                    />
                  </div>
                )}
              </div>`
);

code = code.replace(
  `    clearSelection();
    setShowBulkDeleteConfirm(false);
  };`,
  `    clearSelection();
    setShowBulkDeleteConfirm(false);
    setBulkDeleteConfirmationText("");
  };`
);


fs.writeFileSync('src/components/LibraryModal.tsx', code);
