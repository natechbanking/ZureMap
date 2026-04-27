let currentDiagramState = null;

const getState = () => currentDiagramState;
const setState = (state) => { currentDiagramState = state; };

function buildMarkdownSummary(state) {
  const { nodes = [], edges = [], subscriptions = [], exportedAt } = state;
  const typeCounts = {};
  for (const n of nodes) {
    typeCounts[n.resourceType] = (typeCounts[n.resourceType] ?? 0) + 1;
  }
  const subNames = subscriptions.map(s => s.name).join(', ') || 'Unknown';
  const edgeSummary = edges
    .slice(0, 20)
    .map(e => `- ${e.sourceId.split('/').pop()} → ${e.targetId.split('/').pop()} (${e.edgeType})`)
    .join('\n');
  const costNodes = nodes
    .filter(n => n.costData?.monthlyCostUsd > 0)
    .sort((a, b) => b.costData.monthlyCostUsd - a.costData.monthlyCostUsd)
    .slice(0, 5);
  const costSection = costNodes.length
    ? '\n## Top 5 Costs (Month to Date)\n' + costNodes.map((n, i) => `${i + 1}. ${n.label}: $${n.costData.monthlyCostUsd.toFixed(2)}/mo`).join('\n')
    : '';

  return `# ZureMap Diagram Summary
**Subscriptions**: ${subNames}
**Scanned**: ${exportedAt ?? new Date().toISOString()}
**Total nodes**: ${nodes.length} | **Edges**: ${edges.length}

## Resources by Type
| Type | Count |
|---|---|
${Object.entries(typeCounts).map(([t, c]) => `| ${t} | ${c} |`).join('\n')}

## Connections (first 20)
${edgeSummary || 'None'}${costSection}
`;
}

module.exports = { getState, setState, buildMarkdownSummary };
