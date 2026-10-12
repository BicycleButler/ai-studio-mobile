const fs = require('fs');
let code = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf8');

// Fix confirm modal logic in Escape listener
code = code.replace(
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProjectIds.size > 0 && activeTab === "account") {
          clearProjectSelection();
        } else {
          stopPreview();
          onClose();
        }
      }`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBulkDeleteProjectsConfirm) {
           setShowBulkDeleteProjectsConfirm(false);
           setBulkDeleteConfirmationText("");
        } else if (selectedProjectIds.size > 0 && activeTab === "account") {
          clearProjectSelection();
        } else {
          stopPreview();
          onClose();
        }
      }`
);

// Fix dependency array of the keydown listener
code = code.replace(
  `  }, [isOpen, onClose, activeTab, selectedProjectIds.size, clearProjectSelection, toggleSelectAllProjects]);`,
  `  }, [isOpen, onClose, activeTab, selectedProjectIds.size, clearProjectSelection, toggleSelectAllProjects, showBulkDeleteProjectsConfirm]);`
);
fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', code);


let codeLibrary = fs.readFileSync('src/components/LibraryModal.tsx', 'utf8');
codeLibrary = codeLibrary.replace(
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPromptIds.size > 0) {
        clearSelection();
      }`,
  `    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
         if (showBulkDeleteConfirm) {
            setShowBulkDeleteConfirm(false);
            setBulkDeleteConfirmationText("");
         } else if (selectedPromptIds.size > 0) {
            clearSelection();
         }
      }`
);
codeLibrary = codeLibrary.replace(
  `  }, [selectedPromptIds.size, clearSelection, savedPrompts, toggleSelectAll]);`,
  `  }, [selectedPromptIds.size, clearSelection, savedPrompts, toggleSelectAll, showBulkDeleteConfirm]);`
);

fs.writeFileSync('src/components/LibraryModal.tsx', codeLibrary);
