import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

import { copyFileSync, existsSync } from 'fs';

export function rnd(x:number, y:number): number {
  return Math.floor(Math.random() * (y - x + 1)) + x;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '');
}

export function copyFilesSync(filesSources: string[]): void {
  const outputFolder = path.join(__dirname, '..', 'outputFolder', "final");

  filesSources.forEach((filePath) => {
    const fileName = path.basename(filePath);
    const destinationPath = path.join(outputFolder, fileName);
    console.log("Copping files =>", { filePath, destinationPath });
    copyFileSync(filePath, destinationPath);
  })
}

export function putVideoOnVideo({
  leftPath,
  rightPath,
  outputFolder,
  namePrefix,
}: {
  leftPath: string;
  rightPath: string;
  outputFolder: string;
  namePrefix: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(leftPath);
    const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

    if (existsSync(outputPath)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
      resolve(outputPath);
      return;
    }

    ffmpeg()
      .addInput(leftPath)
      .addInput(rightPath)
      .complexFilter([
        // Prepare overlay with fade-in (0–1s) and fade-out (2-3s)
        '[1:v]format=yuva420p,fade=t=in:st=0:d=1:alpha=1,fade=t=out:st=2:d=1:alpha=1[ovl]',
        
        // Overlay centered, don't stop at overlay's end
        // '[0:v][ovl]overlay=x=(W-w)/2:y=(H-h)/2:enable=\'between(t,0,4)\''

        // Overlay centered and top 25% of the screen, don't stop at overlay's end
        '[0:v][ovl]overlay=x=(W-w)/2:y=H*0.25:enable=\'between(t,0,4)\''
      ])
      .outputOptions([
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p', // final output does not need alpha
        '-crf', '23',
        '-preset', 'veryfast'
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Overlaying progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('❌ Error in putVideoOnVideo:', err.message);
        reject(err);
      })
      .run();
  });
}

 
 

export const revertVideo = (videoPath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(videoPath);
    const outputPath = videoPath.replace(ext, `__reverted${ext}`);

    if (existsSync(outputPath)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
      resolve(outputPath);
      return;
    }

    ffmpeg(videoPath)
      .videoFilter('reverse')
      .audioFilter('areverse')
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Reverting progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => {
        console.log(`✅ Reverted video saved to: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`❌ Error while reverting video:`, err);
        reject(err);
      })
      .run();
  }); 
};



export function makeHorizontalVideo({
  inputPath,
  outputFolder,
  namePrefix,
  startTime,
  duration,
}: {
  inputPath: string;
  outputFolder: string;
  namePrefix: string;
  startTime: number;
  duration: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(inputPath);
    const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

    if (existsSync(outputPath)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
      resolve(outputPath);
      return;
    }

    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .fps(30)
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Trimming progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}





export function resizeVideoBy6({
  inputPath,
  outputFolder,
  namePrefix,
}: {
  inputPath: string;
  outputFolder: string;
  namePrefix: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(inputPath);
    const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

    if (existsSync(outputPath)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
      resolve(outputPath);
      return;
    }

    ffmpeg(inputPath)
      .videoFilter([
        // Step 1: Resize
        'scale=iw/6:ih/6',
        // Step 2: Add red border (10px all around)
        'pad=iw+20:ih+20:10:10:red'
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Resizing + border progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}



export function makeVerticalVideo({
  inputPath,
  outputFolder,
  videoWidth,
  videoHeight,
  namePrefix
}: {
  inputPath: string;
  outputFolder: string;
  videoWidth: number;
  videoHeight: number;
  namePrefix: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(inputPath);
    const finalOutput = path.join(outputFolder, `${namePrefix}${ext}`);

    if (existsSync(finalOutput)) {
      console.log(`⚠️ Skipping video — already exists: ${finalOutput}`);
      return resolve(finalOutput);
    }

    const targetAspectRatio = 9 / 16;
    const targetHeight = videoHeight;
    const targetWidth = Math.floor(targetHeight * targetAspectRatio);

    const cropX = Math.floor((videoWidth - targetWidth) / 2);
    const cropY = 0;

    ffmpeg(inputPath)
      .videoFilter(`crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`)
      .output(finalOutput)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Vertical crop progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(finalOutput))
      .on('error', (err) => {
        console.error('❌ FFmpeg error in makeVerticalVideo:', err.message);
        reject(err);
      })
      .run();
  });
}


export function createScreenshot({
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

 

export function createScreenshotLastFrame({
  inputPath,
  outputPath,
}: {
  inputPath: string;
  outputPath: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    // Step 1: Get video duration
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);

      const duration = metadata.format.duration;
      if (!duration || duration <= 0) {
        return reject(new Error('Invalid video duration.'));
      }

      // Step 2: Take screenshot at the last frame (a bit before the actual duration to avoid overshooting)
      const lastFrameTimestamp = duration - 0.1;

      ffmpeg(inputPath)
        .screenshots({
          timestamps: [lastFrameTimestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '1280x720',
        })
        .on('end', resolve)
        .on('error', reject);
    });
  });
}


export function mergeVideosWithFFmpeg(listFilePath: string, outputPath: string): Promise<void> {
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


 

export async function mergeVideos(
  videos: string[],
  outputFolder: string,
  namePrefix: string
): Promise<string> {
  if (!videos.length) throw new Error('No videos provided to merge.');

  const { ext } = path.parse(videos[0]);
  const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

  if (existsSync(outputPath)) {
    console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
    return outputPath;
  }

  const listFilePath = path.join(outputFolder, 'concat_list.txt');
  const listContent = videos
    .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
    .join('\n');

  await fs.writeFile(listFilePath, listContent, 'utf-8');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Merging progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => {
        console.log(`✅ Merged video saved to: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`❌ Error while merging videos:`, err);
        reject(err);
      })
      .run();
  });
}



