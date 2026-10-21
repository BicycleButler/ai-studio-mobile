const fs = require('fs');
let content = fs.readFileSync('src/components/JulesSessionDrawer.tsx', 'utf8');

content = content.replace(
  /\{selectedSessionIds\.size === filteredSessions\.length \? \(\n\s*<CheckSquare className="w-4 h-4 text-primary" \/>\n\s*\) : selectedSessionIds\.size > 0 \? \(\n\s*<MinusSquare className="w-4 h-4 text-primary" \/>\n\s*\) : \(\n\s*<Square className="w-4 h-4" \/>\n\s*\)\}/,
  `{getSelectionState(filteredSessions) === 'all' ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : getSelectionState(filteredSessions) === 'some' ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}`
);

fs.writeFileSync('src/components/JulesSessionDrawer.tsx', content, 'utf8');
