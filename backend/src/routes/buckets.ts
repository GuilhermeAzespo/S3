import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const buckets = await prisma.bucket.findMany({
      include: {
        _count: { select: { objects: true } },
      }
    });
    
    // Calculate total size per bucket (Prisma aggregate)
    const bucketsWithSize = await Promise.all(buckets.map(async (b) => {
      const agg = await prisma.object.aggregate({
        where: { bucketId: b.id },
        _sum: { sizeBytes: true }
      });
      return {
        ...b,
        quotaBytes: b.quotaBytes ? Number(b.quotaBytes) : null,
        usedBytes: agg._sum.sizeBytes || 0,
        objectCount: b._count.objects
      };
    }));

    res.json(bucketsWithSize);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching buckets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, quotaBytes, isPublic, versioning } = req.body;
    const bucket = await prisma.bucket.create({
      data: {
        name,
        quotaBytes: quotaBytes ? BigInt(quotaBytes) : null,
        isPublic: !!isPublic,
        versioning: !!versioning
      }
    });
    res.json({ ...bucket, quotaBytes: bucket.quotaBytes ? Number(bucket.quotaBytes) : null });
  } catch (error) {
    res.status(500).json({ error: 'Error creating bucket' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quotaBytes, isPublic, versioning } = req.body;
    const bucket = await prisma.bucket.update({
      where: { id },
      data: {
        quotaBytes: quotaBytes !== undefined ? (quotaBytes ? BigInt(quotaBytes) : null) : undefined,
        isPublic,
        versioning
      }
    });
    res.json({ ...bucket, quotaBytes: bucket.quotaBytes ? Number(bucket.quotaBytes) : null });
  } catch (error) {
    res.status(500).json({ error: 'Error updating bucket' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.bucket.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting bucket' });
  }
});

export default router;
