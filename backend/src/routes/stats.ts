import { Router } from 'express';
import { execSync } from 'child_process';
import { prisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';
import path from 'path';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/stats
 * Retorna estatísticas reais do disco do servidor e do uso do S3.
 */
router.get('/', async (req, res) => {
  try {
    const storagePath = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

    // ── Espaço em disco real (via `df`) ──────────────────────────────────
    let diskTotal = 0;
    let diskFree  = 0;
    let diskUsed  = 0;

    try {
      // df -k retorna tamanhos em blocos de 1024 bytes
      const dfOutput = execSync(`df -k "${storagePath}"`, { timeout: 5000 }).toString();
      // Exemplo de saída:
      // Filesystem     1K-blocks    Used Available Use% Mounted on
      // overlay        100663296 3145728  97517568   4% /
      const lines = dfOutput.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].trim().split(/\s+/);
        // [filesystem, 1K-blocks, used, available, use%, mountpoint]
        diskTotal = parseInt(parts[1]) * 1024; // converter KB → bytes
        diskUsed  = parseInt(parts[2]) * 1024;
        diskFree  = parseInt(parts[3]) * 1024;
      }
    } catch (dfErr) {
      console.warn('df command failed, disk stats unavailable:', dfErr);
    }

    // ── Uso real do S3 (soma dos objetos no banco) ────────────────────────
    const [usageAgg, bucketCount, objectCount] = await Promise.all([
      prisma.object.aggregate({ _sum: { sizeBytes: true } }),
      prisma.bucket.count(),
      prisma.object.count(),
    ]);

    const s3UsedBytes = Number(usageAgg._sum.sizeBytes) || 0;

    res.json({
      disk: {
        totalBytes: diskTotal,
        usedBytes:  diskUsed,
        freeBytes:  diskFree,
      },
      s3: {
        usedBytes:   s3UsedBytes,
        bucketCount,
        objectCount,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error fetching stats' });
  }
});

export default router;
