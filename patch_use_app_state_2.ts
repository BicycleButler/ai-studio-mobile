import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useAppState.ts', 'utf-8');

// Now, handle the activeProject!
// We can use projectManagerStore.activeItem instead of maintaining it separately in useAppState

content = content.replace(
  'const [activeProject, setActiveProject] = useState<ProjectInfo | null>(() => getActiveProject());',
  'const activeProject = projectManagerStore.activeItem;\n  const setActiveProject = () => {};'
);

// We need to ensure that updates properly handle 'setActiveProject' legacy stubs
content = content.replace(/setActiveProject\(null\);/g, '');
content = content.replace(/setActiveProject\(\(prev\) => \(prev \? \{ \.\.\.prev, name: newName \} : null\)\);/g, '');


fs.writeFileSync('src/hooks/useAppState.ts', content);
