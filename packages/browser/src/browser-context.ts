import { DeviceContext } from '@oluso/core';

/**
 * Collect browser/device context. Returns an empty object outside a browser
 * environment (e.g. during SSR) rather than throwing.
 */
export function getBrowserContext(): DeviceContext {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {};
    }

    return {
        userAgent: navigator.userAgent,
        url: window.location?.href,
        language: navigator.language,
        platform: navigator.platform,
        screen: typeof screen !== 'undefined'
            ? { width: screen.width, height: screen.height }
            : undefined,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        online: navigator.onLine,
    };
}

export default getBrowserContext;
