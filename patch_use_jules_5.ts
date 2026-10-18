import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useJules.ts', 'utf-8');

content = content.replace(
  'import {\n  dispatchJulesTask,',
  'import {\n  useStorage,\n  julesSessionsManager\n} from "../utils/storage";\nimport {\n  dispatchJulesTask,'
);

// Fix the any type error
content = content.replace(
  'setJulesSessions((prev) => prev.filter((s) => !sessionIds.includes(s.id)));',
  'setJulesSessions((prev) => prev.filter((s: JulesSession) => !sessionIds.includes(s.id)));'
);

// We had some issue replacing the previous setJulesSessions filter in `patch_use_jules_2.ts`
content = content.replace(
  'setJulesSessions((prev) =>\n      prev.filter((s) => !sessionIds.includes(s.id))\n    );',
  'setJulesSessions((prev) => prev.filter((s: JulesSession) => !sessionIds.includes(s.id)));'
);

fs.writeFileSync('src/hooks/useJules.ts', content);
