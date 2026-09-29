import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabase';
import { UserProfile, UserRole } from '../types';

export const ADMIN_EMAIL = 'junior.jacksonmass100@gmail.com';
export const ADMIN_PASSWORD = 'Junior2005678';
export const ADMIN_NAME = 'Junior Jackson';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  role: UserRole;
  isAdmin: boolean;
  loading: boolean;
  isConfigured: boolean;
  signUp: (email: string, password: string, fullName: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'kgp_guest_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRoleState] = useState<UserRole>('user');
  const [loading, setLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    // 1. Check if saved session exists in storage
    const savedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
    if (savedGuest) {
      try {
        const guestData = JSON.parse(savedGuest);
        setUser(guestData.user);
        setProfile(guestData.profile);
        const isJuniorAdmin = guestData.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        setRoleState(isJuniorAdmin ? 'admin' : (guestData.profile?.role || 'user'));
        setLoading(false);
      } catch {
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
    }

    // 2. Check Supabase Auth session if configured
    if (isConfigured) {
      const client = getSupabaseClient();
      client.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSession(session);
          setUser(session.user);
          loadProfile(session.user.id, session.user.email || '');
          localStorage.removeItem(GUEST_STORAGE_KEY);
        }
        setLoading(false);
      });

      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        if (session?.user) {
          loadProfile(session.user.id, session.user.email || '');
          localStorage.removeItem(GUEST_STORAGE_KEY);
        } else if (!localStorage.getItem(GUEST_STORAGE_KEY)) {
          setProfile(null);
          setRoleState('user');
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Default offline guest account with standard user role if no session
      if (!savedGuest) {
        setUser(null);
        setProfile(null);
        setRoleState('user');
      }
      setLoading(false);
    }
  }, [isConfigured]);

  const loadProfile = async (userId: string, email: string) => {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).single();
      const isJuniorAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

      if (!error && data) {
        // Enforce admin exclusively for Junior Jackson
        if (isJuniorAdmin) {
          if (data.role !== 'admin') {
            await client.from('profiles').update({ role: 'admin' }).eq('id', userId);
            data.role = 'admin';
          }
          setProfile(data as UserProfile);
          setRoleState('admin');
        } else {
          // All other users are strictly standard users
          setProfile(data as UserProfile);
          setRoleState('user');
        }
      } else {
        // Create/upsert profile if missing
        const newProfile: UserProfile = {
          id: userId,
          email,
          role: isJuniorAdmin ? 'admin' : 'user',
          full_name: isJuniorAdmin ? ADMIN_NAME : (email.split('@')[0] || 'Staff Member'),
          created_at: new Date().toISOString(),
        };
        try {
          await client.from('profiles').upsert([newProfile]);
        } catch {
          // ignore
        }
        setProfile(newProfile);
        setRoleState(isJuniorAdmin ? 'admin' : 'user');
      }
    } catch {
      // Keep state resilient
    }
  };

  const signUp = async (email: string, password: string, fullName: string, initialRole: UserRole = 'user') => {
    const isJuniorAdmin = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    // Strictly assign admin only if it matches Junior Jackson's email
    const effectiveRole: UserRole = isJuniorAdmin ? 'admin' : 'user';
    const effectiveName = isJuniorAdmin ? ADMIN_NAME : fullName;

    if (!isConfigured) {
      // Local fallback account if Supabase not yet connected
      const mockId = 'user-' + Date.now();
      const guestProfile: UserProfile = {
        id: mockId,
        email,
        full_name: effectiveName,
        role: effectiveRole,
        created_at: new Date().toISOString(),
      };
      const mockUser = {
        id: mockId,
        email,
        user_metadata: { full_name: effectiveName, role: effectiveRole },
      } as unknown as User;
      setUser(mockUser);
      setProfile(guestProfile);
      setRoleState(effectiveRole);
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ user: mockUser, profile: guestProfile }));
      return { success: true };
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: effectiveName,
            role: effectiveRole,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        await loadProfile(data.user.id, data.user.email || '');
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign up failed' };
    }
  };

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const isJuniorAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD;

    if (!isConfigured) {
      // Offline fallback login check
      if (isJuniorAdmin) {
        const guestUser = {
          id: 'junior-jackson-admin',
          email: ADMIN_EMAIL,
          user_metadata: { full_name: ADMIN_NAME, role: 'admin' },
        } as unknown as User;
        const guestProfile: UserProfile = {
          id: 'junior-jackson-admin',
          email: ADMIN_EMAIL,
          full_name: ADMIN_NAME,
          role: 'admin',
          created_at: new Date().toISOString(),
        };
        setUser(guestUser);
        setProfile(guestProfile);
        setRoleState('admin');
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ user: guestUser, profile: guestProfile }));
        return { success: true };
      } else {
        // Normal offline user
        const guestUser = {
          id: 'staff-' + Date.now(),
          email: cleanEmail,
          user_metadata: { full_name: cleanEmail.split('@')[0], role: 'user' },
        } as unknown as User;
        const guestProfile: UserProfile = {
          id: guestUser.id,
          email: cleanEmail,
          full_name: cleanEmail.split('@')[0],
          role: 'user',
          created_at: new Date().toISOString(),
        };
        setUser(guestUser);
        setProfile(guestProfile);
        setRoleState('user');
        localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ user: guestUser, profile: guestProfile }));
        return { success: true };
      }
    }

    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        // If Junior Jackson is logging in for the first time and account isn't created in Supabase Auth yet,
        // automatically register it with admin rights
        if (isJuniorAdmin) {
          const signUpRes = await client.auth.signUp({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            options: {
              data: {
                full_name: ADMIN_NAME,
                role: 'admin',
              },
            },
          });

          if (!signUpRes.error && signUpRes.data.user) {
            setUser(signUpRes.data.user);
            await loadProfile(signUpRes.data.user.id, ADMIN_EMAIL);
            localStorage.removeItem(GUEST_STORAGE_KEY);
            return { success: true };
          }
        }
        return { success: false, error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        await loadProfile(data.session.user.id, data.session.user.email || '');
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }

      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Sign in failed' };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    if (isConfigured) {
      try {
        const client = getSupabaseClient();
        await client.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    setUser(null);
    setProfile(null);
    setSession(null);
    setRoleState('user');
  };

  const resetPassword = async (email: string) => {
    if (!isConfigured) {
      return { success: true };
    }
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(email);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Password reset failed' };
    }
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        role,
        isAdmin,
        loading,
        isConfigured,
        signUp,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
