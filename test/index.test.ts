import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

describe('Worker', () => {
  it('should have scheduled handler', () => {
    expect(worker.scheduled).toBeDefined();
    expect(typeof worker.scheduled).toBe('function');
  });

  it('should have fetch handler', () => {
    expect(worker.fetch).toBeDefined();
    expect(typeof worker.fetch).toBe('function');
  });

  it('should handle root path', async () => {
    const request = new Request('http://localhost/');
    const env = {
      LP_BOT_KV: {} as KVNamespace,
      lp_bot_historical: {} as R2Bucket,
      ARBITRUM_RPC: 'test-rpc',
      POOL_ADDRESS: '0x123',
      NPM_ADDRESS: '0x456',
      POSITION_TOKEN_ID: '789',
      TELEGRAM_BOT_TOKEN: 'test-token',
      TELEGRAM_CHAT_ID: 'test-chat'
    };
    const ctx = {} as ExecutionContext;

    const response = await worker.fetch(request, env, ctx);
    expect(response.status).toBe(200);
    
    const text = await response.text();
    expect(text).toContain('Uniswap LP Bot');
  });
});