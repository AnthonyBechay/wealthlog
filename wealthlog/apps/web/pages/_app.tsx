// apps/web/pages/_app.tsx 

import '../styles/globals.css';
import '../styles/theme.css';

import type { AppProps } from 'next/app';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ThemeProvider } from 'next-themes';

import { api, setAccessToken } from '@wealthlog/common';
import { appWithTranslation } from 'next-i18next';
import nextI18NextConfig from '../next-i18next.config';

/* Public routes requiring no auth */
const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password'];
const isPublic = (p: string) => PUBLIC_PATHS.includes(p);

type ThemeMode = 'light' | 'dark' | 'system';

interface NavigationItem {
  href: string;
  label: string;
  icon: string;
  isActive?: boolean;
}

// Constants - NAVIGATION MISE À JOUR AVEC TRADING SETTINGS
const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: '/landing/landing', label: 'Dashboard', icon: '🏠' },
  { href: '/accounts', label: 'Accounts', icon: '💼' },
  { href: '/trading/trading', label: 'Trading', icon: '📈' },
  { href: '/RealEstate', label: 'Real Estate', icon: '🏘️' },
  { href: '/comingSoon', label: 'Expenses', icon: '💳' },
  { href: '/comingSoon', label: 'Loans', icon: '💰' },
  { href: '/comingSoon', label: 'Forecasting', icon: '📊' },
  { href: '/settings?tab=trading', label: 'Trading Settings', icon: '⚙️' },
  { href: '/settings', label: 'Settings', icon: '🔧' },
];

// =============================================
//              INSTANT UPDATES HOOKS
// =============================================

// ✅ Hook pour empêcher les transitions au chargement initial
const usePreventInitialTransitions = () => {
  useEffect(() => {
    // Ajouter classe preload au chargement
    document.body.classList.add('preload');
    
    // Retirer après un court délai
    const timer = setTimeout(() => {
      document.body.classList.remove('preload');
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
};

// ✅ Hook pour écouter les changements de thème système
const useSystemThemeListener = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const currentTheme = localStorage.getItem('displayMode');
      
      // Si l'utilisateur utilise le mode système, appliquer automatiquement
      if (currentTheme === 'system') {
        const root = document.documentElement;
        
        if (e.matches) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
        
        console.log(`🌟 System theme changed to: ${e.matches ? 'dark' : 'light'}`);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
};

// ✅ Hook pour appliquer le thème initial immédiatement
const useInitialThemeApplication = (themeMode: ThemeMode) => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const root = document.documentElement;
    
    // Appliquer le thème immédiatement
    if (themeMode === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (themeMode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // System mode - détecter la préférence système
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
      }
    }
  }, [themeMode]);
};

// =============================================
//              UTILITIES
// =============================================

// Utilities
const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_PATHS.includes(pathname);
};

const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem('displayMode') as ThemeMode) || 'system';
};

// =============================================
//              COMPONENTS
// =============================================

// Components
interface NavigationLinkProps {
  item: NavigationItem;
  isCollapsed?: boolean;
  onNavigate?: () => void;
}

const NavigationLink = ({ item, isCollapsed = false, onNavigate }: NavigationLinkProps) => {
  const router = useRouter();
  
  // ✅ Amélioration pour gérer les paramètres URL
  const isActive = () => {
    if (item.href.includes('?')) {
      // Pour les liens avec paramètres (ex: /settings?tab=trading)
      const [path, params] = item.href.split('?');
      if (router.pathname === path) {
        const urlParams = new URLSearchParams(router.asPath.split('?')[1] || '');
        const itemParams = new URLSearchParams(params);
        
        // Vérifier si tous les paramètres correspondent
        for (const [key, value] of itemParams.entries()) {
          if (urlParams.get(key) !== value) return false;
        }
        return true;
      }
      return false;
    }
    
    // Logique normale pour les autres liens
    return router.pathname === item.href || 
      (item.href === '/settings' && router.pathname.startsWith('/settings') && !router.asPath.includes('?tab='));
  };

  return (
    <Link href={item.href} legacyBehavior>
      <a
        onClick={onNavigate}
        className={`
          group flex items-center gap-3 px-4 py-3 rounded-lg
          transition-all duration-200 ease-in-out
          ${isActive()
            ? 'bg-white/20 text-white font-semibold shadow-lg'
            : 'text-white/80 hover:bg-white/10 hover:text-white'
          }
          ${isCollapsed ? 'justify-center' : ''}
        `}
        title={isCollapsed ? item.label : undefined}
      >
        <span className="text-lg">{item.icon}</span>
        {!isCollapsed && (
          <span className="truncate text-sm font-medium">
            {item.label}
          </span>
        )}
      </a>
    </Link>
  );
};

