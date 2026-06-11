import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, Upload, Download, Trash2, FileText,
  Search, ShieldAlert, Eye, EyeOff, Folder,
  ChevronRight, FolderUp, FolderOpen, CheckCircle2, AlertCircle, Loader2, X
} from 'lucide-react';
import { format } from 'date-fns';

// ─── helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/** Retorna pastas virtuais e arquivos visíveis no nível do prefix atual */
function listLevel(objects: any[], prefix: string) {
  const folders = new Set<string>();
  const files: any[] = [];
  for (const obj of objects) {
    if (!obj.key.startsWith(prefix)) continue;
    const rest = obj.key.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash === -1) files.push(obj);
    else folders.add(rest.slice(0, slash));
  }
  return { folders: Array.from(folders).sort(), files };
}

// ─── upload em lotes ──────────────────────────────────────────────────────────

const BATCH = 5; // arquivos em paralelo

async function uploadBatch(
  baseUrl: string,
  token: string,
  bucketId: string,
  items: Array<{ file: File; key: string }>,
  onProgress: (done: number) => void
): Promise<{ ok: number; fail: number }> {
  let ok = 0; let fail = 0;

  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    await Promise.all(slice.map(async ({ file, key }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('key', key);
      try {
        await axios.post(`${baseUrl}/api/objects/bucket/${bucketId}/upload`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        ok++;
      } catch { fail++; }
    }));
    onProgress(ok + fail);
  }
  return { ok, fail };
}

// ─── componente principal ─────────────────────────────────────────────────────

