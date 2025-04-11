import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const trimDataPath = path.join(__dirname, '..', 'trim-results.json');
const inputFolder = path.join(__dirname, '..', 'inputFolder');
const outputFolder = path.join(__dirname, '..', 'outputFolder');

type TrimData = {
  filename: string;
  customName: string;
  trimStart: number;
  trimStop: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
};

export async function processAllTrims() {
  try {
    const rawData = await fs.readFile(trimDataPath, 'utf-8');
    const trimDataList: TrimData[] = JSON.parse(rawData);

    // Ensure output folder exists
    await fs.mkdir(outputFolder, { recursive: true });

    for (const data of trimDataList) {
      const inputPath = path.join(inputFolder, data.filename);

      const safeCustomName = data.customName
        ? data.customName.replace(/[^a-zA-Z0-9-_]/g, '_') + '.mp4'
        : `trimmed_${data.filename}`;

      const outputPath = path.join(outputFolder, safeCustomName);

      console.log(`🎬 Processing: ${data.filename} → ${safeCustomName}`);

      const trimVideoRes = await trimVideo({
        inputPath,
        outputPath,
        startTime: data.trimStart,
        duration: data.trimStop - data.trimStart
      });

      console.log(`✅ Video saved`, { outputPath, trimVideoRes });
    }
  } catch (err) {
    console.error('❌ Error processing trim data:', err);
  }
}


function trimVideo({
  inputPath,
  outputPath,
  startTime,
  duration
}: {
  inputPath: string;
  outputPath: string;
  startTime: number;
  duration: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}


