import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useAppState.ts', 'utf-8');

// Fix setActiveProject and setProjects stubs
content = content.replace(
  'const setActiveProject = () => {};',
  'const setActiveProject: React.Dispatch<React.SetStateAction<ProjectInfo | null>> = (val) => { \n    if (typeof val === "function") { \n      const result = val(activeProject); \n      projectsManager.setActiveId(result ? result.id : null); \n    } else { \n      projectsManager.setActiveId(val ? val.id : null); \n    } \n  };'
);

content = content.replace(
  'const setProjects = () => {}; // Stub for any legacy callers',
  'const setProjects: React.Dispatch<React.SetStateAction<ProjectInfo[]>> = (val) => { \n    if (typeof val === "function") { \n      projectsManager.saveItems(val(projects)); \n    } else { \n      projectsManager.saveItems(val); \n    } \n  };'
);

fs.writeFileSync('src/hooks/useAppState.ts', content);
