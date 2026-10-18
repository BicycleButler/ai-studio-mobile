import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useAppState.ts', 'utf-8');

// Replace standard useState for projects with useStorage over projectsManager
content = content.replace(
  'loadStoredProjects,',
  'loadStoredProjects,\n  projectsManager,'
);

// We need to import useStorage
content = content.replace(
  'import { useState, useEffect } from "react";',
  'import { useState, useEffect, useMemo } from "react";\nimport { useStorage } from "../utils/storage";'
);

// Replace:
// const [projects, setProjects] = useState<ProjectInfo[]>(() => loadStoredProjects());
content = content.replace(
  'const [projects, setProjects] = useState<ProjectInfo[]>(() => loadStoredProjects());',
  `const projectManagerStore = useStorage(projectsManager);
  const projects = projectManagerStore.items;
  const setProjects = () => {}; // Stub for any legacy callers
`
);

// Update methods to remove manual state syncing
content = content.replace(/setProjects\(loadStoredProjects\(\)\);/g, '');
content = content.replace(/const updated = loadStoredProjects\(\);\n\s*setProjects\(updated\);/g, 'const updated = loadStoredProjects();');

fs.writeFileSync('src/hooks/useAppState.ts', content);
