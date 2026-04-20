#!/usr/bin/env node
/**
 * Generate CodePing icons from Lucy idle SVG
 * Uses sharp library for SVG to PNG conversion
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -25 55 55">
  <defs>
    <clipPath id="bodyClip">
      <circle cx="8" cy="8" r="14"/>
    </clipPath>
  </defs>

  <!-- Main Body -->
  <g clip-path="url(#bodyClip)">
    <!-- Orange-red crescent -->
    <circle cx="-8" cy="2" r="22" fill="#ff7d10"/>
    <!-- Dark body -->
    <circle cx="17" cy="13" r="19" fill="#0a0310"/>
  </g>

  <!-- Eyes -->
  <g fill="#FFFFFF">
    <circle cx="5" cy="6" r="0.7"/>
    <circle cx="11" cy="6" r="0.7"/>
  </g>

  <!-- Smile -->
  <path d="M 6.5 11 Q 8 12.5 9.5 11" stroke="#FFFFFF" stroke-width="0.5" fill="none" stroke-linecap="round"/>
</svg>`;

const SIZES = [16, 32, 48, 64, 128, 256, 512];

async function generateIcons() {
  const baseDir = process.cwd();
  const assetsDir = path.join(baseDir, 'assets');
  const iconsDir = path.join(assetsDir, 'icons');

  console.log('🎨 Generating CodePing icons from Lucy theme...\n');

  const svgBuffer = Buffer.from(SVG_CONTENT);

  try {
    // Generate icon sizes
    for (const size of SIZES) {
      const outputPath = path.join(iconsDir, `${size}x${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      console.log(`   ✅ ${size}x${size}.png`);
    }

    // Generate main icon.png (512x512)
    const mainIconPath = path.join(assetsDir, 'icon.png');
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(mainIconPath);
    console.log(`   ✅ icon.png (512x512)`);

    // Generate tray icon (smaller, for menu bar)
    const trayIconPath = path.join(assetsDir, 'tray-icon.png');
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(trayIconPath);
    console.log(`   ✅ tray-icon.png (32x32)`);

    // Generate tray icon templates for macOS (Template images)
    const trayTemplateBase = path.join(assetsDir, 'tray-iconTemplate.png');
    await sharp(svgBuffer)
      .resize(18, 18)
      .png()
      .toFile(trayTemplateBase);
    console.log(`   ✅ tray-iconTemplate.png (18x18)`);

    const trayTemplate2x = path.join(assetsDir, 'tray-iconTemplate@2x.png');
    await sharp(svgBuffer)
      .resize(36, 36)
      .png()
      .toFile(trayTemplate2x);
    console.log(`   ✅ tray-iconTemplate@2x.png (36x36)`);

    console.log('\n✅ All icons generated successfully!');
    console.log(`📍 Icon location: ${iconsDir}/\n`);

    return true;
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    return false;
  }
}

// Run
generateIcons().then(success => {
  process.exit(success ? 0 : 1);
});
