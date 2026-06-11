import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Container, LogOut } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full bg-eveo-darker text-eveo-text font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-eveo-dark flex flex-col border-r border-eveo-gray">
        <div className="h-16 flex items-center px-6 border-b border-eveo-gray">
          <span className="text-xl font-bold flex items-center gap-2">
            <span className="text-eveo-red text-2xl">≡</span> S3
          </span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link 
            to="/" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === '/' ? 'bg-eveo-red text-white font-medium' : 'hover:bg-eveo-gray text-gray-300'}`}
          >
            <LayoutGrid size={20} /> Painel
          </Link>
          <Link 
            to="/buckets" 
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname.startsWith('/buckets') ? 'bg-eveo-red text-white font-medium' : 'hover:bg-eveo-gray text-gray-300'}`}
          >
            <Container size={20} /> Buckets
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-eveo-dark border-b border-eveo-gray flex items-center justify-between px-6">
          <h2 className="text-2xl font-semibold capitalize">
            {location.pathname === '/' ? 'Painel' : location.pathname.split('/')[1]}
          </h2>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <LogOut size={18} /> Sair
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-eveo-darker">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
