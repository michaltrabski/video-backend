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

      const verticalOutputPath = path.join(outputFolder, 'VERTICAL ' + baseName + '.mp4');
      const screenshotPath = path.join(outputFolder, baseName + '_screenshot.jpg');
      const screenshotVideoPath = path.join(outputFolder, baseName + '_screenshot_video.mp4');
      const mergedOutputPath = path.join(outputFolder, 'WITH_INTRO ' + baseName + '.mp4');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing vertical video: ${data.filename}`);

      if (await fileExists(verticalOutputPath)) {
        console.log(`⚠️ Skipping video — already exists: ${verticalOutputPath}`);
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

      if (await fileExists(screenshotPath)) {
        console.log(`⚠️ Skipping screenshot — already exists: ${screenshotPath}`);
      } else {
        const midpoint = data.trimStart + (data.trimStop - data.trimStart) / 2;
        await createScreenshot({
          inputPath,
          outputPath: screenshotPath,
          timestamp: midpoint
        });

        await cropScreenshotToVertical({
          inputPath: screenshotPath,
          outputPath: screenshotPath, // overwrite original screenshot
          videoWidth: data.videoWidth,
          videoHeight: data.videoHeight
        });

        console.log(`🖼️  Created screenshot at ${midpoint.toFixed(1)}s: ${screenshotPath}`);
      }

      if (await fileExists(mergedOutputPath)) {
        console.log(`⚠️ Skipping merge — already exists: ${mergedOutputPath}`);
      } else {
        await screenshotToVideo({
          imagePath: screenshotPath,
          outputPath: screenshotVideoPath,
          duration: 2,
          width: Math.floor(data.videoHeight * (9 / 16)),
          height: data.videoHeight
        });

        await concatVideos({
          inputPaths: [screenshotVideoPath, verticalOutputPath],
          outputPath: mergedOutputPath
        });

        console.log(`🎞️  Merged video created: ${mergedOutputPath}`);
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
        folder: path.dirname(outputPath)
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

function cropScreenshotToVertical({
  inputPath,
  outputPath,
  videoWidth,
  videoHeight
}: {
  inputPath: string;
  outputPath: string;
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
      .videoFilter(`crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`)
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function screenshotToVideo({
  imagePath,
  outputPath,
  duration = 2,
  width,
  height
}: {
  imagePath: string;
  outputPath: string;
  duration?: number;
  width: number;
  height: number;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(imagePath)
      .loop(duration)
      .videoCodec('libx264')
      .size(`${width}x${height}`)
      .fps(25)
      .outputOptions('-pix_fmt yuv420p')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

function concatVideos({
  inputPaths,
  outputPath
}: {
  inputPaths: string[];
  outputPath: string;
}): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const fileListPath = path.join(outputFolder, 'concat_list.txt');
      const fileListContent = inputPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n');
      await fs.writeFile(fileListPath, fileListContent, 'utf-8');

      ffmpeg()
        .input(fileListPath)
        .inputOptions('-f', 'concat', '-safe', '0')
        .outputOptions('-c', 'copy')
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    } catch (err) {
      reject(err);
    }
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
