import * as fs from 'fs';

let content = fs.readFileSync('src/components/ImportProjectSheet.tsx', 'utf-8');

content = content.replace(
  'loadStoredProjects,',
  'projectsManager,'
);

content = content.replace(
  'const projects = loadStoredProjects();',
  'const projects = projectsManager.getItems();'
);

fs.writeFileSync('src/components/ImportProjectSheet.tsx', content);
