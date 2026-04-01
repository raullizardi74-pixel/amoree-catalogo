import { useAuth } from '../context/AuthContext';
import { Zap, LogOut } from 'lucide-react';

export default function Header() {
  const { user, signInWithGoogle, signOut, inIframe, loading } = useAuth();

  // ✅ VALIDACIÓN NUCLEAR: Ignora espacios y mayúsculas
  const adminEmails = ['raullizardi74@gmail.com'];
  const userEmail = user?.email?.toLowerCase().trim() || "";
  const isAdmin = adminEmails.includes(userEmail);

  const handleGoToAdmin = () => {
    window.location.href = '/admin';
  };

  const handleGoToStore = () => {
    window.location.href = '/';
  };

  return (
    <header className="bg-[#0A0A0A] border-b border-white/5 sticky top-0 z-50 backdrop-blur-xl">
      <div className="bg-green-500/5 py-2 text-center border-b border-white/5">
        <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-green-500/50 hover:text-green-400 uppercase tracking-[0.3em] transition-all">
          ⚡ Haz clic aquí para optimizar la sesión en ventana nueva ⚡
        </a>
      </div>

      <div className="max-w-7xl mx-auto py-4 px-6 flex justify-between items-center">
        <div className="relative group cursor-pointer" onClick={handleGoToStore}>
          <div className="absolute -inset-2 bg-green-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
          <img src="https://i.postimg.cc/brvsk64r/LOGO_2.png" alt="Logo" className="h-12 sm:h-14 relative brightness-110 contrast-125" referrerPolicy="no-referrer" />
        </div>

        <div className="flex items-center gap-4 sm:gap-8">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-4 sm:gap-6">
                  
                  {/* --- BOTÓN BUSINESS OS (VERIFICACIÓN MEJORADA) --- */}
                  {isAdmin && (
                    <button 
                      onClick={handleGoToAdmin}
                      className="relative group flex items-center gap-3 px-4 py-2 bg-black border border-green-500/30 rounded-2xl transition-all duration-500 hover:border-green-500 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-green-600/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <Zap size={14} className="text-green-500 relative z-10 animate-pulse" />
                      <div className="relative flex flex-col items-start leading-none">
                        <span className="text-[9px] font-black text-white tracking-[0.1em] uppercase">Business OS</span>
                        <span className="text-[6px] font-bold text-green-500/50 uppercase mt-1">Control Center</span>
                      </div>
                    </button>
                  )}

                  <div className="flex items-center gap-3 border-l border-white/10 pl-4 sm:pl-8">
                    <div className="hidden md:flex flex-col items-end leading-none">
                      <p className="text-[10px] font-black text-white uppercase">{user.user_metadata?.full_name || 'Admin'}</p>
                      <p className="text-[7px] font-bold text-green-500 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span> Online
                      </p>
                    </div>
                    <img src={user.user_metadata?.avatar_url} alt="Avatar" className="h-9 w-9 sm:h-11 sm:w-11 rounded-full border border-white/10 object-cover" />
                  </div>

                  <button onClick={signOut} className="text-[8px] font-black text-gray-600 hover:text-red-500 uppercase tracking-[0.2em] transition-colors">Cerrar</button>
                </div>
              ) : (
                <button onClick={signInWithGoogle} className="px-6 py-3 bg-white text-black font-black text-[10px] uppercase rounded-2xl">Iniciar Sesión</button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
