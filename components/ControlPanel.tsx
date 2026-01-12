import React, { useState } from 'react';
import { 
  MapStyleConfig, 
  LayoutType, 
  NodeShape, 
  EdgeStyle, 
  ColorTheme,
  LineStyle,
  MindMapData,
  NodeStyle
} from '../types';
import { 
  Settings, 
  Layout, 
  Palette, 
  Share2, 
  Type, 
  Layers,
  Sparkles,
  PaintBucket,
  PenTool,
  MousePointer2,
  Minimize2,
  GitMerge,
  Maximize
} from 'lucide-react';

declare const chrome: any;

interface ControlPanelProps {
  config: MapStyleConfig;
  setConfig: React.Dispatch<React.SetStateAction<MapStyleConfig>>;
  selectedNode: MindMapData | null;
  onUpdateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) => void;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ config, setConfig, selectedNode, onUpdateNodeStyle }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'node'>('global');

  // If a node is selected, switch to node tab automatically (optional UX)
  // But let's keep tabs clickable.
  
  const handleChange = <K extends keyof MapStyleConfig>(key: K, value: MapStyleConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleNodeStyleChange = <K extends keyof NodeStyle>(key: K, value: NodeStyle[K]) => {
    if (selectedNode && selectedNode.id) {
      onUpdateNodeStyle(selectedNode.id, { [key]: value });
    }
  };

  const layoutLabels: Record<LayoutType, string> = {
    [LayoutType.TREE]: '基本ツリー',
    [LayoutType.CLUSTER]: 'クラスター',
    [LayoutType.FISHBONE]: '魚の骨',
    [LayoutType.TIMELINE]: '年表',
    [LayoutType.LOGIC_TREE]: 'ロジック',
    [LayoutType.CIRCLE_PACKING]: '円配置'
  };

  const themeLabels: Record<ColorTheme, string> = {
    [ColorTheme.NOTEBOOK]: 'Notebook',
    [ColorTheme.PROFESSIONAL]: 'Pro',
    [ColorTheme.DARK]: 'Dark',
    [ColorTheme.PASTEL]: 'Pastel',
    [ColorTheme.MONOCHROME]: 'Mono'
  };

  const shapeLabels: Record<NodeShape, string> = {
    [NodeShape.CIRCLE]: '円',
    [NodeShape.RECTANGLE]: '四角',
    [NodeShape.ROUNDED_RECT]: 'カード',
    [NodeShape.PILL]: '丸角'
  };

  const edgeStyleLabels: Record<EdgeStyle, string> = {
    [EdgeStyle.CURVED]: '曲線',
    [EdgeStyle.STRAIGHT]: '直線',
    [EdgeStyle.STEP]: 'カギ線'
  };

  return (
    <div className="w-full h-full bg-white flex flex-col flex-1 shadow-sm z-10 overflow-hidden font-sans">
      
      {/* Tab Header */}
      <div className="flex border-b border-gray-200 shrink-0">
        <button 
          onClick={() => setActiveTab('global')}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'global' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Settings size={14} /> 全体設定
        </button>
        <button 
          onClick={() => setActiveTab('node')}
          disabled={!selectedNode}
          className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'node' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'}`}
        >
          <MousePointer2 size={14} /> 
          {selectedNode ? '選択中' : '選択なし'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'global' ? (
          <div className="p-5 space-y-6 pb-20">
            
            {/* Layout Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <Layout size={12} className="text-blue-500" />
                <h3>構造レイアウト</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(LayoutType).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleChange('layout', type)}
                    className={`px-1 py-2 text-[10px] font-medium rounded border transition-all truncate ${
                      config.layout === type 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    title={layoutLabels[type]}
                  >
                    {layoutLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme & Colors */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <Palette size={12} className="text-purple-500"/>
                <h3>配色テーマ</h3>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {Object.values(ColorTheme).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => {
                       handleChange('theme', theme);
                       handleChange('useThemeColors', true);
                    }}
                    className={`shrink-0 px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap ${
                      config.theme === theme && config.useThemeColors
                        ? 'bg-purple-100 border-purple-500 text-purple-800 font-bold' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {themeLabels[theme]}
                  </button>
                ))}
              </div>

              {/* Custom Global Colors Override */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">カスタムカラー</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={!config.useThemeColors} onChange={(e) => handleChange('useThemeColors', !e.target.checked)} className="sr-only peer"/>
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                 </div>
                 
                 <div className={`grid grid-cols-2 gap-3 transition-opacity ${config.useThemeColors ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500">ノード背景</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={config.nodeColor} onChange={(e) => handleChange('nodeColor', e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer"/>
                        <span className="text-[10px] text-gray-400 font-mono">{config.nodeColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500">枠線</label>
                      <div className="flex items-center gap-2">
                         <input type="color" value={config.borderColor} onChange={(e) => handleChange('borderColor', e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer"/>
                         <span className="text-[10px] text-gray-400 font-mono">{config.borderColor}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500">テキスト</label>
                       <div className="flex items-center gap-2">
                        <input type="color" value={config.textColor} onChange={(e) => handleChange('textColor', e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer"/>
                        <span className="text-[10px] text-gray-400 font-mono">{config.textColor}</span>
                      </div>
                    </div>
                     <div className="space-y-1">
                      <label className="text-[10px] text-gray-500">接続線</label>
                       <div className="flex items-center gap-2">
                        <input type="color" value={config.lineColor} onChange={(e) => handleChange('lineColor', e.target.value)} className="w-6 h-6 rounded border-0 cursor-pointer"/>
                        <span className="text-[10px] text-gray-400 font-mono">{config.lineColor}</span>
                      </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Visual Style */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-700 text-xs font-bold uppercase tracking-wider">
                <Layers size={12} className="text-emerald-500" />
                <h3>形状と線</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {Object.values(NodeShape).map((shape) => (
                  <button
                    key={shape}
                    onClick={() => handleChange('nodeShape', shape)}
                    className={`py-1.5 text-[10px] rounded border transition-all ${
                      config.nodeShape === shape 
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium' 
                        : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {shapeLabels[shape]}
                  </button>
                ))}
              </div>

               <div className="grid grid-cols-3 gap-2 pt-2">
                {Object.values(EdgeStyle).map((edge) => (
                   <button
                    key={edge}
                    onClick={() => handleChange('edgeStyle', edge)}
                    className={`py-1.5 text-[10px] rounded border transition-all flex items-center justify-center gap-1 ${
                      config.edgeStyle === edge
                        ? 'bg-gray-800 border-gray-800 text-white' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <GitMerge size={10} className={edge === EdgeStyle.STRAIGHT ? "" : edge === EdgeStyle.STEP ? "rotate-90" : "-rotate-45"}/>
                    {edgeStyleLabels[edge]}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                 <div className="flex-1 space-y-1">
                   <label className="text-[10px] text-gray-500">線の種類</label>
                   <select 
                    value={config.lineStyle} 
                    onChange={(e) => handleChange('lineStyle', e.target.value as LineStyle)}
                    className="w-full text-xs border border-gray-200 rounded p-1"
                   >
                     <option value={LineStyle.SOLID}>実線</option>
                     <option value={LineStyle.DASHED}>破線</option>
                     <option value={LineStyle.DOTTED}>点線</option>
                   </select>
                 </div>
                 <div className="flex-1 space-y-1">
                   <label className="text-[10px] text-gray-500">線の太さ: {config.strokeWidth}px</label>
                   <input type="range" min="1" max="8" value={config.strokeWidth} onChange={(e) => handleChange('strokeWidth', Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"/>
                 </div>
              </div>

               <div className="flex gap-2 pt-2">
                 <button 
                  onClick={() => handleChange('shadow', !config.shadow)}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-all ${
                    config.shadow ? 'bg-amber-50 border-amber-400 text-amber-700' : 'bg-white border-gray-200 text-gray-400'
                  }`}
                 >
                   <Sparkles size={12} /> 影
                 </button>
               </div>
            </div>

            {/* Base Size */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
               <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-600">
                  <span className="flex items-center gap-1"><Share2 size={12}/> ノードベース: {config.nodeSize}px</span>
                </div>
                <input type="range" min="20" max="80" value={config.nodeSize} onChange={(e) => handleChange('nodeSize', Number(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700 hover:accent-blue-600"/>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between text-xs font-medium text-gray-600">
                  <span className="flex items-center gap-1"><Type size={12}/> 文字ベース: {config.fontSize}px</span>
                </div>
                <input type="range" min="10" max="24" value={config.fontSize} onChange={(e) => handleChange('fontSize', Number(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-700 hover:accent-blue-600"/>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-6 bg-slate-50 min-h-full pb-20">
            {selectedNode ? (
              <>
                <div className="pb-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 line-clamp-1 break-all">{selectedNode.name}</h3>
                  <p className="text-[10px] text-gray-500 mt-1">個別のデザインを上書きします</p>
                </div>

                {/* Node Style Overrides */}
                <div className="space-y-4">
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-600 flex items-center gap-2"><PaintBucket size={12}/> 塗りつぶし・枠線</label>
                     <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-2 rounded border border-gray-200">
                           <span className="text-[10px] text-gray-400 block mb-1">背景色</span>
                           <div className="flex items-center gap-2">
                             <input type="color" value={selectedNode.style?.fillColor || config.nodeColor} onChange={(e) => handleNodeStyleChange('fillColor', e.target.value)} className="w-full h-8 cursor-pointer rounded"/>
                           </div>
                        </div>
                        <div className="bg-white p-2 rounded border border-gray-200">
                           <span className="text-[10px] text-gray-400 block mb-1">枠線色</span>
                           <div className="flex items-center gap-2">
                             <input type="color" value={selectedNode.style?.borderColor || config.borderColor} onChange={(e) => handleNodeStyleChange('borderColor', e.target.value)} className="w-full h-8 cursor-pointer rounded"/>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-600 flex items-center gap-2"><Maximize size={12}/> サイズ</label>
                     <div className="bg-white p-2 rounded border border-gray-200 flex flex-col gap-3">
                        <div>
                             <span className="text-[10px] text-gray-400 block mb-1">ノードサイズ ({selectedNode.style?.nodeSize || config.nodeSize}px)</span>
                             <input type="range" min="20" max="150" value={selectedNode.style?.nodeSize || config.nodeSize} onChange={(e) => handleNodeStyleChange('nodeSize', Number(e.target.value))} className="w-full h-6 accent-indigo-500"/>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-400 block mb-1">文字サイズ ({selectedNode.style?.fontSize || config.fontSize}px)</span>
                                <input type="range" min="10" max="60" value={selectedNode.style?.fontSize || config.fontSize} onChange={(e) => handleNodeStyleChange('fontSize', Number(e.target.value))} className="w-full h-6 accent-indigo-500"/>
                            </div>
                            <div className="flex-1">
                                <span className="text-[10px] text-gray-400 block mb-1">文字色</span>
                                <input type="color" value={selectedNode.style?.textColor || config.textColor} onChange={(e) => handleNodeStyleChange('textColor', e.target.value)} className="w-full h-6 cursor-pointer rounded"/>
                            </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-600 flex items-center gap-2"><PenTool size={12}/> 親からの接続線</label>
                     <div className="bg-white p-3 rounded border border-gray-200 space-y-3">
                        <div className="flex gap-2">
                            <input type="color" value={selectedNode.style?.lineColor || config.lineColor} onChange={(e) => handleNodeStyleChange('lineColor', e.target.value)} className="w-8 h-8 cursor-pointer rounded flex-shrink-0"/>
                            <select 
                              value={selectedNode.style?.lineStyle || config.lineStyle} 
                              onChange={(e) => handleNodeStyleChange('lineStyle', e.target.value as LineStyle)}
                              className="flex-1 text-xs border border-gray-200 rounded bg-gray-50"
                            >
                              <option value={LineStyle.SOLID}>実線</option>
                              <option value={LineStyle.DASHED}>破線</option>
                              <option value={LineStyle.DOTTED}>点線</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                           <span className="text-[10px] text-gray-400">太さ</span>
                           <input type="range" min="1" max="10" value={selectedNode.style?.lineWidth || config.strokeWidth} onChange={(e) => handleNodeStyleChange('lineWidth', Number(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"/>
                        </div>
                     </div>
                  </div>

                  <div className="pt-4">
                    <button onClick={() => {
                        // Reset style logic could be complex (passing nulls), 
                        // for now just simple implementation
                        if(selectedNode.id) onUpdateNodeStyle(selectedNode.id, {
                            fillColor: undefined, borderColor: undefined, textColor: undefined,
                            fontSize: undefined, lineColor: undefined, lineStyle: undefined, lineWidth: undefined, nodeSize: undefined
                        });
                    }} className="w-full py-2 bg-white border border-red-200 text-red-500 text-xs rounded hover:bg-red-50 transition-colors">
                        設定をリセット
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <Minimize2 size={32} className="mb-2 opacity-20"/>
                <p className="text-xs text-center">マップ上のノードをクリックして<br/>個別に編集できます</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;