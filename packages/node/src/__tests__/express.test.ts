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

    // Regression test: a business-rule error (e.g. "insufficient stock")
    // thrown with its own `.status = 409` used to get its response status
    // forced to 500 by errorHandler defaulting straight to 500 whenever
    // res.statusCode was still 200, ignoring what the error itself said.
    it("errorHandler respects the error's own status code instead of defaulting to 500", () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        const req = makeReq();
        const res = makeRes(200);
        const next = jest.fn();
        const error: any = new Error('Insufficient stock for p2');
        error.status = 409;

        oluso.errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(409);
        const report = mockSendErrorReport.mock.calls[0][1];
        expect(report.message).toBe('Insufficient stock for p2');
    });

    // Regression test for a real duplicate-reporting bug: errorHandler and
    // requestHandler's res.json/send/end overrides used to track "already
    // reported" independently (a local closure variable inside
    // requestHandler that errorHandler had no access to). So a route that
    // threw, got correctly reported by errorHandler, and then had its
    // response actually sent downstream (e.g. an app's own final JSON
    // formatter) looked to requestHandler's wrapper like an unreported
    // >=500 failure -- producing a second, synthetic "Server error: 500 -
    // ..." report for the same already-handled error, with a stack trace
    // pointing into this SDK's own code instead of the real one.
    it('does not double-report when errorHandler already reported and a downstream handler later sends the response', () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });
        const req = makeReq();
        const res = makeRes(200);
        const next = jest.fn();
        const error: any = new Error('Insufficient stock for p2');
        error.status = 409;

        // Mount order matches a real app: requestHandler first (installs
        // the res.json/send/end wrappers), then the route throws and
        // errorHandler handles it, then some downstream error-handling
        // middleware (the app's own) sends the actual response.
        oluso.requestHandler(req, res, jest.fn());
        oluso.errorHandler(error, req, res, next);
        res.json({ error: error.message }); // simulates the app's own final handler

        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        expect(mockSendErrorReport.mock.calls[0][1].message).toBe('Insufficient stock for p2');
    });

    // Regression test: errors from code that never runs inside Express's
    // request/response cycle (a cron job, a queue consumer) are invisible to
    // requestHandler/errorHandler, and invisible to the global
    // uncaughtException/unhandledRejection handlers too if that code catches
    // its own errors. captureException must be reachable off the same
    // instance for that code to report explicitly.
    it('exposes captureException/addBreadcrumb/setUserContext/setCustomContext/flush for non-Express code', async () => {
        const oluso = olusoExpress({ apiKey: 'test-api-key', logToConsole: false });

        expect(typeof oluso.captureException).toBe('function');
        expect(typeof oluso.addBreadcrumb).toBe('function');
        expect(typeof oluso.setUserContext).toBe('function');
        expect(typeof oluso.setCustomContext).toBe('function');
        expect(typeof oluso.flush).toBe('function');

        await oluso.captureException(new Error('background job failed'));
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        const report = mockSendErrorReport.mock.calls[0][1];
        expect(report.message).toBe('background job failed');
    });
});
