import { getRuntime, getRuntimeServerContext } from '../runtime';

describe('runtime detection', () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  afterEach(() => {
    if (originalRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = originalRuntime;
    }
  });

  it('defaults to nodejs when NEXT_RUNTIME is unset', () => {
    delete process.env.NEXT_RUNTIME;
    expect(getRuntime()).toBe('nodejs');
  });

  it('detects edge from NEXT_RUNTIME=edge', () => {
    process.env.NEXT_RUNTIME = 'edge';
    expect(getRuntime()).toBe('edge');
  });

  it('includes hostname/memory/uptime on nodejs but not on edge', () => {
    delete process.env.NEXT_RUNTIME;
    const nodejsContext = getRuntimeServerContext();
    expect(nodejsContext.runtime).toBe('nodejs');
    expect(nodejsContext.hostname).toBeDefined();
    expect(nodejsContext.memory).toBeDefined();

    process.env.NEXT_RUNTIME = 'edge';
    const edgeContext = getRuntimeServerContext();
    expect(edgeContext.runtime).toBe('edge');
    expect(edgeContext.hostname).toBeUndefined();
    expect(edgeContext.memory).toBeUndefined();
  });
});
