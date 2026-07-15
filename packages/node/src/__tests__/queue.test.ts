import fs from 'fs';
import os from 'os';
import path from 'path';
import OfflineQueue from '../utils/queue';
import { ErrorReport } from '../types';

function makeReport(message = 'boom'): ErrorReport {
    return {
        title: message,
        message,
        environment: 'test',
        severity: 'medium',
        tags: [],
        fingerprint: 'abc123',
        context: {},
        timestamp: Date.now(),
    };
}

describe('OfflineQueue', () => {
    let queueDir: string;

    beforeEach(() => {
        queueDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oluso-queue-test-'));
    });

    afterEach(() => {
        fs.rmSync(queueDir, { recursive: true, force: true });
    });

    it('starts empty', () => {
        const queue = new OfflineQueue(100, queueDir);
        expect(queue.isEmpty()).toBe(true);
        expect(queue.size()).toBe(0);
    });

    it('enqueues and dequeues in FIFO order', () => {
        const queue = new OfflineQueue(100, queueDir);
        queue.enqueue(makeReport('first'));
        queue.enqueue(makeReport('second'));

        expect(queue.size()).toBe(2);
        expect(queue.dequeue()?.report.message).toBe('first');
        expect(queue.dequeue()?.report.message).toBe('second');
        expect(queue.isEmpty()).toBe(true);
    });

    it('drops the oldest report once maxSize is exceeded', () => {
        const queue = new OfflineQueue(2, queueDir);
        queue.enqueue(makeReport('first'));
        queue.enqueue(makeReport('second'));
        queue.enqueue(makeReport('third'));

        expect(queue.size()).toBe(2);
        expect(queue.peek()?.report.message).toBe('second');
    });

    it('persists the queue to disk and reloads it', () => {
        const queue = new OfflineQueue(100, queueDir);
        queue.enqueue(makeReport('persisted'));

        const reloaded = new OfflineQueue(100, queueDir);
        expect(reloaded.size()).toBe(1);
        expect(reloaded.peek()?.report.message).toBe('persisted');
    });

    it('drops requeued reports after 3 failed retries', () => {
        const queue = new OfflineQueue(100, queueDir);
        const queued = { report: makeReport(), timestamp: Date.now(), retries: 2 };

        queue.requeueFailed(queued);
        expect(queue.isEmpty()).toBe(true);
    });

    it('processQueue sends reports and removes them on success', async () => {
        const queue = new OfflineQueue(100, queueDir);
        queue.enqueue(makeReport('a'));
        queue.enqueue(makeReport('b'));

        const sendFn = jest.fn().mockResolvedValue(undefined);
        await queue.processQueue(sendFn);

        expect(sendFn).toHaveBeenCalledTimes(2);
        expect(queue.isEmpty()).toBe(true);
    });

    it('processQueue stops and requeues on failure without dropping remaining reports', async () => {
        const queue = new OfflineQueue(100, queueDir);
        queue.enqueue(makeReport('will-fail'));
        queue.enqueue(makeReport('never-attempted'));

        const sendFn = jest.fn().mockRejectedValue(new Error('network down'));
        await queue.processQueue(sendFn);

        expect(sendFn).toHaveBeenCalledTimes(1);
        expect(queue.size()).toBe(2);
        expect(queue.peek()?.retries).toBe(1);
    });
});
