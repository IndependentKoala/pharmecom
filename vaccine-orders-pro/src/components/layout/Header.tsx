import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, User, Menu, X, Syringe, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/context/CartContext';
import { API_BASE } from '@/lib/api';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const userNavigation = [
  { name: 'Catalog', href: '/catalog' },
  { name: 'Order Tracking', href: '/order-tracking' },
  { name: 'My Orders', href: '/orders' },
];

const staffNavigation = [
  { name: 'Catalog', href: '/catalog' },
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Inventory', href: '/inventory' },
];

export function Header() {
  const location = useLocation();
  const { totalItems, setUserIdAndClearCart, setServerCart } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<{ username?: string; is_staff?: boolean; is_superuser?: boolean; id?: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      if (mounted) setUser(null);
      return;
    }
    
    fetch('/api/auth/user/', { 
      headers: {
        'Authorization': `Token ${token}`
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem('authToken');
          return null;
        }
        try {
          const data = await res.json();
          return data;
        } catch {
          localStorage.removeItem('authToken');
          return null;
        }
      })
      .then(async (data) => {
        if (!mounted) return;
        setUser(data);
        // Load server-side cart for this user. The server cart is authoritative
        // (userId is already set in CartContext from login flow).
        // Just fetch and update local items; don't re-merge (that happened in SignIn).
        try {
          const cartRes = await fetch(`${API_BASE}/cart/`, {
            headers: { 'Authorization': `Token ${token}` },
            credentials: 'include'
          });
          if (cartRes.ok) {
            const cartData = await cartRes.json();
            const serverItems = cartData?.items || [];
            // Load server cart into local state.
            setServerCart(serverItems);
          }
        } catch (e) {
          console.warn('Failed to load cart from server', e);
        }
      })
      .catch(() => { 
        if (mounted) {
          setUser(null);
          localStorage.removeItem('authToken');
        }
      });
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await fetch('/api/auth/logout/', { 
          method: 'POST', 
          headers: {
            'Authorization': `Token ${token}`
          }
        });
      }
    } catch (e) {
      console.warn('Logout failed', e);
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    setUserIdAndClearCart(null);
    setUser(null);
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <nav className="container-main flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/catalog" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Syringe className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <span className="font-heading text-lg font-bold text-foreground">Pharmsave</span>
            <span className="text-xs text-muted-foreground block -mt-1">Vaccines</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {user?.is_staff ? (
            <>
              {staffNavigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    location.pathname === item.href
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              {user?.is_superuser && (
                <button
                  onClick={() => {
                    // Navigate to Django admin - handles both localhost and custom domains
                    const adminUrl = `${window.location.origin.replace(':8080', ':8000')}/admin`;
                    window.open(adminUrl, '_blank');
                  }}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    "text-muted-foreground"
                  )}
                >
                  Admin
                </button>
              )}
            </>
          ) : (
            userNavigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  location.pathname === item.href
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {item.name}
              </Link>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!user?.is_staff && !user?.is_superuser && (
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <Badge 
                  variant="accent" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {totalItems}
                </Badge>
              )}
            </Button>
          </Link>
          )}
          
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <Button
                asChild={false}
                variant="ghost"
                size="sm"
                className="hidden sm:flex"
                onClick={() => navigate('/dashboard')}
              >
                <User className="h-4 w-4 mr-2" />
                {user?.username || 'User'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          ) : (
            <Link to="/">
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                <User className="h-4 w-4 mr-2" />
                Sign in
              </Button>
            </Link>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card animate-slide-up">
          <div className="container-main py-4 space-y-2">
            {(user?.is_staff ? staffNavigation : userNavigation).map((item) => {
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
            {user?.is_staff && user?.is_superuser && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  // Navigate to Django admin - handles both localhost and custom domains
                  const adminUrl = `${window.location.origin.replace(':8080', ':8000')}/admin`;
                  window.open(adminUrl, '_blank');
                }}
                className={cn(
                  "block px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-secondary"
                )}
              >
                Admin
              </button>
            )}
            {user && !user.is_staff && (
              <button
                onClick={async () => {
                  setMobileMenuOpen(false);
                  navigate('/dashboard');
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Dashboard
              </button>
            )}
            {user && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary mt-2 pt-2 border-t border-border"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
