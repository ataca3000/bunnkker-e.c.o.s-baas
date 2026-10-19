import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { EcosInput, type EcosInputProps } from './ecos-input';

export type EcosPasswordInputProps = Omit<EcosInputProps, 'type' | 'trailing'>;

/**
 * Password input with a show/hide toggle button in the trailing slot.
 */
export const EcosPasswordInput = forwardRef<HTMLInputElement, EcosPasswordInputProps>(
  (props, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <EcosInput
          ref={ref}
          type={visible ? 'text' : 'password'}
          trailing={
            <button
              type="button"
              tabIndex={-1}
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible((v) => !v)}
              className="pointer-events-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              {visible
                ? <EyeOff className="size-4" />
                : <Eye className="size-4" />
              }
            </button>
          }
          {...props}
        />
      </div>
    );
  },
);

EcosPasswordInput.displayName = 'EcosPasswordInput';
