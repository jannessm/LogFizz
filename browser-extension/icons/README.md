# Extension Icons

## Required Icons

The following icon sizes are needed:
- icon16.png (16x16) - Toolbar icon
- icon32.png (32x32) - Retina toolbar icon
- icon48.png (48x48) - Extension management
- icon128.png (128x128) - Web store / Safari

## Generating Icons

You can generate PNG icons from the icon.svg file using:

1. **ImageMagick** (if installed):
   ```bash
   convert -background none -resize 16x16 icon.svg icon16.png
   convert -background none -resize 32x32 icon.svg icon32.png
   convert -background none -resize 48x48 icon.svg icon48.png
   convert -background none -resize 128x128 icon.svg icon128.png
   ```

2. **Online converters**: Upload icon.svg to https://cloudconvert.com/svg-to-png

3. **Design tools**: Open icon.svg in Figma, Sketch, or Illustrator and export as PNG

## Current Status

The icon.svg file serves as the master icon. PNG files should be generated before
publishing the extension.
