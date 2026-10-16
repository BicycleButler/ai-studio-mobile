import React from "react";
import { X, AlertCircle } from "lucide-react";

export interface ConflictResolutionHandlers {
  onCancel: () => void;
  onKeepRemote: () => void;
  onOverwriteRemote: () => void;
}

export interface ConflictResolutionModalProps extends ConflictResolutionHandlers {
  isOpen: boolean;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  title?: string;
  remoteModifierName?: string;
  remoteModifiedTime?: string;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onCancel,
  onKeepRemote,
  onOverwriteRemote,
  localData,
  remoteData,
  title = "Resolve Editing Conflict",
  remoteModifierName = "Another user",
  remoteModifiedTime = "recently"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="bg-card w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh] border border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            {title}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 -me-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-muted-foreground mb-4">
            {remoteModifierName} modified this record {remoteModifiedTime}. Choose which version to retain:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Changes */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-muted px-4 py-3 border-b border-border font-medium text-sm">
                Your Local Changes
              </div>
              <div className="p-4 space-y-3">
                {Object.keys(localData).map((key) => (
                  <div key={key} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground capitalize">{key}:</span>
                    <span className="font-medium max-w-[60%] truncate text-end" title={String(localData[key])}>
                      {String(localData[key])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Remote Changes */}
            <div className="border border-border rounded-xl overflow-hidden bg-primary/5">
              <div className="bg-primary/10 px-4 py-3 border-b border-border font-medium text-sm">
                Remote Server Version
              </div>
              <div className="p-4 space-y-3">
                {Object.keys(remoteData).map((key) => (
                  <div key={key} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-muted-foreground capitalize">{key}:</span>
                    <span className="font-medium max-w-[60%] truncate text-end" title={String(remoteData[key])}>
                      {String(remoteData[key])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex flex-wrap-reverse items-center justify-end gap-2 bg-muted/30">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onKeepRemote}
            className="px-4 py-2 text-sm font-medium rounded-lg text-foreground bg-muted hover:bg-muted/80 border border-border transition-colors"
          >
            Keep Remote
          </button>
          <button
            onClick={onOverwriteRemote}
            className="px-4 py-2 text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 transition-colors shadow-sm"
          >
            Overwrite Remote
          </button>
        </div>
      </div>
    </div>
  );
};
