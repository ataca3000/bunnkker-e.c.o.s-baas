/**
 * Enterprise UI Authorization Platform (TASK-IAM-005 / ADR-041).
 *
 * The single frontend entry point for authorization. Pages and components consume these
 * hooks/components instead of reading roles or permission strings directly. All checks are
 * UX-only conveniences — the server is the authoritative gate.
 */
export type {
  Authorization,
  AuthorizationContext,
  AuthorizationContextDTO,
  DataScope,
  EffectiveTemplate,
  FeatureKey,
  Permission,
} from './types';
export { EMPTY_CONTEXT, normalizeContext, normalizePermission } from './types';

export { AuthorizationProvider } from './authorization-provider';
export { AuthorizationReactContext } from './authorization-context';

export {
  grants,
  useAuthorization,
  usePermission,
  useVisibility,
  useScope,
  usePolicies,
  useFeature,
  useDashboard,
  useLandingPage,
} from './use-authorization';
export { useNavigation, isModuleVisible } from './use-navigation';

export {
  Can,
  Cannot,
  CanViewField,
  VisibilityBoundary,
  HasScope,
  ScopeBoundary,
  Feature,
  ReadOnly,
} from './components/can';
export { PermissionBoundary, RequirePermission } from './guards/require-permission';
