/* ════════════════════════════════════════════════
   KNOWLEDGE GRAPH EXPLORER  –  script.js
   Full implementation:
     • D3 force-directed graph with zoom/drag
     • Directed edges with arrowhead markers
     • Weighted, colour-coded relationships
     • Click-to-highlight connected nodes
     • Dijkstra's algorithm (shortest path) — full path + visual highlight
     • Build Graph From Scratch mode
     • Quiz engine
     • JSON export
════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   1. DATA MODEL
══════════════════════════════════════════ */
let nodes = [];   // { id, label, category }
let edges = [];   // { id, source, target, type, weight }
let nodeIdCounter = 1;
let edgeIdCounter = 1;

/* ── Edge colour map (matches CSS variables) ── */
const EDGE_COLORS = {
  is_a:     '#00d4ff',
  includes: '#00e5a0',
  uses:     '#ffb547',
  leads_to: '#ff5fa0',
  part_of:  '#a78bfa',
};

/* ── Node category colour map ── */
const CAT_COLORS = {
  core:        '#00d4ff',
  method:      '#00e5a0',
  application: '#ffb547',
  tool:        '#a78bfa',
};

/* ══════════════════════════════════════════
   2. D3 SETUP
══════════════════════════════════════════ */
const svg = d3.select('#graphSvg');
let width  = 0;
let height = 0;

/* ── Zoom behaviour ── */
const zoomBehaviour = d3.zoom()
  .scaleExtent([0.2, 4])
  .on('zoom', e => container.attr('transform', e.transform));

svg.call(zoomBehaviour);

/* ── Root container (transformed by zoom) ── */
const container = svg.append('g').attr('class', 'zoom-container');

/* ── Arrow marker defs (one per edge type) ── */
const defs = svg.append('defs');

function ensureMarker(type) {
  const id = `arrow-${type}`;
  if (defs.select(`#${id}`).empty()) {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', EDGE_COLORS[type] || '#888');
  }
}

Object.keys(EDGE_COLORS).forEach(ensureMarker);

/* ── D3 layer groups (order matters for z-index) ── */
const linkGroup  = container.append('g').attr('class', 'links');
const nodeGroup  = container.append('g').attr('class', 'nodes');
const labelGroup = container.append('g').attr('class', 'labels');

/* ── Force simulation ── */
let simulation = d3.forceSimulation()
  .force('link',   d3.forceLink().id(d => d.id).distance(130).strength(0.6))
  .force('charge', d3.forceManyBody().strength(-400))
  .force('center', d3.forceCenter())
  .force('collide', d3.forceCollide(40))
  .on('tick', ticked);

/* ══════════════════════════════════════════
   3. RENDER ENGINE
══════════════════════════════════════════ */
let linkSel  = linkGroup.selectAll('.link-line');
let nodeSel  = nodeGroup.selectAll('.node-g');
let labelSel = labelGroup.selectAll('.node-label');
let selectedNodeId = null;

