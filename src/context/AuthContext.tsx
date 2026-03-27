import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 1. Creamos el contexto
const AuthContext = createContext<any>(undefined);

// 2. Definimos el proveedor Titanium
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Función para detectar si la App corre dentro de un iframe (como en Postimg o previsualizadores)
  const inIframe = window.self !== window.top;

  useEffect(() => {
    // Comprobar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuchar cambios en el estado de auth (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ✅ FUNCIÓN: Iniciar sesión con Google
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('Error en Login:', error.message);
    }
  };

  // ✅ FUNCIÓN: Cerrar sesión (La que Hugo necesita)
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // Forzamos limpieza de URL y estado
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error en Logout:', error.message);
    }
  };

  return (
    // ✅ Exportamos todo lo que el Header necesita
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, inIframe }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. EXPORTAMOS useAuth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
