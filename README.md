# Oluso

AI-powered error monitoring for JavaScript and TypeScript applications — automatic error reporting, context tracking, and intelligent error grouping across backend and frontend.

This is a monorepo containing the Oluso SDKs:

| Package | Description |
| --- | --- |
| [`oluso`](packages/node) | Node.js SDK — Express and NestJS adapters, plus a framework-agnostic core |
| [`@oluso/react`](packages/react) | React SDK — error boundary, provider, and hook |
| [`@oluso/core`](packages/core) | Shared types and platform-agnostic utilities used internally by the SDKs above |

## Installation

```bash
# Node.js backend
npm install oluso

# React frontend
npm install @oluso/react
```

See each package's README for usage.

## Development

This repo uses npm workspaces.

```bash
npm install       # installs all packages
npm run build     # builds all packages
npm test          # tests all packages
```

## License

MIT