function render() {
  /* ── Resize / re-center ── */
  const rect = document.getElementById('graphSvg').getBoundingClientRect();
  width  = rect.width  || 800;
  height = rect.height || 600;

  simulation.force('center', d3.forceCenter(width / 2, height / 2));

  /* ── Links ── */
  linkSel = linkGroup.selectAll('.link-line')
    .data(edges, d => d.id);

  linkSel.exit().remove();

  const linkEnter = linkSel.enter().append('line')
    .attr('class', 'link-line')
    .attr('marker-end', d => `url(#arrow-${d.type})`)
    .style('stroke', d => EDGE_COLORS[d.type] || '#888')
    .style('stroke-width', d => 1 + (d.weight / 5))
    .on('mouseover', showEdgeTooltip)
    .on('mouseout',  hideTooltip);

  linkSel = linkEnter.merge(linkSel);

  /* ── Edge weight label ── */
  labelGroup.selectAll('.edge-label').remove();
  if (edges.length < 60) {
    labelGroup.selectAll('.edge-label')
      .data(edges, d => d.id)
      .enter().append('text')
        .attr('class', 'edge-label')
        .text(d => d.weight > 1 ? d.weight : '');
  }

  /* ── Nodes (group = circle + label) ── */
  nodeSel = nodeGroup.selectAll('.node-g')
    .data(nodes, d => d.id);

  nodeSel.exit().remove();

  const nodeEnter = nodeSel.enter().append('g')
    .attr('class', 'node-g')
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag',  dragged)
      .on('end',   dragEnded))
    .on('click',     onNodeClick)
    .on('mouseover', showNodeTooltip)
    .on('mouseout',  hideTooltip);

  nodeEnter.append('circle')
    .attr('class', 'node-circle')
    .attr('r', 18)
    .style('fill',   d => CAT_COLORS[d.category] + '22')
    .style('stroke', d => CAT_COLORS[d.category] || '#888')
    .style('color',  d => CAT_COLORS[d.category] || '#888');

  nodeEnter.append('text')
    .attr('class', 'node-label')
    .attr('dy', '32px')
    .text(d => d.label);

  nodeSel = nodeEnter.merge(nodeSel);

  /* ── Update existing circles (category might have changed) ── */
  nodeSel.select('circle')
    .style('fill',   d => CAT_COLORS[d.category] + '22')
    .style('stroke', d => CAT_COLORS[d.category] || '#888');

  nodeSel.select('text').text(d => d.label);

  /* ── Restart simulation ── */
  simulation
    .nodes(nodes)
    .force('link').links(edges);

  simulation.alpha(0.4).restart();

  updateStats();
  updateSelects();
}

/* ── Tick handler: update positions ── */
function ticked() {
  linkSel
    .attr('x1', d => d.source.x)
    .attr('y1', d => d.source.y)
    .attr('x2', d => d.target.x)
    .attr('y2', d => d.target.y);

  nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);

  /* edge weight labels */
  labelGroup.selectAll('.edge-label')
    .attr('x', d => (d.source.x + d.target.x) / 2)
    .attr('y', d => (d.source.y + d.target.y) / 2);
}

/* ══════════════════════════════════════════
   4. DRAG HANDLERS
══════════════════════════════════════════ */
function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x; d.fy = d.y;
}
function dragged(event, d) {
  d.fx = event.x; d.fy = event.y;
}
function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null; d.fy = null;
}

/* ══════════════════════════════════════════
   5. NODE CLICK — HIGHLIGHT CONNECTIONS
══════════════════════════════════════════ */
function onNodeClick(event, d) {
  event.stopPropagation();

  if (selectedNodeId === d.id) {
    clearHighlight();
    closeNodeDetail();
    return;
  }

  selectedNodeId = d.id;

  /* Build set of directly connected node IDs */
  const connected = new Set([d.id]);
  const connectedEdges = new Set();

  edges.forEach(e => {
    const srcId = e.source.id ?? e.source;
    const tgtId = e.target.id ?? e.target;
    if (srcId === d.id || tgtId === d.id) {
      connected.add(srcId);
      connected.add(tgtId);
      connectedEdges.add(e.id);
    }
  });

  /* Apply highlight / dim classes */
  nodeSel.select('circle')
    .classed('highlighted', nd => nd.id === d.id)
    .classed('dimmed',      nd => !connected.has(nd.id));

  linkSel
    .classed('highlighted', ed => connectedEdges.has(ed.id))
    .classed('dimmed',      ed => !connectedEdges.has(ed.id));

  showNodeDetail(d);
}

/* ── Click on empty space → clear ── */
svg.on('click', () => { clearHighlight(); closeNodeDetail(); });

function clearHighlight() {
  selectedNodeId = null;
  nodeSel.select('circle').classed('highlighted', false).classed('dimmed', false).classed('path-node', false);
  linkSel.classed('highlighted', false).classed('dimmed', false).classed('path-edge', false);
  document.getElementById('pathResult').classList.add('hidden');
}

