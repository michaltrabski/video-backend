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

    await fs.mkdir(outputFolder, { recursive: true });

    for (const [index, data] of trimDataList.entries()) {
      const inputPath = path.join(inputFolder, data.filename);

      const baseName = data.customName
        ? data.customName.replace(/[^a-zA-Z0-9-_]/g, '_')
        : `trimmed_${path.parse(data.filename).name}`;

      const trimmedOutputPath = path.join(outputFolder, baseName + '.mp4');
      const verticalOutputPath = path.join(outputFolder, baseName + '_vertical.mp4');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing: ${data.filename}`);

      // Skip trimming if already exists
      if (await fileExists(trimmedOutputPath)) {
        console.log(`⚠️ Skipping trim — already exists: ${trimmedOutputPath}`);
      } else {
        await trimVideo({
          inputPath,
          outputPath: trimmedOutputPath,
          startTime: data.trimStart,
          duration: data.trimStop - data.trimStart,
        });
        console.log(`✅ Trimmed: ${trimmedOutputPath}`);
      }

      // Skip cropping if already exists
      if (await fileExists(verticalOutputPath)) {
        console.log(`⚠️ Skipping crop — already exists: ${verticalOutputPath}`);
      } else {
        await cropToVertical(trimmedOutputPath, verticalOutputPath, data.videoWidth, data.videoHeight);
        console.log(`✅ Cropped to vertical: ${verticalOutputPath}`);
      }
    }

    console.log('\n🎉 All videos processed.');
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
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Trimming progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

function cropToVertical(
  inputPath: string,
  outputPath: string,
  width: number,
  height: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const targetAspectRatio = 9 / 16;
    const targetHeight = height;
    const targetWidth = Math.floor(targetHeight * targetAspectRatio);

    const cropX = Math.floor((width - targetWidth) / 2);
    const cropY = 0;

    ffmpeg(inputPath)
      .videoFilter(`crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`)
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Cropping progress: ${Math.floor(progress.percent || 0)}%\r`);
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
