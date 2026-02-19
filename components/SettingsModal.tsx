import React, { useState, useEffect } from 'react';
import { X, Save, Server, Key, Box, Globe, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { AISettings } from '../types';

interface SettingsModalProps {
  onClose: () => void;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: 'google',
  apiKey: '',
  baseUrl: 'https://generativelanguage.googleapis.com',
  model: 'gemini-3-flash-preview'
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

  useEffect(() => {
    const saved = localStorage.getItem('clawreader_ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        
        // Try to identify active preset based on URL and Model
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

  // Handle manual tab switching (Provider Type)
  const handleProviderTypeSwitch = (type: 'google' | 'custom') => {
    let newSettings = { ...settings, provider: type };

    if (type === 'google') {
      // Reset to Google defaults
      newSettings.baseUrl = PRESETS.google.baseUrl;
      newSettings.model = PRESETS.google.model;
      setActivePreset('google');
    } else {
      // Switching to Custom
      // If current URL is Google's, clear it to avoid confusion
      if (newSettings.baseUrl === PRESETS.google.baseUrl) {
        newSettings.baseUrl = ''; 
        newSettings.model = '';
      }
      setActivePreset('custom');
    }
    setSettings(newSettings);
  };

  // Handle Preset Click
  const applyPreset = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    
    setSettings(prev => ({
      ...prev,
      provider: preset.provider,
      baseUrl: preset.baseUrl,
      model: preset.model,
      // Keep existing API key
    }));
    setActivePreset(key);
  };

  const saveSettings = () => {
    localStorage.setItem('clawreader_ai_settings', JSON.stringify(settings));
    // Dispatch event to notify listeners (e.g., service layers if they listen, though we read directly)
    window.dispatchEvent(new Event('storage')); 
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Server className="text-indigo-600" size={20} /> 
            AI Configuration
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Quick Presets */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Quick Presets</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(PRESETS) as Array<keyof typeof PRESETS>).map((key) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={`relative py-3 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 text-center ${
                    activePreset === key 
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  {activePreset === key && (
                    <div className="absolute top-1 right-1 text-indigo-600">
                      <Check size={10} strokeWidth={4} />
                    </div>
                  )}
                  <span className="truncate w-full">{PRESETS[key].label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Advice Block */}
          {['custom', 'openai'].includes(settings.provider) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start text-xs text-amber-700">
               <AlertCircle size={14} className="mt-0.5 shrink-0" />
               <div className="flex-1">
                 <p className="font-bold mb-1">If connection fails:</p>
                 <ul className="list-disc pl-4 space-y-1 opacity-90">
                    <li>Most direct APIs (e.g., DeepSeek) block browser requests due to CORS.</li>
                    <li><strong>Solution:</strong> Use <strong>OpenRouter</strong> or a local proxy.</li>
                    <li>For <strong>Private/Local</strong> APIs, self-signed certificates might be blocked. Open the Base URL in a new tab to accept risks.</li>
                 </ul>
               </div>
            </div>
          )}

          {/* Provider Toggle */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Provider Mode</label>
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => handleProviderTypeSwitch('google')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.provider === 'google' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Official Google
                </button>
                <button 
                  onClick={() => handleProviderTypeSwitch('custom')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${['custom', 'openai'].includes(settings.provider) ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  OpenAI Compatible
                </button>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                 <Key size={14} /> API Key
               </label>
               <input 
                 type="password" 
                 value={settings.apiKey}
                 onChange={(e) => setSettings(s => ({...s, apiKey: e.target.value}))}
                 placeholder={settings.provider === 'google' ? "Default (Environment Key)" : "sk-..."}
                 className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-sm font-mono"
               />
            </div>

            {/* Base URL */}
            <div className="space-y-2">
               <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                   <Globe size={14} /> Base URL
                 </label>
                 {settings.provider !== 'google' && settings.baseUrl && (
                    <a href={settings.baseUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline">
                      Test Link <ExternalLink size={10} />
                    </a>
                 )}
               </div>
               <input 
                 type="text" 
                 value={settings.baseUrl}
                 onChange={(e) => {
                   setSettings(s => ({...s, baseUrl: e.target.value}));
                   setActivePreset('custom'); // Switch to custom if user edits manually
                 }}
                 disabled={settings.provider === 'google'}
                 placeholder="https://api.example.com/v1"
                 className={`w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-sm font-mono ${settings.provider === 'google' ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`}
               />
            </div>

            {/* Model Name */}
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                 <Box size={14} /> Model Name
               </label>
               <input 
                 type="text" 
                 value={settings.model}
                 onChange={(e) => {
                    setSettings(s => ({...s, model: e.target.value}));
                    if (settings.provider === 'google') {
                      // Allow editing model for Google
                    } else {
                      setActivePreset('custom');
                    }
                 }}
                 placeholder="gpt-4o, deepseek-chat, etc."
                 className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all text-sm font-mono"
               />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={saveSettings} 
            className="px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-sm flex items-center gap-2"
          >
            <Save size={16} />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;