import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient';
import { requireAuth } from '../middleware/auth';

const router = Router();
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

// Configuração do Multer para salvar no disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bucketId = req.params.bucketId;
    const bucketPath = path.join(STORAGE_PATH, bucketId);
    fs.mkdirSync(bucketPath, { recursive: true });
    cb(null, bucketPath);
  },
  filename: (req, file, cb) => {
    // Para simplificar, o nome no disco será o timestamp + nome original (para evitar colisão simples)
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Listar objetos de um bucket (com suporte a prefixo "pastas")
router.get('/bucket/:bucketId', requireAuth, async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { prefix } = req.query; // e.g., "folder/"
    
    let whereClause: any = { bucketId };
    if (prefix && typeof prefix === 'string') {
      whereClause.key = { startsWith: prefix };
    }

    const objects = await prisma.object.findMany({ where: whereClause, orderBy: { createdAt: 'desc' } });
    res.json(objects);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching objects' });
  }
});

// Upload de múltiplos objetos (arquivos e pastas)
router.post('/bucket/:bucketId/upload', requireAuth, upload.array('files', 500), async (req, res) => {
  try {
    const { bucketId } = req.params;
    const files = req.files as Express.Multer.File[];
    // keys enviados pelo frontend como JSON array ou campo repetido
    let keys: string[] = [];
    if (req.body.keys) {
      keys = Array.isArray(req.body.keys) ? req.body.keys : JSON.parse(req.body.keys);
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verificar Cota global do bucket
    const bucket = await prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) {
      for (const f of files) { try { fs.unlinkSync(f.path); } catch (e) {} }
      return res.status(404).json({ error: 'Bucket not found' });
    }

    if (bucket.quotaBytes) {
      const agg = await prisma.object.aggregate({ where: { bucketId }, _sum: { sizeBytes: true } });
      const currentSize = Number(agg._sum.sizeBytes) || 0;
      const uploadSize = files.reduce((acc, f) => acc + f.size, 0);
      if (currentSize + uploadSize > Number(bucket.quotaBytes)) {
        for (const f of files) { try { fs.unlinkSync(f.path); } catch (e) {} }
        return res.status(400).json({ error: 'Bucket quota exceeded' });
      }
    }

    // Verificar Regras de Lifecycle
    const rules = await prisma.lifecycleRule.findMany({ where: { bucketId } });

    const saved = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const key  = keys[i] || file.originalname;

      let expiresAt: Date | null = null;
      for (const rule of rules) {
        if (!rule.prefix || key.startsWith(rule.prefix)) {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + rule.daysToLive);
          break;
        }
      }

      // Substituir se já existe
      const existing = await prisma.object.findUnique({ where: { bucketId_key: { bucketId, key } } });
      if (existing) {
        const oldPath = path.join(STORAGE_PATH, bucketId, existing.id);
        if (fs.existsSync(oldPath)) { try { fs.unlinkSync(oldPath); } catch (e) {} }
        await prisma.object.delete({ where: { id: existing.id } });
      }

      const savedObj = await prisma.object.create({
        data: { bucketId, key, sizeBytes: file.size, mimeType: file.mimetype, expiresAt }
      });

      const finalPath = path.join(STORAGE_PATH, bucketId, savedObj.id);
      fs.renameSync(file.path, finalPath);
      saved.push(savedObj);
    }

    res.json(saved);
  } catch (error) {
    if (req.files) {
      for (const f of req.files as Express.Multer.File[]) { try { fs.unlinkSync(f.path); } catch (e) {} }
    }
    res.status(500).json({ error: 'Error uploading files' });
  }
});

// Download/View (Pode ser público se o bucket for público)
router.get('/:objectId', async (req, res) => {
  try {
    const { objectId } = req.params;
    const obj = await prisma.object.findUnique({ include: { bucket: true }, where: { id: objectId } });
    
    if (!obj) return res.status(404).json({ error: 'Object not found' });
    
    if (!obj.bucket.isPublic) {
      // Requer autenticação
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        // Fallback to query param token for direct links
        const token = req.query.token as string;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        try {
          jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me');
        } catch(e) {
          return res.status(401).json({ error: 'Invalid token' });
        }
      } else {
         // simplified header check, could reuse middleware if not for public bucket fallback
         const token = authHeader.split(' ')[1];
         jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me');
      }
    }

    const filePath = path.join(STORAGE_PATH, obj.bucketId, obj.id);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    res.setHeader('Content-Type', obj.mimeType);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: 'Error downloading file' });
  }
});

router.delete('/:objectId', requireAuth, async (req, res) => {
  try {
    const { objectId } = req.params;
    const obj = await prisma.object.findUnique({ where: { id: objectId } });
    if (!obj) return res.status(404).json({ error: 'Not found' });

    await prisma.object.delete({ where: { id: objectId } });
    
    const filePath = path.join(STORAGE_PATH, obj.bucketId, obj.id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting object' });
  }
});

export default router;
