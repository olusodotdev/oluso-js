import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { OlusoClient } from '../client';

function Boom(): never {
    throw new Error('render blew up');
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.error as jest.Mock).mockRestore();
    });

    it('renders children when there is no error', () => {
        const client = new OlusoClient({ apiKey: 'test-api-key', enableOfflineQueue: false });
        render(
            <ErrorBoundary client={client}>
                <div>all good</div>
            </ErrorBoundary>
        );

        expect(screen.getByText('all good')).toBeTruthy();
    });

    it('reports the error and renders the fallback when a child throws', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;
        const client = new OlusoClient({ apiKey: 'test-api-key', enableOfflineQueue: false });
        const captureSpy = jest.spyOn(client, 'captureException');

        render(
            <ErrorBoundary client={client} fallback={<div>something broke</div>}>
                <Boom />
            </ErrorBoundary>
        );

        expect(screen.getByText('something broke')).toBeTruthy();
        expect(captureSpy).toHaveBeenCalledTimes(1);
        expect(captureSpy.mock.calls[0][0].message).toBe('render blew up');
    });
});
