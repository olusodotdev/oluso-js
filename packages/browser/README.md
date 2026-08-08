# @oluso/browser

Shared browser client for Oluso error monitoring — used internally by [`@oluso/react`](../react) and [`@oluso/vue`](../vue), since there's no meaningful platform difference between "React in a browser" and "Vue in a browser".

Provides `OlusoClient`: global `window.onerror`/`unhandledrejection` capture, `fetch`-based reporting, and a `localStorage`-backed offline queue. It isn't meant to be installed directly unless you're integrating a framework that doesn't have a dedicated Oluso package yet — install `@oluso/react` or `@oluso/vue` instead if one exists for your framework.

## Process monitors

`OlusoClient` also exposes `heartbeat(url, options)`, `assertOutcome(options)`, and `workflow(reference, runId?)`. These APIs are inherited by React, Vue, and Angular clients. See the [complete monitor guide](../../README.md#monitor-outcomes-heartbeats-and-workflows).

## License

MIT
