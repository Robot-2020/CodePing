#!/usr/bin/env node
/**
 * Generate .ico file from PNG icons
 * Combines multiple sizes into a single .ico file
 */

const fs = require('fs');
const path = require('path');

// ICO file format helper
function createICO(pngFiles) {
  // ICO header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved (must be 0)
  header.writeUInt16LE(1, 2); // Type (1 = ICO)
  header.writeUInt16LE(pngFiles.length, 4); // Number of images

  // ICO directory entries
  const entries = [];
  let offset = 6 + (pngFiles.length * 16); // Header + all entries

  for (const { size, buffer } of pngFiles) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // Image size
    entry.writeUInt32LE(offset, 12); // Image offset

    entries.push(entry);
    offset += buffer.length;
  }

  // Combine all parts
  return Buffer.concat([
    header,
    ...entries,
    ...pngFiles.map(f => f.buffer)
  ]);
}

async function generateICO() {
  const baseDir = process.cwd();
  const assetsDir = path.join(baseDir, 'assets');
  const iconsDir = path.join(assetsDir, 'icons');

  console.log('🪟 Generating Windows .ico file...\n');

  try {
    // Use common ICO sizes (16, 32, 48, 256)
    const sizes = [16, 32, 48, 256];
    const pngFiles = [];

    for (const size of sizes) {
      const pngPath = path.join(iconsDir, `${size}x${size}.png`);
      if (!fs.existsSync(pngPath)) {
        console.warn(`⚠️  Missing ${size}x${size}.png, skipping...`);
        continue;
      }
      const buffer = fs.readFileSync(pngPath);
      pngFiles.push({ size, buffer });
      console.log(`   ✅ Added ${size}x${size}.png`);
    }

    if (pngFiles.length === 0) {
      throw new Error('No PNG files found to convert');
    }

    const icoBuffer = createICO(pngFiles);
    const icoPath = path.join(assetsDir, 'icon.ico');
    fs.writeFileSync(icoPath, icoBuffer);

    console.log(`\n✅ Generated icon.ico (${icoBuffer.length} bytes)`);
    console.log(`📍 Location: ${icoPath}\n`);

    return true;
  } catch (error) {
    console.error('❌ Error generating .ico:', error.message);
    return false;
  }
}

// Run
generateICO().then(success => {
  process.exit(success ? 0 : 1);
});
