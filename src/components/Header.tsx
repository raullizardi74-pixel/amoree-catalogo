import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, signInWithGoogle, signOut, inIframe } = useAuth();

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
        <img 
          src="https://i.postimg.cc/brvsk64r/LOGO_2.png" 
          alt="App Amoree Logo" 
          className="h-16" 
          referrerPolicy="no-referrer" 
        />
        <div>
          {user ? (
            <div className="flex items-center gap-4">
              <img src={user.user_metadata.avatar_url} alt={user.user_metadata.full_name} className="h-10 w-10 rounded-full" />
              <span className="hidden sm:inline font-semibold">{user.user_metadata.full_name}</span>
              <button onClick={signOut} className="bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600 transition-colors text-sm">
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button 
            onClick={signInWithGoogle} 
            className="bg-green-500 text-white font-bold py-2 px-4 rounded hover:bg-green-600 transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
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


