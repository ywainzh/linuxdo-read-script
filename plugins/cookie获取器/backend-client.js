export class TransferError extends Error {
  constructor(message, { retryable = false, status = null, code = 'request' } = {}) {
    super(message);
    this.name = 'TransferError';
    this.retryable = retryable;
    this.status = status;
    this.code = code;
    this.attempts = 0;
  }
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function performAttempt(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new TransferError('请求超时', { retryable: true, code: 'timeout' }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      Promise.resolve().then(async () => {
        const response = await fetchImpl(url, { ...options, signal: controller.signal });
        const responseText = await response.text();
        return { response, responseText };
      }),
      timeout
    ]);
  } catch (error) {
    if (error instanceof TransferError) {
      throw error;
    }
    if (controller.signal.aborted || error?.name === 'AbortError') {
      throw new TransferError('请求超时', { retryable: true, code: 'timeout' });
    }
    throw new TransferError(`网络错误：${error?.message || String(error)}`, {
      retryable: true,
      code: 'network'
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function requestWithRetry({
  fetchImpl = fetch,
  url,
  method,
  headers,
  body,
  timeoutMs = 10_000,
  retryDelayMs = 500,
  sleep = wait
}) {
  const maximumAttempts = 2;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const { response, responseText } = await performAttempt(
        fetchImpl,
        url,
        { method, headers, body },
        timeoutMs
      );

      if (!response.ok) {
        throw new TransferError(`HTTP 错误，状态码：${response.status}`, {
          retryable: response.status >= 500 && response.status <= 599,
          status: response.status,
          code: 'http'
        });
      }

      return { responseText, status: response.status, attempts: attempt };
    } catch (error) {
      const transferError = error instanceof TransferError
        ? error
        : new TransferError(error?.message || String(error));
      transferError.attempts = attempt;
      if (!transferError.retryable || attempt === maximumAttempts) {
        throw transferError;
      }
      await sleep(retryDelayMs);
    }
  }

  throw new TransferError('请求失败');
}
