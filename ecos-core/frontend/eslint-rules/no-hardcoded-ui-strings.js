/**
 * ECOS i18n Guard — no-hardcoded-ui-strings (TASK-I18N-GUARD-001)
 *
 * Fails the build when a user-facing English string is written directly into a
 * React component instead of coming from the localization system.
 *
 * What it flags
 * ─────────────
 *   1. JSX text nodes:            <p>Save changes</p>
 *   2. User-facing string props:  placeholder="Search orders"
 *   3. Toast / notification text: toast.success('Order created')
 *   4. Object literals that feed the UI: { title: 'Delete order' }
 *
 * What it deliberately allows (per TASK-I18N-GUARD-001 exceptions)
 * ───────────────────────────────────────────────────────────────
 *   • Brand / product / third-party names  (WooCommerce, Meta, Shopify…)
 *   • Technical identifiers and API names  (SKU, API, FIFO, UUID, SHA-256…)
 *   • Programming terms                    (JSON, HTTP, webhook, git…)
 *   • Non-linguistic content: numbers, symbols, punctuation, single letters,
 *     format placeholders (URLs, emails, phone masks), CSS-ish tokens.
 *   • Anything already wrapped in t(), Trans, or a translation call.
 *
 * Escape hatch for genuine one-offs:
 *   // eslint-disable-next-line ecos-i18n/no-hardcoded-ui-strings -- <reason>
 */

/** Brand, product, and third-party names that must stay in English. */
const BRAND_TERMS = new Set([
  'woocommerce', 'shopify', 'amazon', 'noon', 'salla', 'zid', 'meta', 'facebook',
  'instagram', 'whatsapp', 'telegram', 'google', 'gmail', 'waze', 'claude',
  'claude code', 'github', 'gitlab', 'docker', 'laravel', 'react', 'vite',
  'typescript', 'javascript', 'tailwind', 'redis', 'mysql', 'postgresql',
  'meilisearch', 'sentry', 'stripe', 'paypal', 'ecos', 'aiwos',
]);

/** Technical identifiers, API names, and programming terms. */
const TECHNICAL_TERMS = new Set([
  'api', 'apis', 'sku', 'skus', 'uuid', 'id', 'ids', 'url', 'urls', 'uri',
  'json', 'xml', 'csv', 'pdf', 'html', 'css', 'sql', 'http', 'https', 'ftp',
  'rest', 'graphql', 'webhook', 'webhooks', 'oauth', 'jwt', 'ssl', 'tls',
  'fifo', 'fefo', 'lifo', 'abc', 'kpi', 'kpis', 'roi', 'roas', 'cpc', 'cpm',
  'ctr', 'utm', 'crm', 'erp', 'pos', 'hr', 'bom', 'boms', 'sha-256', 'md5',
  'ci', 'cd', 'sdk', 'cli', 'ui', 'ux', 'db', 'orm', 'dto', 'adr',
  'git', 'commit', 'branch', 'diff', 'patch', 'repo', 'merge', 'rebase',
  'phpstan', 'eslint', 'pint', 'composer', 'npm', 'yarn', 'pnpm', 'tsc',
  'vip', 'egp', 'usd', 'eur', 'sar', 'aed', 'qty', 'pcs', 'kg', 'gm',
]);

/** JSX attributes whose string values are rendered to the user. */
const USER_FACING_PROPS = new Set([
  'placeholder', 'label', 'title', 'description', 'emptyMessage', 'tooltip',
  'alt', 'aria-label', 'helperText', 'hint', 'subtitle', 'caption',
  'confirmLabel', 'cancelLabel', 'submitLabel', 'heading', 'message',
]);

/** Object-literal keys that typically carry user-facing copy. */
const USER_FACING_KEYS = new Set([
  'title', 'description', 'label', 'message', 'placeholder', 'heading',
  'subtitle', 'emptyMessage', 'tooltip', 'hint', 'confirmLabel', 'cancelLabel',
]);

/** Props that are structural/technical and never user-visible copy. */
const IGNORED_PROPS = new Set([
  'className', 'class', 'id', 'key', 'type', 'name', 'role', 'href', 'src',
  'to', 'path', 'value', 'variant', 'size', 'color', 'width', 'height',
  'data-testid', 'testId', 'htmlFor', 'target', 'rel', 'method', 'action',
  'accept', 'autoComplete', 'inputMode', 'pattern', 'form', 'style',
]);

const TRANSLATION_CALLEES = new Set(['t', 'translate', 'i18n']);

/**
 * A string is "user-facing prose" when it contains at least two consecutive
 * letters and reads like language rather than a token or identifier.
 */