const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300">
    <div className="flex flex-col items-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="text-gray-600 dark:text-gray-300 font-medium">Loading WealthLog...</p>
    </div>
  </div>
);

// =============================================
//              MAIN APP COMPONENT
// =============================================

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // State
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ✅ Hooks pour changements instantanés
  usePreventInitialTransitions();
  useSystemThemeListener();
  useInitialThemeApplication(themeMode);

  // Initialize theme from localStorage
  useEffect(() => {
    const storedTheme = getStoredTheme();
    setThemeMode(storedTheme);
    console.log(`🎨 Initial theme loaded: ${storedTheme}`);
  }, []);

  // Persist theme changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('displayMode', themeMode);
      console.log(`💾 Theme saved to localStorage: ${themeMode}`);
    }
  }, [themeMode]);

  // ✅ CORRIGÉ: Fetch user settings avec gestion d'erreur robuste
  useEffect(() => {
    const fetchUserSettings = async () => {
      if (!isAuthenticated) return;
      
      try {
        console.log('🔄 Fetching user settings from /settings/generalSettings...');
        
        // ✅ Endpoint corrigé avec la nouvelle structure de routes
        const response = await api.get('/settings/generalSettings');
        
        // ✅ Validation de la réponse
        if (!response || !response.data) {
          console.warn('⚠️ Empty response from settings API');
          return;
        }
        
        const { data } = response;
        console.log('📦 Settings data received:', { displayMode: data.displayMode });
        
        // ✅ Validation et mise à jour du thème si différent
        if (data.displayMode && 
            ['light', 'dark', 'system'].includes(data.displayMode) && 
            data.displayMode !== themeMode) {
          console.log(`🔄 Updating theme from server: ${themeMode} → ${data.displayMode}`);
          setThemeMode(data.displayMode as ThemeMode);
        }
        
      } catch (error: any) {
        // ✅ Gestion d'erreur détaillée
        if (error?.response?.status === 404) {
          console.warn('⚠️ Settings endpoint not found (404) - using local theme');
        } else if (error?.response?.status === 401) {
          console.warn('⚠️ Unauthorized access to settings - user may need to re-login');
          // Ne pas forcer la déconnexion ici, laisser l'auth check principal s'en charger
        } else if (error?.response?.status >= 500) {
          console.error('❌ Server error fetching settings:', error.response.status);
        } else if (error?.code === 'ECONNREFUSED' || error?.code === 'NETWORK_ERROR') {
          console.error('🌐 Network error fetching settings - server may be down');
        } else {
          console.error('❌ Unexpected error fetching settings:', error);
        }
        
        // ✅ Fallback: continuer avec le thème local
        console.log('🔄 Continuing with local theme:', themeMode);
      }
    };

    // ✅ Délai pour éviter les appels simultanés lors du chargement initial
    const timer = setTimeout(fetchUserSettings, 500);
    return () => clearTimeout(timer);
  }, [isAuthenticated, themeMode]);

  // Authentication check
  useEffect(() => {
    if (isPublicRoute(router.pathname)) {
      setIsCheckingAuth(false);
      return;
    }

    const checkAuthentication = async () => {
      try {
        await api.get('/auth/me');
        setIsAuthenticated(true);
        console.log('✅ User authenticated');
      } catch (error) {
        console.log('❌ Authentication failed');
        setIsAuthenticated(false);
        router.replace('/login');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthentication();
  }, [router.pathname]);

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [router.pathname]);

  // =============================================
  //              HANDLERS
  // =============================================

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
      console.log('👋 User logged out');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAccessToken(null);
      setIsAuthenticated(false);
      router.push('/login');
    }
  }, [router]);

  const handleLogoClick = useCallback(() => {
    router.push('/landing/landing');
    setIsDrawerOpen(false);
  }, [router]);

  // ✅ Handler pour changement de thème instantané
  const handleThemeChange = useCallback((newTheme: ThemeMode) => {
    console.log(`🎨 Theme changing to: ${newTheme}`);
    setThemeMode(newTheme);
    
    // Appliquer immédiatement
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      
      // Animation de transition
      root.style.transition = 'all 0.3s ease';
      
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else if (newTheme === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemPrefersDark) {
          root.classList.add('dark');
          root.classList.remove('light');
        } else {
          root.classList.add('light');
          root.classList.remove('dark');
        }
      }
      
      // Retirer la transition après application
      setTimeout(() => {
        root.style.transition = '';
      }, 300);
    }
  }, []);

  // =============================================
  //              RENDER CONDITIONS
  // =============================================

  // Render conditions
  if (isCheckingAuth) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        forcedTheme={themeMode === 'system' ? undefined : themeMode}
        enableSystem={true}
      >
        <LoadingScreen />
      </ThemeProvider>
    );
  }

  if (isPublicRoute(router.pathname)) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        forcedTheme={themeMode === 'system' ? undefined : themeMode}
        enableSystem={true}
      >
        <Component {...pageProps} />
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // =============================================
  //              MAIN LAYOUT
  // =============================================

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      forcedTheme={themeMode === 'system' ? undefined : themeMode}
      enableSystem={true}
    >
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-300">

        {/* Desktop Sidebar */}
        <aside
          className={`
            hidden md:flex flex-col h-screen
            transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'w-20' : 'w-64'}
            bg-gradient-to-b from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900
            border-r border-blue-500/20
            shadow-xl
          `}
        >
          {/* Header */}
          <header
            className="flex items-center gap-3 p-6 cursor-pointer hover:bg-white/5 transition-colors duration-200"
            onClick={handleLogoClick}
          >
            <img
              src="/logo.png"
              alt="WealthLog"
              className="h-8 w-8 object-contain"
            />
            {!isSidebarCollapsed && (
              <h1 className="text-white font-bold text-xl tracking-tight">
                WealthLog
              </h1>
            )}
          </header>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            {NAVIGATION_ITEMS.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </nav>

          {/* Footer */}
          <footer className="p-4 space-y-3 border-t border-white/10">
            {/* Collapse toggle */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="
                w-full py-2 rounded-lg
                bg-white/10 hover:bg-white/20
                text-white font-medium
                transition-all duration-200
                flex items-center justify-center
              "
              title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="text-lg">
                {isSidebarCollapsed ? '→' : '←'}
              </span>
            </button>

            {/* Logout button */}
            {!isSidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="
                  w-full py-3 rounded-lg
                  bg-white text-blue-600
                  hover:bg-gray-100 dark:hover:bg-gray-200
                  font-semibold text-sm
                  transition-all duration-200
                  shadow-md hover:shadow-lg
                "
              >
                Logout
              </button>
            )}
          </footer>
        </aside>

        {/* Mobile overlay */}
        <div
          className={`
            fixed inset-0 z-40 
            bg-black/40 backdrop-blur-sm
            transition-all duration-300
            ${isDrawerOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}
          `}
          onClick={() => setIsDrawerOpen(false)}
        />

        {/* Mobile drawer */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-72
            bg-gradient-to-b from-blue-600 to-blue-700 dark:from-blue-800 dark:to-blue-900
            transform transition-transform duration-300 ease-in-out
            ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
            shadow-2xl
          `}
        >
          {/* Mobile header */}
          <header
            className="flex items-center gap-3 p-6 border-b border-white/10 cursor-pointer"
            onClick={handleLogoClick}
          >
            <img
              src="/logo.png"
              alt="WealthLog"
              className="h-8 w-8 object-contain"
            />
            <h1 className="text-white font-bold text-xl tracking-tight">
              WealthLog
            </h1>
          </header>

          {/* Mobile navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
            {NAVIGATION_ITEMS.map((item) => (
              <NavigationLink
                key={item.href}
                item={item}
                onNavigate={() => setIsDrawerOpen(false)}
              />
            ))}
          </nav>

          {/* Mobile footer */}
          <footer className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="
                w-full py-3 rounded-lg
                bg-white text-blue-600
                hover:bg-gray-100
                font-semibold text-sm
                transition-all duration-200
                shadow-md
              "
            >
              Logout
            </button>
          </footer>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Mobile top bar */}
          <header className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-300">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="
                  p-2 rounded-lg
                  text-gray-600 dark:text-gray-300
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors duration-200
                "
                aria-label="Open navigation menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <h1
                className="text-lg font-bold text-gray-900 dark:text-white cursor-pointer transition-colors duration-200"
                onClick={handleLogoClick}
              >
                WealthLog
              </h1>

              <div className="w-10" />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 transition-all duration-300">
            <Component {...pageProps} />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default appWithTranslation(MyApp, nextI18NextConfig);