export default function BucketExplorer() {
  const { bucketId } = useParams<{ bucketId: string }>();
  const navigate     = useNavigate();

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [bucket,      setBucket]      = useState<any>(null);
  const [objects,     setObjects]     = useState<any[]>([]);
  const [prefix,      setPrefix]      = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading,     setLoading]     = useState(true);

  // progresso do upload
  const [uploadState, setUploadState] = useState<{
    active: boolean; total: number; done: number; label: string;
  }>({ active: false, total: 0, done: 0, label: '' });

  // notificações (toast)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const token   = localStorage.getItem('token') ?? '';
  const baseUrl = import.meta.env.VITE_API_URL || '';

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!bucketId) return;
    setLoading(true);
    try {
      const [br, or] = await Promise.all([
        axios.get(`${baseUrl}/api/buckets`,                     { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${baseUrl}/api/objects/bucket/${bucketId}`,  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setBucket(br.data.find((b: any) => b.id === bucketId) ?? null);
      setObjects(or.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [bucketId, baseUrl, token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── upload ─────────────────────────────────────────────────────────────────
  const doUpload = async (fileList: FileList, isFolder: boolean) => {
    if (!fileList.length || !bucketId) return;

    const items: Array<{ file: File; key: string }> = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const rel  = (file as any).webkitRelativePath as string;
      const key  = isFolder && rel ? prefix + rel : prefix + file.name;
      items.push({ file, key });
    }

    setUploadState({ active: true, total: items.length, done: 0, label: `Enviando 0 / ${items.length}` });

    const { ok, fail } = await uploadBatch(baseUrl, token, bucketId, items, (done) => {
      setUploadState(s => ({ ...s, done, label: `Enviando ${done} / ${items.length}` }));
    });

    setUploadState({ active: false, total: 0, done: 0, label: '' });

    if (fail === 0) {
      showToast('success', `${ok} arquivo(s) enviado(s) com sucesso!`);
      // navegar para dentro da pasta se veio de folder upload
      if (isFolder && items.length > 0) {
        const firstRel = (items[0].file as any).webkitRelativePath as string;
        if (firstRel) {
          const folderName = firstRel.split('/')[0];
          setPrefix(prefix + folderName + '/');
        }
      }
    } else {
      showToast('error', `${ok} OK · ${fail} falhou(aram). Verifique o console.`);
    }

    fetchAll();
    if (fileInputRef.current)   fileInputRef.current.value   = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (obj: any) => {
    if (!confirm(`Excluir "${obj.key}"?`)) return;
    try {
      await axios.delete(`${baseUrl}/api/objects/${obj.id}`, { headers: { Authorization: `Bearer ${token}` } });
      showToast('success', 'Arquivo excluído.');
      fetchAll();
    } catch { showToast('error', 'Erro ao excluir o arquivo.'); }
  };

  // ── navegação de pastas ────────────────────────────────────────────────────
  const breadcrumbs = prefix.split('/').filter(Boolean);

  const navigateTo = (parts: string[]) => {
    setPrefix(parts.length ? parts.join('/') + '/' : '');
    setSearchQuery('');
  };

  // ── listagem ───────────────────────────────────────────────────────────────
  const searchMode = searchQuery.trim().length > 0;
  const { folders, files } = searchMode
    ? { folders: [], files: objects.filter(o => o.key.toLowerCase().includes(searchQuery.toLowerCase())) }
    : listLevel(objects, prefix);

  const getDownloadUrl = (obj: any) =>
    bucket?.isPublic
      ? `${baseUrl}/api/objects/${obj.id}`
      : `${baseUrl}/api/objects/${obj.id}?token=${token}`;

  // ── guards ─────────────────────────────────────────────────────────────────
  if (loading && !bucket) return (
    <div className="flex h-64 items-center justify-center text-gray-400">Carregando…</div>
  );

  if (!bucket) return (
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

  return (
    <div className="space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-medium text-white
            ${toast.type === 'success' ? 'bg-green-700' : 'bg-red-700'}`}
          style={{ minWidth: 260 }}
        >
          {toast.type === 'success'
            ? <CheckCircle2 size={18} className="shrink-0" />
            : <AlertCircle  size={18} className="shrink-0" />}
          <span className="flex-1">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 ml-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Barra de progresso global ── */}
      {uploadState.active && (
        <div className="fixed top-5 right-5 z-[9999] bg-[#1e2330] border border-[#3a3a44] rounded-xl px-5 py-3 shadow-2xl text-sm text-white"
          style={{ minWidth: 280 }}>
          <div className="flex items-center gap-3 mb-2">
            <Loader2 size={16} className="animate-spin text-eveo-red shrink-0" />
            <span>{uploadState.label}</span>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-eveo-red h-2 rounded-full transition-all"
              style={{ width: `${uploadState.total ? (uploadState.done / uploadState.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

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
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Pesquisar arquivos…" value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#2d2d35] border-none text-sm text-white rounded-md pl-10 pr-4 py-2.5 focus:ring-1 focus:ring-eveo-red outline-none" />
        </div>

        {/* inputs hidden */}
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) doUpload(e.target.files, false); }} />
        <input ref={folderInputRef} type="file" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) doUpload(e.target.files, true); }}
          // @ts-ignore
          webkitdirectory="true" directory="true" />

        <div className="flex gap-2 w-full md:w-auto justify-end">
          <button onClick={() => folderInputRef.current?.click()} disabled={uploadState.active}
            className="px-4 py-2.5 bg-[#2d2d35] hover:bg-[#3a3a44] disabled:opacity-40 text-gray-200 font-medium rounded-md text-sm transition-colors flex items-center gap-2">
            <Folder size={16} /> Upload de Pasta
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploadState.active}
            className="px-5 py-2.5 bg-eveo-red hover:bg-eveo-redHover disabled:bg-red-900 text-white font-medium rounded-md text-sm transition-colors flex items-center gap-2">
            <Upload size={16} />
            {uploadState.active ? 'Enviando…' : 'Upload de Arquivo'}
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

            {/* Voltar pasta */}
            {!searchMode && prefix && (
              <tr className="border-t border-[#3a3a44] bg-[#2a2f3a] hover:bg-[#343946] cursor-pointer"
                onClick={() => navigateTo(breadcrumbs.slice(0, -1))}>
                <td className="p-4 text-gray-400 flex items-center gap-3" colSpan={6}>
                  <FolderUp size={18} className="shrink-0" /> ..
                </td>
              </tr>
            )}

            {/* Pastas virtuais */}
            {!searchMode && folders.map(folder => (
              <tr key={`f-${folder}`}
                className="border-t border-[#3a3a44] bg-[#2f3542] hover:bg-[#343946] cursor-pointer"
                onClick={() => navigateTo([...breadcrumbs, folder])}>
                <td className="p-4 font-medium text-blue-300 flex items-center gap-3">
                  <Folder size={18} className="text-blue-400 shrink-0" /> {folder}
                </td>
                <td className="p-4 text-gray-500 text-xs">Pasta</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4 text-gray-500">—</td>
                <td className="p-4" />
              </tr>
            ))}

            {/* Arquivos */}
            {files.map((obj, idx) => {
              const displayName = searchMode ? obj.key : obj.key.slice(prefix.length);
              return (
                <tr key={obj.id}
                  className={`border-t border-[#3a3a44] ${idx % 2 === 0 ? 'bg-[#2a2f3a]' : 'bg-[#2f3542]'} hover:bg-[#343946] transition-colors`}>
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
                    {obj.expiresAt
                      ? <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 rounded text-xs border border-yellow-500/20">{format(new Date(obj.expiresAt), 'dd/MM/yyyy')}</span>
                      : <span className="text-gray-500 text-xs">Permanente</span>}
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

            {folders.length === 0 && files.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-gray-400">
                  {searchQuery ? 'Nenhum arquivo encontrado.' : 'Esta pasta está vazia.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
