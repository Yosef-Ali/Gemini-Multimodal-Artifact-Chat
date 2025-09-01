import React, { useState, useRef, useEffect } from 'react';
import { Message, Persona } from '../types';
import ChatHistory from './ChatHistory';
import ChatInput from './ChatInput';
import { ChevronDownIcon, ClipboardCopyIcon, DocumentTextIcon, SparklesIcon, AcademicCapIcon, PencilIcon, GlobeIcon, DotsHorizontalIcon, QuestionMarkCircleIcon, TrashIcon, PanelRightIcon } from './Icons';
import { fileToBase64 } from '../utils/file';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (text: string, images?: { mimeType: string, data: string }[]) => void;
  onGenerateImage: (prompt: string) => void;
  onEditImage: (prompt: string, image: { mimeType: string, data: string }) => void;
  onPerformOcr: (images: { mimeType: string, data: string }[]) => void;
  onClearConversation: () => void;
  isLoading: boolean;
  isArtifactVisible: boolean;
  onToggleArtifactPanel: () => void;
  model: string;
  onModelChange: (model: string) => void;
  personas: Persona[];
  activePersona: Persona;
  onPersonaChange: (personaId: string) => void;
}

const SuggestionButton: React.FC<{ icon: React.ReactNode; text: string; onClick?: () => void, disabled?: boolean }> = ({ icon, text, onClick, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
        {icon}
        {text}
    </button>
);


const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage, onGenerateImage, onEditImage, onPerformOcr, onClearConversation, isLoading, isArtifactVisible, onToggleArtifactPanel, model, onModelChange, personas, activePersona, onPersonaChange }) => {
  const showWelcomeScreen = messages.length <= 1;
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const [isPersonaSelectorOpen, setIsPersonaSelectorOpen] = useState(false);
  const personaSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
            setIsModelSelectorOpen(false);
        }
        if (personaSelectorRef.current && !personaSelectorRef.current.contains(event.target as Node)) {
            setIsPersonaSelectorOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleImageGenerationClick = () => {
    const prompt = window.prompt("Enter a description for the image you want to generate:");
    if (prompt && prompt.trim() !== '') {
      onGenerateImage(prompt);
    }
  };

  const handleImageEditClick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/tiff,image/tif,image/bmp';
    fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            const editPrompt = window.prompt("Describe the edit you want to make:");
            if (editPrompt && editPrompt.trim() !== '') {
                try {
                    const imageData = await fileToBase64(file);
                    onEditImage(editPrompt, imageData);
                } catch (error) {
                    console.error("Error processing image for editing:", error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    alert(`Failed to process image: ${errorMessage}\n\nSupported formats: PNG, JPEG, TIFF, WebP, BMP`);
                }
            }
        }
    };
    fileInput.click();
  };

  const handleOcrClick = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/webp,image/tiff,image/tif,image/bmp';
    fileInput.multiple = true;
    fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const files = target.files;
        if (files && files.length > 0) {
            // Show loading state immediately
            const loadingToast = document.createElement('div');
            loadingToast.className = 'fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            loadingToast.textContent = `Processing ${files.length} image${files.length > 1 ? 's' : ''} for Amharic OCR...`;
            document.body.appendChild(loadingToast);
            
            try {
                const imagePromises = Array.from(files).map(file => fileToBase64(file));
                const imagesData = await Promise.all(imagePromises);
                onPerformOcr(imagesData);
                
                // Remove loading toast
                document.body.removeChild(loadingToast);
            } catch (error) {
                console.error("Error processing images for OCR:", error);
                document.body.removeChild(loadingToast);
                
                // Better error message
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                alert(`Failed to process image files: ${errorMessage}\n\nSupported formats: PNG, JPEG, TIFF, WebP, BMP`);
            }
        }
    };
    fileInput.click();
  };


  return (
    <div className="flex flex-col flex-1 h-screen relative animate-fade-in">
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
             <div className="relative" ref={personaSelectorRef}>
                <button 
                    onClick={() => setIsPersonaSelectorOpen(!isPersonaSelectorOpen)}
                    className="flex items-center gap-2 text-lg font-semibold cursor-pointer p-2 -m-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50"
                >
                    <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
                      {activePersona.avatar}
                    </span>
                    <span className="text-base">{activePersona.name}</span>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isPersonaSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isPersonaSelectorOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10">
                        <ul className="py-1">
                            {personas.map(persona => (
                              <li key={persona.id}>
                                <a href="#" onClick={(e) => { e.preventDefault(); onPersonaChange(persona.id); setIsPersonaSelectorOpen(false); }} className={`flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${persona.id === activePersona.id ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
                                    <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-indigo-500 dark:text-indigo-400 flex-shrink-0">
                                      {persona.avatar}
                                    </span>
                                    <div>
                                      <p className={`font-semibold ${persona.id === activePersona.id ? 'text-gray-900 dark:text-white' : ''}`}>{persona.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 font-normal truncate">{persona.systemInstruction.split('.')[0]}</p>
                                    </div>
                                </a>
                            </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="relative" ref={modelSelectorRef}>
                <button 
                    onClick={() => setIsModelSelectorOpen(!isModelSelectorOpen)}
                    className="flex items-center gap-2 text-sm font-medium cursor-pointer p-2 -m-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50"
                >
                    <span>{model}</span>
                    <ChevronDownIcon className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isModelSelectorOpen ? 'rotate-180' : ''}`} />
                </button>
                {isModelSelectorOpen && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10">
                        <ul className="py-1">
                            <li>
                                <a href="#" onClick={(e) => { e.preventDefault(); onModelChange('deepseek-chat'); setIsModelSelectorOpen(false); }} className={`block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${model === 'deepseek-chat' ? 'bg-gray-100 dark:bg-gray-700 font-semibold' : ''}`}>
                                    🧠 deepseek-chat
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block font-normal">🇪🇹 Smart Amharic reasoning with memory</span>
                                </a>
                            </li>
                            <li>
                                <a href="#" onClick={(e) => { e.preventDefault(); onModelChange('openrouter/deepseek'); setIsModelSelectorOpen(false); }} className={`block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${model === 'openrouter/deepseek' ? 'bg-gray-100 dark:bg-gray-700 font-semibold' : ''}`}>
                                    💰 openrouter/deepseek
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block font-normal">Cost-effective alternative via OpenRouter</span>
                                </a>
                            </li>
                            <li>
                                <a href="#" onClick={(e) => { e.preventDefault(); onModelChange('gemini-1.5-flash-latest'); setIsModelSelectorOpen(false); }} className={`block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${model === 'gemini-1.5-flash-latest' ? 'bg-gray-100 dark:bg-gray-700 font-semibold' : ''}`}>
                                    gemini-1.5-flash-latest
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block font-normal">📷 For images & artifacts only</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                )}
            </div>
            <button 
                onClick={onClearConversation}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" 
                aria-label="Clear conversation"
                title="Clear conversation"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={onToggleArtifactPanel}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                aria-label={isArtifactVisible ? "Hide Artifact Panel" : "Show Artifact Panel"}
                title={isArtifactVisible ? "Hide Artifact Panel" : "Show Artifact Panel"}
            >
                <PanelRightIcon className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                Y
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {showWelcomeScreen ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8">Good morning, Yosef Ali</h1>
            <div className="w-full max-w-2xl">
              <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  <SuggestionButton 
                    icon={<DocumentTextIcon className="w-4 h-4 text-cyan-500" />} 
                    text="📄 Amharic OCR" 
                    onClick={handleOcrClick} 
                    disabled={isLoading} 
                  />
                  <SuggestionButton 
                    icon={<PencilIcon className="w-4 h-4 text-yellow-500" />} 
                    text="✏️ Image Edit" 
                    onClick={handleImageEditClick} 
                    disabled={isLoading} 
                  />
                  <SuggestionButton 
                    icon={<SparklesIcon className="w-4 h-4 text-purple-500" />} 
                    text="🎨 Generate Image" 
                    onClick={handleImageGenerationClick} 
                    disabled={isLoading} 
                  />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <ChatHistory messages={messages} activePersona={activePersona} />
          </div>
        )}
      </main>

      {!showWelcomeScreen && (
        <footer className="p-4 md:p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
          <div className="w-full max-w-3xl mx-auto">
            <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} />
             <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                  <SuggestionButton 
                    icon={<DocumentTextIcon className="w-4 h-4 text-cyan-500" />} 
                    text="📄 Amharic OCR" 
                    onClick={handleOcrClick} 
                    disabled={isLoading} 
                  />
                  <SuggestionButton 
                    icon={<PencilIcon className="w-4 h-4 text-yellow-500" />} 
                    text="✏️ Image Edit" 
                    onClick={handleImageEditClick} 
                    disabled={isLoading} 
                  />
                  <SuggestionButton 
                    icon={<SparklesIcon className="w-4 h-4 text-purple-500" />} 
                    text="🎨 Generate Image" 
                    onClick={handleImageGenerationClick} 
                    disabled={isLoading} 
                  />
            </div>
          </div>
        </footer>
      )}
       <button className="absolute bottom-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <QuestionMarkCircleIcon className="w-6 h-6" />
        </button>
    </div>
  );
};

export default ChatPanel;