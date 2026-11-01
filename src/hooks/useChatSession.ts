import { defaultTimeProvider } from "../utils/timeProvider";
import { useServices } from "../services/ServiceContext";
import { useState, useCallback } from "react";
import { ChatMessage, StructuredExample, SavedPrompt, PromptType, PromptConfig, ProjectInfo } from "../types";
import { defaultIdGenerator } from "../utils/idGenerator";
import { IPromptTemplateService } from "../services/promptTemplateService";
import { useStore } from "./useStore";

export function useChatSession(initialDraft: { messages?: ChatMessage[]; freeformText?: string; structuredExamples?: StructuredExample[] }, promptType: PromptType, config: PromptConfig, activeProject: ProjectInfo | null, promptTemplateService: IPromptTemplateService) {
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${defaultTimeProvider.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (initialDraft.messages && initialDraft.messages.length > 0) {
      return initialDraft.messages;
    }
    return [];
  });

  const [freeformText] = useState(initialDraft.freeformText);
  const [structuredExamples] = useState<StructuredExample[]>(initialDraft.structuredExamples || []);

  const { savedPromptsService } = useServices();
  const savedPromptsStore = useStore(savedPromptsService.savedPromptsManager);
  const savedPrompts = savedPromptsStore.items;

  // Backwards compatibility for setSavedPrompts (should ideally only be modified via the manager)
  const setSavedPrompts = useCallback((promptsOrUpdater: React.SetStateAction<SavedPrompt[]>) => {
      const nextPrompts = typeof promptsOrUpdater === 'function' ? promptsOrUpdater(savedPrompts) : promptsOrUpdater;
      savedPromptsService.savedPromptsManager.collection.save(nextPrompts);
  }, [savedPrompts]);

  const handleStartNewChat = useCallback((onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }
    const newSessionId = defaultIdGenerator.generate("sess");
    setCurrentSessionId(newSessionId);
    setMessages([]);
  }, []);

  const handleSaveCurrentPrompt = useCallback((title: string) => {
    const newSaved: SavedPrompt = {
      id: defaultIdGenerator.generate("saved"),
      title,
      type: promptType,
      config: { ...config },
      messages: [...messages],
      updatedAt: defaultTimeProvider.now(),
      projectId: activeProject?.id,
    };
    savedPromptsService.savedPromptsManager.collection.upsert(newSaved, true);
  }, [promptType, config, messages, activeProject?.id]);

  const handleDeleteSavedPrompt = useCallback((id: string) => {
    savedPromptsService.savedPromptsManager.collection.delete(id);
  }, []);

  const handleBulkDeleteSavedPrompts = useCallback((ids: string[]) => {
    savedPromptsService.savedPromptsManager.collection.bulkDelete(ids);
    promptTemplateService.bulkDeleteCustomTemplates(ids);
  }, [promptTemplateService]);

  return {
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    freeformText,
    structuredExamples,
    savedPrompts,
    setSavedPrompts,
    handleStartNewChat,
    handleSaveCurrentPrompt,
    handleDeleteSavedPrompt,
    handleBulkDeleteSavedPrompts,
  };
}
