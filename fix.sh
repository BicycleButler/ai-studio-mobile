sed -i 's/    toggleSelectAll: toggleSelectAllHistoryRaw,/    toggleSelectAll: toggleSelectAllHistoryRaw,\n    getSelectionState: getHistorySelectionState,/g' src/components/ChatWorkspace.tsx
