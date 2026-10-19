import { createContext } from 'react';

import { EMPTY_CONTEXT, type AuthorizationContext } from './types';

/**
 * React context carrying the current user's normalised authorization context
 * (TASK-IAM-005). Populated by <AuthorizationProvider> from the auth store; consumed by
 * every authorization hook. Defaults to an empty (deny-nothing-granted) context.
 */
export const AuthorizationReactContext = createContext<AuthorizationContext>(EMPTY_CONTEXT);
