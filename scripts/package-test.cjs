const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

async function packageTesterZip() {
  const rootDir = path.resolve(__dirname, "..");
  const distDir = path.join(rootDir, "dist");
  const releaseDir = path.join(rootDir, "release");

  console.log("==> Starting Attendly Tester Package Build...");

  // 1. Verify dist exists and has manifest.json
  const manifestPath = path.join(distDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Error: dist/manifest.json not found! Run 'npm run build' first.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const version = manifest.version_name || manifest.version || "0.1.0";
  console.log(`Detected Extension Version: ${version}`);

  // 2. Ensure release directory exists
  if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
  }

  const zipFilename = `attendly-v${version}.zip`;
  const zipPath = path.join(releaseDir, zipFilename);

  // If previous zip exists, remove it
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", {
    zlib: { level: 9 }, // Maximum compression
  });

  output.on("close", () => {
    const sizeKb = (archive.pointer() / 1024).toFixed(1);
    console.log(`\n======================================================`);
    console.log(`SUCCESS: Package created!`);
    console.log(`File: ${zipFilename} (${sizeKb} KB)`);
    console.log(`Path: ${zipPath}`);
    console.log(`Ready for manual installation and tester distribution.`);
    console.log(`======================================================\n`);
  });

  archive.on("error", (err) => {
    throw err;
  });

  archive.pipe(output);

  // Add the contents of dist/ directly to the root of the ZIP
  archive.directory(distDir, false);

  await archive.finalize();
}

packageTesterZip().catch((err) => {
  console.error("Failed to package tester ZIP:", err);
  process.exit(1);
});
