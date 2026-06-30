# Next.js + Electron + Hardware Licensing

A bulletproof boilerplate to wrap a Next.js (Standalone) web app into a Windows `.exe` using Electron, with built-in hardware ID validation to prevent piracy.

## Features
- **Standalone Wrapper**: Skips the tedious Next.js custom server setup by wrapping the output of `next build` (standalone).
- **Env Injector**: Automatically copies your `.env.local` securely into the `.exe` build.
- **Hardware Lock**: Reads the physical machine's MAC/HWID to validate licenses against your cloud backend before opening the app.

## How to use
1. Run `npm run build:win`. This will build your Next.js app, copy the env vars, and wrap it in Electron.
2. The `electron-main.js` will intercept startup, read the HWID via `node-machine-id`, and start the internal server on a random port.

## License
MIT - Created by Brecha Soluciones S.A. de C.V.
