import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, signInWithGoogle, signOut, inIframe } = useAuth();

  // 1. DEFINIMOS EL ACCESO DE ADMINISTRADOR (SÓLO TÚ POR AHORA)
  const isAdmin = user && user.email === 'raullizardi74@gmail.com';

  const handleGoToAdmin = () => {
    window.location.href = '/admin';
  };

  const handleGoToStore = () => {
    window.location.href = '/';
  };

  return (
    <header className="bg-white shadow-lg sticky top-0 z-20">
      <div className="bg-gray-50 py-2 text-center text-xs sm:text-sm border-b border-gray-200">
        <a 
          href={window.location.href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          👉 Haz clic aquí para abrir en ventana nueva y poder iniciar sesión
        </a>
      </div>
      <div className="py-3 px-6 flex justify-between items-center">
        {/* LOGO - Al darle clic vuelve a la tienda principal */}
        <img 
          src="https://i.postimg.cc/brvsk64r/LOGO_2.png" 
          alt="App Amoree Logo" 
          className="h-16 cursor-pointer" 
          referrerPolicy="no-referrer"
          onClick={handleGoToStore}
        />

        <div>
          {user ? (
            <div className="flex items-center gap-3 sm:gap-6">
              
              {/* 2. BOTÓN "VER PEDIDOS" - SOLO APARECE SI ERES TÚ */}
              {isAdmin && (
                <button 
                  onClick={handleGoToAdmin}
                  className="bg-amber-400 hover:bg-amber-500 text-amber-900 font-black py-2 px-3 sm:px-4 rounded-lg transition-all text-xs sm:text-sm shadow-sm flex items-center gap-2 border border-amber-500 animate-pulse-slow"
                >
                  <span className="text-base">📋</span>
                  <span className="hidden xs:inline">VER PEDIDOS</span>
                </button>
              )}

              <div className="flex items-center gap-2 border-l border-gray-100 pl-3 sm:pl-6">
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt={user.user_metadata.full_name} 
                  className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border-2 border-green-100" 
                />
                <span className="hidden md:inline font-bold text-gray-700 text-sm">
                  {user.user_metadata.full_name}
                </span>
              </div>

              <button 
                onClick={signOut} 
                className="bg-red-50 text-red-600 border border-red-200 font-bold py-2 px-3 rounded-lg hover:bg-red-600 hover:text-white transition-all text-xs"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle} 
              className="bg-green-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-green-600 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md shadow-green-100"
              disabled={inIframe}
              title={inIframe ? 'Abre la app en una nueva pestaña para iniciar sesión' : 'Iniciar sesión con Google'}
            >
              Iniciar sesión con Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
