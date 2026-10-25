import { describe, test, beforeEach } from 'vitest';
import { PromptTemplateService, IPromptTemplateService, BUILTIN_PROMPT_TEMPLATES } from "./promptTemplateService";


describe('testPromptTemplateService', () => {
  let service: IPromptTemplateService;

  beforeEach(() => {
    service = new PromptTemplateService({});
    service.clearCustomTemplates();
  });

  test('main', () => {
    service.clearCustomTemplates();

    // Test 1: Built-in Starter Templates
    const builtins = service.getBuiltinTemplates();
    if (builtins.length !== 6) {
      throw new Error(`Expected 6 starter templates, got ${builtins.length}`);
    }

    const expectedCategories = ["tone", "coding", "reasoning", "formatting", "analysis"];
    for (const cat of expectedCategories) {
      if (!builtins.some((t) => t.category === cat)) {
        throw new Error(`Missing template in category: ${cat}`);
      }
    }

    const concise = service.getTemplateById("concise-direct");
    if (!concise || !concise.isBuiltin || !concise.content.includes("concisely")) {
      throw new Error("Failed to retrieve concise-direct built-in template");
    }

    const staff = service.getTemplateById("staff-engineer");
    if (!staff || !staff.isBuiltin || !staff.content.includes("staff software engineer")) {
      throw new Error("Failed to retrieve staff-engineer built-in template");
    }

    // Test 2: Custom Template Creation & Retrieval
    const custom1 = service.saveCustomTemplate({
      title: "SQL Performance Guru",
      category: "coding",
      description: "Indexes, execution plans, and query optimization directives",
      content: "Optimize the following database queries for minimal disk I/O and index scans.",
    });

    if (!custom1.id || !custom1.id.startsWith("custom_tpl_")) {
      throw new Error(`Invalid custom template ID: ${custom1.id}`);
    }

    const allWithCustom = service.getAllTemplates();
    if (allWithCustom.length !== BUILTIN_PROMPT_TEMPLATES.length + 1) {
      throw new Error(`Expected ${BUILTIN_PROMPT_TEMPLATES.length + 1} templates after insert, got ${allWithCustom.length}`);
    }

    const fetched = service.getTemplateById(custom1.id);
    if (!fetched || fetched.title !== "SQL Performance Guru") {
      throw new Error("Failed to retrieve custom template by ID");
    }

    // Test 3: Custom Template Update
    const updatedCustom = service.saveCustomTemplate({
      id: custom1.id,
      title: "SQL Performance Expert",
      category: "coding",
      content: "Refined SQL optimization directive with explain plans.",
    });

    if (updatedCustom.id !== custom1.id || updatedCustom.title !== "SQL Performance Expert") {
      throw new Error("Failed to update existing custom template");
    }

    // Test 4: Cannot delete built-in templates
    const deleteBuiltinResult = service.deleteCustomTemplate("concise-direct");
    if (deleteBuiltinResult !== false) {
      throw new Error("deleteCustomTemplate should refuse to delete built-in templates");
    }

    // Test 5: Can delete custom template
    const deleteCustomResult = service.deleteCustomTemplate(custom1.id);
    if (!deleteCustomResult || service.getTemplateById(custom1.id) !== undefined) {
      throw new Error("Failed to delete custom template");
    }

    // Test 6: Validation
    try {
      service.saveCustomTemplate({ title: "", content: "Some content", category: "custom" });
      throw new Error("Should have thrown error on empty title");
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Should have thrown")) {
        throw err;
      }
    }

    // Test 7: Double-Newline Sequential Composition Protocol (Question 3 Decision Option A)
    // Strict FIFO order [Template 1 Content]\n\n[Template 2 Content]\n\n[User's handwritten text]
    const composed = service.composePrompt(
      ["concise-direct", "staff-engineer"],
      "How do I structure a concurrent channel in Go?"
    );

    const expectedText = `${concise.content}\n\n${staff.content}\n\nHow do I structure a concurrent channel in Go?`;
    if (composed.combinedText !== expectedText) {
      throw new Error(`Composed text mismatch.\nExpected:\n${expectedText}\nGot:\n${composed.combinedText}`);
    }

    if (composed.templateIds.length !== 2 || composed.templateIds[0] !== "concise-direct" || composed.templateIds[1] !== "staff-engineer") {
      throw new Error("Template IDs sequence in composition payload does not reflect FIFO order");
    }

    // Test 8: Composition edge cases
    const noTemplates = service.composePrompt([], "Just a manual question");
    if (noTemplates.combinedText !== "Just a manual question" || noTemplates.templateIds.length !== 0) {
      throw new Error("Failed to handle empty template selection");
    }

    const noUserText = service.composePrompt(["valid-json"], "");
    const jsonTpl = service.getTemplateById("valid-json")!;
    if (noUserText.combinedText !== jsonTpl.content) {
      throw new Error("Failed to compose when user text is empty");
    }

    // bulk delete tests
    const t1 = service.saveCustomTemplate({ title: 't1', content: 'c1', category: 'custom' });
    const t2 = service.saveCustomTemplate({ title: 't2', content: 'c2', category: 'custom' });
    const t3 = service.saveCustomTemplate({ title: 't3', content: 'c3', category: 'custom' });

    const res = service.bulkDeleteCustomTemplates([t1.id!, t3.id!]);
    if (res !== true) throw new Error("Expected bulk delete to return true");
    const all = service.getCustomTemplates();
    if (all.length !== 1 || all[0].id !== t2.id) throw new Error("Bulk delete failed");

    if (service.bulkDeleteCustomTemplates([]) !== false) {
       throw new Error("Expected bulk delete with empty array to return false");
    }

    service.clearCustomTemplates();
  });
});
