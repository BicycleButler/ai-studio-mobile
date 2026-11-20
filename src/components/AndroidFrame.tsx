import React from "react";

interface AndroidFrameProps {
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children }) => {
  return (
    <div className="w-full h-screen h-[100dvh] min-h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden">
      {children}
    </div>
  );
};
