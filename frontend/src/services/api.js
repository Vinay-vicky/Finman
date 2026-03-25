const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const buildHeaders = (token, extraHeaders = {}) => ({
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extraHeaders,
});

const parseErrorMessage = (payload, fallback) => {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  return payload.message || payload.error || fallback;
};

export const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    token,
    body,
    headers = {},
    credentials = 'include',
  } = options;

  const hasBody = body !== undefined;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials,
    headers: buildHeaders(token, {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    }),
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(parseErrorMessage(payload, 'Request failed.'));
    error.status = response.status;
    error.details = typeof payload === 'object' ? payload.details : undefined;
    throw error;
  }

  return payload;
};
