import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const assets = [
  ["https://www.clubraia.com/assets/img/home/slide01.jpg", "public/clubraia/slide01.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide02.jpg", "public/clubraia/slide02.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide04.jpg", "public/clubraia/slide04.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide05.jpg", "public/clubraia/slide05.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide06.jpg", "public/clubraia/slide06.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide07.jpg", "public/clubraia/slide07.jpg"],
  ["https://www.clubraia.com/assets/img/home/slide08.jpg", "public/clubraia/slide08.jpg"],
  ["https://www.clubraia.com/assets/img/general/logo.svg", "public/clubraia/logo.svg"],
  ["https://www.clubraia.com/assets/img/general/arrowleft.svg", "public/clubraia/arrowleft.svg"],
  ["https://www.clubraia.com/assets/img/general/arrowright.svg", "public/clubraia/arrowright.svg"],
  ["https://www.clubraia.com/assets/img/general/about.jpg", "public/clubraia/about.jpg"],
  ["https://www.clubraia.com/assets/img/general/contact.jpg", "public/clubraia/contact.jpg"],
  ["https://www.clubraia.com/assets/img/general/close.svg", "public/clubraia/close.svg"],
];

async function download(url, outputPath) {
  const response = await fetch(url);

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }

  const absoluteOutput = join(process.cwd(), outputPath);
  await mkdir(dirname(absoluteOutput), { recursive: true });
  await finished(Readable.fromWeb(response.body).pipe(createWriteStream(absoluteOutput)));
  console.log(`Downloaded ${outputPath}`);
}

for (const [url, outputPath] of assets) {
  await download(url, outputPath);
}
