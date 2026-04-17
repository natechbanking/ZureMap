# Azure Architecture Icons

This directory is intentionally empty due to Microsoft's licensing terms.

## Setup

1. Download the official Azure Architecture Icons from:
   https://learn.microsoft.com/en-us/azure/architecture/icons/

2. Extract the ZIP file.

3. Run the icon mapping script to normalize filenames:
   ```bash
   npm run map-icons -- --source /path/to/extracted-icons
   ```

   This will:
   - Strip numeric prefixes (e.g., `00001-icon-Virtual-Machine.svg` → `Virtual-Machine.svg`)
   - Copy matched SVGs to this directory
   - Generate `icon-manifest.json` with ARM type → SVG filename mappings
   - Report any unmapped resource types

## Manual Install

If you prefer, copy SVG files directly into this directory using the naming
convention in `src/app/core/services/icon-registry.service.ts` (`RESOURCE_TYPE_MAP`).

## License

Azure Architecture Icons are provided by Microsoft under the
[Microsoft Azure Terms of Use](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks).
They may be used in architectural diagrams, training materials, and documentation
with proper attribution.
