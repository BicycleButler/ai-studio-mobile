import React, { useState } from "react";
import { Plus, Trash2, Play, Sparkles, Table, Copy, Check, Square } from "lucide-react";
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
    <div className="flex flex-col h-full flex-1 overflow-y-auto bg-[#131314] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs bg-[#1a1b1f] border border-[#2b2c31] rounded-xl px-3 py-2">
        <div className="flex items-center gap-2">
          <Table className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-medium text-white">Structured Few-Shot Prompt</span>
        </div>
        <button
          id="add-example-btn"
          onClick={addExample}
          className="px-2 py-1 rounded-md bg-[#25272e] hover:bg-[#2e313a] text-blue-300 text-[11px] font-medium flex items-center gap-1 border border-[#353842]"
        >
          <Plus className="w-3 h-3" />
          <span>Add Example</span>
        </button>
      </div>

      {/* Examples List */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-[#9aa0a6] uppercase tracking-wider px-1">
          Few-Shot Examples ({examples.length})
        </div>

        {examples.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#17181c] border border-dashed border-[#2b2c31] text-center text-xs text-zinc-500">
            No examples added. Click &quot;Add Example&quot; to teach Gemini your expected input-output format.
          </div>
        ) : (
          examples.map((ex, index) => (
            <div
              key={ex.id}
              className="bg-[#1a1b20] border border-[#2b2c31] rounded-xl p-2.5 space-y-2"
            >
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="font-semibold text-blue-300">
                  Example #{index + 1}
                </span>
                <button
                  onClick={() => removeExample(ex.id)}
                  className="p-1 text-zinc-500 hover:text-rose-400 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-0.5">Input</span>
                  <textarea
                    value={ex.input}
                    onChange={(e) => updateExample(ex.id, "input", e.target.value)}
                    placeholder="Input text..."
                    rows={2}
                    className="w-full bg-[#141416] border border-[#282a30] rounded-lg p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 resize-none font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block mb-0.5">Expected Output</span>
                  <textarea
                    value={ex.output}
                    onChange={(e) => updateExample(ex.id, "output", e.target.value)}
                    placeholder="Expected output / JSON..."
                    rows={2}
                    className="w-full bg-[#141416] border border-[#282a30] rounded-lg p-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 resize-none font-mono"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Test Input */}
      <div className="bg-[#1a1b20] border border-[#2b2c31] rounded-xl p-3 space-y-2">
        <label className="text-[11px] font-semibold text-zinc-300 block">
          Test Case Input
        </label>
        <textarea
          id="structured-test-input"
          value={testInput}
          onChange={(e) => setTestInput(e.target.value)}
          placeholder="Enter new test input to test against the structured model..."
          rows={3}
          className="w-full bg-[#141416] border border-[#282a30] rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
        />

        <div className="flex justify-end pt-1">
          {isGenerating ? (
            <button
              onClick={onStop}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              id="structured-run-btn"
              onClick={handleRun}
              disabled={!testInput.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md active:scale-95 transition-colors ${
                testInput.trim()
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-[#25272e] text-zinc-500 cursor-not-allowed"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Generate Output</span>
            </button>
          )}
        </div>
      </div>

      {/* Predicted Output */}
      <div className="bg-[#1a1b20] border border-[#2b2c31] rounded-xl p-3 min-h-[140px] space-y-2">
        <div className="flex items-center justify-between text-[11px] text-[#9aa0a6] pb-2 border-b border-[#282a30]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-zinc-300">Model Prediction</span>
          </div>
          {output && (
            <button
              onClick={handleCopy}
              className="p-1 rounded text-[#9aa0a6] hover:text-white hover:bg-[#25272e] transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {output ? (
          <div className="prose prose-invert prose-xs max-w-none break-words [&>pre]:bg-[#121214] [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-[#2c2d33] [&>code]:text-blue-300">
            <Markdown>{output}</Markdown>
          </div>
        ) : (
          <div className="flex items-center justify-center text-xs text-zinc-500 italic py-6">
            {isGenerating ? "Predicting structured output..." : "Structured result will appear here."}
          </div>
        )}
      </div>
    </div>
  );
};
