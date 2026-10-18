import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useAppState.ts', 'utf-8');

// Replace standard useState for projects with useStorage over projectsManager
content = content.replace(/const updated = loadStoredProjects\(\);\n\s*setProjects\(updated\);/g, 'const updated = loadStoredProjects();');
content = content.replace(/const updated = loadStoredProjects\(\);/g, 'const updated = projectsManager.getItems();');

fs.writeFileSync('src/hooks/useAppState.ts', content);
