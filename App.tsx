import React, { useState, useRef, useEffect } from 'react';
import { 
  MindMapData, 
  MapStyleConfig, 
  LayoutType, 
  NodeShape, 
  EdgeStyle, 
  ColorTheme,
  LineStyle,
  NodeStyle
} from './types';
import ControlPanel from './components/ControlPanel';
import MindMapRenderer, { MindMapRendererHandle } from './components/MindMapRenderer';
import { Code, X, Check, Download, FileText, Image as ImageIcon, HelpCircle, ExternalLink, AlignLeft } from 'lucide-react';

declare const chrome: any;

const INITIAL_DATA: MindMapData = {
  name: "NotebookLM Studio",
  children: [
    {
      name: "使い方",
      children: [
        { name: "テキストを選択" },
        { name: "「ページ読込」をクリック" },
        { name: "自動でマップ化" }
      ]
    },
    {
      name: "機能",
      children: [
        { name: "デザイン変更" },
        { name: "画像保存 (PNG/SVG)" },
        { name: "JSON編集" }
      ]
    }
  ]
};

const INITIAL_CONFIG: MapStyleConfig = {
  layout: LayoutType.TREE,
  nodeShape: NodeShape.ROUNDED_RECT,
  edgeStyle: EdgeStyle.CURVED,
  theme: ColorTheme.PROFESSIONAL,
  nodeSize: 40,
  fontSize: 14,
  strokeWidth: 2,
  depthLimit: 3,
  shadow: true,
  freezeDrag: false,
  lineColor: '#cbd5e1',
  lineStyle: LineStyle.SOLID,
  nodeColor: '#ffffff',
  borderColor: '#e2e8f0',
  textColor: '#334155',
  useThemeColors: true
};

