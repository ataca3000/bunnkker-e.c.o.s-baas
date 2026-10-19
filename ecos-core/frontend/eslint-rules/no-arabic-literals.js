/**
 * ECOS i18n Guard — no-arabic-literals (TASK-I18N-GUARD-001)
 *
 * Arabic copy belongs in src/i18n/locales/ar/*.json, never inline in a
 * component. Inline Arabic silently breaks language switching: the string
 * renders in Arabic even when the user selects English.
 *
 * Escape hatch:
 *   // eslint-disable-next-line ecos-i18n/no-arabic-literals -- <reason>
 */

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow inline Arabic string literals in components; Arabic copy must live in the ar locale files.',
    },
    schema: [],
    messages: {
      arabic:
        'Inline Arabic text {{text}} — move it to src/i18n/locales/ar/<namespace>.json and reference it with t().',
    },
  },

  create(context) {
    const check = (node, value) => {
      if (typeof value !== 'string' || !ARABIC.test(value)) return;
      const preview = value.trim().replace(/\s+/g, ' ').slice(0, 30);
      context.report({ node, messageId: 'arabic', data: { text: JSON.stringify(preview) } });
    };

    return {
      Literal(node) { check(node, node.value); },
      JSXText(node) { check(node, node.value); },
      TemplateElement(node) { check(node, node.value?.cooked ?? ''); },
    };
  },
};
