import { EventEmitter } from 'events';
import { olusoExpress } from '../adapters/express';
import * as httpsUtils from '../utils/https';

jest.mock('../utils/https');

function makeRes(statusCode = 200) {
    const res: any = new EventEmitter();
    res.statusCode = statusCode;
    res.send = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.status = jest.fn((code: number) => {
        res.statusCode = code;
        return res;
    });
    return res;
}

function makeReq() {
    return { method: 'GET', path: '/widgets', query: {}, headers: {} } as any;
}

describe('olusoExpress', () => {
    const mockSendErrorReport = httpsUtils.sendErrorReport as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSendErrorReport.mockResolvedValue(undefined);
    });

    // Regression test for the exact bug this split fixed: Express decides
    // regular vs. error-handling middleware purely by fn.length. A single
    // function trying to serve both roles necessarily has length 4 (or 3),
    // so Express would only ever dispatch it as one or the other --
    // silently making the other mode permanently unreachable in a real app.
    it('returns a requestHandler with arity 3 and an errorHandler with arity 4', () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        expect(oluso.requestHandler.length).toBe(3);
        expect(oluso.errorHandler.length).toBe(4);
    });

    it('requestHandler calls next and reports when a 5xx response is sent', () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        oluso.requestHandler(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        res.statusCode = 500;
        res.json({ error: 'boom' });

        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        const report = mockSendErrorReport.mock.calls[0][1];
        expect(report.message).toContain('Server error: 500');
    });

    it('requestHandler does not report on a 2xx response', () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        const req = makeReq();
        const res = makeRes();
        const next = jest.fn();

        oluso.requestHandler(req, res, next);
        res.statusCode = 200;
        res.send('ok');

        expect(mockSendErrorReport).not.toHaveBeenCalled();
    });

    it('errorHandler reports the error and forwards to next', () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        const req = makeReq();
        const res = makeRes(200);
        const next = jest.fn();
        const error = new Error('Something went wrong');

        oluso.errorHandler(error, req, res, next);

        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);
        expect(res.status).toHaveBeenCalledWith(500);
        expect((error as any).severity).toBe('critical');
    });
});
