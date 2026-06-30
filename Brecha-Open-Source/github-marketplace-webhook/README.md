# GitHub Marketplace Webhook Boilerplate

A plug-and-play Next.js route handler and landing page for developers selling their SaaS on the GitHub Marketplace.

## Features
- **SHA-256 HMAC Signature Verification**: Ensures webhooks actually come from GitHub.
- **Event Parsing**: Automatically detects `marketplace_purchase` and `installation` events.
- **Tornasol Landing Page**: A premium, conversion-optimized landing page with animated gradients (Tornasol effect) using Tailwind.

## How to use
1. Set `GITHUB_WEBHOOK_SECRET` in your `.env`.
2. Configure your GitHub App to point to `https://your-domain.com/api/github/webhook`.
3. Route visitors to `https://your-domain.com/github` for the landing page.

## License
MIT - Created by Brecha Soluciones S.A. de C.V.
