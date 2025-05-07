import fs from 'fs/promises';
import path from 'path';
import {
  copyFilesSync, createScreenshot, createScreenshotLastFrame, fileExists, makeHorizontalVideo,
  makeVerticalVideo, mergeVideos, revertVideo, rnd, sanitizeFileName, speedUpVideo
} from './utils';

const PRODUCE_VERTICAL = true;
const PRODUCE_THUMBNAILS = true;
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
  pointInTime: number;
};

type TrimRequest = {
  allVideosTitle: string;
  videos: TrimData[];
};

export async function zoomInVideos() {
  console.log('🚀 Starting zoomInVideos...');

  try {
    const rawData = await fs.readFile(trimDataPath, 'utf-8');
    const parsed: TrimRequest = JSON.parse(rawData);
    const allVideosTitle = parsed.allVideosTitle;
    const trimDataList = parsed.videos;


    await fs.mkdir(path.join(outputFolder, 'final'), { recursive: true });

    // const horizontalVideos: string[] = [];

    const screenshotsList: string[] = [];
    const arr: {
      horizontalVideos: string[], verticalVideos: string[], thumbnails: string[]
    } = { horizontalVideos: [], verticalVideos: [], thumbnails: [] };

    let counter = 0;

    for (const [index, data] of trimDataList.entries()) {
      counter++;
      const { filename, customName, trimStart, trimStop, pointInTime } = data;
      const finalOutputPath = path.join(outputFolder, customName + '.mp4');



      if (await fileExists(finalOutputPath)) {
        console.log(`⚠️ Skipping video — already exists: ${finalOutputPath}`);
        continue;
      }



      const baseVideoFirst = await makeHorizontalVideo({
        inputPath: path.join(inputFolder, filename),
        outputFolder,
        namePrefix: `${filename}_baseFirst`,
        startTime: trimStart,
        duration: pointInTime - trimStart
      });



      const baseVideoFirst2xSpeeded = await speedUpVideo({
        inputPath: baseVideoFirst,
        outputFolder,
        namePrefix: `${filename}_baseVideoFirst2xSpeeded`,
        speedFactor: 2,
      });

      const baseVideoSecond = await makeHorizontalVideo({
        inputPath: path.join(inputFolder, filename),
        outputFolder,
        namePrefix: `${filename}_baseVideoSecond`,
        startTime: pointInTime,
        duration: trimStop - pointInTime
      });

      const horizontalVideo = await mergeVideos([baseVideoFirst2xSpeeded, baseVideoSecond], outputFolder, `${filename}_base`,);

      arr.horizontalVideos.push(horizontalVideo);

      if (PRODUCE_VERTICAL) {
        const verticalVideo = await makeVerticalVideo({
          inputPath: horizontalVideo,
          outputFolder,
          videoWidth: data.videoWidth,
          videoHeight: data.videoHeight,
          namePrefix: `${customName} #nikon #p1000 #p1100`,
        });
        arr.verticalVideos.push(verticalVideo);
      }

      if (PRODUCE_THUMBNAILS) {
        const screenshotPath = path.join(outputFolder, customName + '.jpg');

        await createScreenshotLastFrame({
          inputPath: horizontalVideo,
          outputPath: screenshotPath
        });
        console.log(`📸 Created screenshot: ${screenshotPath}`);
        arr.thumbnails.push(screenshotPath);
      }
    }

    copyFilesSync(arr.thumbnails);
    copyFilesSync(arr.verticalVideos);

    console.log('ℹ️ Merging horizontal videos...', arr.horizontalVideos.length);
    if (arr.horizontalVideos.length > 1) {
      const mergedHorizontalVideo = await mergeVideos(arr.horizontalVideos, outputFolder, allVideosTitle);
      copyFilesSync([mergedHorizontalVideo]);
    } else {
      console.log('ℹ️ Not enough horizontal videos to merge.', arr.horizontalVideos.length);
    }

    for (const data of trimDataList) {
      const sourceFile = path.join(inputFolder, data.filename);
      try {
        if (REMOVE_SOURCE_FILES) {
          await fs.unlink(sourceFile);
          console.log(`🗑️  Deleted source file: ${sourceFile}`);
        }
      } catch (err) {
        console.error(`⚠️ Error deleting source file: ${sourceFile}`, err);
      }
    }

    console.log('\n🎉 All videos processed.');
  } catch (error) {
    console.error('❌ An error occurred:', error);
  }
}
