import { OfflineQueue } from '../queue';

describe('OfflineQueue (without @react-native-async-storage/async-storage installed)', () => {
    it('still works purely in-memory, degrading gracefully', async () => {
        const queue = new OfflineQueue(5);

        expect(queue.isEmpty()).toBe(true);

        queue.enqueue({ title: 'a', message: 'a' } as any);
        queue.enqueue({ title: 'b', message: 'b' } as any);

        expect(queue.size()).toBe(2);
        expect(queue.peek()?.report.message).toBe('a');

        const sent: string[] = [];
        await queue.processQueue(async (report) => {
            sent.push(report.message);
        });

        expect(sent).toEqual(['a', 'b']);
        expect(queue.isEmpty()).toBe(true);
    });

    it('respects maxSize by dropping the oldest entry', () => {
        const queue = new OfflineQueue(2);
        queue.enqueue({ title: '1', message: '1' } as any);
        queue.enqueue({ title: '2', message: '2' } as any);
        queue.enqueue({ title: '3', message: '3' } as any);

        expect(queue.size()).toBe(2);
        expect(queue.peek()?.report.message).toBe('2');
    });
});
