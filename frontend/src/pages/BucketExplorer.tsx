import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Upload, Download, Trash2, FileText,
  Search, ShieldAlert, Eye, EyeOff, Folder, FolderOpen,
  ChevronRight, FolderUp, X, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Dado um prefixo atual e a lista completa de objetos,
// retorna { folders: string[], files: object[] } visíveis nesse nível.
function listLevel(objects: any[], prefix: string) {
  const folders = new Set<string>();
  const files: any[] = [];

  for (const obj of objects) {
    const key: string = obj.key;
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length); // parte após o prefixo atual
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      // É um arquivo direto neste nível
      files.push(obj);
    } else {
      // É uma pasta (tudo até o primeiro '/')
      folders.add(rest.slice(0, slashIdx));
    }
  }

  return { folders: Array.from(folders).sort(), files };
}

// ─── Toast simples ────────────────────────────────────────────────────────────

interface Toast { id: number; type: 'success' | 'error' | 'loading'; message: string }

let toastId = 0;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function BucketExplorer() {
  const { bucketId } = useParams<{ bucketId: string }>();
  const navigate = useNavigate();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [bucket,      setBucket]      = useState<any>(null);
  const [objects,     setObjects]     = useState<any[]>([]);
  const [prefix,      setPrefix]      = useState('');          // pasta atual
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [uploading,   setUploading]   = useState(false);
  const [toasts,      setToasts]      = useState<Toast[]>([]);

  const token   = localStorage.getItem('token');
  const baseUrl = import.meta.env.VITE_API_URL || '';

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, type, message }]);
    if (type !== 'loading') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!bucketId) return;
    setLoading(true);
    try {
      const [bucketRes, objRes] = await Promise.all([
        axios.get(`${baseUrl}/api/buckets`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${baseUrl}/api/objects/bucket/${bucketId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setBucket(bucketRes.data.find((b: any) => b.id === bucketId) || null);
      setObjects(objRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [bucketId, baseUrl, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const doUpload = async (fileList: FileList, isFolder: boolean) => {
    if (!fileList.length || !bucketId) return;
    setUploading(true);
    const tid = addToast('loading', `Enviando ${fileList.length} arquivo(s)…`);

    const formData = new FormData();
    const keys: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      let key: string;

      if (isFolder && (file as any).webkitRelativePath) {
        // Pasta: preserva estrutura relativa, dentro do prefixo atual
        key = prefix + (file as any).webkitRelativePath;
      } else {
        // Arquivo(s) simples: coloca no prefixo atual
        key = prefix + file.name;
      }

      formData.append('files', file);
      keys.push(key);
    }

    // Enviar keys como JSON string
    formData.append('keys', JSON.stringify(keys));

    try {
      await axios.post(`${baseUrl}/api/objects/bucket/${bucketId}/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      removeToast(tid);
      addToast('success', `${fileList.length} arquivo(s) enviado(s) com sucesso!`);

      // Se veio de pasta, navegar para a raiz dessa pasta no prefixo atual
      if (isFolder && fileList.length > 0 && (fileList[0] as any).webkitRelativePath) {
        const folderName = (fileList[0] as any).webkitRelativePath.split('/')[0];
        setPrefix(prefix + folderName + '/');
      }

      fetchAll();
    } catch (err: any) {
      removeToast(tid);
      addToast('error', err.response?.data?.error || 'Erro ao enviar arquivos.');
    } finally {
      setUploading(false);
      if (fileInputRef.current)   fileInputRef.current.value   = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const handleFileChange   = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) doUpload(e.target.files, false);
  };
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) doUpload(e.target.files, true);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (obj: any) => {
    if (!confirm(`Excluir "${obj.key}"?`)) return;
    try {
      await axios.delete(`${baseUrl}/api/objects/${obj.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addToast('success', 'Arquivo excluído.');
      fetchAll();
    } catch {
      addToast('error', 'Erro ao excluir o arquivo.');
    }
  };

  // ── Navegação de pastas ────────────────────────────────────────────────────
  const breadcrumbs = prefix.split('/').filter(Boolean); // ['PastaRaiz','SubPasta']

  const navigateTo = (parts: string[]) => {
    setPrefix(parts.length ? parts.join('/') + '/' : '');
    setSearchQuery('');
  };

  // ── Listagem ───────────────────────────────────────────────────────────────
  // Quando há busca, ignorar hierarquia e mostrar tudo que bate
  const searchMode = searchQuery.trim().length > 0;
  const { folders, files } = searchMode
    ? { folders: [], files: objects.filter(o => o.key.toLowerCase().includes(searchQuery.toLowerCase())) }
    : listLevel(objects, prefix);

  const getDownloadUrl = (obj: any) =>
    bucket?.isPublic
      ? `${baseUrl}/api/objects/${obj.id}`
      : `${baseUrl}/api/objects/${obj.id}?token=${token}`;

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (loading && !bucket) {
    return <div className="flex h-64 items-center justify-center text-gray-400">Carregando…</div>;
  }
  if (!bucket) {
    return (
      <div className="bg-[#2a2f3a] rounded-xl p-8 text-center text-gray-300">
        <ShieldAlert className="mx-auto mb-4 text-eveo-red" size={48} />
        <h3 className="text-xl font-bold mb-2">Bucket Não Encontrado</h3>
        <p className="text-gray-400 mb-6">O bucket não existe ou você não tem permissão.</p>
        <button onClick={() => navigate('/buckets')}
          className="px-4 py-2 bg-eveo-red hover:bg-eveo-redHover text-white font-medium rounded-md text-sm transition-colors inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Voltar para Buckets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">

      {/* ── Toasts ── */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-medium pointer-events-auto
              ${t.type === 'success' ? 'bg-green-700 text-white' : t.type === 'error' ? 'bg-red-700 text-white' : 'bg-[#2a2f3a] text-gray-200 border border-gray-600'}`}>
            {t.type === 'success' && <CheckCircle2 size={16} />}
            {t.type === 'error'   && <AlertCircle  size={16} />}
            {t.type === 'loading' && <Loader2 size={16} className="animate-spin" />}
            {t.message}
            {t.type !== 'loading' && (
              <button onClick={() => removeToast(t.id)} className="ml-2 opacity-70 hover:opacity-100">
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#2a2f3a] p-6 rounded-xl border border-eveo-gray">
        <div className="space-y-2">
          <button onClick={() => navigate('/buckets')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium mb-2">
            <ArrowLeft size={16} /> Voltar para Buckets
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">{bucket.name}</h1>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${bucket.isPublic ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
              {bucket.isPublic ? <Eye size={12} /> : <EyeOff size={12} />}
              {bucket.isPublic ? 'Público' : 'Privado'}
            </span>
          </div>
          <p className="text-gray-400 text-sm">ID: <span className="font-mono text-gray-300">{bucket.id}</span></p>
        </div>

        <div className="bg-[#1e1e24] p-4 rounded-lg border border-eveo-gray flex gap-6 text-sm">
          <div>
            <span className="block text-gray-400 text-xs">Uso de Armazenamento</span>
            <span className="text-white font-semibold">{formatBytes(bucket.usedBytes)}</span>
            <span className="text-gray-500"> / {bucket.quotaBytes ? formatBytes(bucket.quotaBytes) : 'Ilimitado'}</span>
            {bucket.quotaBytes && (
              <div className="w-32 bg-gray-700 h-1 mt-1.5 rounded-full overflow-hidden">
                <div className="bg-eveo-red h-1" style={{ width: `${Math.min((bucket.usedBytes / bucket.quotaBytes) * 100, 100)}%` }} />
              </div>
            )}
          </div>
          <div className="border-l border-eveo-gray pl-6">
            <span className="block text-gray-400 text-xs">Total de Arquivos</span>
            <span className="text-white font-semibold text-lg">{objects.length}</span>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Busca */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Pesquisar arquivos…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#2d2d35] border-none text-sm text-white rounded-md pl-10 pr-4 py-2.5 focus:ring-1 focus:ring-eveo-red outline-none" />
        </div>

        {/* Upload inputs (hidden) */}
        <input ref={fileInputRef}   type="file" multiple className="hidden" onChange={handleFileChange} />
        <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderChange}
          /* @ts-ignore */
          webkitdirectory="true" directory="true" />

        {/* Botões de upload */}
        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button onClick={() => folderInputRef.current?.click()} disabled={uploading}
            className="px-4 py-2.5 bg-[#2d2d35] hover:bg-[#3a3a44] disabled:opacity-50 text-gray-200 font-medium rounded-md text-sm transition-colors flex items-center gap-2">
            <Folder size={16} /> Upload de Pasta
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-5 py-2.5 bg-eveo-red hover:bg-eveo-redHover disabled:bg-red-800 text-white font-medium rounded-md text-sm transition-colors flex items-center gap-2">
            <Upload size={16} />
            {uploading ? 'Enviando…' : 'Upload de Arquivo'}
          </button>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      {!searchMode && (
        <div className="flex items-center gap-1 text-sm flex-wrap">
          <button onClick={() => navigateTo([])}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors font-medium">
            <FolderOpen size={15} /> Raiz
          </button>
          {breadcrumbs.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-gray-600" />
              <button onClick={() => navigateTo(breadcrumbs.slice(0, i + 1))}
                className={`hover:text-white transition-colors ${i === breadcrumbs.length - 1 ? 'text-white font-semibold' : 'text-gray-400'}`}>
                {part}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Tabela ── */}
      <div className="bg-[#2a2f3a] rounded-xl overflow-hidden shadow-lg border border-eveo-gray">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-eveo-red text-white text-sm">
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">Tipo</th>
              <th className="p-4 font-medium">Tamanho</th>
              <th className="p-4 font-medium">Enviado em</th>
              <th className="p-4 font-medium">Expiração</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">

            {/* Botão "Subir pasta" (volta um nível) */}
            {!searchMode && prefix && (
              <tr className="border-t border-[#3a3a44] bg-[#2a2f3a] hover:bg-[#343946] transition-colors cursor-pointer"
                onClick={() => navigateTo(breadcrumbs.slice(0, -1))}>
                <td className="p-4 text-gray-400 flex items-center gap-3" colSpan={6}>
                  <FolderUp size={18} className="shrink-0" /> ..
                </td>
              </tr>
            )}

            {/* Pastas virtuais */}
            {!searchMode && folders.map(folder => (
              <tr key={`folder-${folder}`}
                className="border-t border-[#3a3a44] bg-[#2f3542] hover:bg-[#343946] transition-colors cursor-pointer"
                onClick={() => navigateTo([...breadcrumbs, folder])}>
                <td className="p-4 font-medium text-blue-300 flex items-center gap-3">
                  <Folder size={18} className="text-blue-400 shrink-0" />
                  {folder}
                </td>
                <td className="p-4 text-gray-500 text-xs">Pasta</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4" />
              </tr>
            ))}

            {/* Arquivos */}
            {files.map((obj, index) => {
              const displayName = searchMode ? obj.key : obj.key.slice(prefix.length);
              return (
                <tr key={obj.id}
                  className={`border-t border-[#3a3a44] ${index % 2 === 0 ? 'bg-[#2a2f3a]' : 'bg-[#2f3542]'} hover:bg-[#343946] transition-colors`}>
                  <td className="p-4 font-medium text-white">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-gray-400 shrink-0" />
                      <span className="truncate max-w-xs md:max-w-sm" title={obj.key}>{displayName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-300 font-mono text-xs">{obj.mimeType}</td>
                  <td className="p-4 text-white font-medium">{formatBytes(obj.sizeBytes)}</td>
                  <td className="p-4 text-gray-300">{format(new Date(obj.createdAt), 'dd/MM/yyyy HH:mm')}</td>
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
                      <a href={getDownloadUrl(obj)} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-white transition-colors" title="Download">
                        <Download size={18} />
                      </a>
                      <button onClick={() => handleDelete(obj)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors" title="Excluir">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Vazio */}
            {folders.length === 0 && files.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400">
                  {searchQuery ? 'Nenhum arquivo correspondente à pesquisa.' : 'Esta pasta está vazia.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
