# ZureMap

<p align="center">
  <img src="public/logo.png" alt="ZureMap" width="160" />
</p>

ZureMap is an intelligent Azure Architecture Diagram Generator built with Angular. It automatically scans your Azure subscriptions, discovers resources, and generates interactive architecture diagrams.

## Features

- **Automated Resource Discovery:** Uses Azure CLI authentication to securely scan and discover resources across one or multiple Azure subscriptions.
- **Topology & Connections:** Automatically maps virtual network topologies and resolves relationships like Private Endpoints, VNet Peering, and Managed Identity Assignments.
- **Smart Layout Engine:** Uses ELK (Eclipse Layout Kernel) to automatically compute and arrange readable architectural layouts.
- **Interactive Canvas:**
  - Grouping by Subscriptions, Resource Groups, and VNets.
  - Expandable/collapsible resource panels (e.g., Route Tables, NSGs, VM details).
  - Drag-and-drop reordering, panning, and zooming.
- **Custom Annotations:** Rich drawing tools including shapes (rectangles, diamonds, ellipses), arrows, lines, freehand drawing, and sticky notes.
- **Official Azure Icons:** Uses normalized Microsoft Azure Architecture Icons to accurately represent your cloud infrastructure.
- **FinOps & Cost Insights:** Cost visualization per resource and top cost insights directly on the diagram.
- **Export Options:** Export diagrams to images (with customizable backgrounds) or save/load JSON configurations.
- **DNS Zone Management:** View and manage DNS zones and their records within your subscription.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) — required for authentication (`az login`)
- [Angular CLI](https://github.com/angular/angular-cli) v19.2+
- [Docker](https://www.docker.com/) _(optional, for containerized usage)_

## Getting Started

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   # or
   make install
   ```

2. **Authenticate with Azure:**
   ```bash
   az login
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   # or
   make dev
   ```
   Open `http://localhost:4200/`. The app hot-reloads on file changes.

### Docker

Run ZureMap in a container (the image includes Azure CLI):

```bash
# Build and start
make docker-up

# Stop and remove
make docker-down

# Tail logs
make docker-logs
```

The container serves the app on port `3001`. You will need to mount your Azure credentials or run `az login` inside the container.

## Available Commands

| Command | Description |
|---|---|
| `make dev` | Start proxy + Angular dev server |
| `make build` | Production build |
| `make test` | Run unit tests (single run) |
| `make test-watch` | Run unit tests in watch mode |
| `make lint` | Lint the project |
| `make clean` | Remove build artifacts and caches |
| `make map-icons` | Regenerate Azure icon mappings |
| `make docker-build` | Build the Docker image |
| `make docker-up` | Build and start the container |
| `make docker-down` | Stop and remove the container |
| `make docker-logs` | Tail container logs |

Run `make help` to see all available targets.

## Project Structure

```
src/
  app/
    features/
      scan/     # Subscription selection, scanning options, resource graph discovery
      canvas/   # Interactive diagramming surface (elkjs, drawing/layout services)
    core/
      services/ # Azure auth, resource mapping, connection resolving
scripts/
  map-icons.js  # Normalizes raw Azure Architecture SVGs for use in ZureMap
proxy/
  server.js     # Local proxy server for Azure CLI API calls
```

## Updating Icons

To update the official Azure icons, download the latest SVG pack and run:

```bash
npm run map-icons -- --source /path/to/downloaded-icons
# or
make map-icons
```

This normalizes filenames, copies them to `assets/azure-icons/`, and regenerates `icon-manifest.json`.

## Building for Production

```bash
make build
```

Build artifacts are stored in `dist/`.

## Testing

```bash
make test        # single run
make test-watch  # watch mode
```

## License

ZureMap is source-available under the [Elastic License 2.0 (ELv2)](./LICENSE.md).

**You are free to:** use, modify, and distribute ZureMap for personal or internal business purposes.

**You may not:**
- Provide ZureMap (or a derivative) to third parties as a hosted or managed service.
- Re-sell, sublicense, or commercially distribute ZureMap as a standalone product or embedded service.
- Remove or obscure licensing, copyright, or other notices.

See [LICENSE.md](./LICENSE.md) for the full terms.
