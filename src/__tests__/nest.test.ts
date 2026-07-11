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

    it('reports HttpExceptions using their declared status code', () => {
        const Filter = OlusoExceptionFilter({ apiKey: 'test-api-key', logToConsole: false });
        const filter = new Filter();

        const request = { url: '/widgets', method: 'GET' };
        const response = makeResponse();
        const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

        filter.catch(exception, makeHttpHost(request, response));

        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 404, path: '/widgets' })
        );
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
