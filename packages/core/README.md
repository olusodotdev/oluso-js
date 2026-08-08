# @oluso/core

Shared types and platform-agnostic utilities used internally by the Oluso SDKs (`oluso`, `@oluso/react`, and future platform packages).

This package has no Node-only or browser-only dependencies — everything in it (sanitization, rate limiting, fingerprinting, breadcrumb tracking, shared types) runs identically anywhere JavaScript runs. It isn't meant to be installed directly; install `oluso` (Node.js) or `@oluso/react` (React) instead.

It also owns the platform-neutral `MonitorClient`, typed heartbeat/assertion/workflow contracts, recursive monitor-evidence redaction, timeout handling, and bounded exponential retries used by every JavaScript platform package. Application code should normally call these helpers through its platform client's `heartbeat`, `assertOutcome`, and `workflow` methods.

## License

MIT
