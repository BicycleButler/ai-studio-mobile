const fs = require('fs');
let code = fs.readFileSync('src/components/JulesSessionDrawer.tsx', 'utf8');

// Remove duplicate Escape listener
code = code.replace(
  `  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);`,
  ``
);

// Update search logic
code = code.replace(
  `          const filtered = searchQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.repository.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : sessions;`,
  `          const filtered = searchQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.branch && s.branch.toLowerCase().includes(searchQuery.toLowerCase()))
              )
            : sessions;`
);

// Fix confirm modal logic in Escape listener
code = code.replace(
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSessionIds.size > 0) {
          clearSelection();
        } else {
          onClose();
        }
      }`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBulkDeleteConfirm) {
          setShowBulkDeleteConfirm(false);
          setBulkDeleteConfirmationText("");
        } else if (selectedSessionIds.size > 0) {
          clearSelection();
        } else {
          onClose();
        }
      }`
);
// Fix dependency array of the keydown listener
code = code.replace(
  `  }, [isOpen, selectedSessionIds.size, isCreating, sessions, searchQuery, clearSelection, onClose, toggleSelectAll]);`,
  `  }, [isOpen, selectedSessionIds.size, isCreating, sessions, searchQuery, clearSelection, onClose, toggleSelectAll, showBulkDeleteConfirm]);`
);


fs.writeFileSync('src/components/JulesSessionDrawer.tsx', code);
