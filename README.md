# knowledge-graph-explorer
Name-Saumya Baranwal
USN-4NI24CS188
Section-C
## Project Title
**Knowledge Graph Explorer — Directed Graph Visualisation & Pathfinding**

---

## Project Description

Knowledge Graph Explorer is an interactive, browser-based tool for building, visualising, and analysing directed weighted graphs. It is designed as both a learning platform and a practical sandbox for exploring graph theory concepts — from basic node-edge relationships to running Dijkstra's shortest-path algorithm in real time.

The project ships with a pre-loaded AI/ML knowledge graph as a working demo, and offers a separate blank-canvas mode where users can construct entirely custom graphs from scratch. All graph manipulation, layout, and pathfinding runs entirely in the browser — no server, no backend, no installation required.

### Core Features

**Explorer Tab (Default Graph)**
- Pre-loaded 12-node, 12-edge knowledge graph covering Artificial Intelligence, Machine Learning, Deep Learning, NLP, Computer Vision, tools like TensorFlow and PyTorch, and more.
- Add new nodes (with category: Core, Method, Application, Tool) and directed edges (with relation type and numeric weight 1–10) on top of the existing graph.
- Click any node to highlight its direct connections and view an inline detail card showing in-degree, out-degree, and all incoming/outgoing relationships.
- Run Dijkstra's algorithm between any two nodes: the shortest path is highlighted visually on the graph and displayed as a readable label trail with total cost.
- Export the current graph state as a JSON file.

**Build Graph Tab (Blank Canvas)**
- Fully independent blank canvas, completely separate from the Explorer graph.
- Identical feature set: add nodes, add edges, click-to-inspect, Dijkstra pathfinding, and JSON export.
- Visually distinct amber/orange theme to clearly differentiate it from the default graph.
- Empty-state prompt guides first-time users to add their first node.

**Concepts Tab**
- Six illustrated concept cards covering Directed Graphs, Weighted Edges, BFS & DFS, Dijkstra's Algorithm, In/Out-degree, and Cycles & DAGs.
- A step-by-step Dijkstra walkthrough with pseudocode examples.

**Quiz Tab**
- Randomised multiple-choice quiz drawn from the edges of whichever graph (Explorer or Scratch) has more edges.
- Tests the user's knowledge of relationship types between node pairs.
- Live score tracker with correct/incorrect feedback per question.

**Applications Tab**
- Six real-world use-case cards covering Google Knowledge Graph, Drug Interaction Networks, Recommendation Systems, Fraud Detection, Navigation & Route Planning, and Curriculum Design.

### Technology Stack

| Layer | Technology |
|---|---|
| Graph rendering & physics | D3.js v7 (force-directed simulation) |
| UI / Layout | Vanilla HTML5 + CSS3 (CSS custom properties) |
| Logic | Vanilla JavaScript (ES6+) |
| Fonts | Space Mono (display/mono) · DM Sans (body) via Google Fonts |
| No build step | Single self-contained HTML file |

---

## How to Run

### Option 1 — Open Directly in a Browser (Simplest)

1. Download or save the file `knowledge-graph-explorer.html`.
2. Double-click it to open it in any modern browser (Chrome, Firefox, Edge, Safari).
3. The app loads immediately with the default AI/ML graph pre-populated.

> **Note:** This works because all logic is client-side JavaScript. There is no build step, no `npm install`, and no server required.

### Option 2 — Serve via a Local HTTP Server (Recommended for Development)

Opening the file directly via `file://` works in most browsers, but if you plan to extend or modify the project, a local server avoids potential CORS issues with future asset loading.

**Using Python (built into macOS/Linux):**
```bash
# Python 3
python3 -m http.server 8080

# Then open in browser:
# http://localhost:8080/knowledge-graph-explorer.html
```

**Using Node.js (npx):**
```bash
npx serve .

# Then open the URL shown in the terminal
```

**Using VS Code:**
Install the **Live Server** extension, right-click `knowledge-graph-explorer.html`, and select "Open with Live Server".

### Option 3 — Deploy to a Static Host

Because the project is a single HTML file with no backend, it can be deployed to any static hosting provider:

- **GitHub Pages** — push the file to a repo and enable Pages.
- **Netlify / Vercel** — drag and drop the HTML file into their deploy UI.
- **Any web server** — place the file in the server's public directory.

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 90+ | ✓ Full support |
| Firefox 88+ | ✓ Full support |
| Edge 90+ | ✓ Full support |
| Safari 14+ | ✓ Full support |
| Internet Explorer | ✗ Not supported |

---

## Project Structure

```
knowledge-graph-explorer.html   ← Entire application (single file)
knowledge-graph-project-doc.md  ← This document
```

The application is intentionally self-contained in one file. If you choose to separate concerns, the natural split is:

```
index.html     ← markup only
style.css      ← all CSS custom properties and component styles
script.js      ← D3 engine factory, graph state, Dijkstra, quiz logic
```

---

## Extending the Project

**Adding a new edge relation type:**
1. Add the new type string to `ALL_TYPES` and `EDGE_COLORS` in the script.
2. Add a corresponding CSS variable and `.swatch` class in the styles.
3. Add a `<option>` to the `edgeType` and `sEdgeType` selects.
4. Add a legend item in both sidebar Legend panels.

**Loading a custom graph from JSON:**
The exported JSON format is:
```json
{
  "nodes": [{ "id": 1, "label": "Node Name", "category": "core" }],
  "edges": [{ "id": 1, "source": 1, "target": 2, "type": "includes", "weight": 3 }]
}
```
You can parse this and replace the `nodes`/`edges` arrays, then call `eRender()` or `sRender()`.
