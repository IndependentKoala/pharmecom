// API client for communicating with Django backend
const VITE_API_URL = import.meta.env.VITE_API_URL;
export const API_BASE = VITE_API_URL || '/api';

interface ApiError {
  detail?: string;
  [key: string]: any;
}

class ApiClient {
  private baseUrl = API_BASE;

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
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
