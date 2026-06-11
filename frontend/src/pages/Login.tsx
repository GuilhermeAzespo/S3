import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Ajustar URL para ambiente de dev (ou prod via proxy)
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await axios.post(`${baseUrl}/api/auth/login`, { username, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err) {
      setError('Credenciais inválidas');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-eveo-darker text-eveo-text">
      <div className="w-full max-w-md p-8 space-y-8 bg-eveo-dark rounded-xl shadow-lg border border-eveo-gray">
        <div className="text-center">
          <h2 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
            <span className="text-eveo-red">≡</span> S3
          </h2>
          <p className="text-gray-400">Faça login para gerenciar seu armazenamento</p>
        </div>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-lg text-center text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Usuário</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-eveo-darker border border-eveo-gray rounded-lg focus:outline-none focus:border-eveo-red text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-eveo-darker border border-eveo-gray rounded-lg focus:outline-none focus:border-eveo-red text-white"
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-eveo-red hover:bg-eveo-redHover text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
