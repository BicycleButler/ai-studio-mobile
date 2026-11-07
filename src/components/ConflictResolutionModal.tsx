import React from "react";
import { AlertCircle } from "lucide-react";
import { Dialog, DialogBody, DialogFooter } from "./ui";

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
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onCancel}
      title={
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          {title}
        </div>
      }
      size="xl"
    >
      <DialogBody>
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
              {Object.keys(localData || {}).map((key) => (
                <div key={key} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium max-w-[60%] truncate text-end" title={String((localData || {})[key])}>
                    {String((localData || {})[key])}
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
              {Object.keys(remoteData || {}).map((key) => (
                <div key={key} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-muted-foreground capitalize">{key}:</span>
                  <span className="font-medium max-w-[60%] truncate text-end" title={String((remoteData || {})[key])}>
                    {String((remoteData || {})[key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogBody>

      <DialogFooter className="flex-wrap-reverse sm:flex-row-reverse">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onKeepRemote}
          className="px-4 py-2 text-sm font-medium rounded-lg text-foreground bg-muted hover:bg-muted/80 border border-border transition cursor-pointer"
        >
          Keep Remote
        </button>
        <button
          type="button"
          onClick={onOverwriteRemote}
          className="px-4 py-2 text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 transition shadow-sm cursor-pointer"
        >
          Overwrite Remote
        </button>
      </DialogFooter>
    </Dialog>
  );
};
