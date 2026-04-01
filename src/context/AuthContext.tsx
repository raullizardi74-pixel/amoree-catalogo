import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// 1. Creamos el contexto con el tipado Titanium
const AuthContext = createContext<any>(undefined);

// 2. Definimos el proveedor
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ✅ Función para detectar si la App corre dentro de un iframe (Optimización para editores web)
  const inIframe = window.self !== window.top;

  useEffect(() => {
    // A. Comprobar sesión inicial con manejo de errores
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error recuperando sesión inicial:', error);
      } finally {
        setLoading(false);
      }
    };

    checkInitialSession();

    // B. Escuchar cambios en el estado de auth (Login, Logout, Token Refreshed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false); // Aseguramos que deje de cargar tras el cambio
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ✅ FUNCIÓN: Iniciar sesión con Google (Configurada para Amoree)
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Asegura que regrese a la misma página donde estaba
          redirectTo: window.location.origin 
        }
      });
      if (error) throw error;
    } catch (error: any) {
      console.error('🛑 Error en Login Titanium:', error.message);
      alert('No se pudo iniciar sesión con Google.');
    }
  };

  // ✅ FUNCIÓN: Cerrar sesión (Fix: Limpieza total de estado)
  const signOut = async () => {
    try {
      setLoading(true); // Feedback visual inmediato
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Forzamos limpieza de URL y reinicio de la App para evitar residuos de caché
      window.location.href = '/';
    } catch (error: any) {
      console.error('🛑 Error en Logout Titanium:', error.message);
      setLoading(false);
    }
  };

  return (
    // ✅ Exportamos el kit completo para el Header y el POS
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, inIframe }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Hook personalizado useAuth
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
