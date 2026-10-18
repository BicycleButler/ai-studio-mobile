import * as fs from 'fs';

let content = fs.readFileSync('src/utils/storage/ActiveItemManager.ts', 'utf-8');

const newContent = content
  .replace('import { StorageSingleton } from "./StorageSingleton";', 'import { StorageSingleton } from "./StorageSingleton";\nimport { Observable } from "../observable";')
  .replace('export class ActiveItemManager<T> {', 'export interface ActiveItemManagerState<T> {\n  items: T[];\n  activeId: string | null;\n  activeItem: T | null;\n}\n\nexport class ActiveItemManager<T> extends Observable<ActiveItemManagerState<T>> {')
  .replace('constructor(options: ActiveItemManagerOptions<T>) {', `constructor(options: ActiveItemManagerOptions<T>) {
    super({
      items: options.collection.load(),
      activeId: options.activeIdSingleton.load() ? options.activeIdSingleton.load() : null,
      activeItem: null // We will compute this right after
    });
    this.collection = options.collection;
    this.activeIdSingleton = options.activeIdSingleton;
    this.getId = options.getId;
    this.onActiveItemChange = options.onActiveItemChange;

    this.currentState!.activeItem = this.getActiveItem();

    // Reactively update when underlying storage changes (e.g. from other tabs)
    this.collection.subscribe(() => {
      this.recomputeState();
    });
    this.activeIdSingleton.subscribe(() => {
      this.recomputeState();
    });
  }

  private recomputeState(): void {
    const items = this.getItems();
    const activeId = this.getActiveId();
    let activeItem: T | null = null;
    if (items.length > 0) {
      if (activeId) {
        const match = items.find((p) => this.getId(p) === activeId);
        if (match) activeItem = match;
        else activeItem = items[0];
      } else {
        activeItem = items[0];
      }
    }

    this.notify({ items, activeId, activeItem });
  }`)
  .replace('this.notifyActiveItemChange();', 'this.notifyActiveItemChange();\n    this.recomputeState();')
  .replace('this.notifyActiveItemChange();', 'this.notifyActiveItemChange();\n    this.recomputeState();')
  .replace(/this\.notifyActiveItemChange\(\);/g, 'this.notifyActiveItemChange();\n    this.recomputeState();');

fs.writeFileSync('src/utils/storage/ActiveItemManager.ts', newContent);