function isUserFacingProse(raw) {
  const text = String(raw).trim();

  if (text.length < 3) return false;
  // Needs at least one multi-letter word.
  if (!/[A-Za-z]{2,}/.test(text)) return false;
  // Already Arabic → not an English hardcode (separate rule bans Arabic in TSX).
  if (/[؀-ۿ]/.test(text)) return false;
  // Format placeholders and machine tokens.
  if (/^(https?:\/\/|mailto:|tel:|\/|#|\{|\$)/.test(text)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(text)) return false;          // email sample
  if (/^\+?[\d\s()X-]+$/.test(text)) return false;            // phone mask
  if (/^[A-Z0-9_-]+$/.test(text) && text.length <= 12) return false; // CONST/CODE
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(text)) return false;      // camelCase token
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(text)) return false;    // kebab-token
  // Tailwind-ish class soup.
  if (/^(flex|grid|block|inline|hidden|absolute|relative|w-|h-|p[xytrbl]?-|m[xytrbl]?-|text-|bg-|border|rounded|gap-|space-)/.test(text)) return false;

  const normalized = text.toLowerCase().replace(/[.,:;!?()[\]…]/g, '').trim();

  // Whole string is an allowed brand/technical term.
  if (BRAND_TERMS.has(normalized) || TECHNICAL_TERMS.has(normalized)) return false;

  // Every word is an allowed term (e.g. "API URL", "SKU / UUID").
  const words = normalized.split(/[\s/&|+-]+/).filter(Boolean);
  if (words.length > 0 && words.every((w) => BRAND_TERMS.has(w) || TECHNICAL_TERMS.has(w) || /^\d+$/.test(w))) {
    return false;
  }

  return true;
}

/** True when the node sits inside a t()/Trans call already. */
function isInsideTranslation(node) {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (cur.type === 'CallExpression') {
      const c = cur.callee;
      if (c.type === 'Identifier' && TRANSLATION_CALLEES.has(c.name)) return true;
      if (c.type === 'MemberExpression' && c.property?.type === 'Identifier'
        && TRANSLATION_CALLEES.has(c.property.name)) return true;
    }
    if (cur.type === 'JSXElement') {
      const n = cur.openingElement?.name;
      if (n?.type === 'JSXIdentifier' && n.name === 'Trans') return true;
    }
  }
  return false;
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow hardcoded user-facing English strings in React components; all UI text must come from the i18n system.',
    },
    schema: [{
      type: 'object',
      properties: {
        allow: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    }],
    messages: {
      hardcoded:
        'Hardcoded UI string {{text}} — move it into a translation namespace and use t(). Brand names, product names, technical identifiers, and API names are exempt.',
    },
  },

  create(context) {
    const extraAllow = new Set((context.options?.[0]?.allow ?? []).map((s) => s.toLowerCase()));
    const allowed = (text) => extraAllow.has(String(text).trim().toLowerCase());

    const report = (node, text) => {
      const preview = String(text).trim().replace(/\s+/g, ' ').slice(0, 40);
      context.report({ node, messageId: 'hardcoded', data: { text: JSON.stringify(preview) } });
    };

    return {
      // 1. <div>Some text</div>
      JSXText(node) {
        const text = node.value.trim();
        if (!text || allowed(text) || !isUserFacingProse(text)) return;
        report(node, text);
      },

      // 2. placeholder="..." / label="..." / title="..."
      JSXAttribute(node) {
        const name = node.name?.type === 'JSXIdentifier' ? node.name.name
          : node.name?.type === 'JSXNamespacedName' ? `${node.name.namespace.name}-${node.name.name.name}`
            : null;
        if (!name || IGNORED_PROPS.has(name) || !USER_FACING_PROPS.has(name)) return;

        const v = node.value;
        if (!v) return;
        if (v.type === 'Literal' && typeof v.value === 'string') {
          if (allowed(v.value) || !isUserFacingProse(v.value)) return;
          report(v, v.value);
        }
      },

      // 3. toast.success('...') / toast.error('...')
      //    plus 4. { title: '...', description: '...' }
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (allowed(node.value) || !isUserFacingProse(node.value)) return;
        if (isInsideTranslation(node)) return;

        const parent = node.parent;

        // toast.*(...) and notify.*(...)
        if (parent?.type === 'CallExpression' && parent.arguments.includes(node)) {
          const c = parent.callee;
          const obj = c?.type === 'MemberExpression' && c.object?.type === 'Identifier' ? c.object.name : null;
          if (obj === 'toast' || obj === 'notify') { report(node, node.value); }
          return;
        }

        // { title: 'Delete order' } — only for known copy-bearing keys
        if (parent?.type === 'Property' && parent.value === node) {
          const k = parent.key;
          const keyName = k?.type === 'Identifier' ? k.name : (k?.type === 'Literal' ? String(k.value) : null);
          if (keyName && USER_FACING_KEYS.has(keyName)) { report(node, node.value); }
        }
      },
    };
  },
};
