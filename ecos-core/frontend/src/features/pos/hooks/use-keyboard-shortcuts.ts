import { useEffect, useRef } from 'react';

export type ShortcutHandler = (e: KeyboardEvent) => void;

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  handler: ShortcutHandler;
};

function matches(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
  const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
  const altMatch = !!shortcut.alt === e.altKey;
  const shiftMatch = !!shortcut.shift === e.shiftKey;
  return keyMatch && ctrlMatch && altMatch && shiftMatch;
}

// Registers the event listener once. Reads current shortcuts and enabled state
// from refs on each keydown, so there is no re-registration on every render.
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!enabledRef.current) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key !== 'Escape') return;
      }

      for (const shortcut of shortcutsRef.current) {
        if (matches(e, shortcut)) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);  
}

/** Canonical POS keyboard shortcut definitions (for display in help panel). */
export const POS_SHORTCUTS = {
  newSale:        { key: 'n',      ctrl: true,  description: 'New sale' },
  payment:        { key: 'F8',                  description: 'Open payment' },
  holdCart:       { key: 'F9',                  description: 'Hold cart' },
  cancelCart:     { key: 'Escape',              description: 'Cancel / close' },
  returnMode:     { key: 'r',      ctrl: true,  description: 'Return mode' },
  exchangeMode:   { key: 'e',      ctrl: true,  description: 'Exchange mode' },
  saleMode:       { key: '1',      alt:  true,  description: 'Sale mode' },
  managerMode:    { key: 'm',      ctrl: true,  description: 'Manager view' },
  customerSearch: { key: 'k',      ctrl: true,  description: 'Customer search' },
  searchFocus:    { key: '/',                   description: 'Focus product search' },
  cartUp:         { key: '↑',                   description: 'Select previous item' },
  cartDown:       { key: '↓',                   description: 'Select next item' },
  cartEditQty:    { key: 'Enter',               description: 'Edit selected quantity' },
  cartIncrease:   { key: '+',                   description: 'Increase quantity' },
  cartDecrease:   { key: '-',                   description: 'Decrease quantity' },
  cartRemove:     { key: 'Delete',              description: 'Remove selected item' },
  keyboardHelp:   { key: '?',      shift: true, description: 'Keyboard shortcuts help' },
} as const;
