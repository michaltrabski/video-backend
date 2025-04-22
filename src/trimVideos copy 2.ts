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

function sanitizeFileName(name: string): string {
  // Remove only characters not allowed in filenames (Windows-safe)
  return name.replace(/[\\/:*?"<>|]/g, '');
}

export async function processAllTrims() {
  try {
    const rawData = await fs.readFile(trimDataPath, 'utf-8');
    const trimDataList: TrimData[] = JSON.parse(rawData);

    await fs.mkdir(outputFolder, { recursive: true });

    for (const [index, data] of trimDataList.entries()) {
      const inputPath = path.join(inputFolder, data.filename);

      const baseName = data.customName
        ? sanitizeFileName(data.customName.trim())
        : sanitizeFileName(`trimmed_${path.parse(data.filename).name}`);

      const verticalOutputPath = path.join(outputFolder, "VERTICAL " + baseName + '.mp4');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing vertical video: ${data.filename}`);

      if (await fileExists(verticalOutputPath)) {
        console.log(`⚠️ Skipping — already exists: ${verticalOutputPath}`);
      } else {
        await trimAndCropToVertical({
          inputPath,
          outputPath: verticalOutputPath,
          startTime: data.trimStart,
          duration: data.trimStop - data.trimStart,
          videoWidth: data.videoWidth,
          videoHeight: data.videoHeight
        });

        console.log(`✅ Created vertical video: ${verticalOutputPath}`);
      }
    }

    console.log('\n🎉 All videos processed.');
  } catch (err) {
    console.error('❌ Error processing trim data:', err);
  }
}

function trimAndCropToVertical({
  inputPath,
  outputPath,
  startTime,
  duration,
  videoWidth,
  videoHeight
}: {
  inputPath: string;
  outputPath: string;
  startTime: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const targetAspectRatio = 9 / 16;
    const targetHeight = videoHeight;
    const targetWidth = Math.floor(targetHeight * targetAspectRatio);

    const cropX = Math.floor((videoWidth - targetWidth) / 2);
    const cropY = 0;

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .videoFilter(`crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`)
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Processing progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
