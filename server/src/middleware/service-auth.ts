/**
 * Service Token Authentication Helper
 * Since requireAuth now handles both user auth and service tokens,
 * this file just provides the helper function for workers to make authenticated requests
 */

/**
 * Helper function to make authenticated requests from workers
 */
export const makeServiceRequest = async (
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: any,
  userId?: string
) => {
  const headers: any = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`
  };
  
  const body = data ? JSON.stringify({
    ...data,
    userId: userId || data.userId  // Ensure userId is included
  }) : undefined;
  
  const response = await fetch(url, {
    method,
    headers,
    body
  });
  
  if (!response.ok) {
    const error = await response.json() as { error?: string; details?: string };
    throw new Error(error.error || error.details || `Request failed: ${response.status}`);
  }
  
  return response.json();
};