/* ══════════════════════════════════════════
   6. NODE DETAIL CARD
══════════════════════════════════════════ */
function showNodeDetail(d) {
  const card = document.getElementById('nodeDetail');
  document.getElementById('detailName').textContent = d.label;

  const badge = document.getElementById('detailCategory');
  badge.textContent = d.category;
  badge.className = `detail-badge badge-${d.category}`;

  const outgoing = edges.filter(e => (e.source.id ?? e.source) === d.id);
  const incoming = edges.filter(e => (e.target.id ?? e.target) === d.id);

  const getLabel = id => (nodes.find(n => n.id === id) || {}).label || id;

  const outList = document.getElementById('detailOut');
  outList.innerHTML = outgoing.length
    ? outgoing.map(e => `<li><span>${getLabel(e.target.id ?? e.target)}</span> — ${e.type} (w:${e.weight})</li>`).join('')
    : '<li style="color:var(--text-dim)">none</li>';

  const inList = document.getElementById('detailIn');
  inList.innerHTML = incoming.length
    ? incoming.map(e => `<li><span>${getLabel(e.source.id ?? e.source)}</span> — ${e.type} (w:${e.weight})</li>`).join('')
    : '<li style="color:var(--text-dim)">none</li>';

  /* Delete button */
  const delBtn = document.getElementById('detailDeleteBtn');
  delBtn.onclick = () => deleteNode(d.id);

  card.classList.remove('hidden');
}

function closeNodeDetail() {
  document.getElementById('nodeDetail').classList.add('hidden');
}

/* ══════════════════════════════════════════
   7. TOOLTIPS
══════════════════════════════════════════ */
const tooltip = document.getElementById('tooltip');

function showNodeTooltip(event, d) {
  const inDeg  = edges.filter(e => (e.target.id ?? e.target) === d.id).length;
  const outDeg = edges.filter(e => (e.source.id ?? e.source) === d.id).length;
  tooltip.innerHTML = `
    <strong>${d.label}</strong><br/>
    Category: ${d.category}<br/>
    In-degree: ${inDeg} &nbsp; Out-degree: ${outDeg}
  `;
  positionTooltip(event);
}

function showEdgeTooltip(event, d) {
  const src = (d.source.label ?? d.source);
  const tgt = (d.target.label ?? d.target);
  tooltip.innerHTML = `
    <strong>${src}</strong> → <strong>${tgt}</strong><br/>
    Type: ${d.type.replace('_', ' ')}<br/>
    Weight: ${d.weight}
  `;
  positionTooltip(event);
}

