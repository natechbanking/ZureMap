# ZureMap

ZureMap is an intelligent Azure Architecture Diagram Generator built with Angular. It automatically scans your Azure subscriptions, discovers resources, and generates interactive architecture diagrams.

## Features

- **Automated Resource Discovery:** Uses Azure CLI authentication to securely scan and discover resources across one or multiple Azure subscriptions.
- **Topology & Connections:** Automatically maps out virtual network topologies and resolves relationships like Private Endpoints, VNet Peering, and Managed Identity Assignments.
- **Smart Layout Engine:** Uses ELK (Eclipse Layout Kernel) to automatically compute and arrange beautiful, readable architectural layouts.
- **Interactive Canvas:**
  - Grouping by Subscriptions, Resource Groups, and VNets.
  - Expandable/collapsible resource panels (e.g., Route Tables, NSGs, VM details).
  - Drag-and-drop reordering, panning, and zooming.
- **Custom Annotations:** Rich drawing tools including shapes (rectangles, diamonds, ellipses), arrows, lines, freehand drawing, and sticky notes to annotate your generated architecture.
- **Official Azure Icons:** Uses normalized Microsoft Azure Architecture Icons to accurately represent your cloud infrastructure.
- **FinOps & Cost Insights:** Provides cost visualization per node/resource and top cost insights directly on the diagram.
- **Export Options:** Export your diagrams to images (with customizable backgrounds) or save/load JSON configurations.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) - Required for authentication (`az login`).
- [Angular CLI](https://github.com/angular/angular-cli) version 19.2+

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Azure Authentication:**
   Make sure you are logged in to your Azure CLI:
   ```bash
   az login
   ```

3. **Start the Development Server:**
   Run the application and the proxy server concurrently:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Project Structure

- `src/app/features/scan`: Handles the subscription selection, scanning options, and the Azure resource graph discovery process.
- `src/app/features/canvas`: The interactive diagramming surface powered by `elkjs` and custom drawing/layout services.
- `src/app/core/services`: Core services handling Azure authentication (`az-auth.service`), resource mapping, and connection resolving.
- `scripts/map-icons.js`: A script that maps and normalizes raw Azure Architecture SVG icons into the format expected by ZureMap.

## Updating Icons

If you need to update the official Azure icons, place the raw SVG files in a folder and run:
```bash
npm run map-icons -- --source /path/to/downloaded-icons
```
This script normalizes the filenames, copies them to `assets/azure-icons/`, and generates the `icon-manifest.json`.

## Building for Production

To build the project for production, run:
```bash
npm run build
```
The build artifacts will be stored in the `dist/` directory.

## Testing

- **Unit tests:** Run `npm run test` or `ng test` to execute unit tests via Karma.
