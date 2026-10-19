/**
 * ECOS i18n Guard plugin (TASK-I18N-GUARD-001)
 *
 * Local ESLint flat-config plugin that keeps the application fully localized.
 * Wired in eslint.config.js as the `ecos-i18n` plugin; `npm run lint` (and
 * therefore CI) fails when a new hardcoded UI string is introduced.
 */
import noHardcodedUiStrings from './no-hardcoded-ui-strings.js';
import noArabicLiterals from './no-arabic-literals.js';

export default {
  meta: { name: 'eslint-plugin-ecos-i18n', version: '1.0.0' },
  rules: {
    'no-hardcoded-ui-strings': noHardcodedUiStrings,
    'no-arabic-literals': noArabicLiterals,
  },
};
