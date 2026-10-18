import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useJules.ts', 'utf-8');

content = content.replace(
  'import { useState, useCallback, useEffect, useRef } from "react";',
  'import { useState, useCallback, useEffect, useRef } from "react";\nimport { useStorage, julesSessionsManager } from "../utils/storage";'
);

content = content.replace(
  'const [julesSessions, setJulesSessions] = useState<JulesSession[]>(() => loadStoredJulesSessions());',
  'const julesStore = useStorage(julesSessionsManager);\n  const julesSessions = julesStore.items;\n  const setJulesSessions = () => {};'
);

content = content.replace(/setJulesSessions\(loadStoredJulesSessions\(\)\);/g, '');

fs.writeFileSync('src/hooks/useJules.ts', content);
