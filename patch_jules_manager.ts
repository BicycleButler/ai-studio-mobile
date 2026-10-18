import * as fs from 'fs';

let content = fs.readFileSync('src/utils/storage/jules.ts', 'utf-8');

content = content.replace(
  'getId: (s) => s.id,',
  'getId: (s) => s.id,\n  allowImplicitSelection: false,'
);

fs.writeFileSync('src/utils/storage/jules.ts', content);
