import streamSaver from 'streamsaver';
import createWriter from './zip-stream';
import { FileLike, ProgressCallback } from './exporter';
import logger from './logger';

declare global {
  interface Window {
    ZIP: any;
  }
}

/**
 * Download multiple files from URL and save as a zip archive.
 *
 * @see https://github.com/jimmywarting/StreamSaver.js/issues/106
 * @param zipFilename Name of the zip archive file
 * @param files List of files to download
 * @param onProgress Callback function to track progress
 * @param rateLimit The minimum time gap between two downloads (in milliseconds)
 */
export async function zipStreamDownload(
  zipFilename: string,
  files: FileLike[],
  onProgress?: ProgressCallback<FileLike>,
  rateLimit = 1000,
) {
  // The data written to this stream will be streamed to the user's browser as a file download.
  const writableOutputStream = streamSaver.createWriteStream(zipFilename);

  let current = 0;
  const total = files.length;
  const fileIterator = files.values();

  // Add files to zip archive stream.
  const readableZipStream: ReadableStream = createWriter({
    async pull(ctrl: any) {
      const fileInfo = fileIterator.next();
      if (fileInfo.done) {
        // All files have been downloaded.
        ctrl.close();
      } else {
        // Download file and add to zip.
        const { filename, url } = fileInfo.value;

        const start = Date.now();
        logger.debug(`Start downloading ${filename} from ${url}`);
        return fetch(url)
          .then((res) => {
            ctrl.enqueue({
              name: filename,
              stream: () => res.body,
            });

            // Update progress.
            onProgress?.(++current, total, fileInfo.value);
            logger.debug(`Finished downloading ${filename} in ${Date.now() - start}ms`);
          })
          .then(() => {
            // Wait for a while to prevent rate limit.
            return new Promise((resolve) => setTimeout(resolve, rateLimit));
          });
      }
    },
  });

  // Download the zip archive.
  logger.info(`Start zip archive: ${zipFilename}`);
  return readableZipStream.pipeTo(writableOutputStream);
}
