const fs = require('fs');
let content = fs.readFileSync('src/components/LibraryModal.tsx', 'utf8');

content = content.replace(
  /\{selectedPromptIds\.size === savedPrompts\.length \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary" \/>\n\s*\) : selectedPromptIds\.size > 0 \? \(\n\s*<MinusSquare className="w-4 h-4 text-primary" \/>\n\s*\) : \(\n\s*<Square className="w-4 h-4" \/>\n\s*\)\}/,
  `{getSelectionState(savedPrompts) === 'all' ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : getSelectionState(savedPrompts) === 'some' ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}`
);

fs.writeFileSync('src/components/LibraryModal.tsx', content, 'utf8');
