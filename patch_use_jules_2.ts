import * as fs from 'fs';

let content = fs.readFileSync('src/hooks/useJules.ts', 'utf-8');

content = content.replace(/setJulesSessions\(sessions\);/g, '');
content = content.replace(/setJulesSessions\(\(prev\) =>\n\s*prev.map\(\(s\) => \(s\.id === session\.id \? session : s\)\)\n\s*\);/g, '');
content = content.replace(/setJulesSessions\(\(prev\) => prev.filter\(\(s\) => !sessionIds\.includes\(s\.id\)\)\);/g, '');
content = content.replace(/setJulesSessions\(\(prevSessions\) =>\n\s*prevSessions\.map\(\(s\) =>\n\s*s\.id === activeJulesSession\.id \? \{ \.\.\.s, messages: julesMessages \} : s\n\s*\)\n\s*\);/g, '');
content = content.replace(/, setJulesSessions\]/g, ']');

// Also update `activeJulesSession`
content = content.replace(
  'const [activeJulesSession, setActiveJulesSession] = useState<JulesSession | null>(null);',
  'const activeJulesSession = julesStore.activeItem;\n  const setActiveJulesSession = () => {};'
);

content = content.replace(/setActiveJulesSession\(null\);/g, '');
content = content.replace(/setActiveJulesSession\(session\);/g, '');
content = content.replace(/setActiveJulesSession\(newSession\);/g, '');
content = content.replace(/setActiveJulesSession\(\(prev\) => \(prev && prev.id === session.id \? session : prev\)\);/g, '');
content = content.replace(/setActiveJulesSession\(\{ \.\.\.activeJulesSession, messages: julesMessages \}\);/g, '');

fs.writeFileSync('src/hooks/useJules.ts', content);
