export class IolError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'IolError';
  }
}

export class IolAuthError extends IolError {
  constructor(message: string, status?: number, details?: unknown) {
    super(message, status, details);
    this.name = 'IolAuthError';
  }
}
