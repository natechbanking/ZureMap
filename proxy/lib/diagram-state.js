let currentDiagramState = null;

const getState = () => currentDiagramState;
const setState = (state) => { currentDiagramState = state; };

function sanitizeForMarkdown(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\|/g, '\\|');
}

function buildMarkdownSummary(state) {
  const { nodes = [], edges = [], subscriptions = [], exportedAt } = state;
  const typeCounts = new Map();
  for (const n of nodes) {
    const resourceType = sanitizeForMarkdown(n.resourceType || 'Unknown');
    typeCounts.set(resourceType, (typeCounts.get(resourceType) ?? 0) + 1);
  }
  const subNames = subscriptions
    .map((s) => sanitizeForMarkdown(s?.name))
    .filter(Boolean)
    .join(', ') || 'Unknown';
  const edgeSummary = edges
    .slice(0, 20)
    .map((e) => {
      const source = sanitizeForMarkdown((e?.sourceId || '').split('/').pop() || 'Unknown');
      const target = sanitizeForMarkdown((e?.targetId || '').split('/').pop() || 'Unknown');
      const edgeType = sanitizeForMarkdown(e?.edgeType || 'Unknown');
      return `- ${source} → ${target} (${edgeType})`;
    })
    .join('\n');
  const costNodes = nodes
    .filter(n => n.costData?.monthlyCostUsd > 0)
    .sort((a, b) => b.costData.monthlyCostUsd - a.costData.monthlyCostUsd)
    .slice(0, 5);
  const costSection = costNodes.length
    ? '\n## Top 5 Costs (Month to Date)\n' + costNodes.map((n, i) => `${i + 1}. ${sanitizeForMarkdown(n.label || 'Unknown')}: $${n.costData.monthlyCostUsd.toFixed(2)}/mo`).join('\n')
    : '';

  return `# ZureMap Diagram Summary
**Subscriptions**: ${subNames}
**Scanned**: ${sanitizeForMarkdown(exportedAt ?? new Date().toISOString())}
**Total nodes**: ${nodes.length} | **Edges**: ${edges.length}

## Resources by Type
| Type | Count |
|---|---|
${Array.from(typeCounts.entries()).map(([t, c]) => `| ${t} | ${c} |`).join('\n')}

## Connections (first 20)
${edgeSummary || 'None'}${costSection}
`;
}

module.exports = { getState, setState, buildMarkdownSummary };
