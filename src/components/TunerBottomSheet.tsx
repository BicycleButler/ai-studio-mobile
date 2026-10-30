import React from "react";
import { Drawer } from "./ui/Drawer.tsx";

import { TunerConfigPanel } from "./tuner/TunerConfigPanel";

export { type TunerActionHandlers, type TunerBottomSheetProps } from "./tuner/TunerConfigPanel";

export const TunerBottomSheet: React.FC<import("./tuner/TunerConfigPanel").TunerBottomSheetProps> = (props) => {
  if (props.isModal) {
    return (
      <Drawer
        isOpen={props.isOpen || false}
        onClose={props.onClose || (() => {})}
        title="Models & Parameters"
        drawerId="tuner-bottom-sheet"
        className="!h-[85vh] !p-0"
      >
        <div className="flex flex-col h-full overflow-hidden relative">
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-safe space-y-8 relative">
             <TunerConfigPanel {...props} />
          </div>
        </div>
      </Drawer>
    );
  }

  return <TunerConfigPanel {...props} />;
};
