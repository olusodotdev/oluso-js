import { HttpException, HttpStatus } from '@nestjs/common';
import { OlusoExceptionFilter } from '../adapters/nest';
import * as httpsUtils from '../utils/https';

jest.mock('../utils/https');

function makeHttpHost(request: any, response: any) {
    return {
        getType: () => 'http',
        switchToHttp: () => ({
            getRequest: () => request,
            getResponse: () => response,
        }),
    } as any;
}

function makeResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
}

describe('OlusoExceptionFilter', () => {
    const mockSendErrorReport = httpsUtils.sendErrorReport as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSendErrorReport.mockResolvedValue(undefined);
    });

    it('does NOT report 4xx client errors (noise: health-check 404s, expired-session 401s, bad input)', () => {
        const Filter = OlusoExceptionFilter({ apiKey: 'test-api-key', logToConsole: false });
        const filter = new Filter();

        const clientErrors = [
            new HttpException('Cannot HEAD /', HttpStatus.NOT_FOUND),          // uptime/health-check ping
            new HttpException('Your session has expired', HttpStatus.UNAUTHORIZED), // expired JWT
            new HttpException('Bad Request', HttpStatus.BAD_REQUEST),          // client sent junk
        ];

        for (const exception of clientErrors) {
            const response = makeResponse();
            filter.catch(exception, makeHttpHost({ url: '/x', method: 'GET' }, response));
            // The client still gets its proper HTTP response...
            expect(response.status).toHaveBeenCalledWith((exception as any).getStatus());
        }

        // ...but none of these noisy client errors are reported to Oluso.
        expect(mockSendErrorReport).not.toHaveBeenCalled();
    });

    it('reports 5xx HttpExceptions (real server faults)', () => {
        const Filter = OlusoExceptionFilter({ apiKey: 'test-api-key', logToConsole: false });
        const filter = new Filter();

        const response = makeResponse();
        const exception = new HttpException('upstream down', HttpStatus.SERVICE_UNAVAILABLE);
        filter.catch(exception, makeHttpHost({ url: '/widgets', method: 'GET' }, response));

        expect(response.status).toHaveBeenCalledWith(503);
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
    });

    it('treats non-HttpException errors as 500s', () => {
        const Filter = OlusoExceptionFilter({ apiKey: 'test-api-key', logToConsole: false });
        const filter = new Filter();

        const request = { url: '/widgets', method: 'POST' };
        const response = makeResponse();
        const exception = new Error('db exploded');

        filter.catch(exception, makeHttpHost(request, response));

        expect(response.status).toHaveBeenCalledWith(500);
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
        const report = mockSendErrorReport.mock.calls[0][1];
        expect(report.severity).toBe('critical');
    });

    it('re-throws RPC exceptions after reporting', () => {
        const Filter = OlusoExceptionFilter({ apiKey: 'test-api-key', logToConsole: false });
        const filter = new Filter();
        const exception = new Error('rpc failure');

        const host = {
            getType: () => 'rpc',
        } as any;

        expect(() => filter.catch(exception, host)).toThrow('rpc failure');
        expect(mockSendErrorReport).toHaveBeenCalledTimes(1);
    });
});
