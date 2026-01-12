// This script runs on the NotebookLM (or any) page

declare var chrome: any;

console.log("NotebookLM Mind Map Studio Content Script Loaded");

// --- 1. Text Selection Parsing (Enhanced for Markdown/Indentation) ---
const parseTextStructure = (text: string) => {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return null;

  const virtualRoot = { name: "Root", children: [] as any[] };
  // Stack stores objects { level: number, node: Node }
  const stack = [{ level: -1, node: virtualRoot }];

  const detectIndentLevel = (line: string): number => {
    // 1. Check for Markdown Headers (#)
    const headerMatch = line.match(/^(#+)\s/);
    if (headerMatch) {
      return headerMatch[1].length - 1; // # = level 0
    }

    // 2. Check for indentation (spaces/tabs) with list markers
    // Count leading spaces
    const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
    // Count leading tabs
    const leadingTabs = (line.match(/^\t*/)?.[0].length || 0);

    if (leadingTabs > 0) return leadingTabs;
    return Math.floor(leadingSpaces / 2); // Assume 2 spaces per indent
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let level = detectIndentLevel(line);
    
    // Clean the text: remove bullets, numbers, headers
    const cleanName = line
      .replace(/^[#]+\s/, '')        // Remove headers
      .replace(/^[\s\t]*[-*+]\s/, '') // Remove bullets (- * +)
      .replace(/^[\s\t]*\d+\.\s/, '') // Remove numbering (1. )
      .trim();

    if (!cleanName) continue;

    const newNode = { name: cleanName, children: [] };

    // Backtrack stack to find the correct parent
    // If current level is same or less than top of stack, pop until we find a parent with strictly lower level
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);

    stack.push({ level, node: newNode });
  }

  // Return logic
  if (virtualRoot.children.length === 1 && virtualRoot.children[0].children && virtualRoot.children[0].children.length > 0) {
    return virtualRoot.children[0];
  }
  if (virtualRoot.children.length > 1) {
    return { name: "選択したメモ", children: virtualRoot.children };
  }
  return virtualRoot.children[0] || { name: "No Content", children: [] };
};

// --- 2. Header Parsing (Fallback) ---
const scrapeHeaders = () => {
  const root: any = { name: document.title.replace(" - NotebookLM", "").trim() || "Web Page", children: [] };
  const stack: any[] = [{ level: 0, node: root }];
  const contentArea = document.querySelector('main') || document.body;
  const headers = contentArea.querySelectorAll('h1, h2, h3, h4');
  
  if (headers.length === 0) return null;

  headers.forEach((header) => {
    const tagName = header.tagName.toLowerCase();
    const level = parseInt(tagName.replace('h', ''));
    const text = (header as HTMLElement).innerText.trim();
    if (!text || text.length > 150) return;

    const newNode = { name: text, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    const parent = stack.length > 0 ? stack[stack.length - 1].node : root;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);
    stack.push({ level, node: newNode });
  });

  if (!root.children || root.children.length === 0) return null;
  return root;
};

// --- 3. Visual Graph Scraping (Hybrid: Edges + Spatial) ---
const scrapeVisualGraph = () => {
  console.log("Attempting Hybrid Visual Scraping...");

  interface NodeCandidate {
    id: number;
    text: string;
    x: number; // Center X
    y: number; // Center Y
    width: number;
    height: number;
    left: number;
    top: number;
    element: Element;
  }

  // A. Collect Nodes
  const candidatesMap = new Map<string, NodeCandidate>();
  let idCounter = 0;

  const isGarbage = (text: string) => {
    const t = text.trim();
    if (t.length === 0) return true;
    if (/^([<>+\-●•]|\d+)$/.test(t)) return true; 
    return false;
  };

  const processElement = (el: Element) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; 

    // Visual filtering
    const style = window.getComputedStyle(el);
    const opacity = parseFloat(style.opacity);
    if (style.visibility === 'hidden' || style.display === 'none' || opacity < 0.1) return;

    const fontSize = parseFloat(style.fontSize);
    if (rect.height < 10 && fontSize < 10) return;

    let text = "";
    if (el.tagName.toLowerCase() === 'text') {
        text = el.textContent?.trim() || "";
    } else {
        text = el.textContent?.trim() || "";
    }

    if (text && text.length < 300 && !isGarbage(text)) {
        // Use position+text as key to dedupe
        const key = `${Math.round(rect.left)}-${Math.round(rect.top)}-${text}`;
        if (!candidatesMap.has(key)) {
            candidatesMap.set(key, { 
                id: idCounter++,
                text, 
                x: rect.left + rect.width / 2, 
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                element: el
            });
        }
    }
  };

  document.querySelectorAll('svg text').forEach(processElement);
  document.querySelectorAll(
      'main .react-flow__node, main .node, [role="main"] div[style*="absolute"], [role="main"] div[style*="transform"]'
  ).forEach(el => {
      const htmlEl = el as HTMLElement;
      // If it has direct text, use it. If it has a child that was already picked up, skip?
      // Simple heuristic: if it has text content and no child text nodes that are large.
      const textNode = htmlEl.innerText ? htmlEl : htmlEl.querySelector('div, span, p');
      if (textNode) processElement(textNode);
  });

  const candidates = Array.from(candidatesMap.values());
  if (candidates.length === 0) return null;

  // B. Detect Edges (The Gold Standard)
  const connections: { source: number, target: number }[] = [];
  const processedPairs = new Set<string>();

  const findClosestNode = (px: number, py: number) => {
      let best = null;
      let minD = Infinity;
      
      // First pass: Check intersection
      for (const node of candidates) {
          if (px >= node.left && px <= node.left + node.width &&
              py >= node.top && py <= node.top + node.height) {
              return node; // Direct hit
          }
      }

      // Second pass: Proximity
      for (const node of candidates) {
          // Calculate distance to bounding box
          const dx = Math.max(node.left - px, 0, px - (node.left + node.width));
          const dy = Math.max(node.top - py, 0, py - (node.top + node.height));
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (dist < minD) {
              minD = dist;
              best = node;
          }
      }
      
      // Threshold for "connection" - if the line ends too far from any node, it's noise
      if (minD > 100) return null;
      return best;
  };

  document.querySelectorAll('svg path').forEach(path => {
      const svgPath = path as SVGGeometryElement;
      
      // Heuristic: Edges are usually strokes with no fill
      const style = window.getComputedStyle(path);
      if (style.fill !== 'none' && style.fill !== 'transparent' && !style.fill.includes('rgba(0, 0, 0, 0)')) {
          // Some arrows might be filled, but usually connection lines are not.
          // Let's be permissive but careful.
      }
      
      // Skip if it looks like an icon
      const box = path.getBoundingClientRect();
      if (box.width < 10 && box.height < 10) return;

      try {
          if (svgPath.getTotalLength) {
              const len = svgPath.getTotalLength();
              if (len > 5) {
                  // Get start and end points in Screen Coordinates
                  const ctm = svgPath.getScreenCTM();
                  if (!ctm) return;

                  const pStart = svgPath.getPointAtLength(0).matrixTransform(ctm);
                  const pEnd = svgPath.getPointAtLength(len).matrixTransform(ctm);

                  const startNode = findClosestNode(pStart.x, pStart.y);
                  const endNode = findClosestNode(pEnd.x, pEnd.y);

                  if (startNode && endNode && startNode.id !== endNode.id) {
                      const pairKey = [startNode.id, endNode.id].sort().join('-');
                      if (!processedPairs.has(pairKey)) {
                          // Determine direction based on X axis (Left -> Right)
                          if (startNode.x < endNode.x) {
                              connections.push({ source: startNode.id, target: endNode.id });
                          } else {
                              connections.push({ source: endNode.id, target: startNode.id });
                          }
                          processedPairs.add(pairKey);
                      }
                  }
              }
          }
      } catch (e) {
          // Path operations can fail
      }
  });

  console.log(`Found ${candidates.length} nodes and ${connections.length} explicit connections.`);

  // C. Build Graph
  const adjacency = new Map<number, number[]>(); // Parent -> Children
  const hasParent = new Set<number>();

  // Add explicit connections
  connections.forEach(({ source, target }) => {
      if (!adjacency.has(source)) adjacency.set(source, []);
      adjacency.get(source)?.push(target);
      hasParent.add(target);
  });

  // D. Fallback for disconnected nodes (Spatial Heuristic)
  // Sort candidates by X
  candidates.sort((a, b) => a.x - b.x);

  // If node has no parent (and is not the leftmost root), try to attach it
  // Skip the very first node (assumed overall root)
  for (let i = 1; i < candidates.length; i++) {
      const current = candidates[i];
      if (hasParent.has(current.id)) continue;

      // Find best spatial parent
      let bestParent = null;
      let minMetric = Infinity;

      for (let j = 0; j < i; j++) {
          const potential = candidates[j];
          
          const dx = current.x - potential.x;
          if (dx <= 0) continue; // Must be to the left

          const dy = Math.abs(current.y - potential.y);
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Heuristic: Prefer nodes closer in distance, but heavily penalize vertical distance 
          // to encourage "branch" formation rather than attaching to a far-away vertical root.
          // Also prefer nodes that are closer in X (immediate parent layer).
          const metric = dist + (dy * 0.5); 

          if (metric < minMetric) {
              minMetric = metric;
              bestParent = potential;
          }
      }

      if (bestParent) {
          if (!adjacency.has(bestParent.id)) adjacency.set(bestParent.id, []);
          adjacency.get(bestParent.id)?.push(current.id);
          hasParent.add(current.id);
          console.log(`Spatial fallback: Linked "${current.text}" to "${bestParent.text}"`);
      }
  }

  // E. Construct Tree Object
  // Find the root (node with no parent)
  // In a cyclic graph or messy scrape, just pick the leftmost node that has no parent.
  let rootNode = candidates[0];
  // Ideally find a node that is in candidates but not in hasParent
  const roots = candidates.filter(c => !hasParent.has(c.id));
  if (roots.length > 0) {
      // Pick the leftmost of the roots
      roots.sort((a, b) => a.x - b.x);
      rootNode = roots[0];
  }

  const buildNode = (c: NodeCandidate): any => {
      const childrenIds = adjacency.get(c.id) || [];
      // Sort children by Y for consistent visual order
      const childrenNodes = childrenIds
          .map(id => candidates.find(n => n.id === id))
          .filter(n => n !== undefined) as NodeCandidate[];
      
      childrenNodes.sort((a, b) => a.y - b.y);

      return {
          name: c.text,
          children: childrenNodes.map(buildNode)
      };
  };

  const finalTree = buildNode(rootNode);
  console.log("Final Hybrid Graph:", finalTree);
  return finalTree;
}


// --- Main Entry Point ---
const scrapePageStructure = () => {
  // 1. User Selection
  const selection = window.getSelection();
  const selectedText = selection?.toString();
  
  if (selectedText && selectedText.trim().length > 0) {
    const parsed = parseTextStructure(selectedText);
    if (parsed) return parsed;
  }

  // 2. Visual Graph
  const visualGraph = scrapeVisualGraph();
  if (visualGraph) {
      return visualGraph;
  }

  // 3. Headers
  const headerStructure = scrapeHeaders();
  if (headerStructure) {
      return headerStructure;
  }

  return null;
};

// Listen for messages
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
    
    if (request.action === "GET_DATA") {
      try {
        const scrapedData = scrapePageStructure();
        
        if (scrapedData) {
          sendResponse({ 
            success: true,
            data: scrapedData,
            message: "構造を読み込みました。"
          });
        } else {
          sendResponse({ 
            success: false,
            message: "データが見つかりませんでした。\n\nテキストを選択するか、マインドマップ画面を表示して再試行してください。"
          });
        }
      } catch (e) {
        console.error(e);
        sendResponse({ success: false, message: "解析中にエラーが発生しました。" });
      }
    }

    return true; 
  });
}

