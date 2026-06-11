import { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Container } from 'lucide-react';

interface BucketStats {
  totalBuckets: number;
  totalObjects: number;
  usedBytes: number;
  totalQuota: number | null; // null = sem limite definido
}

export default function Dashboard() {
  const [stats, setStats] = useState<BucketStats>({
    totalBuckets: 0,
    totalObjects: 0,
    usedBytes: 0,
    totalQuota: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const token = localStorage.getItem('token');
        const res = await axios.get(`${baseUrl}/api/buckets`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        let objects = 0;
        let bytes = 0;
        let quotaSum = 0;
        let hasAnyQuota = false;

        res.data.forEach((b: any) => {
          objects += b.objectCount || 0;
          bytes += Number(b.usedBytes) || 0;
          if (b.quotaBytes) {
            quotaSum += Number(b.quotaBytes);
            hasAnyQuota = true;
          }
        });

        setStats({
          totalBuckets: res.data.length,
          totalObjects: objects,
          usedBytes: bytes,
          totalQuota: hasAnyQuota ? quotaSum : null,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Se há cota definida, calcula percentual; senão mostra barra proporcional ao uso
  const hasQuota = stats.totalQuota !== null && stats.totalQuota > 0;
  const usagePercent = hasQuota
    ? Math.min((stats.usedBytes / stats.totalQuota!) * 100, 100)
    : 0;

  const barColor =
    usagePercent > 85
      ? 'bg-red-500'
      : usagePercent > 60
      ? 'bg-yellow-500'
      : 'bg-green-500';

  return (
    <div className="space-y-6">
      {/* Storage Quota Card */}
      <div className="bg-eveo-dark border border-eveo-red rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <HardDrive size={18} className="text-gray-400" /> COTA DE ARMAZENAMENTO
          </h3>
          <div className="text-right">
            {loading ? (
              <span className="text-gray-400 text-sm">Carregando…</span>
            ) : (
              <>
                <span className="text-white font-bold">
                  {formatBytes(stats.usedBytes)}
                  {hasQuota && <> / {formatBytes(stats.totalQuota!)}</>}
                </span>
                {hasQuota ? (
                  <span className="block text-gray-400 text-sm">{usagePercent.toFixed(1)}% usado</span>
                ) : (
                  <span className="block text-gray-400 text-sm">Sem limite definido</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-700 rounded-full h-2.5 mb-6">
          <div
            className={`${barColor} h-2.5 rounded-full transition-all duration-700`}
            style={{ width: hasQuota ? `${usagePercent}%` : '0%' }}
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <span className="block text-gray-400 text-sm">Disponível</span>
            <span className="block text-white font-medium">
              {hasQuota ? formatBytes(stats.totalQuota! - stats.usedBytes) : '∞'}
            </span>
          </div>
          <div>
            <span className="block text-gray-400 text-sm">Utilizado</span>
            <span className="block text-white font-medium">{formatBytes(stats.usedBytes)}</span>
          </div>
          <div>
            <span className="block text-gray-400 text-sm">Objetos</span>
            <span className="block text-white font-medium">{stats.totalObjects}</span>
          </div>
          <div>
            <span className="block text-gray-400 text-sm">Status</span>
            <span
              className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full border ${
                usagePercent > 85
                  ? 'bg-red-500/20 text-red-400 border-red-500/50'
                  : 'bg-green-500/20 text-green-500 border-green-500/50'
              }`}
            >
              {usagePercent > 85 ? 'CRÍTICO' : 'OK'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#2a2f3a] rounded-xl p-6 flex items-center gap-4">
          <Container size={32} className="text-gray-300" />
          <div>
            <span className="block text-gray-300 text-sm">Total de buckets</span>
            <span className="block text-white text-2xl font-bold">{stats.totalBuckets}</span>
          </div>
        </div>
        <div className="bg-[#2a2f3a] rounded-xl p-6 flex items-center gap-4">
          <HardDrive size={32} className="text-gray-300" />
          <div>
            <span className="block text-gray-300 text-sm">Total de objetos</span>
            <span className="block text-white text-2xl font-bold">{stats.totalObjects}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