// export function mergeVideos(videos: string[], outputFolder: string, namePrefix: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     if (!videos.length) {
//       return reject(new Error('No videos provided to merge.'));
//     }

//     const { ext } = path.parse(videos[0]);
//     const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);
//     const tempDir = outputFolder; // Best practice: use same folder for temp

//     if (existsSync(outputPath)) {
//       console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
//       resolve(outputPath);
//       return;
//     }

//     const command = ffmpeg();

//     console.log(`Merging videos:`,{videos});

//     videos.forEach((video) => {
//       command.input(video);
//     });

//     command
//       .on('progress', (progress) => {
//         process.stdout.write(`⏳ Merging progress: ${Math.floor(progress.percent || 0)}%\r`);
//       })
//       .on('end', () => {
//         console.log(`✅ Merged video saved to: ${outputPath}`);
//         resolve(outputPath);
//       })
//       .on('error', (err) => {
//         console.error(`❌ Error while merging videos:`, err);
//         reject(err);
//       })
//       .mergeToFile(outputPath, tempDir); // 👈 now correctly passing 2 arguments
//   });
// }

export function speedUpVideo({
  inputPath,
  outputFolder,
  namePrefix,
  speedFactor
}: {
  inputPath: string;
  outputFolder: string;
  namePrefix: string;
  speedFactor: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(inputPath);
    const outputPathWithPrefix = path.join(outputFolder, `${namePrefix}${ext}`);

    if (existsSync(outputPathWithPrefix)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPathWithPrefix}`);
      resolve(outputPathWithPrefix);
      return;
    }

    ffmpeg(inputPath)
      .videoFilter(`setpts=${1 / speedFactor}*PTS`)
      .audioFilter(`atempo=${speedFactor}`)
      .FPS(30)
      .output(outputPathWithPrefix)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Speeding up progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(outputPathWithPrefix))
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// export function addMusicToVideo({
//   inputPath,
//   outputFolder,
//   namePrefix,
//   mp3Path,
// }: {
//   inputPath: string;
//   outputFolder: string;
//   namePrefix: string;
//   mp3Path: string;
// }): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const { ext } = path.parse(inputPath);
//     const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

//     console.log({ outputPath,mp3Path });

//     if (existsSync(outputPath)) {
//       console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
//       resolve(outputPath);
//       return;
//     }

//     ffmpeg(inputPath)
//       .input(mp3Path)
//       .audioCodec('aac')
//       .videoCodec('copy') // copy video stream without re-encoding
//       .outputOptions([
//         '-shortest',       // cut audio to match video length
//         // '-preset', 'ultrafast', // very fast processing
//       ])
//       .output(outputPath)
//       .on('progress', (progress) => {
//         process.stdout.write(`⏳ Adding music progress: ${Math.floor(progress.percent || 0)}%\r`);
//       })
//       .on('end', () => resolve(outputPath))
//       .on('error', (err) => {
//         console.error('❌ FFmpeg error:', err.message);
//         reject(err);
//       })
//       .run();
//   });
// }

export function addMusicToVideo({
  inputPath,
  outputFolder,
  namePrefix,
  mp3Path,
}: {
  inputPath: string;
  outputFolder: string;
  namePrefix: string;
  mp3Path: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const { ext } = path.parse(inputPath);
    const outputPath = path.join(outputFolder, `${namePrefix}${ext}`);

    console.log({ outputPath, mp3Path });

    if (existsSync(outputPath)) {
      console.log(`⚠️ Skipping video — already exists: ${outputPath}`);
      resolve(outputPath);
      return;
    }

    ffmpeg(inputPath)
      .noAudio() // remove original audio
      .input(mp3Path) // add new audio
      .audioCodec('aac')
      .videoCodec('libx264') // re-encode video
      .outputOptions([
        '-shortest',       // stop at end of shortest stream
        '-preset', 'veryfast',
        '-crf', '23',
      ])
      .output(outputPath)
      .on('progress', (progress) => {
        process.stdout.write(`⏳ Adding music progress: ${Math.floor(progress.percent || 0)}%\r`);
      })
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err.message);
        reject(err);
      })
      .run();
  });
}