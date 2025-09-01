import {
  ArgumentsHost,
  ConflictException,
  HttpStatus,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHostMock(
  req: Partial<{
    method: string;
    url: string;
    route?: { path?: string };
    requestId?: string;
  }>,
  res: { statusCode?: number; headers?: Record<string, string> },
) {
  const response = {
    status: jest.fn().mockImplementation((code: number) => {
      res.statusCode = code;
      return response;
    }),
    header: jest.fn().mockImplementation((k: string, v: string) => {
      res.headers = res.headers || {};
      res.headers[k] = v;
      return response;
    }),
    json: jest.fn().mockImplementation((body: unknown) => body),
  };
  const request = {
    method: req.method ?? 'GET',
    url: req.url ?? '/',
    route: req.route,
    requestId: req.requestId,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response, request };
}

describe('AllExceptionsFilter', () => {
  it('retorna problem+json para ConflictException com code e message', () => {
    const filter = new AllExceptionsFilter();
    const resBag: { statusCode?: number; headers?: Record<string, string> } =
      {};
    const { host, response } = createHostMock(
      { method: 'POST', url: '/demo' },
      resBag,
    );
    const ex = new ConflictException({ code: 'DUP', message: 'dup' });
    const body = filter.catch(ex, host) as unknown;

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.header).toHaveBeenCalledWith(
      'Content-Type',
      'application/problem+json',
    );
    // json foi chamado com o payload final
    expect(response.json).toHaveBeenCalled();
  });

  it('mapeia UNAUTHORIZED para INVALID_CREDENTIALS quando sem code explícito', () => {
    const filter = new AllExceptionsFilter();
    const resBag: { statusCode?: number; headers?: Record<string, string> } =
      {};
    const { host, response } = createHostMock(
      { method: 'POST', url: '/auth/login' },
      resBag,
    );
    const ex = new UnauthorizedException();
    filter.catch(ex, host);
    const payload = (response.json.mock.calls.at(-1)?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(payload.code).toBe('INVALID_CREDENTIALS');
  });

  it('mapeia PayloadTooLargeException para UPLOAD_TOO_LARGE', () => {
    const filter = new AllExceptionsFilter();
    const resBag: { statusCode?: number; headers?: Record<string, string> } =
      {};
    const { host, response } = createHostMock(
      { method: 'POST', url: '/admin/documents' },
      resBag,
    );
    const ex = new PayloadTooLargeException();
    filter.catch(ex, host);
    const payload = (response.json.mock.calls.at(-1)?.[0] ?? {}) as Record<
      string,
      unknown
    >;
    expect(payload.code).toBe('UPLOAD_TOO_LARGE');
    expect(resBag.statusCode).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });
});
