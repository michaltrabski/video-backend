import fs from 'fs/promises';
import path from 'path';
import {
  copyFilesSync, createScreenshot, fileExists, makeHorizontalVideo,
  makeVerticalVideo, mergeVideos, mergeVideosWithFFmpeg,
  revertVideo, sanitizeFileName, speedUpVideo
} from './utils';


const PRODUCE_VERTICAL = true;
const PRODUCE_SCREENSHOTS = false;
const REMOVE_SOURCE_FILES = false;

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

type TrimRequest = {
  allVideosTitle: string;
  videos: TrimData[];
};

export async function zoomOutVideos() {
  console.log('🚀 Starting zoomOutVideos...');

  try {
    const rawData = await fs.readFile(trimDataPath, 'utf-8');
    const parsed: TrimRequest = JSON.parse(rawData);
    const allVideosTitle = parsed.allVideosTitle;
    const trimDataList = parsed.videos;

    console.log(`📁 Global Video Title: ${allVideosTitle}`);

    await fs.mkdir(outputFolder, { recursive: true });
    await fs.mkdir(path.join(outputFolder, "final"), { recursive: true });

    const horizontalVideos: string[] = [];
    const horizontalSpeededVideos: string[] = [];
    const verticalVideos: string[] = [];
    const verticalSpeededVideos: string[] = [];
    const screenshotsList: string[] = [];

    let counter = 0;
    for (const [index, data] of trimDataList.entries()) {
      counter++;
      const { filename, customName, trimStart, trimStop } = data;
      // const inputPath = path.join(inputFolder, filename);

      // const tempVerticalPath = path.join(outputFolder, customName + ' #nikon #p1000 #p1100.mp4');
      const finalOutputPath = path.join(outputFolder, customName + '.mp4');
      const screenshotPath = path.join(outputFolder, customName + '.jpg');

      console.log(`\n[${index + 1}/${trimDataList.length}] 🎬 Processing: ${filename}`);

      if (await fileExists(finalOutputPath)) {
        console.log(`⚠️ Skipping video — already exists: ${finalOutputPath}`);
      } else {

        const baseVideo = await makeHorizontalVideo({
          inputPath: path.join(inputFolder, filename),
          outputFolder,
          namePrefix: `${counter}_${customName}___BASE___`,
          startTime: trimStart,
          duration: trimStop - trimStart - 0.1
        });

        const baseSpeededBy2 = await speedUpVideo({
          inputPath: path.join(inputFolder, filename),
          outputFolder,
          namePrefix: `${counter}_${customName}___baseSpeededBy2`,
          speedFactor: 2,
        });

        // const first3Second = await makeHorizontalVideo({
        //   inputPath: path.join(inputFolder, filename),
        //   outputFolder,
        //   namePrefix: `${counter}_${customName}___3SECONDS___`,
        //   startTime: 0,
        //   duration: 3
        // });

        // const firstSecondResizeVideo = await resizeVideoBy6({
        //   inputPath: first3Second,
        //   outputFolder,
        //   namePrefix: `${counter}_${customName}___3SECONDS_RESIZED___`,
        // });


        // FINAL WITHOUT MUSIC
        // const horizontalVideo = await putVideoOnVideo({
        //   leftPath: baseVideo,
        //   rightPath: firstSecondResizeVideo,
        //   outputFolder,
        //   namePrefix: `${counter}_${customName}___HORIZONTAL___`,
        // });
        // horizontalVideos.push(horizontalVideo);

        const baseSpeededBy6 = await speedUpVideo({
          inputPath: baseVideo,
          outputFolder,
          namePrefix: `${counter}_${customName}___baseSpeededBy6`,
          speedFactor: 6,
        });
 

        const baseSpeededBy6Reverted = await revertVideo(baseSpeededBy6)

        const revertedPlusBaseSpeededBy2 = await mergeVideos([baseSpeededBy6Reverted, baseSpeededBy2], outputFolder, `${counter}_${customName}___FINAL___`)

        // not working 
        // const withMusic = await addMusicToVideo({
        //   inputPath: finalVideo,
        //   outputFolder,
        //   namePrefix: `${counter}_${customName}___FINAL___SPEEDUP___MUSIC`,
        //   mp3Path: path.join(__dirname, '..', 'music', '1.mp3')})


        if (PRODUCE_VERTICAL) {
          const verticalVideo = await makeVerticalVideo({
            inputPath: revertedPlusBaseSpeededBy2,
            outputFolder,
            videoWidth: data.videoWidth,
            videoHeight: data.videoHeight,
            namePrefix: `${counter}_${customName} #nikon #p1000 #p1100 ___FINAL___VERTICAL`,
          });
          verticalVideos.push(verticalVideo);

          // const verticalSpeededVideo = await speedUpVideo({
          //   inputPath: verticalVideo,
          //   outputFolder,
          //   namePrefix: `${counter}_${customName} #nikon #p1000 #p1100 ___FINAL___VERTICAL___SPEEDUP`,
          //   speedFactor: 2,
          // });
          // verticalSpeededVideos.push(verticalSpeededVideo);
          // console.log(`✅ Created final vertical video: ${finalOutputPath}`);
        }

        if (PRODUCE_SCREENSHOTS) {
          await createScreenshot({
            inputPath: baseVideo,
            outputPath: screenshotPath,
            timestamp: 1 // screenshot at 1 second of the video
          });
          console.log(`📸 Created screenshot: ${screenshotPath}`)
          screenshotsList.push(screenshotPath);
        }
      }
    }

    // Create a screenshotsList
    console.log({ screenshotsList });
    copyFilesSync(screenshotsList);

    // console.log({ verticalSpeededVideos });
    // copyFilesSync(verticalSpeededVideos);

    console.log({ verticalVideos });
    copyFilesSync(verticalVideos);

    console.log('\n🎉 All videos processed.');

    // Merge horizontal videos if multiple exist
    if (horizontalVideos.length > 1) {
      // Create a list file for vertical videos
      const verticalVideosPath = path.join(outputFolder, 'verticalVideosList.txt');
      const verticalVideosContent = verticalVideos
        .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
        .join('\n');
      await fs.writeFile(verticalVideosPath, verticalVideosContent, 'utf-8');

      // Create a list file for ffmpeg to merge videos
      const listPath = path.join(outputFolder, 'horizontalVideosList.txt');
      const concatFileContent = horizontalVideos
        .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
        .join('\n');
      await fs.writeFile(listPath, concatFileContent, 'utf-8');

      const mergedOutput = path.join(
        outputFolder,
        sanitizeFileName(`${allVideosTitle}.mp4`) // this is final horizontal video name
      );

      await mergeVideosWithFFmpeg(listPath, mergedOutput);

      // copy merged video to final folder
      const finalMergedPath = path.join(outputFolder, "final", sanitizeFileName(`${allVideosTitle}.mp4`));
      console.log({ mergedOutput, finalMergedPath });
      await fs.copyFile(mergedOutput, finalMergedPath);
      await fs.copyFile(verticalVideosPath, path.join(outputFolder, "final", 'verticalVideosList.txt'));

      console.log(`🎞️  Merged horizontal video created: ${mergedOutput}`);
    } else {
      console.log('ℹ️ Not enough horizontal videos to merge.', horizontalVideos.length);
    }

    // Copy all short videos to the final folder
    // for (const video of verticalVideos) {
    //   const videoName = path.basename(video);
    //   const finalPath = path.join(outputFolder, "final", videoName);
    //   await fs.copyFile(video, finalPath);
    //   console.log(`📦 Copied video to final folder: ${finalPath}`);
    // }

    // Remove source files (optional toggle)
    for (const data of trimDataList) {
      const inputPath = path.join(inputFolder, data.filename);
      try {
        if (REMOVE_SOURCE_FILES) {
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
