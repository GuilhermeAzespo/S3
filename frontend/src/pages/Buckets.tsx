import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Search, Trash2, X, HardDrive, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface CreateModalState {
  name: string;
  quotaEnabled: boolean;
  quotaValue: string;
  quotaUnit: 'MB' | 'GB' | 'TB';
  retentionEnabled: boolean;
  retentionDays: string;
}

const initialModal: CreateModalState = {
  name: '',
  quotaEnabled: false,
  quotaValue: '',
  quotaUnit: 'GB',
  retentionEnabled: false,
  retentionDays: '30',
};

export default function Buckets() {
  const navigate = useNavigate();
  const [buckets,   setBuckets]   = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState<CreateModalState>(initialModal);
  const [creating,  setCreating]  = useState(false);
  const [error,     setError]     = useState('');
  const [search,    setSearch]    = useState('');

  // Seleção e exclusão
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [deleteModal,  setDeleteModal]  = useState<{
    open: boolean; objectCount: number; force: boolean; deleting: boolean;
  }>({ open: false, objectCount: 0, force: false, deleting: false });

  const baseUrl = import.meta.env.VITE_API_URL || '';
  const token   = localStorage.getItem('token');

  useEffect(() => { fetchBuckets(); }, []);

  const fetchBuckets = async () => {
    try {
      const res = await axios.get(`${baseUrl}/api/buckets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBuckets(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ── Checkbox ──────────────────────────────────────────────────────────────
  const toggleOne = (id: string) => setSelected(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => setSelected(s =>
    s.size === filteredBuckets.length
      ? new Set()
      : new Set(filteredBuckets.map((b: any) => b.id))
  );

  // ── Exclusão ──────────────────────────────────────────────────────────────
  const startDelete = async () => {
    if (selected.size === 0) return;
    // Verificar se algum dos selecionados tem arquivos (primeiro selecionado basta para o aviso)
    // O backend vai retornar 409 se tiver arquivos
    setDeleteModal({ open: true, objectCount: 0, force: false, deleting: false });
  };

  const confirmDelete = async (force: boolean) => {
    setDeleteModal(s => ({ ...s, deleting: true }));
    const ids = Array.from(selected);
    for (const id of ids) {
      try {
        await axios.delete(`${baseUrl}/api/buckets/${id}${force ? '?force=true' : ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err: any) {
        if (err.response?.status === 409 && !force) {
          // Tem arquivos — mostrar aviso com contagem total
          const total = ids.reduce((acc, bid) => {
            const b = buckets.find((x: any) => x.id === bid);
            return acc + (b?.objectCount || 0);
          }, 0);
          setDeleteModal({ open: true, objectCount: total, force: true, deleting: false });
          return;
        }
      }
    }
    setSelected(new Set());
    setDeleteModal({ open: false, objectCount: 0, force: false, deleting: false });
    fetchBuckets();
  };

  const openModal = () => {
    setForm(initialModal);
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    if (!creating) setShowModal(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('O nome do bucket é obrigatório.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      // Convert quota to bytes
      let quotaBytes: number | null = null;
      if (form.quotaEnabled && form.quotaValue) {
        const val = parseFloat(form.quotaValue);
        const multiplier = form.quotaUnit === 'MB' ? 1024 ** 2 : form.quotaUnit === 'GB' ? 1024 ** 3 : 1024 ** 4;
        quotaBytes = Math.round(val * multiplier);
      }

      const bucketRes = await axios.post(
        `${baseUrl}/api/buckets`,
        { name: form.name.trim(), isPublic: false, quotaBytes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (form.retentionEnabled && form.retentionDays) {
        const days = parseInt(form.retentionDays);
        if (days > 0) {
          await axios.post(
            `${baseUrl}/api/lifecycle/bucket/${bucketRes.data.id}`,
            { prefix: '', daysToLive: days },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }

      setShowModal(false);
      fetchBuckets();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Erro ao criar bucket. Verifique o nome e tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const filteredBuckets = buckets.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-[#2d2d35] hover:bg-[#3a3a44] text-gray-300 rounded-md text-sm transition-colors flex items-center gap-2">
            Regras de Ciclo de Vida
          </button>
          <button
            onClick={startDelete}
            disabled={selected.size === 0}
            className="px-4 py-2 bg-[#2d2d35] hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 hover:text-white rounded-md text-sm transition-colors flex items-center gap-2">
            <Trash2 size={16} /> Excluir{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Pesquisar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-[#2d2d35] border-none text-sm text-white rounded-md pl-10 pr-4 py-2 focus:ring-1 focus:ring-eveo-red outline-none"
            />
          </div>
          <button
            onClick={openModal}
            className="px-4 py-2 bg-eveo-red hover:bg-eveo-redHover text-white font-medium rounded-md text-sm transition-colors flex items-center gap-2"
          >
            <Plus size={16} /> Criar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#2a2f3a] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-eveo-red text-white text-sm">
              <th className="p-4 w-12">
                <input type="checkbox"
                  className="rounded bg-black border-none cursor-pointer"
                  checked={selected.size > 0 && selected.size === filteredBuckets.length}
                  onChange={toggleAll} />
              </th>
              <th className="p-4 font-medium">Nome</th>
              <th className="p-4 font-medium">Cota do Bucket</th>
              <th className="p-4 font-medium">Criado</th>
              <th className="p-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredBuckets.map((b, index) => (
              <tr key={b.id} className={`border-t border-[#3a3a44] ${index % 2 === 0 ? 'bg-[#2a2f3a]' : 'bg-[#2f3542]'} ${selected.has(b.id) ? 'bg-red-900/10' : ''}`}>
                <td className="p-4">
                  <input type="checkbox" className="rounded bg-black border-none cursor-pointer"
                    checked={selected.has(b.id)}
                    onChange={() => toggleOne(b.id)} />
                </td>
                <td className="p-4 font-medium text-white">{b.name}</td>
                <td className="p-4">
                  <div className="text-white font-medium">
                    {formatBytes(b.usedBytes)} <span className="text-gray-400 font-normal">/ {b.quotaBytes ? formatBytes(Number(b.quotaBytes)) : 'Ilimitado'}</span>
                  </div>
                  {b.quotaBytes && (
                    <div className="w-full max-w-[150px] bg-gray-700 h-1 mt-2 rounded-full">
                      <div
                        className="bg-green-500 h-1 rounded-full"
                        style={{ width: `${Math.min((b.usedBytes / Number(b.quotaBytes)) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </td>
                <td className="p-4 text-gray-300">
                  {format(new Date(b.createdAt), 'dd/MM/yyyy')}
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => navigate(`/buckets/${b.id}`)}
                    className="px-4 py-1.5 border border-eveo-red text-eveo-red hover:bg-eveo-red hover:text-white rounded transition-colors text-xs font-medium"
                  >
                    Explorar
                  </button>
                </td>
              </tr>
            ))}
            {filteredBuckets.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-400">Nenhum bucket encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e2330] border border-[#3a3a44] rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="p-2 bg-red-500/15 rounded-lg shrink-0">
                <AlertTriangle size={22} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-white text-base font-semibold mb-1">
                  {deleteModal.objectCount > 0
                    ? 'Bucket contém arquivos'
                    : `Excluir ${selected.size} bucket(s)?`}
                </h2>
                {deleteModal.objectCount > 0 ? (
                  <p className="text-gray-400 text-sm">
                    Os <span className="text-white font-semibold">{deleteModal.objectCount} arquivo(s)</span> dentro
                    {selected.size > 1 ? ' desses buckets' : ' deste bucket'} serão
                    <span className="text-red-400 font-semibold"> permanentemente excluídos</span>. Esta ação não pode ser desfeita.
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm">
                    Os buckets selecionados serão permanentemente excluídos. Esta ação não pode ser desfeita.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ open: false, objectCount: 0, force: false, deleting: false })}
                disabled={deleteModal.deleting}
                className="flex-1 px-4 py-2.5 bg-[#2a2f3a] hover:bg-[#3a3a44] text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button
                onClick={() => confirmDelete(deleteModal.force || deleteModal.objectCount === 0)}
                disabled={deleteModal.deleting}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {deleteModal.deleting
                  ? <><Loader2 size={15} className="animate-spin" /> Excluindo…</>
                  : deleteModal.objectCount > 0 ? 'Excluir tudo' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Bucket Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="bg-[#1e2330] border border-[#3a3a44] rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white text-lg font-semibold">Criar Bucket</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Form */}
            <div className="space-y-5">

              {/* Nome */}
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">Nome do Bucket</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="ex: meu-bucket-01"
                  className="w-full bg-[#2a2f3a] border border-[#3a3a44] text-white rounded-lg px-4 py-2.5 text-sm outline-none focus:border-eveo-red transition-colors"
                />
              </div>

              {/* Limite de Armazenamento */}
              <div className="bg-[#2a2f3a] rounded-xl p-4 border border-[#3a3a44]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <HardDrive size={15} className="text-gray-400" />
                    Limite de Armazenamento
                  </div>
                  <button
                    onClick={() => setForm({ ...form, quotaEnabled: !form.quotaEnabled })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.quotaEnabled ? 'bg-eveo-red' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.quotaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
                {form.quotaEnabled && (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.quotaValue}
                      onChange={(e) => setForm({ ...form, quotaValue: e.target.value })}
                      placeholder="0"
                      className="flex-1 bg-[#1e2330] border border-[#3a3a44] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-eveo-red transition-colors"
                    />
                    <select
                      value={form.quotaUnit}
                      onChange={(e) => setForm({ ...form, quotaUnit: e.target.value as any })}
                      className="bg-[#1e2330] border border-[#3a3a44] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-eveo-red transition-colors"
                    >
                      <option value="MB">MB</option>
                      <option value="GB">GB</option>
                      <option value="TB">TB</option>
                    </select>
                  </div>
                )}
                {!form.quotaEnabled && (
                  <p className="text-gray-500 text-xs">Ilimitado — sem restrição de tamanho</p>
                )}
              </div>

              {/* Retenção */}
              <div className="bg-[#2a2f3a] rounded-xl p-4 border border-[#3a3a44]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                    <Clock size={15} className="text-gray-400" />
                    Retenção de Objetos
                  </div>
                  <button
                    onClick={() => setForm({ ...form, retentionEnabled: !form.retentionEnabled })}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.retentionEnabled ? 'bg-eveo-red' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.retentionEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
                    />
                  </button>
                </div>
                {form.retentionEnabled && (
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      value={form.retentionDays}
                      onChange={(e) => setForm({ ...form, retentionDays: e.target.value })}
                      className="w-24 bg-[#1e2330] border border-[#3a3a44] text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-eveo-red transition-colors"
                    />
                    <span className="text-gray-400 text-sm">dias após exclusão</span>
                  </div>
                )}
                {!form.retentionEnabled && (
                  <p className="text-gray-500 text-xs">Desativado — objetos excluídos são removidos imediatamente</p>
                )}
                {form.retentionEnabled && (
                  <p className="text-gray-500 text-xs mt-2">
                    Objetos excluídos ficam retidos por {form.retentionDays || '?'} dia(s) antes da remoção definitiva.
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                disabled={creating}
                className="flex-1 px-4 py-2.5 bg-[#2a2f3a] hover:bg-[#3a3a44] text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 px-4 py-2.5 bg-eveo-red hover:bg-eveo-redHover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando…
                  </>
                ) : (
                  'Criar Bucket'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
