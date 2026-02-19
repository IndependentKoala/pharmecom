import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/lib/api";
import { formatApiError } from "@/lib/errorFormatter";
import { useCart } from "@/context/CartContext";

export default function SignIn() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setUserIdAndClearCart } = useCart();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('authToken');
    if (token) {
      // Token exists, redirect to catalog
      if (mounted) navigate('/catalog');
    }
    return () => { mounted = false; };
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      // Get CSRF token from backend
      const csrfRes = await fetch(`${API_BASE}/auth/csrf/`, { 
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      let csrfToken: string | null = null;
      try {
        const csrfData = await csrfRes.json();
        csrfToken = csrfData?.csrfToken;
      } catch (e) {
        console.warn('Failed to parse CSRF response', e);
      }

      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRFToken": csrfToken })
        },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });
      
      const txt = await res.text();
      if (!res.ok) {
        throw new Error(formatApiError(txt));
      }
      
      let data: any = null;
      try {
        data = txt ? JSON.parse(txt) : null;
      } catch (e) {
        console.warn('Failed to parse login response:', e);
        throw new Error('Invalid server response');
      }
      
      // Store auth token in localStorage for token-based auth
      if (data?.key) {
        localStorage.setItem('authToken', data.key);
        // Get user ID and set it in cart context to merge local carts and
        // trigger localStorage persistence of the merged cart for next page load.
        try {
          const userRes = await fetch(`${API_BASE}/auth/user/`, {
            headers: { "Authorization": `Token ${data.key}` },
            credentials: "include"
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            // Merge anonymous cart into user cart (stored in localStorage).
            // The effect in CartContext will persist this to localStorage.
            setUserIdAndClearCart(String(userData.id));
            // On next page load, Header will fetch the server cart and override locals.
          }
        } catch (e) {
          console.warn('Failed to fetch user ID', e);
        }
      }
      
      // Login successful, redirect to catalog
      navigate('/catalog');
    } catch (err: any) {
      let friendlyMessage = "Sign in failed. Please check your username and password.";
      if (err?.message) {
        // Check if it's the API non_field_errors response
        if (err.message.includes("non_field_errors") || err.message.includes("Unable to log in")) {
          friendlyMessage = "Invalid username or password. Please try again.";
        } else {
          friendlyMessage = err.message;
        }
      }
      setError(friendlyMessage);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-6 rounded shadow">
        <h2 className="text-2xl mb-4">Sign In</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <label className="block mb-2">
          <span className="text-sm">Username or Email</span>
          <input className="mt-1 block w-full border rounded px-2 py-1" value={username} onChange={e=>setUsername(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="text-sm">Password</span>
          <input type="password" className="mt-1 block w-full border rounded px-2 py-1" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
        <div className="flex items-center">
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Sign In</button>
        </div>
      </form>
    </div>
  );
}
