import * as fs from 'fs';

let content = fs.readFileSync('src/utils/storage/ActiveItemManager.ts', 'utf-8');

// Fix the IReadableStore typescript error since getSnapshot() might return undefined in Observable,
// but useStorage requires T.
// We will implement getSnapshot in ActiveItemManager to ALWAYS return the state.

content = content.replace(
  'public getItems(): T[] {',
  'public getSnapshot(): ActiveItemManagerState<T> {\n    return this.currentState!;\n  }\n\n  public getItems(): T[] {'
);

// Add allowImplicitSelection to options
content = content.replace(
  'onActiveItemChange?: (activeItem: T | null) => void;\n}',
  'onActiveItemChange?: (activeItem: T | null) => void;\n  allowImplicitSelection?: boolean;\n}'
);

content = content.replace(
  'private onActiveItemChange?: (activeItem: T | null) => void;',
  'private onActiveItemChange?: (activeItem: T | null) => void;\n  private allowImplicitSelection: boolean;'
);

content = content.replace(
  'this.onActiveItemChange = options.onActiveItemChange;',
  'this.onActiveItemChange = options.onActiveItemChange;\n    this.allowImplicitSelection = options.allowImplicitSelection ?? true;'
);


// Fix logic in getActiveItem
content = content.replace(
  `public getActiveItem(): T | null {
    const items = this.getItems();
    if (items.length === 0) return null;
    const activeId = this.getActiveId();
    if (activeId) {
      const match = items.find((p) => this.getId(p) === activeId);
      if (match) return match;
    }
    return items[0];
  }`,
  `public getActiveItem(): T | null {
    const items = this.getItems();
    if (items.length === 0) return null;
    const activeId = this.getActiveId();
    if (activeId) {
      const match = items.find((p) => this.getId(p) === activeId);
      if (match) return match;
    }
    return this.allowImplicitSelection ? items[0] : null;
  }`
);

// Fix logic in recomputeState
content = content.replace(
  `private recomputeState(): void {
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
  }`,
  `private recomputeState(): void {
    const items = this.getItems();
    const activeId = this.getActiveId();
    let activeItem: T | null = null;
    if (items.length > 0) {
      if (activeId) {
        const match = items.find((p) => this.getId(p) === activeId);
        if (match) activeItem = match;
        else activeItem = this.allowImplicitSelection ? items[0] : null;
      } else {
        activeItem = this.allowImplicitSelection ? items[0] : null;
      }
    }

    this.notify({ items, activeId, activeItem });
  }`
);

// Fix syncActiveIdAfterDeletion implicit fallback
content = content.replace(
  `if (remainingItems.length > 0) {
        this.setActiveId(this.getId(remainingItems[0]));
      } else {
        this.setActiveId(null);
      }`,
  `if (remainingItems.length > 0 && this.allowImplicitSelection) {
        this.setActiveId(this.getId(remainingItems[0]));
      } else {
        this.setActiveId(null);
      }`
);

// Fix saveItems implicit fallback
content = content.replace(
  `if (items.length > 0) {
          this.setActiveId(this.getId(items[0]));
        } else {
          this.setActiveId(null);
        }`,
  `if (items.length > 0 && this.allowImplicitSelection) {
          this.setActiveId(this.getId(items[0]));
        } else {
          this.setActiveId(null);
        }`
);

fs.writeFileSync('src/utils/storage/ActiveItemManager.ts', content);
