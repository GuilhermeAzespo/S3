import { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Container, Database } from 'lucide-react';

interface DiskStats {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

interface S3Stats {
  usedBytes: number;
  bucketCount: number;
  objectCount: number;
}

interface Stats {
  disk: DiskStats;
  s3: S3Stats;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const token = localStorage.getItem('token');
        const res = await axios.get(`${baseUrl}/api/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(res.data);
      } catch (e) {
        console.error('Erro ao buscar estatísticas:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
    // Atualiza a cada 30 segundos
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calcula percentual de uso: bytes do S3 sobre espaço total do disco
  const diskTotal  = stats?.disk.totalBytes  ?? 0;
  const diskFree   = stats?.disk.freeBytes   ?? 0;
  const s3Used     = stats?.s3.usedBytes     ?? 0;
  const available  = diskFree; // espaço livre real no servidor

  const usagePercent =
    diskTotal > 0 ? Math.min((s3Used / diskTotal) * 100, 100) : 0;

  const barColor =
    usagePercent > 85 ? 'bg-red-500' :
    usagePercent > 60 ? 'bg-yellow-500' :
    'bg-green-500';

  return (
    <div className="space-y-6">
      {/* ── Cota de Armazenamento ── */}
      <div className="bg-eveo-dark border border-eveo-red rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <HardDrive size={18} className="text-gray-400" />
            COTA DE ARMAZENAMENTO
          </h3>
          <div className="text-right">
            {loading ? (
              <span className="text-gray-400 text-sm">Carregando…</span>
            ) : (
              <>
                <span className="text-white font-bold">
                  {formatBytes(s3Used)}
                  {diskTotal > 0 && <> / {formatBytes(diskTotal)}</>}
                </span>
                <span className="block text-gray-400 text-sm">
                  {diskTotal > 0 ? `${usagePercent.toFixed(1)}% usado` : 'Capacidade desconhecida'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="w-full bg-gray-700 rounded-full h-3 mb-6 overflow-hidden">
          <div
            className={`${barColor} h-3 rounded-full transition-all duration-700`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <span className="block text-gray-400 text-xs uppercase tracking-wide mb-1">
              Disponível
            </span>
            <span className="block text-white font-semibold text-lg">
              {loading ? '—' : formatBytes(available)}
            </span>
            <span className="block text-gray-500 text-xs">no servidor</span>
          </div>
          <div>
            <span className="block text-gray-400 text-xs uppercase tracking-wide mb-1">
              Utilizado
            </span>
            <span className="block text-white font-semibold text-lg">
              {loading ? '—' : formatBytes(s3Used)}
            </span>
            <span className="block text-gray-500 text-xs">pelo S3</span>
          </div>
          <div>
            <span className="block text-gray-400 text-xs uppercase tracking-wide mb-1">
              Objetos
            </span>
            <span className="block text-white font-semibold text-lg">
              {loading ? '—' : stats?.s3.objectCount ?? 0}
            </span>
            <span className="block text-gray-500 text-xs">armazenados</span>
          </div>
          <div>
            <span className="block text-gray-400 text-xs uppercase tracking-wide mb-1">
              Status
            </span>
            {loading ? (
              <span className="text-gray-500">—</span>
            ) : (
              <span
                className={`inline-block mt-1 px-3 py-0.5 text-xs rounded-full border font-medium ${
                  usagePercent > 85
                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                    : 'bg-green-500/20 text-green-400 border-green-500/40'
                }`}
              >
                {usagePercent > 85 ? 'CRÍTICO' : 'OK'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Cards de resumo ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#2a2f3a] rounded-xl p-6 flex items-center gap-4">
          <Container size={32} className="text-gray-300" />
          <div>
            <span className="block text-gray-400 text-sm">Total de buckets</span>
            <span className="block text-white text-2xl font-bold">
              {loading ? '—' : stats?.s3.bucketCount ?? 0}
            </span>
          </div>
        </div>

        <div className="bg-[#2a2f3a] rounded-xl p-6 flex items-center gap-4">
          <Database size={32} className="text-gray-300" />
          <div>
            <span className="block text-gray-400 text-sm">Total de objetos</span>
            <span className="block text-white text-2xl font-bold">
              {loading ? '—' : stats?.s3.objectCount ?? 0}
            </span>
          </div>
        </div>

        <div className="bg-[#2a2f3a] rounded-xl p-6 flex items-center gap-4">
          <HardDrive size={32} className="text-gray-300" />
          <div>
            <span className="block text-gray-400 text-sm">Capacidade total</span>
            <span className="block text-white text-2xl font-bold">
              {loading ? '—' : diskTotal > 0 ? formatBytes(diskTotal) : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