function positionTooltip(event) {
  const svgRect = document.getElementById('graphSvg').getBoundingClientRect();
  tooltip.style.left = (event.clientX - svgRect.left + 12) + 'px';
  tooltip.style.top  = (event.clientY - svgRect.top  - 12) + 'px';
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

/* ══════════════════════════════════════════
   8. ADD / DELETE NODES & EDGES
══════════════════════════════════════════ */
function addNode() {
  const label    = document.getElementById('nodeLabel').value.trim();
  const category = document.getElementById('nodeCategory').value;

  if (!label) { alert('Please enter a concept name.'); return; }
  if (nodes.find(n => n.label.toLowerCase() === label.toLowerCase())) {
    alert('A node with this name already exists.'); return;
  }

  nodes.push({ id: nodeIdCounter++, label, category });
  document.getElementById('nodeLabel').value = '';
  render();
}

function addEdge() {
  const fromId  = parseInt(document.getElementById('edgeFrom').value);
  const toId    = parseInt(document.getElementById('edgeTo').value);
  const type    = document.getElementById('edgeType').value;
  const weight  = parseInt(document.getElementById('edgeWeight').value) || 1;

  if (!fromId || !toId)       { alert('Select both source and target nodes.'); return; }
  if (fromId === toId)        { alert('Self-loops are not allowed.'); return; }
  if (edges.find(e =>
    (e.source.id ?? e.source) === fromId &&
    (e.target.id ?? e.target) === toId &&
    e.type === type)) {
    alert('This relationship already exists.'); return;
  }

  edges.push({ id: edgeIdCounter++, source: fromId, target: toId, type, weight });
  render();
}

function deleteNode(id) {
  nodes = nodes.filter(n => n.id !== id);
  edges = edges.filter(e => {
    const src = e.source.id ?? e.source;
    const tgt = e.target.id ?? e.target;
    return src !== id && tgt !== id;
  });
  closeNodeDetail();
  clearHighlight();
  render();
}

/* ══════════════════════════════════════════
   9. DIJKSTRA'S ALGORITHM
══════════════════════════════════════════ */
function dijkstra(startId, endId) {
  /* Build adjacency list */
  const adj = {};
  nodes.forEach(n => { adj[n.id] = []; });

  edges.forEach(e => {
    const src = e.source.id ?? e.source;
    const tgt = e.target.id ?? e.target;
    adj[src].push({ to: tgt, weight: e.weight });
  });

  /* Initialise distances */
  const dist = {};
  const prev = {};
  const visited = new Set();

  nodes.forEach(n => { dist[n.id] = Infinity; prev[n.id] = null; });
  dist[startId] = 0;

  /* Simple priority queue (array-based for clarity) */
  const pq = [{ id: startId, cost: 0 }];

  while (pq.length > 0) {
    /* Extract minimum */
    pq.sort((a, b) => a.cost - b.cost);
    const { id: u } = pq.shift();

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === endId) break;

    for (const { to: v, weight: w } of (adj[u] || [])) {
      if (visited.has(v)) continue;
      const newDist = dist[u] + w;
      if (newDist < dist[v]) {
        dist[v] = newDist;
        prev[v] = u;
        pq.push({ id: v, cost: newDist });
      }
    }
  }

  /* Reconstruct path */
  if (dist[endId] === Infinity) return null;

  const path = [];
  let cur = endId;
  while (cur !== null) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return { path, cost: dist[endId] };
}

function findShortestPath() {
  const fromId = parseInt(document.getElementById('pathFrom').value);
  const toId   = parseInt(document.getElementById('pathTo').value);
  const resultEl = document.getElementById('pathResult');

  if (!fromId || !toId) { alert('Select start and end nodes.'); return; }
  if (fromId === toId)  { alert('Start and end must be different.'); return; }

  /* Clear previous highlight state */
  nodeSel.select('circle')
    .classed('highlighted', false)
    .classed('dimmed', false)
    .classed('path-node', false);
  linkSel
    .classed('highlighted', false)
    .classed('dimmed', false)
    .classed('path-edge', false);
  selectedNodeId = null;

  const result = dijkstra(fromId, toId);

  if (!result) {
    resultEl.textContent = '✗ No path found between these nodes.';
    resultEl.className = 'path-result error';
    resultEl.classList.remove('hidden');
    return;
  }

  /* ── Build readable path string ── */
  const getLabel = id => (nodes.find(n => n.id === id) || {}).label || id;
  const pathLabels = result.path.map(getLabel).join(' → ');

  resultEl.textContent = `✓ Shortest Path (Cost ${result.cost}):\n${pathLabels}`;
  resultEl.className = 'path-result';
  resultEl.classList.remove('hidden');

  /* ── Highlight path nodes ── */
  const pathSet = new Set(result.path);

  nodeSel.select('circle')
    .classed('dimmed',     d => !pathSet.has(d.id))
    .classed('path-node',  d => pathSet.has(d.id));

  /* ── Highlight path edges ── */
  const pathEdgeIds = new Set();
  for (let i = 0; i < result.path.length - 1; i++) {
    const a = result.path[i];
    const b = result.path[i + 1];
    const e = edges.find(ed => {
      const s = ed.source.id ?? ed.source;
      const t = ed.target.id ?? ed.target;
      return s === a && t === b;
    });
    if (e) pathEdgeIds.add(e.id);
  }

  linkSel
    .classed('dimmed',    ed => !pathEdgeIds.has(ed.id))
    .classed('path-edge', ed => pathEdgeIds.has(ed.id));
}

