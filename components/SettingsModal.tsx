
import React, { useState, useEffect } from 'react';
import { X, Save, Server, Key, Box, Globe, AlertCircle, Check, Loader2, PlayCircle, ShieldAlert } from 'lucide-react';
import { AISettings } from '../types';
import { testOpenAIConnection } from '../services/gemini';

interface SettingsModalProps {
  onClose: () => void;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'google',
  apiKey: '',
  baseUrl: 'https://generativelanguage.googleapis.com',
  model: 'gemini-3-flash-preview',
  useProxy: false
};

const PRESETS = {
  google: {
    provider: 'google' as const,
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-3-flash-preview',
    label: 'Google Gemini'
  },
  openai: {
    provider: 'custom' as const,
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    label: 'OpenAI'
  },
  openrouter: {
    provider: 'custom' as const,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.0-flash-001',
    label: 'OpenRouter'
  },
  deepseek: {
    provider: 'custom' as const,
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    label: 'DeepSeek'
  }
};

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [activePreset, setActivePreset] = useState<keyof typeof PRESETS | 'custom'>('google');
  
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, msg: string} | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('clawreader_ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        
        if (parsed.provider === 'google') {
          setActivePreset('google');
        } else if (parsed.baseUrl?.includes('openrouter')) {
          setActivePreset('openrouter');
        } else if (parsed.baseUrl?.includes('deepseek')) {
          setActivePreset('deepseek');
        } else if (parsed.baseUrl?.includes('openai.com')) {
          setActivePreset('openai');
        } else {
          setActivePreset('custom');
        }
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const handleProviderTypeSwitch = (type: 'google' | 'custom') => {
    let newSettings = { ...settings, provider: type };

    if (type === 'google') {
      newSettings.baseUrl = PRESETS.google.baseUrl;
      newSettings.model = PRESETS.google.model;
      newSettings.useProxy = false;
      setActivePreset('google');
    } else {
      if (newSettings.baseUrl === PRESETS.google.baseUrl) {
        newSettings.baseUrl = ''; 
        newSettings.model = '';
      }
      setActivePreset('custom');
    }
    setSettings(newSettings);
    setTestResult(null);
  };

  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    setSettings(prev => ({
      ...prev,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.model,
      useProxy: false // Reset proxy on preset change usually
    }));
    setActivePreset(key);
    setTestResult(null);
  };

  const saveSettings = () => {
    localStorage.setItem('clawreader_ai_settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('storage')); 
    onClose();
  };

  const handleTestConnection = async () => {
    if (!settings.apiKey && settings.provider !== 'google') {
      setTestResult({ success: false, msg: "API Key is required for custom providers." });
      return;
    }
    
    setIsTesting(true);
    setTestResult(null);
    
    if (settings.provider === 'google') {
       setTimeout(() => {
          setIsTesting(false);
          setTestResult({ success: true, msg: "Google Provider Configured" });
       }, 500);
       return;
    }

    try {
      const result = await testOpenAIConnection(settings);
      setTestResult({ success: result.success, msg: result.message });
    } catch (e) {
      setTestResult({ success: false, msg: "Unexpected error during test." });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm md:p-4 animate-in fade-in duration-200">
      <div className="
         bg-white flex flex-col overflow-hidden shadow-2xl
         w-full h-[90vh] rounded-t-[2rem] animate-in slide-in-from-bottom duration-300
         md:w-[500px] md:h-auto md:max-h-[85vh] md:rounded-2xl md:animate-in md:zoom-in-95 md:slide-in-from-bottom-0
      ">
        <div className="md:hidden w-full flex justify-center pt-4 pb-2 bg-white shrink-0" onTouchEnd={onClose}>
           <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="text-indigo-600" size={24} /> 
            <span>AI Configuration</span>
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
          <div className="md:hidden">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
               Quick Presets
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`relative py-4 px-4 rounded-2xl border-2 text-sm font-bold transition-all flex items-center justify-between group ${
                    activePreset === key 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:bg-indigo-50'
                  }`}
                >
                  <span>{PRESETS[key].label}</span>
                  {activePreset === key && <Check size={16} strokeWidth={3} />}
                </button>
              ))}
            </div>
            <div className="border-t border-gray-200 mt-6" />
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Provider Type</label>
              <div className="flex p-1.5 bg-gray-200/50 rounded-2xl">
                <button 
                  onClick={() => handleProviderTypeSwitch('google')}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${settings.provider === 'google' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  Official Google
                </button>
                <button 
                  onClick={() => handleProviderTypeSwitch('custom')}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${['custom', 'openai'].includes(settings.provider) ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}
                >
                  Custom / OpenAI
                </button>
              </div>
            </div>
            
            {settings.provider !== 'google' && (
              <div className="space-y-2">
                {testResult ? (
                  <div className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 border ${testResult.success ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                     {testResult.success ? <Check size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
                     <div className="break-all">{testResult.msg}</div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm text-amber-800 leading-snug">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <span className="font-bold">Connection Tips:</span>
                      <p className="mt-1 opacity-90 text-xs">Direct API calls from browsers enforce <strong>CORS</strong>. If connection fails, try enabling the Proxy option below.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-5">
               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Key size={16} /> API Key
                  </label>
                  <input 
                    type="password" 
                    value={settings.apiKey}
                    onChange={(e) => {
                       setSettings(s => ({...s, apiKey: e.target.value}));
                       setTestResult(null);
                    }}
                    placeholder={settings.provider === 'google' ? "Using Built-in Key (Optional)" : "sk-..."}
                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all text-base"
                  />
               </div>

               <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <Globe size={16} /> Base URL
                    </label>
                    {settings.provider !== 'google' && (
                       <button 
                         onClick={handleTestConnection} 
                         disabled={isTesting || !settings.baseUrl}
                         className="text-[10px] text-indigo-600 font-bold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                       >
                         {isTesting ? <Loader2 size={10} className="animate-spin" /> : <PlayCircle size={10} />}
                         Test Connection
                       </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={settings.baseUrl}
                    onChange={(e) => {
                      setSettings(s => ({...s, baseUrl: e.target.value}));
                      setActivePreset('custom');
                      setTestResult(null);
                    }}
                    disabled={settings.provider === 'google'}
                    placeholder="https://api.openai.com/v1"
                    className={`w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all text-base font-mono ${settings.provider === 'google' ? 'bg-gray-100 text-gray-400' : ''}`}
                  />
                  <p className="text-[10px] text-gray-400 pl-1">
                     If URL ends in <code>/v1</code>, we auto-append <code>/chat/completions</code>.
                  </p>
               </div>
               
               {/* Proxy Toggle */}
               {settings.provider !== 'google' && (
                 <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={settings.useProxy || false}
                          onChange={(e) => {
                            setSettings(s => ({...s, useProxy: e.target.checked}));
                            setTestResult(null);
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Bypass CORS (Use Proxy)
                      </label>
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Experimental</span>
                   </div>
                   {settings.useProxy && (
                      <div className="flex gap-2 text-[11px] text-gray-500 leading-snug">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5 text-amber-500" />
                        <p>Routes requests through <code>corsproxy.io</code>. Only use this if direct connection fails due to CORS errors. Your API Key will pass through this public proxy.</p>
                      </div>
                   )}
                 </div>
               )}

               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Box size={16} /> Model Name
                  </label>
                  <input 
                    type="text" 
                    value={settings.model}
                    onChange={(e) => {
                       setSettings(s => ({...s, model: e.target.value}));
                       if (settings.provider !== 'google') setActivePreset('custom');
                       setTestResult(null);
                    }}
                    placeholder="gpt-4o"
                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all text-base font-mono"
                  />
               </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 border-t border-gray-100 bg-white flex flex-col-reverse md:flex-row gap-3 md:justify-end shrink-0 pb-safe">
          <button 
            onClick={onClose} 
            className="w-full md:w-auto px-6 py-4 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors text-sm md:text-base"
          >
            Cancel
          </button>
          <button 
            onClick={saveSettings} 
            className="w-full md:w-auto px-8 py-4 rounded-2xl font-bold text-white bg-indigo-600 active:scale-95 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 text-sm md:text-base flex items-center justify-center gap-2"
          >
            <Save size={20} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
