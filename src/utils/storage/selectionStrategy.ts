export interface ISelectionStrategy<T> {
  selectImplicitItem(items: T[], getId: (item: T) => string): T | null;
}

export class FirstItemSelectionStrategy<T> implements ISelectionStrategy<T> {
  selectImplicitItem(items: T[], _getId: (item: T) => string): T | null {
    if (!items || items.length === 0) {
      return null;
    }
    return items[0];
  }
}

export class NoImplicitSelectionStrategy<T> implements ISelectionStrategy<T> {
  selectImplicitItem(_items: T[], _getId: (item: T) => string): T | null {
    return null;
  }
}
