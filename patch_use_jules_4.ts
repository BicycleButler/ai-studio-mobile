import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useJules.ts', 'utf-8');

content = content.replace(
  'const setJulesSessions = () => {};',
  'const setJulesSessions: React.Dispatch<React.SetStateAction<JulesSession[]>> = (val) => { \n    if (typeof val === "function") { \n      julesSessionsManager.saveItems(val(julesSessions)); \n    } else { \n      julesSessionsManager.saveItems(val); \n    } \n  };'
);

content = content.replace(
  'const [activeJulesSession, setActiveJulesSession] = useState<JulesSession | null>(() => getActiveJulesSession());',
  'const activeJulesSession = julesStore.activeItem;\n  const setActiveJulesSession: React.Dispatch<React.SetStateAction<JulesSession | null>> = (val) => { \n    if (typeof val === "function") { \n      const result = val(activeJulesSession); \n      julesSessionsManager.setActiveId(result ? result.id : null); \n    } else { \n      julesSessionsManager.setActiveId(val ? val.id : null); \n    } \n  };'
);

fs.writeFileSync('src/hooks/useJules.ts', content);
