import { useState, useEffect } from "react";
import { ModelInfo, PromptConfig, SavedPrompt, PromptType } from "../types";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  fetchModels
} from "../utils/modelCatalog";

export function useModelConfig(
  initialConfig: PromptConfig,
  customApiKey: string,
  chatSession: ReturnType<typeof import("./useChatSession").useChatSession>
) {
  const [models, setModels] = useState<ModelInfo[]>(CURATED_MODELS);
  const [config, setConfig] = useState<PromptConfig>(initialConfig);

  useEffect(() => {
    fetchModels(customApiKey)
      .then((data) => {
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          const cleaned = data.models.filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id));
          if (cleaned.length > 0) {
            setModels(cleaned);
          }
        }
      })
      .catch(() => {});
  }, [customApiKey]);

  const handleLoadPrompt = (prompt: SavedPrompt, setPromptType: (type: PromptType) => void) => {
    const validPromptTypes: PromptType[] = ["chat", "code", "jules", "stubs"];
    const targetType: PromptType = validPromptTypes.includes(prompt.type as PromptType)
      ? (prompt.type as PromptType)
      : "chat";
    setPromptType(targetType);
    setConfig(prompt.config);
    if (prompt.messages && prompt.messages.length > 0) {
      chatSession.setMessages(prompt.messages);
    }
  };

  return {
    models,
    setModels,
    config,
    setConfig,
    handleLoadPrompt,
  };
}
