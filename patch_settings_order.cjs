const fs = require('fs');
let code = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf8');

// The function clearProjectSelection needs to be defined before it is used in useEffects
code = code.replace(
  `  // Clear project selection when switching tabs (ADR 0047)
  useEffect(() => {
    clearProjectSelection();
  }, [activeTab, clearProjectSelection]);`,
  ``
);

code = code.replace(
  `  const clearProjectSelection = useCallback(() => {
    setSelectedProjectIds(new Set());
    setLastSelectedProjectId(null);
  }, []);`,
  `  const clearProjectSelection = useCallback(() => {
    setSelectedProjectIds(new Set());
    setLastSelectedProjectId(null);
  }, []);

  // Clear project selection when switching tabs (ADR 0047)
  useEffect(() => {
    clearProjectSelection();
  }, [activeTab, clearProjectSelection]);`
);


fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', code);