/* ══════════════════════════════════════════
   10. UI HELPERS
══════════════════════════════════════════ */
function updateSelects() {
  const selects = ['edgeFrom', 'edgeTo', 'pathFrom', 'pathTo'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = '<option value="">— select —</option>';
    nodes.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n.id;
      opt.textContent = n.label;
      sel.appendChild(opt);
    });
    if (nodes.find(n => n.id == cur)) sel.value = cur;
  });
}

function updateStats() {
  document.getElementById('graphStats').textContent =
    `Nodes: ${nodes.length} · Edges: ${edges.length}`;
}

/* ── Tab switching ── */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab === 'explorer') { resizeSvg(); }
  });
});

/* ── SVG resize observer ── */
function resizeSvg() {
  const rect = document.getElementById('graphSvg').getBoundingClientRect();
  if (rect.width) {
    width  = rect.width;
    height = rect.height;
    simulation.force('center', d3.forceCenter(width / 2, height / 2));
    simulation.alpha(0.1).restart();
  }
}

const ro = new ResizeObserver(() => resizeSvg());
ro.observe(document.getElementById('graphSvg'));

/* ══════════════════════════════════════════
   11. SAMPLE DATA
══════════════════════════════════════════ */
function loadSampleData() {
  resetGraph(false);

  /* Nodes */
  const raw = [
    { id: 1, label: 'Artificial Intelligence', category: 'core' },
    { id: 2, label: 'Machine Learning',        category: 'core' },
    { id: 3, label: 'Deep Learning',           category: 'method' },
    { id: 4, label: 'Neural Networks',         category: 'method' },
    { id: 5, label: 'NLP',                     category: 'application' },
    { id: 6, label: 'Computer Vision',         category: 'application' },
    { id: 7, label: 'Reinforcement Learning',  category: 'method' },
    { id: 8, label: 'TensorFlow',              category: 'tool' },
    { id: 9, label: 'PyTorch',                 category: 'tool' },
    { id:10, label: 'Supervised Learning',     category: 'method' },
    { id:11, label: 'Unsupervised Learning',   category: 'method' },
    { id:12, label: 'Data Science',            category: 'core' },
  ];

  const rawEdges = [
    { id:1,  source:1, target:2,  type:'includes', weight:1 },
    { id:2,  source:2, target:3,  type:'includes', weight:1 },
    { id:3,  source:3, target:4,  type:'uses',     weight:1 },
    { id:4,  source:2, target:10, type:'includes', weight:2 },
    { id:5,  source:2, target:11, type:'includes', weight:2 },
    { id:6,  source:2, target:7,  type:'includes', weight:3 },
    { id:7,  source:3, target:5,  type:'leads_to', weight:2 },
    { id:8,  source:3, target:6,  type:'leads_to', weight:2 },
    { id:9,  source:4, target:8,  type:'uses',     weight:1 },
    { id:10, source:4, target:9,  type:'uses',     weight:1 },
    { id:11, source:1, target:12, type:'is_a',     weight:2 },
    { id:12, source:12,target:2,  type:'includes', weight:1 },
  ];

  nodes = raw;
  edges = rawEdges;
  nodeIdCounter = 20;
  edgeIdCounter = 20;

  render();
}

/* ══════════════════════════════════════════
   12. BUILD FROM SCRATCH
══════════════════════════════════════════ */
function buildFromScratch() {
  const confirmed = confirm(
    'This will clear all nodes and edges so you can build a new graph from scratch.\n\nAre you sure?'
  );
  if (!confirmed) return;

  /* Full reset */
  nodes = [];
  edges = [];
  nodeIdCounter = 1;
  edgeIdCounter = 1;

  /* Clear all visual state */
  clearHighlight();
  closeNodeDetail();

  /* Hide path result */
  const pathResult = document.getElementById('pathResult');
  pathResult.textContent = '';
  pathResult.classList.add('hidden');

  render();
}

