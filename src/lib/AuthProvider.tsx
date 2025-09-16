import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, AuthResponse, LoginRequest } from './types';
import { setAuthToken, removeAuthToken, getAuthToken, isAuthenticated } from './apiClient';
import { usePost } from './useApi';
import { queryClient } from './queryClient';
import { supabase } from '@/integrations/supabase/client';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';

// Auth context interface
interface AuthContextType {
  // State
  user: User | null;
  teamId: string | null;
  userRole: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  signUp: (email: string, password: string) => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  checkAuth: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Local storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  TEAM_ID: 'team_id',
  USER_ROLE: 'user_role',
  USER_DATA: 'user_data',
} as const;

// Auth provider component
export function AuthProvider({ children }: AuthProviderProps) {
  const USE_MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
  const [user, setUser] = useState<User | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Login mutation
  const loginMutation = usePost<AuthResponse, LoginRequest>('/auth/login', {
    onSuccess: (response) => {
      const { token, user: userData, team_id } = response.data;
      
      // Store in localStorage
      setAuthToken(token);
      localStorage.setItem(STORAGE_KEYS.TEAM_ID, team_id);
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, userData.role);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      
      // Update state
      setUser(userData);
      setTeamId(team_id);
      setUserRole(userData.role);
    },
    onError: (error) => {
      console.error('Login failed:', error);
      logout();
    },
  });

  // Check authentication status
  const checkAuthMutation = usePost<{ user: User; team_id: string }>('/api/auth/verify', {
    onSuccess: (response) => {
      const { user: userData, team_id } = response.data;
      
      // Update localStorage
      localStorage.setItem(STORAGE_KEYS.TEAM_ID, team_id);
      localStorage.setItem(STORAGE_KEYS.USER_ROLE, userData.role);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      
      // Update state
      setUser(userData);
      setTeamId(team_id);
      setUserRole(userData.role);
    },
    onError: (error) => {
      console.error('Auth verification failed:', error);
      logout();
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (USE_MOCK_AUTH) {
          // Handle mock authentication
          const storedUserData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
          const storedTeamId = localStorage.getItem(STORAGE_KEYS.TEAM_ID);
          const storedUserRole = localStorage.getItem(STORAGE_KEYS.USER_ROLE);
          
          if (storedUserData && storedTeamId && storedUserRole) {
            try {
              const userData = JSON.parse(storedUserData) as User;
              setUser(userData);
              setTeamId(storedTeamId);
              setUserRole(storedUserRole as UserRole);
            } catch (error) {
              console.error('Failed to parse stored user data:', error);
              // Clear corrupted data
              localStorage.removeItem(STORAGE_KEYS.USER_DATA);
              localStorage.removeItem(STORAGE_KEYS.TEAM_ID);
              localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
            }
          }
          setIsLoading(false);
          return;
        }

        // Handle Supabase authentication
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setSupabaseUser(session?.user ?? null);
        
        if (session?.user && session.access_token) {
          // Set the token for API calls
          setAuthToken(session.access_token);
          
          // Convert Supabase user to our User type
          const userData: User = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role: 'admin' as UserRole,
          };
          
          // Store user data locally
          localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
          localStorage.setItem(STORAGE_KEYS.USER_ROLE, 'admin');
          localStorage.setItem(STORAGE_KEYS.TEAM_ID, session.user.id);
          
          setUser(userData);
          setUserRole('admin');
          setTeamId(session.user.id);
        } else {
          // No session, clear any stale data
          removeAuthToken();
          localStorage.removeItem(STORAGE_KEYS.USER_DATA);
          localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
          localStorage.removeItem(STORAGE_KEYS.TEAM_ID);
          setUser(null);
          setUserRole(null);
          setTeamId(null);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        // Clear auth state on error
        removeAuthToken();
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
        localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
        localStorage.removeItem(STORAGE_KEYS.TEAM_ID);
        setUser(null);
        setUserRole(null);
        setTeamId(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up Supabase auth listener (only if not using mock auth)
    if (!USE_MOCK_AUTH) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log('Auth state change:', event, session?.user?.id);
          
          // Avoid duplicate processing during initialization
          if (event === 'INITIAL_SESSION') {
            return; // Already handled in initializeAuth
          }
          
          setSession(session);
          setSupabaseUser(session?.user ?? null);
          
          if (session?.user && session.access_token) {
            // Set the token for API calls
            setAuthToken(session.access_token);
            
            // Convert Supabase user to our User type
            const userData: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
              role: 'admin' as UserRole,
            };
            
            // Store user data locally
            localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
            localStorage.setItem(STORAGE_KEYS.USER_ROLE, 'admin');
            localStorage.setItem(STORAGE_KEYS.TEAM_ID, session.user.id);
            
            setUser(userData);
            setUserRole('admin');
            setTeamId(session.user.id);
          } else {
            // Clear auth state only on sign out
            if (event === 'SIGNED_OUT') {
              removeAuthToken();
              localStorage.removeItem(STORAGE_KEYS.USER_DATA);
              localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
              localStorage.removeItem(STORAGE_KEYS.TEAM_ID);
              setUser(null);
              setUserRole(null);
              setTeamId(null);
            }
          }
        }
      );

      return () => subscription.unsubscribe();
    }
  }, [USE_MOCK_AUTH]);

  // Login function
  const login = async (credentials: LoginRequest): Promise<void> => {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        // Create a local mock session for development without backend
        const mockUser: User = {
          id: 'dev-user',
          email: credentials.email,
          role: 'admin' as UserRole,
          name: 'Developer',
        } as unknown as User;
        setAuthToken('dev-token');
        localStorage.setItem(STORAGE_KEYS.TEAM_ID, 'dev-team');
        localStorage.setItem(STORAGE_KEYS.USER_ROLE, mockUser.role as unknown as string);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(mockUser));
        setUser(mockUser);
        setTeamId('dev-team');
        setUserRole(mockUser.role);
        return;
      }
      // Use Supabase authentication
      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // The auth state change listener will handle updating the user state
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    if (!USE_MOCK_AUTH) {
      // Sign out from Supabase
      await supabase.auth.signOut();
    }
    
    // Clear localStorage
    removeAuthToken();
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    localStorage.removeItem(STORAGE_KEYS.TEAM_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_ROLE);
    
    // Clear state
    setUser(null);
    setTeamId(null);
    setUserRole(null);
    setSupabaseUser(null);
    setSession(null);
    
    // Clear all queries
    queryClient.clear();
    
    // Redirect to login
    window.location.href = '/login';
  };

  // Sign up function
  const signUp = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      if (USE_MOCK_AUTH) {
        // For mock mode, just simulate signup success
        const mockUser: User = {
          id: 'new-user',
          email: email,
          role: 'user' as UserRole,
          name: email.split('@')[0],
        } as unknown as User;
        setAuthToken('dev-token');
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(mockUser));
        localStorage.setItem(STORAGE_KEYS.TEAM_ID, 'dev-team');
        localStorage.setItem(STORAGE_KEYS.USER_ROLE, 'user');
        setUser(mockUser);
        setTeamId('dev-team');
        setUserRole('user');
        return;
      }
      
      // Use Supabase authentication
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Note: User will need to confirm email before they can login
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Update user function
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedUser));
      
      // Update role if it changed
      if (userData.role) {
        setUserRole(userData.role);
        localStorage.setItem(STORAGE_KEYS.USER_ROLE, userData.role);
      }
    }
  };

  // Check auth function
  const checkAuth = async (): Promise<void> => {
    if (isAuthenticated()) {
      await checkAuthMutation.mutateAsync({});
    }
  };

  // Context value
  const contextValue: AuthContextType = {
    // State
    user,
    teamId,
    userRole,
    isLoading: isLoading || loginMutation.isPending || checkAuthMutation.isPending,
    isAuthenticated: !!user && !!teamId,
    
    // Actions
    login,
    logout,
    signUp,
    updateUser,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to check if user has specific role
export function useHasRole(requiredRole: UserRole | UserRole[]): boolean {
  const { userRole } = useAuth();
  
  if (!userRole) return false;
  
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return roles.includes(userRole);
}

// Hook to check if user has admin privileges
export function useIsAdmin(): boolean {
  return useHasRole('admin');
}

// Hook to check if user has manager or admin privileges
export function useIsManagerOrAdmin(): boolean {
  return useHasRole(['admin', 'manager']);
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: UserRole | UserRole[]
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, userRole } = useAuth();

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (requiredRole && userRole) {
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      if (!roles.includes(userRole)) {
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
              <p className="text-muted-foreground mt-2">
                You don't have permission to access this page.
              </p>
            </div>
          </div>
        );
      }
    }

    return <Component {...props} />;
  };
}

export default AuthProvider;
