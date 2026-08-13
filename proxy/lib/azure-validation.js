const ARM_TOKEN_RESOURCE = 'https://management.azure.com/';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_PATTERN.test(value);
}

function isArmTokenResource(value) {
  return value === ARM_TOKEN_RESOURCE;
}

module.exports = { ARM_TOKEN_RESOURCE, isUuid, isArmTokenResource };
