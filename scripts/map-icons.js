#!/usr/bin/env node
/**
 * Normalizes Microsoft Azure Architecture Icons for ZureMap.
 *
 * Usage:
 *   node scripts/map-icons.js --source /path/to/downloaded-icons
 *
 * What it does:
 *   1. Walks the source directory for SVG files
 *   2. Strips numeric prefixes (e.g. "00001-icon-") and normalizes filenames
 *   3. Copies matched SVGs to assets/azure-icons/
 *   4. Generates assets/azure-icons/icon-manifest.json
 *   5. Reports unmapped ARM resource types
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const sourceIdx = args.indexOf('--source');
const sourceDir = sourceIdx >= 0 ? args[sourceIdx + 1] : null;

if (!sourceDir) {
  console.error('Usage: node scripts/map-icons.js --source /path/to/icons');
  process.exit(1);
}

const TARGET_DIR = path.join(__dirname, '..', 'assets', 'azure-icons');
const MANIFEST_PATH = path.join(TARGET_DIR, 'icon-manifest.json');

// ARM type to expected SVG filename
const RESOURCE_TYPE_MAP = {
  'microsoft.compute/virtualmachines':              'Virtual-Machine.svg',
  'microsoft.compute/disks':                        'Managed-Disks.svg',
  'microsoft.compute/virtualmachinescalesets':      'VM-Scale-Sets.svg',
  'microsoft.network/virtualnetworks':              'Virtual-Networks.svg',
  'microsoft.network/networksecuritygroups':        'Network-Security-Groups.svg',
  'microsoft.network/privateendpoints':             'Private-Endpoint.svg',
  'microsoft.network/publicipaddresses':            'Public-IP-Addresses.svg',
  'microsoft.network/loadbalancers':                'Load-Balancers.svg',
  'microsoft.network/applicationgateways':          'Application-Gateways.svg',
  'microsoft.network/networkinterfaces':            'Network-Interfaces.svg',
  'microsoft.network/dnszones':                     'DNS-Zones.svg',
  'microsoft.web/sites':                            'App-Services.svg',
  'microsoft.web/serverfarms':                      'App-Service-Plans.svg',
  'microsoft.sql/servers':                          'SQL-Server.svg',
  'microsoft.sql/servers/databases':                'SQL-Database.svg',
  'microsoft.storage/storageaccounts':              'Storage-Accounts.svg',
  'microsoft.keyvault/vaults':                      'Key-Vaults.svg',
  'microsoft.containerservice/managedclusters':     'Kubernetes-Services.svg',
  'microsoft.servicebus/namespaces':                'Service-Bus.svg',
  'microsoft.eventhub/namespaces':                  'Event-Hubs.svg',
  'microsoft.cognitiveservices/accounts':           'Cognitive-Services.svg',
  'microsoft.insights/components':                  'Application-Insights.svg',
  'microsoft.operationalinsights/workspaces':       'Log-Analytics-Workspaces.svg',
  'microsoft.cache/redis':                          'Cache-Redis.svg',
  'microsoft.documentdb/databaseaccounts':          'Azure-Cosmos-DB.svg',
  'microsoft.apimanagement/service':                'API-Management-Services.svg',
  'microsoft.logic/workflows':                      'Logic-Apps.svg',
  'microsoft.resources/resourcegroups':             'Resource-Groups.svg',
};

// Collect all SVGs from source
function findSvgs(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findSvgs(full));
    else if (entry.name.toLowerCase().endsWith('.svg')) results.push(full);
  }
  return results;
}

function normalizeName(filename) {
  return filename
    .replace(/^\d+-/, '')         // strip leading digits+dash
    .replace(/^icon-/i, '')        // strip "icon-" prefix
    .replace(/\s+/g, '-');         // spaces to dashes
}

const allSvgs = findSvgs(sourceDir);
const svgMap = new Map();
for (const svgPath of allSvgs) {
  const normalized = normalizeName(path.basename(svgPath));
  svgMap.set(normalized.toLowerCase(), svgPath);
}

fs.mkdirSync(TARGET_DIR, { recursive: true });

const mappings = {};
const unmapped = [];
const suggestions = {};
let copied = 0;

for (const [armType, targetFilename] of Object.entries(RESOURCE_TYPE_MAP)) {
  const srcPath = svgMap.get(targetFilename.toLowerCase());
  if (srcPath) {
    fs.copyFileSync(srcPath, path.join(TARGET_DIR, targetFilename));
    mappings[armType] = targetFilename;
    copied++;
  } else {
    unmapped.push(armType);
    // Fuzzy suggestion: find SVGs with overlapping words
    const words = targetFilename.replace('.svg', '').toLowerCase().split('-');
    const candidates = [...svgMap.keys()].filter(k => words.some(w => w.length > 3 && k.includes(w)));
    if (candidates.length) suggestions[armType] = candidates.slice(0, 3).map(c => svgMap.get(c)).map(p => path.basename(p));
  }
}

const manifest = {
  generated: new Date().toISOString().split('T')[0],
  totalIcons: allSvgs.length,
  copiedIcons: copied,
  mappings,
  unmapped,
  suggestions,
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

console.log(`\n✔ Copied ${copied} icons to assets/azure-icons/`);
if (unmapped.length) {
  console.log(`\n⚠ ${unmapped.length} unmapped ARM types:`);
  unmapped.forEach(t => {
    const s = suggestions[t];
    console.log(`  ${t}${s ? ` → suggestions: ${s.join(', ')}` : ''}`);
  });
}
console.log(`\n✔ Manifest written to ${MANIFEST_PATH}`);
