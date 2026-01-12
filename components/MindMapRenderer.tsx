import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import {
  select,
  zoom,
  zoomIdentity,
  zoomTransform,
  scaleOrdinal,
  schemeDark2,
  schemePastel1,
  hierarchy,
  tree as d3Tree,
  pack as d3Pack,
  drag as d3Drag
} from 'd3';
import type { ZoomBehavior, ScaleOrdinal } from 'd3';
import { 
  MindMapData, 
  MapStyleConfig, 
  LayoutType, 
  NodeShape, 
  EdgeStyle, 
  ColorTheme,
  LineStyle 
} from '../types';
import { ZoomIn, ZoomOut, Maximize, Move } from 'lucide-react';

interface MindMapRendererProps {
  data: MindMapData | null;
  config: MapStyleConfig;
  onNodeClick?: (data: MindMapData) => void;
  onBackgroundClick?: () => void;
  selectedNodeId?: string | null;
}

export interface MindMapRendererHandle {
  downloadImage: (format: 'png' | 'svg') => void;
}

const MindMapRenderer = forwardRef<MindMapRendererHandle, MindMapRendererProps>(({ data, config, onNodeClick, onBackgroundClick, selectedNodeId }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const zoomBehavior = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const prevConfigRef = useRef<MapStyleConfig>(config);
  const nodePositionsRef = useRef<Map<string, {x: number, y: number}>>(new Map());

  useImperativeHandle(ref, () => ({
    downloadImage: async (format) => {
      if (!svgRef.current || !data) return;
      
      const svgElement = svgRef.current;
      
      // 1. Get the bounding box of the actual content (the <g> element), not the viewport
      const contentGroup = svgElement.querySelector('g');
      if (!contentGroup) return;
      
      const bbox = contentGroup.getBBox();
      const padding = 60; // Extra padding
      
      // 2. Clone the SVG to manipulate it without affecting the display
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      const cloneGroup = clone.querySelector('g');
      
      if (cloneGroup) {
        // Reset transform to identity so we get raw coordinates
        // We handle positioning via viewBox on the parent SVG
        cloneGroup.setAttribute('transform', '');
      }

      // 3. Inject Font Styles explicitly
      // When converting to image, external stylesheets are often ignored.
      // We inject a style block with imports and explicit font-family.
      const style = document.createElement('style');
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        text { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; 
        }
      `;
      clone.prepend(style);

      // 4. Set viewBox to exactly match the content bounds
      // bbox.x/y can be negative, so we shift the view to start there.
      const x = bbox.x - padding;
      const y = bbox.y - padding;
      const w = bbox.width + (padding * 2);
      const h = bbox.height + (padding * 2);

      clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
      clone.setAttribute('width', `${w}px`);
      clone.setAttribute('height', `${h}px`);

      // Serializing
      const serializer = new XMLSerializer();
      let source = serializer.serializeToString(clone);

      // XML Namespace Check
      if(!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)){
          source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      if(!source.match(/^<svg[^>]+xmlns:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)){
          source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
      }
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

      // Determine Background Color
      let bgFill = "#ffffff";
      switch (config.theme) {
          case ColorTheme.DARK: bgFill = "#111827"; break;
          case ColorTheme.PASTEL: bgFill = "#fff1f2"; break;
          case ColorTheme.MONOCHROME: bgFill = "#ffffff"; break;
          case ColorTheme.PROFESSIONAL: bgFill = "#f8fafc"; break;
          default: bgFill = "#f8fafc"; break;
      }

      if (format === 'svg') {
        // For SVG export, we might want to add a rect for background if it's not white
        // But usually SVGs are transparent. Let's keep it transparent or user preference.
        // If specific background is needed, we could prepend a rect.
        const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${data.name || 'mindmap'}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // PNG Export
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
        
        img.onload = () => {
          const canvas = document.createElement("canvas");
          // High resolution scale
          const scale = 3; 
          
          canvas.width = w * scale;
          canvas.height = h * scale;
          
          const context = canvas.getContext("2d");
          if (context) {
            context.scale(scale, scale);
            
            // Draw Background
            context.fillStyle = bgFill;
            context.fillRect(0, 0, w, h);
            
            // Draw Image
            // Since we adjusted viewBox, drawing at 0,0 with w,h should fit perfectly
            context.drawImage(img, 0, 0, w, h);
            
            const link = document.createElement("a");
            link.download = `${data.name || 'mindmap'}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
          }
        };
        img.onerror = (e) => {
            console.error("Image export failed", e);
            alert("画像の生成に失敗しました。");
        }
      }
    }
  }));

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
      }
    };
    window.addEventListener('resize', updateDims);
    // Initial check
    setTimeout(updateDims, 0); 
    
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const handleZoom = (factor: number) => {
    if (svgRef.current && zoomBehavior.current) {
      select(svgRef.current)
        .transition()
        .duration(300)
        .call(zoomBehavior.current.scaleBy, factor);
    }
  };

  const handleResetZoom = () => {
     if (svgRef.current && zoomBehavior.current) {
      const svg = select(svgRef.current);
      const g = svg.select<SVGGElement>("g");
      
      if (g.empty()) return;

      const bounds = g.node()?.getBBox();
      if (!bounds) return;

      const { width, height } = dimensions;
      const padding = 60;

      const widthRatio = (width - padding * 2) / bounds.width;
      const heightRatio = (height - padding * 2) / bounds.height;
      const scale = Math.min(widthRatio, heightRatio, 1); 

      // Guard against NaN or Infinity if bounds are zero
      if (!isFinite(scale) || isNaN(scale)) return;

      const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (height - bounds.height * scale) / 2 - bounds.y * scale;

      svg.transition()
        .duration(750)
        .call(zoomBehavior.current.transform, zoomIdentity.translate(tx, ty).scale(scale));
    }
  }

  // Render D3
  useEffect(() => {
    if (!data || !svgRef.current) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) return; // Wait for dimensions

    const svg = select(svgRef.current);

    // Save previous transform to restore after render if layout hasn't changed
    const currentTransform = zoomTransform(svgRef.current);

    svg.on("click", (event) => {
       if (event.target === svgRef.current && onBackgroundClick) {
         onBackgroundClick();
       }
    });

    const isLayoutChanged = prevConfigRef.current.layout !== config.layout;
    
    // If layout changed, clear positions cache, otherwise sync current
    if (isLayoutChanged) {
        nodePositionsRef.current.clear();
    }
    
    svg.selectAll("g").remove(); 
    svg.selectAll("defs").remove();

    // --- Color Scales & Styles ---
    let colorScale: ScaleOrdinal<string, string>;
    let bgColor = "#f8fafc";
    let defaultTextColor = config.textColor;
    let defaultLineColor = config.lineColor;

    if (config.useThemeColors) {
         switch (config.theme) {
            case ColorTheme.DARK:
                colorScale = scaleOrdinal(schemeDark2);
                bgColor = "#111827";
                defaultTextColor = "#e5e7eb";
                defaultLineColor = "#374151";
                break;
            case ColorTheme.PASTEL:
                colorScale = scaleOrdinal(schemePastel1);
                bgColor = "#fff1f2";
                defaultTextColor = "#475569";
                defaultLineColor = "#e2e8f0";
                break;
            case ColorTheme.MONOCHROME:
                colorScale = scaleOrdinal(["#1e293b", "#334155", "#475569", "#64748b"]);
                bgColor = "#ffffff";
                defaultTextColor = "#1e293b";
                defaultLineColor = "#cbd5e1";
                break;
            case ColorTheme.PROFESSIONAL:
                colorScale = scaleOrdinal(["#0f172a", "#1e40af", "#0369a1", "#0e7490"]);
                bgColor = "#f8fafc";
                defaultTextColor = "#0f172a";
                defaultLineColor = "#cbd5e1";
                break;
            case ColorTheme.NOTEBOOK:
            default:
                colorScale = scaleOrdinal(["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#8AB4F8", "#F28B82"]);
                bgColor = "#f8fafc";
                break;
        }
    } else {
        bgColor = "#ffffff";
        colorScale = scaleOrdinal([config.nodeColor]);
        defaultTextColor = config.textColor;
        defaultLineColor = config.lineColor;
    }

    svg.style("background-color", bgColor);

    const defs = svg.append("defs");
    if (config.shadow) {
      const filter = defs.append("filter")
        .attr("id", "drop-shadow")
        .attr("height", "130%");
      filter.append("feGaussianBlur")
        .attr("in", "SourceAlpha")
        .attr("stdDeviation", 3)
        .attr("result", "blur");
      filter.append("feOffset")
        .attr("in", "blur")
        .attr("dx", 2)
        .attr("dy", 2)
        .attr("result", "offsetBlur");
      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "offsetBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");
    }

    // Process Data
    const root = hierarchy(data)
      .sum(d => (d.children ? 0 : 1))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    
    root.each((d: any) => {
       const pathId = d.ancestors().reverse().map((a:any) => a.data.name).join("|");
       d.id = d.data.id || pathId;
       d.data.id = d.id; 
    });

    const nodes = root.descendants();
    const links = root.links();
    
    let sortForRendering = false;

    // --- Static Layout Calculation (No Physics) ---
    // Calculate x, y for all nodes first
    if (config.layout === LayoutType.LOGIC_TREE) {
        // Dynamic node size based on config to prevent overlap
        // Vertical spacing = nodeSize * 2.5 (leaves enough room for text height + margin)
        // Horizontal spacing = fixed but generous
        const spacingY = Math.max(config.nodeSize * 2.5, 60); 
        const spacingX = Math.max(config.nodeSize * 4, 250);
        
        const treeLayout = d3Tree().nodeSize([spacingY, spacingX]); // nodeSize takes [height, width] for vertical tree (which we rotate)
        treeLayout(root);
        nodes.forEach((d: any) => {
            // Swap x and y for horizontal layout
            const temp = d.x; d.x = d.y; d.y = temp;
        });
    } else if (config.layout === LayoutType.TIMELINE) {
        const timelineY = 0;
        const spacingX = Math.max(config.nodeSize * 5, 250);
        nodes.forEach((d: any, i) => {
             if (d.depth === 0) { d.x = 0; d.y = timelineY; } 
             else if (d.depth === 1) {
                 const indexInLevel = d.parent.children.indexOf(d);
                 d.x = (indexInLevel + 1) * spacingX;
                 d.y = timelineY;
             } else {
                 const branchUp = d.parent.children.indexOf(d) % 2 === 0;
                 const offset = Math.max(config.nodeSize * 3, 120) * (d.depth - 1);
                 d.x = d.parent.x;
                 d.y = branchUp ? d.parent.y - offset : d.parent.y + offset;
             }
        });
    } else if (config.layout === LayoutType.FISHBONE) {
        const headX = 0;
        const headY = 0;
        const spineLength = Math.max(nodes.length * 100, 800);
        nodes.forEach((d: any) => {
             if (d.depth === 0) { d.x = headX; d.y = headY; } 
             else if (d.depth === 1) {
                 const idx = d.parent.children.indexOf(d);
                 const total = d.parent.children.length;
                 const xPos = headX - (spineLength / (total + 1)) * (idx + 1);
                 const isTop = idx % 2 === 0;
                 const yOffset = isTop ? -Math.max(config.nodeSize * 4, 180) : Math.max(config.nodeSize * 4, 180);
                 d.x = xPos; d.y = headY + yOffset;
             } else {
                 const idx = d.parent.children.indexOf(d);
                 d.x = d.parent.x + (idx % 2 === 0 ? 30 : -30);
                 const spacing = Math.max(config.nodeSize * 1.5, 60);
                 d.y = d.parent.y + (d.parent.y < 0 ? -spacing * (idx+1) : spacing * (idx+1));
             }
        });
    } else if (config.layout === LayoutType.CIRCLE_PACKING) {
        sortForRendering = true;
        const pack = d3Pack().size([width, height]).padding(25);
        pack(root);
        // Center shift not needed as pack uses size, but let's re-center later
    } else if (config.layout === LayoutType.CLUSTER) {
        // Radial Cluster
        const radius = Math.min(width, height) * 0.8;
        const tree = d3Tree().size([2 * Math.PI, radius]);
        tree(root);
        // Convert polar to cartesian
        nodes.forEach((d: any) => {
            const angle = d.x; 
            const r = d.y;
            d.x = r * Math.cos(angle - Math.PI/2);
            d.y = r * Math.sin(angle - Math.PI/2);
        });
    } else { // TREE (Standard Horizontal)
        // Dynamic node size based on config
        const spacingY = Math.max(config.nodeSize * 2.5, 60);
        const spacingX = Math.max(config.nodeSize * 5, 250);

        const treeLayout = d3Tree().nodeSize([spacingY, spacingX]); 
        treeLayout(root);
        nodes.forEach((d: any) => {
            // Swap x and y for horizontal
            const temp = d.x; d.x = d.y; d.y = temp;
        });
    }

    // --- Center the Graph ---
    // Shift all nodes so the bounding box center is at 0,0.
    if (config.layout !== LayoutType.CIRCLE_PACKING) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodes.forEach((d: any) => {
            if (isNaN(d.x) || isNaN(d.y)) return; // Skip invalid nodes
            if (d.x < minX) minX = d.x;
            if (d.x > maxX) maxX = d.x;
            if (d.y < minY) minY = d.y;
            if (d.y > maxY) maxY = d.y;
        });
        
        // Ensure we have valid bounds
        if (minX !== Infinity && maxX !== -Infinity && minY !== Infinity && maxY !== -Infinity) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            nodes.forEach((d: any) => {
                if (!isNaN(d.x)) d.x -= centerX;
                if (!isNaN(d.y)) d.y -= centerY;
            });
        }
    } else {
        // For Circle Packing, d3.pack centers in the given size [width, height].
        // We shift to make 0,0 center.
        nodes.forEach((d: any) => {
            if (!isNaN(d.x)) d.x -= width / 2;
            if (!isNaN(d.y)) d.y -= height / 2;
        });
    }

    // Restore dragged positions if layout is same
    if (!isLayoutChanged) {
        nodes.forEach((d: any) => {
            if (nodePositionsRef.current.has(d.id)) {
                const cached = nodePositionsRef.current.get(d.id);
                if (cached) {
                    d.x = cached.x;
                    d.y = cached.y;
                }
            }
        });
    } else {
         // Update cache with new layout
         nodes.forEach((d: any) => {
            if (!isNaN(d.x) && !isNaN(d.y)) {
                nodePositionsRef.current.set(d.id, {x: d.x, y: d.y});
            }
         });
    }

    const g = svg.append("g");
    
    zoomBehavior.current = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
      
    svg.call(zoomBehavior.current);
    
    // Initial view: Center graph at [width/2, height/2]
    // Since we shifted graph to 0,0, translating to width/2, height/2 puts it in center.
    if (isLayoutChanged || nodePositionsRef.current.size === 0) {
        const initialScale = 0.8;
        svg.call(zoomBehavior.current.transform, 
            zoomIdentity
                .translate(width/2, height/2)
                .scale(initialScale)
        );
    } else {
        // Restore previous zoom
        svg.call(zoomBehavior.current.transform, currentTransform);
    }

    const showLinks = config.layout !== LayoutType.CIRCLE_PACKING;
    const link = g.append("g")
        .selectAll("path")
        .data(showLinks ? links : [])
        .join("path")
        .attr("fill", "none")
        .attr("opacity", 0.7);

    // Apply Link Styles
    link.each(function(d: any) {
        const el = select(this);
        const style = d.target.data.style; 
        
        const stroke = style?.lineColor || defaultLineColor;
        const width = style?.lineWidth || config.strokeWidth;
        const lineStyle = style?.lineStyle || config.lineStyle;

        el.attr("stroke", stroke)
          .attr("stroke-width", width);

        if (lineStyle === LineStyle.DASHED) {
            el.attr("stroke-dasharray", "8,4");
        } else if (lineStyle === LineStyle.DOTTED) {
            el.attr("stroke-dasharray", "2,4");
        } else {
            el.attr("stroke-dasharray", "none");
        }
    });

    if (sortForRendering) {
        nodes.sort((a, b) => a.depth - b.depth);
    }

    const node = g.append("g")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("cursor", "move")
        .on("click", (event, d: any) => {
            event.stopPropagation();
            if (onNodeClick) onNodeClick(d.data);
        });

    if (config.shadow) {
        node.style("filter", "url(#drop-shadow)");
    }

    // Render Function (updates DOM attributes)
    const ticked = () => {
        if (showLinks) {
            link.attr("d", (d: any) => {
                // Safety guard for NaN coordinates to prevent crashes
                if (isNaN(d.source.x) || isNaN(d.source.y) || isNaN(d.target.x) || isNaN(d.target.y)) {
                    return "";
                }

                const style = config.layout === LayoutType.LOGIC_TREE ? EdgeStyle.STEP : config.edgeStyle;
                
                if (style === EdgeStyle.STRAIGHT) {
                    return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                } else if (style === EdgeStyle.STEP) {
                    // Logic for step (Manhattan)
                    return `M${d.source.x},${d.source.y} V${d.target.y} H${d.target.x}`;
                } else {
                    // Curved (Bezier)
                    const dx = d.target.x - d.source.x;
                    return `M${d.source.x},${d.source.y} C${d.source.x + dx / 2},${d.source.y} ${d.target.x - dx / 2},${d.target.y} ${d.target.x},${d.target.y}`;
                }
            });
        }
        
        node.attr("transform", (d: any) => {
            // Safety guard for NaN coordinates
            const x = isNaN(d.x) ? 0 : d.x;
            const y = isNaN(d.y) ? 0 : d.y;
            return `translate(${x},${y})`;
        });
    };

    // Initial Render
    ticked();

    // Drag Implementation (Manual Move)
    const drag = d3Drag<SVGGElement, any>()
        .on("start", (event, d) => {
            // No simulation to stop
        })
        .on("drag", (event, d) => {
            // Update node position manually
            d.x = event.x;
            d.y = event.y;
            // Update cache
            nodePositionsRef.current.set(d.id, {x: d.x, y: d.y});
            ticked();
        })
        .on("end", (event, d) => {
            // Nothing to cleanup
        });

    node.call(drag);

    // Draw Shape & Text
    node.each(function(d: any) {
        const el = select(this);
        const name = d.data.name || "";
        const isRoot = d.depth === 0;
        const isSelected = selectedNodeId === d.id;
        const style = d.data.style || {};

        let fill = style.fillColor;
        let stroke = style.borderColor;
        
        if (!fill) {
            if (config.useThemeColors) {
                 fill = isRoot ? colorScale('root') : (config.layout === LayoutType.CIRCLE_PACKING ? colorScale(d.depth.toString()) : "#fff");
            } else {
                 fill = config.nodeColor;
            }
        }
        
        if (!stroke) {
            if (config.useThemeColors) {
                 stroke = isRoot ? "none" : colorScale(d.depth.toString());
            } else {
                 stroke = config.borderColor;
            }
        }

        let finalWidth: number, finalHeight: number;
        
        if (config.layout === LayoutType.CIRCLE_PACKING && d.r) {
             finalWidth = d.r * 2; finalHeight = d.r * 2;
        } else {
             // Use Individual Size OR Global Size
             const baseSize = style.nodeSize || config.nodeSize;
             const fontSize = style.fontSize || config.fontSize;
             const textLen = name.length;
             const minW = baseSize * 2.5;
             const minH = baseSize;
             const estimatedTextWidth = (textLen * fontSize) + 24; 
             
             if (config.nodeShape === NodeShape.CIRCLE) {
                const dia = baseSize * 2; finalWidth = dia; finalHeight = dia;
             } else {
                finalWidth = Math.max(minW, estimatedTextWidth);
                finalHeight = Math.max(minH, fontSize * 2 + 10);
             }
        }
        const halfW = finalWidth / 2, halfH = finalHeight / 2;
        const currentShape = config.layout === LayoutType.CIRCLE_PACKING ? NodeShape.CIRCLE : config.nodeShape;

        let shapeEl;
        if (currentShape === NodeShape.RECTANGLE) {
            shapeEl = el.append("rect").attr("width", finalWidth).attr("height", finalHeight).attr("x", -halfW).attr("y", -halfH);
        } else if (currentShape === NodeShape.ROUNDED_RECT) {
             shapeEl = el.append("rect").attr("width", finalWidth).attr("height", finalHeight).attr("x", -halfW).attr("y", -halfH).attr("rx", 6);
        } else if (currentShape === NodeShape.PILL) {
             shapeEl = el.append("rect").attr("width", finalWidth).attr("height", finalHeight).attr("x", -halfW).attr("y", -halfH).attr("rx", finalHeight / 2); 
        } else {
             shapeEl = el.append("circle").attr("r", finalWidth / 2);
        }
        
        shapeEl
            .attr("fill", fill)
            .attr("stroke", stroke)
            .attr("stroke-width", isSelected ? 3 : 2); 

        if (config.layout === LayoutType.CIRCLE_PACKING) {
            shapeEl.attr("fill-opacity", isRoot ? 0.1 : 0.6);
        }
        
        if (isSelected) {
            shapeEl.attr("stroke", "#4f46e5").attr("stroke-dasharray", "2,2");
        }

        const textColor = style.textColor || (isRoot && config.layout !== LayoutType.CIRCLE_PACKING && config.useThemeColors ? "#fff" : defaultTextColor);
        const fontSize = style.fontSize || config.fontSize;

        el.append("text")
          .attr("text-anchor", "middle")
          .attr("fill", textColor)
          .style("font-size", `${fontSize}px`)
          .style("font-weight", isRoot ? "700" : "500")
          .style("pointer-events", "none")
          .style("user-select", "none")
          .attr("dy", "0.35em")
          .text(name);
    });

    prevConfigRef.current = config;

  }, [data, dimensions, config, selectedNodeId]); 

  if (!data) return null;

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 overflow-hidden relative group">
      <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing block" />
      
      {/* Canvas Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={() => handleZoom(1.2)} className="p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-gray-50">
          <ZoomIn size={20} />
        </button>
        <button onClick={() => handleZoom(0.8)} className="p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-gray-50">
          <ZoomOut size={20} />
        </button>
        <button onClick={handleResetZoom} className="p-2 bg-white rounded-lg shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 hover:bg-gray-50" title="全体を表示">
          <Maximize size={20} />
        </button>
      </div>

      <div className="absolute top-4 left-4 pointer-events-none">
        <h3 className="text-sm font-bold text-gray-400 select-none bg-white/50 px-2 rounded flex items-center gap-2">
            {data.name} 
        </h3>
      </div>
    </div>
  );
});

export default MindMapRenderer;