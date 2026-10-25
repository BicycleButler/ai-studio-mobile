import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('src/utils/storage/StorageCollection.test.ts', 'utf-8');
content = content.replace(
    'import { describe, it, expect, vi } from \'vitest\';',
    'import { describe, it, expect } from \'vitest\';'
);
writeFileSync('src/utils/storage/StorageCollection.test.ts', content);

content = readFileSync('src/utils/storage/StorageSingleton.test.ts', 'utf-8');
content = content.replace(
    'import { describe, it, expect, vi } from \'vitest\';',
    'import { describe, it, expect } from \'vitest\';'
);
writeFileSync('src/utils/storage/StorageSingleton.test.ts', content);
