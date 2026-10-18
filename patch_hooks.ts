import * as fs from 'fs';

let content = fs.readFileSync('src/utils/storage/hooks.ts', 'utf-8');

content = content.replace(
  'return storageInstance.getSnapshot();',
  'return storageInstance.getSnapshot() as T;'
);

fs.writeFileSync('src/utils/storage/hooks.ts', content);
