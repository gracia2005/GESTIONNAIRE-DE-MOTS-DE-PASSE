export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

const API_BASE = '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-SecureVault-Client': 'true',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // sends and receives HttpOnly cookies
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Erreur serveur (${res.status})`,
        ...data,
      };
    }
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur réseau de communication avec le serveur.',
    };
  }
}
