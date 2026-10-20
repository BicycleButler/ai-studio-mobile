import React, { createContext, useContext, ReactNode } from "react";
import { IPromptTemplateService, defaultPromptTemplateService } from "./promptTemplateService";

const PromptTemplateContext = createContext<IPromptTemplateService>(defaultPromptTemplateService);

export const PromptTemplateProvider: React.FC<{
  service?: IPromptTemplateService;
  children: ReactNode;
}> = ({ service = defaultPromptTemplateService, children }) => {
  return (
    <PromptTemplateContext.Provider value={service}>
      {children}
    </PromptTemplateContext.Provider>
  );
};

export function usePromptTemplateService(): IPromptTemplateService {
  return useContext(PromptTemplateContext);
}
