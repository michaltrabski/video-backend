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

    const horizontalVideos: string[] = [];

    for (const [index, data] of trimDataList.entries()) {
      const inputPath = path.join(inputFolder, data.filename);

      const baseName = data.customName
        ? sanitizeFileName(data.customName.trim())
        : sanitizeFileName(`trimmed_${path.parse(data.filename).name}`);

      const tempTrimmedPath = path.join(outputFolder, baseName + '_HORIZONTAL.mp4');
      const finalOutputPath = path.join(outputFolder, baseName + '.mp4');
      const screenshotPath = path.join(outputFolder, baseName + '.jpg');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing: ${data.filename}`);

      if (await fileExists(finalOutputPath)) {
        console.log(`⚠️ Skipping video — already exists: ${finalOutputPath}`);
      } else {
        await trimHorizontallyWithoutChangingVideoDimention({
          inputPath,
          outputPath: tempTrimmedPath,
          startTime: data.trimStart,
          duration: data.trimStop - data.trimStart
        });

        console.log(`✅ Created temporary horizontal video: ${tempTrimmedPath}`);

        horizontalVideos.push(tempTrimmedPath);

        // await trimAndCropToVertical({
        //   inputPath: tempTrimmedPath,
        //   outputPath: finalOutputPath,
        //   startTime: 0,
        //   duration: data.trimStop - data.trimStart,
        //   videoWidth: data.videoWidth,
        //   videoHeight: data.videoHeight
        // });

        // console.log(`✅ Created final vertical video: ${finalOutputPath}`);
      }

      if (await fileExists(screenshotPath)) {
        console.log(`⚠️ Skipping screenshot — already exists: ${screenshotPath}`);
      } else {
        const midpoint = data.trimStart + (data.trimStop - data.trimStart) / 2;

       if (false) {
          await createScreenshot({
            inputPath,
            outputPath: screenshotPath,
            timestamp: midpoint
          });
          console.log(`🖼️  Created screenshot at ${midpoint.toFixed(1)}s: ${screenshotPath}`);
        }
      }
    }

    console.log('\n🎉 All videos processed.');

    // Merge horizontal videos if multiple exist
    if (horizontalVideos.length > 1) {
      const listPath = path.join(outputFolder, 'concat_list.txt');
      const concatFileContent = horizontalVideos
        .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
        .join('\n');

      await fs.writeFile(listPath, concatFileContent, 'utf-8');

      const mergedOutput = path.join(outputFolder, 'merged_horizontal.mp4');
      await mergeVideosWithFFmpeg(listPath, mergedOutput);

      console.log(`🎞️  Merged horizontal video created: ${mergedOutput}`);
    } else {
      console.log('ℹ️ Not enough horizontal videos to merge.');
    }

    // Remove source files (optional toggle)
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

function trimHorizontallyWithoutChangingVideoDimention({
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
        process.stdout.write(`⏳ Vertical crop progress: ${Math.floor(progress.percent || 0)}%\r`);
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
        size: '1280x720'
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

function mergeVideosWithFFmpeg(listFilePath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFilePath)
      .inputOptions('-f', 'concat', '-safe', '0')
      .outputOptions('-c', 'copy')
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
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
