// Builds the preloader mark from the 1024px master logo.
//
// The master (`public/pure/purelogo.png`) is a 1.37 MB RGBA square with a large
// band of baked-in transparent padding. It is far too heavy for the element
// that has to paint first on a cold visit, and its padding makes precise
// centring impossible.
//
// The crop below is the SAME box `.pure-corner-logo` uses in globals.css
// (x:199-822, y:167-866, 623x699). Keeping the two crops identical is what
// lets the preloader mark fly to the corner logo on exit as a pure
// translate+scale: both elements frame the artwork the same way, so the
// transform lands pixel-aligned instead of drifting.
//
// Run: node scripts/build-pure-mark.mjs

import sharp from "sharp";

const SOURCE = "public/pure/purelogo.png";
const OUTPUT = "public/pure/pure-mark.webp";

/** The crop box shared with `.pure-corner-logo`. */
const CROP = { left: 199, top: 167, width: 623, height: 699 };

/** Twice the largest size the mark is ever displayed at (208px wide). */
const OUTPUT_WIDTH = 440;

async function main() {
  const info = await sharp(SOURCE)
    .extract(CROP)
    .resize({ width: OUTPUT_WIDTH })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(OUTPUT);

  console.log(
    `${OUTPUT}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