function App() {
  const [data, setData] = useState<MindMapData | null>(INITIAL_DATA);
  const [config, setConfig] = useState<MapStyleConfig>(INITIAL_CONFIG);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  
  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<MindMapData | null>(null);

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'json' | 'text'>('text');
  const [editorInput, setEditorInput] = useState('');
  const [editorError, setEditorError] = useState<string | null>(null);

  // Renderer Ref for Export
  const rendererRef = useRef<MindMapRendererHandle>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // --- Storage Synchronization ---
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['mindMapData', 'mindMapConfig'], (result: any) => {
        if (result.mindMapData) {
          setData(result.mindMapData);
        }
        if (result.mindMapConfig) {
          // Merge with initial to ensure new properties exist
          setConfig({ ...INITIAL_CONFIG, ...result.mindMapConfig });
        }
        setIsInitialized(true);
      });

      const handleStorageChange = (changes: any, areaName: string) => {
        if (areaName === 'local') {
          if (changes.mindMapData?.newValue && JSON.stringify(data) !== JSON.stringify(changes.mindMapData.newValue)) {
            setData(changes.mindMapData.newValue);
          }
          if (changes.mindMapConfig?.newValue && JSON.stringify(config) !== JSON.stringify(changes.mindMapConfig.newValue)) {
            setConfig(changes.mindMapConfig.newValue);
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    } else {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ mindMapData: data, mindMapConfig: config });
    }
  }, [data, config, isInitialized]);

  // --- Recursive Node Update ---
  const updateNodeStyle = (nodeId: string, styleUpdate: Partial<NodeStyle>) => {
    if (!data) return;

    const updateRecursive = (node: MindMapData): MindMapData => {
      // Logic relies on 'id' being consistent. 
      // Note: In Renderer, IDs are path-based. We match against what the renderer gives us.
      if (node.id === nodeId) {
        const newStyle = { ...(node.style || {}), ...styleUpdate };
        // Remove undefined values to keep clean
        Object.keys(newStyle).forEach(key => (newStyle as any)[key] === undefined && delete (newStyle as any)[key]);
        const updated = { ...node, style: newStyle };
        setSelectedNodeData(updated); // Update local selection state immediately
        return updated;
      }
      if (node.children) {
        return { ...node, children: node.children.map(child => updateRecursive(child)) };
      }
      return node;
    };

    const newData = updateRecursive({ ...data }); // Shallow copy root
    setData(newData);
  };

  const handleNodeClick = (nodeData: MindMapData) => {
    setSelectedNodeId(nodeData.id || null);
    setSelectedNodeData(nodeData);
  };

  const handleBackgroundClick = () => {
    setSelectedNodeId(null);
    setSelectedNodeData(null);
  };

  // --- Helpers for Text Mode ---
  const toMarkdown = (nodes: MindMapData[], level = 0): string => {
    return nodes.map(node => {
      const indent = "  ".repeat(level);
      const line = `${indent}- ${node.name}`;
      const children = node.children ? "\n" + toMarkdown(node.children, level + 1) : "";
      return line + children;
    }).join("\n");
  };

  const parseMarkdown = (text: string): MindMapData => {
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const virtualRoot: MindMapData = { name: "Root", children: [] };
    const stack = [{ level: -1, node: virtualRoot }];

    lines.forEach(line => {
        const leadingSpaces = line.match(/^\s*/)?.[0].length || 0;
        const level = Math.floor(leadingSpaces / 2);
        const name = line.replace(/^\s*[-*+]\s+/, '').trim(); 

        if (!name) return;

        const newNode: MindMapData = { name, children: [] };
        
        while (stack.length > 1 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }
        
        const parent = stack[stack.length - 1].node;
        if (!parent.children) parent.children = [];
        parent.children.push(newNode);
        stack.push({ level, node: newNode });
    });

    if (virtualRoot.children && virtualRoot.children.length === 1) return virtualRoot.children[0];
    return { name: "New Map", children: virtualRoot.children || [] };
  };

  // --- Handlers ---
  const handleOpenNewTab = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  const openEditor = () => {
    if (editorMode === 'json') {
        setEditorInput(JSON.stringify(data, null, 2));
    } else {
        if (data) {
           setEditorInput(`- ${data.name}\n${data.children ? toMarkdown(data.children, 1) : ''}`);
        } else {
           setEditorInput("");
        }
    }
    setEditorError(null);
    setIsEditorOpen(true);
  };

  const switchEditorMode = (mode: 'json' | 'text') => {
      setEditorMode(mode);
      if (mode === 'json') {
          setEditorInput(JSON.stringify(data, null, 2));
      } else {
           if (data) {
             setEditorInput(`- ${data.name}\n${data.children ? toMarkdown(data.children, 1) : ''}`);
           } else {
             setEditorInput("");
           }
      }
      setEditorError(null);
  };

  const saveEditorData = () => {
    try {
      if (editorMode === 'json') {
          const parsed = JSON.parse(editorInput);
          setData(parsed);
      } else {
          const parsed = parseMarkdown(editorInput);
          setData(parsed);
      }
      setIsEditorOpen(false);
    } catch (e) {
      setEditorError("エラー: 構文を確認してください");
    }
  };

  const handleFetchFromPage = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      setLoading(true);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { action: "GET_DATA" }, (response: any) => {
            setLoading(false);
            if (chrome.runtime.lastError) {
              alert("接続エラー: ページをリロードしてから再試行してください。");
              return;
            }
            if (response && response.success && response.data) {
              setData(response.data);
            } else {
              alert(response?.message || "データの取得に失敗しました。");
            }
          });
        } else {
          setLoading(false);
        }
      });
    } else {
      alert("Chrome拡張機能環境でのみ動作します。");
    }
  };

  const handleDownload = (format: 'png' | 'svg') => {
    if (rendererRef.current) rendererRef.current.downloadImage(format);
    setIsExportMenuOpen(false);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-30 shadow-sm relative shrink-0">
        <div className="flex items-center gap-2">
          <img 
            src="/アイコン.png" 
            alt="Logo" 
            className="w-8 h-8 rounded-lg shadow-md object-cover"
          />
          <span className="font-bold text-gray-800 tracking-tight hidden sm:block">Mind Map Studio</span>
        </div>

        <div className="flex items-center gap-2">
           <div className="flex items-center gap-1">
             <button
              onClick={handleFetchFromPage}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full transition-all border border-indigo-100 shadow-sm hover:shadow active:scale-95 disabled:opacity-50"
            >
              {loading ? <span className="animate-spin">⌛</span> : <FileText size={14} />}
              <span className="hidden xs:inline">ページ読込</span>
            </button>
            <div className="group relative flex items-center justify-center">
              <HelpCircle size={16} className="text-gray-400 cursor-help hover:text-indigo-500 transition-colors" />
              <div className="absolute top-full right-0 mt-2 w-72 p-3 bg-gray-800 text-white text-[11px] rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-relaxed">
                 <p className="font-bold mb-1">高度な読み込みモード:</p>
                <ol className="list-decimal pl-4 space-y-1 text-gray-200">
                  <li>テキスト選択 (Markdown形式)</li>
                  <li>自動検出 (画面のグラフ構造を解析)</li>
                </ol>
              </div>
            </div>
           </div>

           <button onClick={handleOpenNewTab} className="flex items-center gap-1.5 px-2 py-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
             <ExternalLink size={16} />
           </button>

           <button
            onClick={openEditor}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-full transition-all border border-gray-200 hover:border-gray-300 ml-1"
          >
            <Code size={14} />
            <span className="hidden xs:inline">編集</span>
          </button>

          <div className="relative ml-1">
            <button
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-full transition-all shadow-md active:scale-95"
            >
              <Download size={14} />
              <span>保存</span>
            </button>
            {isExportMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsExportMenuOpen(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-20 py-1 overflow-hidden">
                  <button onClick={() => handleDownload('png')} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                    <ImageIcon size={14}/> PNG画像
                  </button>
                  <button onClick={() => handleDownload('svg')} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                    <Code size={14}/> SVGベクター
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Control Panel */}
        <div className="order-2 md:order-1 w-full md:w-80 flex-1 md:flex-none flex flex-col min-h-0 border-t md:border-t-0 md:border-r border-gray-200 z-10 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
           <ControlPanel 
              config={config} 
              setConfig={setConfig} 
              selectedNode={selectedNodeData}
              onUpdateNodeStyle={updateNodeStyle}
           />
        </div>

        {/* Map */}
        <div className="order-1 md:order-2 w-full md:flex-1 h-[35vh] md:h-full relative bg-slate-100/50 shadow-inner md:shadow-none shrink-0 md:shrink">
          <MindMapRenderer 
            ref={rendererRef} 
            data={data} 
            config={config} 
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            selectedNodeId={selectedNodeId}
          />
          
          {/* Editor Modal */}
          {isEditorOpen && (
            <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-white border border-gray-200 shadow-2xl rounded-2xl flex flex-col h-[75vh] animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                  <div className="flex gap-4 items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <Code size={18} className="text-blue-600"/>
                      データ編集
                    </h3>
                    <div className="flex bg-gray-200 rounded-lg p-0.5">
                        <button 
                          onClick={() => switchEditorMode('text')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editorMode === 'text' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <div className="flex items-center gap-1"><AlignLeft size={12}/> テキスト</div>
                        </button>
                        <button 
                          onClick={() => switchEditorMode('json')}
                          className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${editorMode === 'json' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <div className="flex items-center gap-1"><Code size={12}/> JSON</div>
                        </button>
                    </div>
                  </div>
                  <button onClick={() => setIsEditorOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                    <X size={20} />
                  </button>
                </div>
                
                <textarea
                  value={editorInput}
                  onChange={(e) => setEditorInput(e.target.value)}
                  className="flex-1 w-full font-mono text-xs leading-relaxed p-4 bg-white focus:bg-gray-50 border-0 outline-none resize-none"
                  spellCheck={false}
                  placeholder={editorMode === 'text' ? "- Root Topic\n  - Subtopic 1\n  - Subtopic 2" : "{ ... }"}
                />
                
                {editorError && (
                  <div className="px-4 py-2 bg-red-50 text-red-600 text-xs border-t border-red-100">
                    {editorError}
                  </div>
                )}

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white rounded-b-2xl">
                  <button onClick={() => setIsEditorOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 font-medium text-xs transition-colors">キャンセル</button>
                  <button onClick={saveEditorData} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95">
                    <Check size={14} /> 適用する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;