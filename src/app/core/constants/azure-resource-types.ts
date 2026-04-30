export const AZURE_RESOURCE_TYPES = {
  // Compute
  VIRTUAL_MACHINE:        'microsoft.compute/virtualmachines',

  // Networking
  VIRTUAL_NETWORK:        'microsoft.network/virtualnetworks',
  SUBNET:                 'microsoft.network/subnets',
  NETWORK_INTERFACE:      'microsoft.network/networkinterfaces',
  NETWORK_SECURITY_GROUP: 'microsoft.network/networksecuritygroups',
  PRIVATE_ENDPOINT:       'microsoft.network/privateendpoints',
  ROUTE_TABLE:            'microsoft.network/routetables',

  // Storage
  STORAGE_ACCOUNT:        'microsoft.storage/storageaccounts',

  // SQL
  SQL_DATABASE:           'microsoft.sql/servers/databases',
} as const;

export type AzureResourceType = typeof AZURE_RESOURCE_TYPES[keyof typeof AZURE_RESOURCE_TYPES];

// ── Storage sub-resource helpers ──────────────────────────────────────────────

export interface StorageSubResourceBuckets {
  containers: string[];
  fileShares: string[];
  tables: string[];
  queues: string[];
}

export type StorageSubResourceKey = keyof StorageSubResourceBuckets;

/** Maps ARM sub-resource types to the storage bucket they belong to. */
export const STORAGE_SUB_TYPES: Readonly<Record<string, StorageSubResourceKey>> = {
  'microsoft.storage/storageaccounts/blobservices/containers': 'containers',
  'microsoft.storage/storageaccounts/fileservices/shares':     'fileShares',
  'microsoft.storage/storageaccounts/tableservices/tables':    'tables',
  'microsoft.storage/storageaccounts/queueservices/queues':    'queues',
};

/** Intermediate service-level nodes that should be suppressed (not mapped as their own nodes). */
export const STORAGE_SERVICE_TYPES: ReadonlySet<string> = new Set([
  'microsoft.storage/storageaccounts/blobservices',
  'microsoft.storage/storageaccounts/fileservices',
  'microsoft.storage/storageaccounts/tableservices',
  'microsoft.storage/storageaccounts/queueservices',
]);