/* ══════════════════════════════════════════
   13. RESET & EXPORT
══════════════════════════════════════════ */
function resetGraph(doRender = true) {
  nodes = [];
  edges = [];
  nodeIdCounter = 1;
  edgeIdCounter = 1;
  clearHighlight();
  closeNodeDetail();
  if (doRender) render();
}

function exportJSON() {
  const data = {
    nodes: nodes.map(({ id, label, category }) => ({ id, label, category })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source.id ?? e.source,
      target: e.target.id ?? e.target,
      type: e.type,
      weight: e.weight,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'knowledge-graph.json';
  a.click();
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   14. QUIZ ENGINE
══════════════════════════════════════════ */
let quizScore = 0;
let quizTotal = 0;
let currentQuestion = null;
let quizAnswered = false;

const ALL_TYPES = ['is_a', 'includes', 'uses', 'leads_to', 'part_of'];

function startQuiz() {
  quizScore = 0;
  quizTotal = 0;
  document.getElementById('quizScore').textContent = quizScore;
  document.getElementById('quizTotal').textContent = quizTotal;
  currentQuestion = null;
  nextQuestion();
}

function nextQuestion() {
  const edgePool = edges.filter(e => nodes.length > 0);
  if (edgePool.length === 0) {
    document.getElementById('quizPrompt').textContent =
      'No edges in the graph yet. Load sample data and come back!';
    document.getElementById('quizOptions').innerHTML = '';
    document.getElementById('quizFeedback').classList.add('hidden');
    return;
  }

  quizAnswered = false;
  document.getElementById('quizFeedback').classList.add('hidden');

  /* Pick a random edge */
  const edge = edgePool[Math.floor(Math.random() * edgePool.length)];
  const srcLabel = (nodes.find(n => n.id === (edge.source.id ?? edge.source)) || {}).label || '?';
  const tgtLabel = (nodes.find(n => n.id === (edge.target.id ?? edge.target)) || {}).label || '?';
  const correct = edge.type;

  currentQuestion = { edge, correct };

  document.getElementById('quizPrompt').textContent =
    `What is the relationship type from  "${srcLabel}"  →  "${tgtLabel}" ?`;

  /* Build options: correct + 3 distractors */
  const others = ALL_TYPES.filter(t => t !== correct);
  const shuffle = arr => arr.sort(() => Math.random() - 0.5);
  const options = shuffle([correct, ...shuffle(others).slice(0, 3)]);

  const container = document.getElementById('quizOptions');
  container.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option-btn';
    btn.textContent = opt.replace('_', ' ');
    btn.addEventListener('click', () => handleAnswer(opt, btn));
    container.appendChild(btn);
  });
}

function handleAnswer(chosen, btn) {
  if (quizAnswered || !currentQuestion) return;
  quizAnswered = true;
  quizTotal++;

  const correct = currentQuestion.correct;
  const isRight = chosen === correct;

  if (isRight) {
    quizScore++;
    btn.classList.add('correct');
  } else {
    btn.classList.add('wrong');
    /* Highlight the correct answer */
    document.querySelectorAll('.quiz-option-btn').forEach(b => {
      if (b.textContent === correct.replace('_', ' ')) b.classList.add('correct');
    });
  }

  /* Disable all buttons */
  document.querySelectorAll('.quiz-option-btn').forEach(b => b.disabled = true);

  const fb = document.getElementById('quizFeedback');
  fb.textContent = isRight ? '✓ Correct!' : `✗ Wrong — the answer is "${correct.replace('_', ' ')}"`;
  fb.className = `quiz-feedback ${isRight ? 'correct-fb' : 'wrong-fb'}`;
  fb.classList.remove('hidden');

  document.getElementById('quizScore').textContent = quizScore;
  document.getElementById('quizTotal').textContent = quizTotal;
}

/* ══════════════════════════════════════════
   15. INITIALISE
══════════════════════════════════════════ */
window.addEventListener('load', () => {
  resizeSvg();
  render();
  /* Auto-load sample data on first open */
  loadSampleData();
});
