import { Router } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/bucket/:bucketId', async (req, res) => {
  try {
    const rules = await prisma.lifecycleRule.findMany({ where: { bucketId: req.params.bucketId } });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching rules' });
  }
});

router.post('/bucket/:bucketId', async (req, res) => {
  try {
    const { prefix, daysToLive } = req.body;
    const rule = await prisma.lifecycleRule.create({
      data: {
        bucketId: req.params.bucketId,
        prefix: prefix || '',
        daysToLive: parseInt(daysToLive)
      }
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Error creating rule' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.lifecycleRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting rule' });
  }
});

export default router;
