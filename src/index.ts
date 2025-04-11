import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 3000;

// Allow all CORS requests (you can restrict origin if needed)
app.use(cors());
app.use('/inputFolder', express.static(path.join(__dirname, '..', 'inputFolder')));

const inputFolder = path.join(__dirname, '..', 'inputFolder');

const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];

app.get('/files', async (req, res) => {
  try {
    const entries = await fs.readdir(inputFolder, { withFileTypes: true });

    const videos: any[] = [];
    const images: any[] = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      const fullPath = path.join(inputFolder, entry.name);

      if (videoExtensions.includes(ext) || imageExtensions.includes(ext)) {
        const stats = await fs.stat(fullPath);
        const baseInfo = {
          name: entry.name,
          sizeBytes: stats.size,
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          extension: ext,
          path: `/inputFolder/${entry.name}`
        };

        if (videoExtensions.includes(ext)) {
          videos.push(baseInfo);
        } else {
          images.push(baseInfo);
        }
      }
    }

    res.json({ videos, images });
  } catch (err) {
    console.error('Error reading folder or files:', err);
    res.status(500).json({ error: 'Failed to read files from input folder' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}/files`);
});