// --- 4. Floating Action Button for Auto-Detection ---
const createOverlayButton = () => {
  const existingBtn = document.getElementById('nlm-studio-float-btn');
  
  // Broader check for any graph-like content
  const hasGraphContent = document.querySelector('svg text') !== null || document.querySelector('.react-flow__renderer') !== null;

  if (hasGraphContent) {
    if (!existingBtn) {
      const btn = document.createElement('button');
      btn.id = 'nlm-studio-float-btn';
      btn.innerHTML = `
        <span style="font-size: 18px; margin-right: 6px;">✨</span>
        <span style="font-weight: 600;">Studioで開く</span>
      `;
      // Styles for floating button
      Object.assign(btn.style, {
        position: 'fixed',
        bottom: '180px', // Adjusted to avoid overlap with zoom controls
        right: '24px',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        padding: '10px 16px',
        backgroundColor: '#4f46e5', // Indigo-600
        color: 'white',
        border: 'none',
        borderRadius: '24px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        transition: 'transform 0.2s, background-color 0.2s',
        animation: 'fadeIn 0.3s ease-out'
      });

      // Hover effects
      btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.backgroundColor = '#4338ca'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.backgroundColor = '#4f46e5'; };

      // Click Action
      btn.onclick = () => {
        // Enclose entire handler in try/catch to catch synchronous context invalidation
        try {
          // Safety Check: Is extension context still valid?
          // Sometimes chrome.runtime itself or .id property access throws if context is totally gone
          if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
            alert("拡張機能が更新されました。機能を有効にするために、このページを再読み込み（リロード）してください。");
            return;
          }

          btn.innerHTML = `<span style="font-size: 14px; margin-right: 6px;" class="animate-spin">⌛</span><span style="font-weight: 600;">解析中...</span>`;
          btn.style.opacity = "0.9";
          
          // Give UI a moment to update
          setTimeout(() => {
            try {
              const data = scrapePageStructure();
              if (data) {
                // Send data to background to open in new tab
                chrome.runtime.sendMessage({ 
                    action: "OPEN_STUDIO_TAB", 
                    data: data 
                  }, (response: any) => {
                     // Check for asynchronous error (lastError)
                     const lastError = chrome.runtime.lastError;
                     if (lastError) {
                        console.error("Runtime error:", lastError);
                        alert("拡張機能の接続が切れました。ページをリロードしてください。");
                        // Reset button
                        if(btn) {
                           btn.innerHTML = `<span style="font-size: 18px; margin-right: 6px;">✨</span><span style="font-weight: 600;">Studioで開く</span>`;
                           btn.style.opacity = "1";
                        }
                     }
                  });

                btn.innerHTML = `<span style="margin-right:4px;">✅</span> 完了`;
                setTimeout(() => { 
                    if(btn) {
                        btn.innerHTML = `<span style="font-size: 18px; margin-right: 6px;">✨</span><span style="font-weight: 600;">Studioで開く</span>`;
                        btn.style.opacity = "1";
                    }
                }, 2000);
              } else {
                 btn.innerHTML = `<span style="margin-right:4px;">⚠️</span> 取得失敗`;
                 console.log("Scraping returned null");
                 setTimeout(() => { 
                     if(btn) {
                         btn.innerHTML = `<span style="font-size: 18px; margin-right: 6px;">✨</span><span style="font-weight: 600;">Studioで開く</span>`;
                         btn.style.opacity = "1";
                     }
                 }, 2000);
              }
            } catch (e) {
              console.error("Scraping or connection error:", e);
              // If error is related to context invalidation
              if (e instanceof Error && e.message.includes("Extension context invalidated")) {
                  alert("拡張機能が更新されました。ページをリロードしてください。");
              } else {
                  btn.innerHTML = `<span style="margin-right:4px;">❌</span> エラー`;
              }
               setTimeout(() => { 
                   if(btn) {
                       btn.innerHTML = `<span style="font-size: 18px; margin-right: 6px;">✨</span><span style="font-weight: 600;">Studioで開く</span>`;
                       btn.style.opacity = "1";
                   }
               }, 2000);
            }
          }, 100);
        } catch (err) {
            // Catch synchronous context errors
            console.error(err);
            alert("拡張機能が更新されました。ページをリロードしてください。");
        }
      };

      document.body.appendChild(btn);
    } else {
        existingBtn.style.display = 'flex';
    }
  } else {
    // Hide if no SVG content found
    if (existingBtn) {
      existingBtn.style.display = 'none';
    }
  }
};

// Monitor DOM changes to show/hide button based on context
const observer = new MutationObserver((mutations) => {
  createOverlayButton();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check
setTimeout(createOverlayButton, 1500);