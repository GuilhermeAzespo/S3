import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

import authRoutes from './routes/auth';
import bucketRoutes from './routes/buckets';
import objectRoutes from './routes/objects';
import lifecycleRoutes from './routes/lifecycle';
import { startLifecycleCron } from './cron/lifecycleJob';
import { prisma } from './prismaClient';

// Carregar variáveis de ambiente localmente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Criar pasta storage se não existir
const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../storage');
if (!fs.existsSync(STORAGE_PATH)) {
  fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/buckets', bucketRoutes);
app.use('/api/objects', objectRoutes);
app.use('/api/lifecycle', lifecycleRoutes);

// Servir frontend em produção
const frontendPath = process.env.FRONTEND_PATH || path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Iniciar cron job
startLifecycleCron();

// Função para semear o usuário admin padrão se não houver nenhum
async function seedAdmin() {
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      console.log('🌱 Default admin user seeded (username: admin, password: admin123)');
    }
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await seedAdmin();
});

