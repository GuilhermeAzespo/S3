import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prismaClient';

const STORAGE_PATH = process.env.STORAGE_PATH || path.join(__dirname, '../../../storage');

export const startLifecycleCron = () => {
  // Run everyday at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Running lifecycle cleanup job...');
    try {
      const now = new Date();
      // Find expired objects
      const expiredObjects = await prisma.object.findMany({
        where: {
          expiresAt: {
            lte: now
          }
        }
      });

      for (const obj of expiredObjects) {
        console.log(`Deleting expired object: ${obj.id} (${obj.key})`);
        
        // Delete from DB
        await prisma.object.delete({ where: { id: obj.id } });
        
        // Delete from disk
        const filePath = path.join(STORAGE_PATH, obj.bucketId, obj.id);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      console.log(`Lifecycle cleanup finished. Removed ${expiredObjects.length} objects.`);
    } catch (error) {
      console.error('Error in lifecycle cron job:', error);
    }
  });
};
