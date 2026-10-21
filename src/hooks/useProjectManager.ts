import { useStore } from "./useStore";
import { ProjectInfo, PromptConfig, PromptType } from "../types";
import {
  projectsManager,
  setActiveProjectId,
  saveDraftState,
  loadDraftState,
  saveStoredApiKey
} from "../utils/storage";
import { clearAllChatSessions } from "../services/chatHistoryService";

export function useProjectManager(
  chatSession: ReturnType<typeof import("./useChatSession").useChatSession>,
  setPromptType: (pt: PromptType) => void,
  setConfig: (updater: PromptConfig | ((prev: PromptConfig) => PromptConfig)) => void,
  setCustomApiKey: (key: string) => void,
  setCandidateClipboardKey: (key: string) => void,
  setClipboardToastKey: (key: string | null) => void,
  promptType: PromptType,
  config: PromptConfig
) {
  const projectManagerStore = useStore(projectsManager);
  const projects = projectManagerStore.items;

  const setProjects: React.Dispatch<React.SetStateAction<ProjectInfo[]>> = (val) => {
    if (typeof val === "function") {
      projectsManager.collection.save(val(projects));
    } else {
      projectsManager.collection.save(val);
    }
  };

  const activeProject = projectManagerStore.activeItem;

  const setActiveProject: React.Dispatch<React.SetStateAction<ProjectInfo | null>> = (val) => {
    if (typeof val === "function") {
      const result = val(activeProject);
      projectsManager.setActiveId(result ? result.id : null);
    } else {
      projectsManager.setActiveId(val ? val.id : null);
    }
  };

  const handleProjectActivated = (project: ProjectInfo, onStopStream?: () => void) => {
    if (onStopStream) {
      onStopStream();
    }

    // Persist current draft under outgoing active project
    saveDraftState(
      {
        promptType,
        config,
        freeformText: chatSession.freeformText,
        structuredExamples: chatSession.structuredExamples,
        messages: chatSession.messages,
      },
      activeProject?.id
    );

    // Mark new project active in storage & local state
    setActiveProjectId(project.id);
    setActiveProject(project);
    setCustomApiKey(project.apiKey);
    saveStoredApiKey(project.apiKey);

    // Load incoming project's scoped draft state
    const targetDraft = loadDraftState(project.id);
    setPromptType(targetDraft.promptType);
    setConfig({
      ...targetDraft.config,
      ...(project.defaultModel ? { model: project.defaultModel } : {}),
    });
    if (targetDraft.messages && targetDraft.messages.length > 0) {
      chatSession.setMessages(targetDraft.messages);
    } else {
      chatSession.setMessages([]);
    }

    setCandidateClipboardKey("");
    setClipboardToastKey(null);
    chatSession.setCurrentSessionId(`sess_${Date.now()}`);
  };

  const handleRenameProject = (id: string, newName: string) => {
    projectsManager.collection.update(id, { name: newName });
  };

  const handleDeleteProject = (id: string, onStopStream?: () => void) => {
    projectsManager.collection.delete(id);
    try {
      clearAllChatSessions(id);
    } catch(e) {
      console.error("Failed to clean up chat sessions", e);
    }
    const updated = projectsManager.getItems();
    if (activeProject?.id === id) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setCustomApiKey("");
        saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  const handleBulkDeleteProjects = (ids: string[], onStopStream?: () => void) => {
    projectsManager.collection.bulkDelete(ids);
    try {
      ids.forEach(id => clearAllChatSessions(id));
    } catch(e) {
      console.error("Failed to clean up chat sessions", e);
    }
    const updated = projectsManager.getItems();

    if (activeProject && ids.includes(activeProject.id)) {
      if (updated.length > 0) {
        handleProjectActivated(updated[0], onStopStream);
      } else {
        setCustomApiKey("");
        saveStoredApiKey("");
        chatSession.setMessages([]);
      }
    }
  };

  return {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    handleProjectActivated,
    handleRenameProject,
    handleDeleteProject,
    handleBulkDeleteProjects,
  };
}
