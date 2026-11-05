const fs = require('fs');

const file = 'src/components/UnifiedSettingsModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// remove unused imports
content = content.replace(/Volume2,\s*Sliders,\s*FolderHeart,\s*Code2,\s*Compass,\s*Sun,\s*User,\s*/, '');

fs.writeFileSync(file, content);
