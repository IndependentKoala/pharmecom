// API client for communicating with Django backend
// Use the API URL defined in vite.config.ts via the define option, or fall back to /api
declare const __API_URL__: string;
export const API_BASE = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';

interface ApiError {
  detail?: string;
  [key: string]: any;
}

class ApiClient {
  private baseUrl = API_BASE;

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    // Attach credentials and token if available
    const token = localStorage.getItem('authToken');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    } as Record<string, string>;
    if (token) {
      headers['Authorization'] = `Token ${token}`;
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (e) {
      data = text;
    }

    if (!response.ok) {
      const err: ApiError = (data && typeof data === 'object') ? data : { detail: String(data) };
      const error: any = new Error(err.detail || `API Error: ${response.status}`);
      error.status = response.status;
      error.data = err;
      throw error;
    }

    return data;
  }

  // Products
  async fetchProducts() {
    return this.request('/products/');
  }

  async fetchProductById(id: string | number) {
    return this.request(`/products/${id}/`);
  }

  // Orders
  async fetchOrders() {
    return this.request('/orders/');
  }

  async fetchOrderById(id: string | number) {
    return this.request(`/orders/${id}/`);
  }

  async createOrder(data: any) {
    return this.request('/orders/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Auth
  async registerUser(data: any) {
    return this.request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCurrentUser() {
    return this.request('/auth/user/');
  }

  async login(username: string, password: string) {
    return this.request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async logout() {
    return this.request('/auth/logout/', {
      method: 'POST',
    });
  }
}

export default new ApiClient();
