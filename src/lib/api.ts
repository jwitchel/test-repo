// API utility functions

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

interface FetchOptions extends RequestInit {
  requireAuth?: boolean;
}

export async function apiFetch(
  endpoint: string, 
  options: FetchOptions = {}
): Promise<Response> {
  const { requireAuth = true, ...fetchOptions } = options;
  
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  });
  
  if (requireAuth && response.status === 401) {
    // Redirect to login if not authenticated
    window.location.href = '/login';
  }
  
  return response;
}

export async function apiGet<T = unknown>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }
  
  return response.json();
}

export async function apiPost<T = unknown>(
  endpoint: string, 
  data?: unknown
): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API error: ${response.status}`);
  }
  
  return response.json();
}