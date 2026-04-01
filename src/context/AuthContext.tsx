import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext<any>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const inIframe = window.self !== window.top;

  // ✅ LISTA MAESTRA DE ADMINS (Centralizada)
  const adminEmails = ['raullizardi74@gmail.com'];
  
  // ✅ CÁLCULO DE ADMIN (Blindaje Nuclear)
  const isAdmin = user && adminEmails.includes(user.email?.toLowerCase().trim() || '');

  useEffect(() => {
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error inicial:', error);
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (error: any) { console.error(error.message); }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error: any) { console.error(error.message); }
  };

  return (
    // ✅ Exportamos 'isAdmin' para que el Lápiz y el Header lo vean
    <AuthContext.Provider value={{ user, loading, isAdmin, signInWithGoogle, signOut, inIframe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth debe estar dentro de AuthProvider');
  return context;
};
