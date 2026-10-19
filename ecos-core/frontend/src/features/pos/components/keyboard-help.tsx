import { Keyboard } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { usePosStore } from '@/features/pos/store/pos-store';

type Shortcut = { keys: string[]; description: string };

const SHORTCUT_GROUPS: { heading: string; shortcuts: Shortcut[] }[] = [
  {
    heading: 'Transactions',
    shortcuts: [
      { keys: ['Ctrl', 'N'],  description: 'New Sale' },
      { keys: ['F8'],         description: 'Open Payment' },
      { keys: ['F9'],         description: 'Hold Cart' },
      { keys: ['Ctrl', 'H'], description: 'View Held Carts' },
      { keys: ['Escape'],     description: 'Cancel / Close Panel' },
    ],
  },
  {
    heading: 'Modes',
    shortcuts: [
      { keys: ['Alt', '1'],   description: 'Sale Mode' },
      { keys: ['Ctrl', 'R'],  description: 'Return Mode' },
      { keys: ['Ctrl', 'E'],  description: 'Exchange Mode' },
      { keys: ['Ctrl', 'M'],  description: 'Manager View' },
    ],
  },
  {
    heading: 'Navigation',
    shortcuts: [
      { keys: ['/'],          description: 'Search for a product' },
      { keys: ['Enter'],      description: 'Confirm barcode scan' },
      { keys: ['Shift', '?'], description: 'Toggle help panel' },
    ],
  },
];

export function KeyboardHelp() {
  const { keyboardHelpOpen, toggleKeyboardHelp } = usePosStore();

  return (
    <Dialog open={keyboardHelpOpen} onOpenChange={toggleKeyboardHelp}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="size-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground text-center">
          Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-xs">?</kbd> to toggle
        </p>
      </DialogContent>
    </Dialog>
  );
}
