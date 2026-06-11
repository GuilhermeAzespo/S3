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

// Upload de objeto
router.post('/bucket/:bucketId/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { bucketId } = req.params;
    const { key } = req.body; // Path no S3, ex: "images/foto.jpg"
    const file = req.file;

    if (!file || !key) {
      return res.status(400).json({ error: 'File and key are required' });
    }

    // Verificar Cota
    const bucket = await prisma.bucket.findUnique({ where: { id: bucketId } });
    if (!bucket) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Bucket not found' });
    }

    if (bucket.quotaBytes) {
      const agg = await prisma.object.aggregate({
        where: { bucketId },
        _sum: { sizeBytes: true }
      });
      const currentSize = agg._sum.sizeBytes || 0;
      if (currentSize + file.size > Number(bucket.quotaBytes)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Bucket quota exceeded' });
      }
    }

    // Verificar Regras de Lifecycle
    const rules = await prisma.lifecycleRule.findMany({ where: { bucketId } });
    let expiresAt: Date | null = null;
    
    for (const rule of rules) {
      if (!rule.prefix || key.startsWith(rule.prefix)) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + rule.daysToLive);
        break; // Aplica a primeira regra correspondente
      }
    }

    // Salvar ou atualizar no banco
    const existing = await prisma.object.findUnique({ where: { bucketId_key: { bucketId, key } } });
    let savedObj;
    
    if (existing) {
      // Deletar arquivo antigo do disco
      const oldFilePath = path.join(STORAGE_PATH, bucketId, existing.id);
      if (fs.existsSync(oldFilePath)) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
      await prisma.object.delete({ where: { id: existing.id } });
    }

    savedObj = await prisma.object.create({
      data: {
        bucketId,
        key,
        sizeBytes: file.size,
        mimeType: file.mimetype,
        expiresAt
      }
    });

    // Renomear o arquivo para usar o ID do objeto no disco (mais seguro para rotas e sem espaços)
    const finalPath = path.join(STORAGE_PATH, bucketId, savedObj.id);
    fs.renameSync(file.path, finalPath);

    res.json(savedObj);
  } catch (error) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch(e) {} }
    res.status(500).json({ error: 'Error uploading file' });
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
