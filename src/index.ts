import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { processAllTrims } from './trimVideos';

const app = express();
const PORT = 3000;

// Allow all CORS requests (you can restrict origin if needed)
app.use(cors());
app.use(express.json());
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


app.post('/submit-trims', async (req, res) => {
  const data = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid data format. Expected an array.' });
  }

  try {
    const outputPath = path.join(__dirname, '..', 'trim-results.json');
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ Trim data saved to', outputPath);
    res.status(200).json({ message: 'Trim data saved successfully.' });
    processAllTrims();
  } catch (error) {
    console.error('❌ Failed to save trim data:', error);
    res.status(500).json({ error: 'Failed to save data on server.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}/files`);
});

 
