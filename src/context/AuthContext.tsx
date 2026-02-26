import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  inIframe: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [inIframe, setInIframe] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

 useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      // Aquí validamos si el correo es el tuyo
      setIsAdmin(currentUser?.email === 'raullizardi74@gmail.com'); 
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        // Validamos de nuevo en cada cambio de sesión
        setIsAdmin(currentUser?.email === 'raullizardi74@gmail.com');
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      setInIframe(window.self !== window.top);
    } catch (e) {
      setInIframe(true);
    }
  }, []);

  const signInWithGoogle = async () => {
    if (inIframe) {
      console.log('Login is disabled within an iframe. Please open in a new tab.');
      return;
    }
    const redirectUrl = 'https://amoree-catalogo.vercel.app/';
    console.log('Redirigiendo a:', redirectUrl);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });
    if (error) console.error('Error signing in with Google:', error);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Error signing out:', error);
  };

  const value = {
    session,
    user,
    signInWithGoogle,
    signOut,
    inIframe,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
