import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Upload, Download, Trash2, FileText, Search, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

export default function BucketExplorer() {
  const { bucketId } = useParams<{ bucketId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bucket, setBucket] = useState<any>(null);
  const [objects, setObjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const token = localStorage.getItem('token');
  const baseUrl = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    fetchBucketAndObjects();
  }, [bucketId]);

  const fetchBucketAndObjects = async () => {
    if (!bucketId) return;
    setLoading(true);
    try {
      // Obter informações do bucket específico buscando na lista total
      const bucketRes = await axios.get(`${baseUrl}/api/buckets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const currentBucket = bucketRes.data.find((b: any) => b.id === bucketId);
      setBucket(currentBucket || null);

      // Obter objetos do bucket
      const objectsRes = await axios.get(`${baseUrl}/api/objects/bucket/${bucketId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setObjects(objectsRes.data);
    } catch (e) {
      console.error('Erro ao buscar dados do bucket', e);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !bucketId) return;

    const file = files[0];
    
    // Verificar cota antes de tentar enviar (se disponível)
    if (bucket && bucket.quotaBytes) {
      const remainingBytes = bucket.quotaBytes - bucket.usedBytes;
      if (file.size > remainingBytes) {
        alert('Erro: O arquivo excede a cota disponível do bucket.');
        return;
      }
    }

    const key = prompt('Confirme ou altere o caminho/nome do arquivo:', file.name);
    if (!key) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);

    try {
      await axios.post(`${baseUrl}/api/objects/bucket/${bucketId}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchBucketAndObjects();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Erro ao realizar upload do arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileDelete = async (objectId: string, key: string) => {
    if (!confirm(`Tem certeza de que deseja excluir o arquivo "${key}"?`)) return;
    try {
      await axios.delete(`${baseUrl}/api/objects/${objectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBucketAndObjects();
    } catch (e) {
      console.error(e);
      alert('Erro ao deletar o arquivo.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDownloadUrl = (obj: any) => {
    if (bucket?.isPublic) {
      return `${baseUrl}/api/objects/${obj.id}`;
    }
    return `${baseUrl}/api/objects/${obj.id}?token=${token}`;
  };

  const filteredObjects = objects.filter(obj => 
    obj.key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !bucket) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Carregando detalhes do bucket...
      </div>
    );
  }

  if (!bucket) {
    return (
      <div className="bg-[#2a2f3a] rounded-xl p-8 text-center text-gray-300">
        <ShieldAlert className="mx-auto mb-4 text-eveo-red" size={48} />
        <h3 className="text-xl font-bold mb-2">Bucket Não Encontrado</h3>
        <p className="text-gray-400 mb-6">O bucket que você está tentando acessar não existe ou você não tem permissão.</p>
        <button 
          onClick={() => navigate('/buckets')}
          className="px-4 py-2 bg-eveo-red hover:bg-eveo-redHover text-white font-medium rounded-md text-sm transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} /> Voltar para Buckets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#2a2f3a] p-6 rounded-xl border border-eveo-gray">
        <div className="space-y-2">
          <button 
            onClick={() => navigate('/buckets')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium mb-2"
          >
            <ArrowLeft size={16} /> Voltar para Buckets
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">{bucket.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${bucket.isPublic ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {bucket.isPublic ? <Eye size={12} /> : <EyeOff size={12} />}
              {bucket.isPublic ? 'Público' : 'Privado'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            ID: <span className="font-mono text-gray-300">{bucket.id}</span>
          </p>
        </div>

        <div className="bg-[#1e1e24] p-4 rounded-lg border border-eveo-gray flex gap-6 text-sm">
          <div>
            <span className="block text-gray-400 text-xs">Uso de Armazenamento</span>
            <span className="text-white font-semibold">{formatBytes(bucket.usedBytes)}</span>
            <span className="text-gray-500 font-normal"> / {bucket.quotaBytes ? formatBytes(bucket.quotaBytes) : 'Ilimitado'}</span>
            {bucket.quotaBytes && (
              <div className="w-32 bg-gray-700 h-1 mt-1.5 rounded-full overflow-hidden">
                <div className="bg-eveo-red h-1" style={{ width: `${Math.min((bucket.usedBytes / bucket.quotaBytes) * 100, 100)}%` }}></div>
              </div>
            )}
          </div>
          <div className="border-l border-eveo-gray pl-6">
            <span className="block text-gray-400 text-xs">Total de Arquivos</span>
            <span className="text-white font-semibold text-lg">{objects.length}</span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Pesquisar arquivos..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#2d2d35] border-none text-sm text-white rounded-md pl-10 pr-4 py-2.5 focus:ring-1 focus:ring-eveo-red outline-none"
          />
        </div>

        <div className="w-full md:w-auto flex justify-end">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full md:w-auto px-5 py-2.5 bg-eveo-red hover:bg-eveo-redHover disabled:bg-red-800 text-white font-medium rounded-md text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Upload size={18} />
            {uploading ? 'Enviando...' : 'Fazer Upload de Arquivo'}
          </button>
        </div>
      </div>

      {/* Files Table */}
      <div className="bg-[#2a2f3a] rounded-xl overflow-hidden shadow-lg border border-eveo-gray">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-eveo-red text-white text-sm">
              <th className="p-4 font-medium">Nome do Arquivo (Key)</th>
              <th className="p-4 font-medium">Tipo</th>
              <th className="p-4 font-medium">Tamanho</th>
              <th className="p-4 font-medium">Enviado em</th>
              <th className="p-4 font-medium">Expiração (Regra)</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredObjects.map((obj, index) => (
              <tr key={obj.id} className={`border-t border-[#3a3a44] ${index % 2 === 0 ? 'bg-[#2a2f3a]' : 'bg-[#2f3542]'} hover:bg-[#343946] transition-colors`}>
                <td className="p-4 font-medium text-white flex items-center gap-3">
                  <FileText size={18} className="text-gray-400 shrink-0" />
                  <span className="truncate max-w-xs md:max-w-md" title={obj.key}>{obj.key}</span>
                </td>
                <td className="p-4 text-gray-300 font-mono text-xs">{obj.mimeType}</td>
                <td className="p-4 text-white font-medium">{formatBytes(obj.sizeBytes)}</td>
                <td className="p-4 text-gray-300">
                  {format(new Date(obj.createdAt), 'dd/MM/yyyy HH:mm')}
                </td>
                <td className="p-4">
                  {obj.expiresAt ? (
                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-xs border border-yellow-500/20">
                      {format(new Date(obj.expiresAt), 'dd/MM/yyyy')}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">Permanente</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a 
                      href={getDownloadUrl(obj)}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-white transition-colors"
                      title="Download/Visualizar"
                    >
                      <Download size={18} />
                    </a>
                    <button 
                      onClick={() => handleFileDelete(obj.id, obj.key)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredObjects.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  {searchQuery ? 'Nenhum arquivo correspondente à pesquisa.' : 'Nenhum arquivo neste bucket.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
