import fs from 'fs';

let content = fs.readFileSync('src/components/UnifiedSettingsModal.tsx', 'utf-8');

const search = `                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.voiceURI, "device");
                            }}
                            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isPlaying ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-primary" />
                            )}
                          </button>
      {/* Floating Batch Action Bar for Projects */}
      <FloatingBatchActionBar
        isVisible={selectedProjectIds.size > 0}
        selectedCount={selectedProjectIds.size}
        onDelete={() => setShowBulkDeleteProjectsConfirm(true)}
        onClearSelection={clearProjectSelection}
        className="!z-[100] !shadow-xl"
      />

      {/* Bulk Delete Projects Confirmation Modal */}
      <AnimatePresence>
        {showBulkDeleteProjectsConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">
                  Delete {selectedProjectIds.size} selected {selectedProjectIds.size === 1 ? 'project' : 'projects'}?
                </h3>
              </div>
              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected projects from your local storage.
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
              </div>
              <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteProjectsConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkDeleteProjects}
                  disabled={selectedProjectIds.size > 100 && bulkDeleteConfirmationText !== selectedProjectIds.size.toString()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                >
                  Delete {selectedProjectIds.size} {selectedProjectIds.size === 1 ? 'Project' : 'Projects'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>`;

const replace = `                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreviewVoice(v.voiceURI, "device");
                            }}
                            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isPlaying ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Volume2 className="w-3 h-3 text-primary" />
                            )}
                          </button>`;

content = content.replace(search, replace);

fs.writeFileSync('src/components/UnifiedSettingsModal.tsx', content);
