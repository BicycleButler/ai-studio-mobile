import React, { useState } from "react";
import { Plus, Trash2, Play, Copy, Check, Square } from "lucide-react";
import Markdown from "react-markdown";
import { StructuredExample, PromptConfig } from "../types";

interface StructuredWorkspaceProps {
  config: PromptConfig;
  examples: StructuredExample[];
  onUpdateExamples: (examples: StructuredExample[]) => void;
  onExecute: (input: string, examples: StructuredExample[]) => void;
  onStop: () => void;
  isGenerating: boolean;
  output: string;
}

export const StructuredWorkspace: React.FC<StructuredWorkspaceProps> = ({
  config: _config,
  examples,
  onUpdateExamples,
  onExecute,
  onStop,
  isGenerating,
  output,
}) => {
  const [testInput, setTestInput] = useState("");
  const [copied, setCopied] = useState(false);

  const addExample = () => {
    const newEx: StructuredExample = {
      id: `ex-${Date.now()}`,
      input: "",
      output: "",
    };
    onUpdateExamples([...examples, newEx]);
  };

  const updateExample = (
    id: string,
    field: "input" | "output",
    val: string
  ) => {
    onUpdateExamples(
      examples.map((ex) => (ex.id === id ? { ...ex, [field]: val } : ex))
    );
  };

  const removeExample = (id: string) => {
    onUpdateExamples(examples.filter((ex) => ex.id !== id));
  };

  const handleRun = () => {
    if (!testInput.trim()) return;
    onExecute(testInput, examples);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full flex-1 overflow-y-auto bg-background text-foreground p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs bg-card border border-border rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Structured Few-Shot Prompt</span>
        </div>
        <button
          id="add-example-btn"
          onClick={addExample}
          className="px-2 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium flex items-center gap-1 border border-border cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Add Example</span>
        </button>
      </div>

      {/* Examples List */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Few-Shot Examples ({examples.length})
        </div>

        {examples.length === 0 ? (
          <div className="p-4 rounded-xl bg-card border border-dashed border-border text-center text-xs text-muted-foreground">
            No examples added. Click &quot;Add Example&quot; to teach Gemini your expected input-output format.
          </div>
        ) : (
          examples.map((ex, index) => (
            <div
              key={ex.id}
              className="bg-card border border-border rounded-xl p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-primary">
                  Example #{index + 1}
                </span>
                <button
                  onClick={() => removeExample(ex.id)}
                  className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Input</span>
                  <textarea
                    value={ex.input}
                    onChange={(e) => updateExample(ex.id, "input", e.target.value)}
                    placeholder="Input text..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none font-mono placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Expected Output</span>
                  <textarea
                    value={ex.output}
                    onChange={(e) => updateExample(ex.id, "output", e.target.value)}
                    placeholder="Expected output / JSON..."
                    rows={2}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-xs text-foreground focus:outline-none focus:border-primary resize-none font-mono placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Test Input */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2">
        <label className="text-[11px] font-semibold text-foreground block">
          Test Case Input
        </label>
        <textarea
          id="structured-test-input"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="Enter new test input to test against the structured model..."
          rows={3}
          className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary resize-none font-mono placeholder:text-muted-foreground"
        />

        <div className="flex justify-end pt-1">
          {isGenerating ? (
            <button
              onClick={onStop}
              className="px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              id="structured-run-btn"
              onClick={handleRun}
              disabled={!testInput.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors cursor-pointer ${
                testInput.trim()
                  ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Generate Output</span>
            </button>
          )}
        </div>
      </div>

      {/* Predicted Output */}
      <div className="bg-card border border-border rounded-xl p-3 min-h-[140px] space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">Model Prediction</span>
          </div>
          {output && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {output ? (
          <div className="prose dark:prose-invert prose-xs max-w-none break-words text-foreground [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border [&>code]:text-primary">
            <Markdown>{output}</Markdown>
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-muted-foreground italic py-6">
            {isGenerating ? "Predicting structured output..." : "Structured result will appear here."}
          </div>
        )}
      </div>
    </div>
  );
};
