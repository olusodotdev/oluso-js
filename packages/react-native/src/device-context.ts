import { DeviceContext } from '@oluso/core';

/**
 * Collect device context via React Native's Platform/Dimensions APIs.
 * Uses `require` rather than a static import so this package can be built
 * and tested without `react-native` installed; in a real RN app Metro
 * resolves the require normally.
 */
export function getDeviceContext(): DeviceContext {
    try {
        const { Platform, Dimensions } = require('react-native');
        const window = Dimensions.get('window');
        const screen = Dimensions.get('screen');

        return {
            platform: `${Platform.OS} ${Platform.Version}`,
            screen: { width: screen.width, height: screen.height },
            viewport: { width: window.width, height: window.height },
        };
    } catch {
        return {};
    }
}

export default getDeviceContext;
