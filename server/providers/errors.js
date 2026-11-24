export class ProviderError extends Error {
  constructor(message, { status = 502, provider } = {}) {
    super(message);
    this.status = status;
    this.provider = provider;
  }
}
