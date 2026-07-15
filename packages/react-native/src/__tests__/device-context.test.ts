import { getDeviceContext } from '../device-context';

describe('getDeviceContext (without react-native installed)', () => {
    it('returns an empty object rather than throwing', () => {
        expect(getDeviceContext()).toEqual({});
    });
});
