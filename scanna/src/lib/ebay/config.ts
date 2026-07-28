// Shared eBay REST API base URLs — sandbox vs. production per
// EBAY_ENVIRONMENT. All eBay REST calls in this project use plain fetch
// against the official Sell API (never browser automation), per brief.md.

export type EbayEnvironment = 'sandbox' | 'production';

export function getEbayEnvironment(): EbayEnvironment {
  const env = process.env.EBAY_ENVIRONMENT;
  return env === 'production' ? 'production' : 'sandbox';
}

export function getEbayApiBase(): string {
  return getEbayEnvironment() === 'production' ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';
}

export function getEbayAuthBase(): string {
  return getEbayEnvironment() === 'production' ? 'https://auth.ebay.com' : 'https://auth.sandbox.ebay.com';
}

export class EbayApiError extends Error {
  constructor(message: string, readonly status?: number, readonly body?: unknown) {
    super(message);
    this.name = 'EbayApiError';
  }
}
