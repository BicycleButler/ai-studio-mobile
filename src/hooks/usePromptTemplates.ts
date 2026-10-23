import { useState } from "react";

export function usePromptTemplates(initialSelectedTemplateIds: string[] = []) {
  const [isTemplateDrawerOpen, setIsTemplateDrawerOpen] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(initialSelectedTemplateIds);

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleRemoveTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) => prev.filter((id) => id !== templateId));
  };

  const handleClearAllTemplates = () => {
    setSelectedTemplateIds([]);
  };

  return {
    isTemplateDrawerOpen,
    setIsTemplateDrawerOpen,
    selectedTemplateIds,
    setSelectedTemplateIds,
    handleToggleTemplate,
    handleRemoveTemplate,
    handleClearAllTemplates,
  };
}
