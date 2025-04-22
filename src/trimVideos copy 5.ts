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

      const verticalOutputPath = path.join(outputFolder,  baseName + '.mp4');
      const screenshotPath = path.join(outputFolder, baseName + '.jpg');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing vertical video: ${data.filename}`);

      if (await fileExists(verticalOutputPath)) {
        console.log(`⚠️ Skipping video — already exists: ${verticalOutputPath}`);
      } else {

        await trimHorizontallyWithoutChangingVideoDimention()

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

      if (await fileExists(screenshotPath)) {
        console.log(`⚠️ Skipping screenshot — already exists: ${screenshotPath}`);
      } else {
        const midpoint = data.trimStart + (data.trimStop - data.trimStart) / 2;
        await createScreenshot({
          inputPath,
          outputPath: screenshotPath,
          timestamp: midpoint
        });
        console.log(`🖼️  Created screenshot at ${midpoint.toFixed(1)}s: ${screenshotPath}`);
      }
    }

    console.log('\n🎉 All videos processed.');

    // remove source files after processing
    for (const data of trimDataList) {
      const inputPath = path.join(inputFolder, data.filename);
      try {
        if (false) {
           await fs.unlink(inputPath);
        }
        console.log(`🗑️  Deleted source file: ${inputPath}`);
      } catch (err) {
        console.error(`⚠️ Error deleting source file: ${inputPath}`, err);
      }
    }
  } catch (err) {
    console.error('❌ Error processing trim data:', err);
  }
}

function trimHorizontallyWithoutChangingVideoDimention() {
  // implement
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

function createScreenshot({
  inputPath,
  outputPath,
  timestamp
}: {
  inputPath: string;
  outputPath: string;
  timestamp: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1280x720' // youtube thumbnail size
      })
      .on('end', resolve )
      .on('error', reject);
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
