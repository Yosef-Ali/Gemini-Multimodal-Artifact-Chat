
import React, { useState, useRef, useCallback } from 'react';
import { PlusIcon, MicrophoneIcon, XIcon, ThinkingIcon, GlobeIcon, ChevronDownIcon, DocumentTextIcon } from './Icons';
import { fileToBase64 } from '../utils/file';

interface ChatInputProps {
  onSendMessage: (text: string, images?: { mimeType: string, data: string }[]) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [images, setImages] = useState<{ file: File, preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    if ((!text.trim() && images.length === 0) || isLoading) return;

    let imagesData: { mimeType: string, data: string }[] | undefined;
    if (images.length > 0) {
      try {
        imagesData = await Promise.all(images.map(image => fileToBase64(image.file)));
      } catch (error) {
        console.error("Error converting files to base64", error);
        alert("Could not process one or more image files. Please try again.");
        return;
      }
    }
    
    onSendMessage(text, imagesData);
    setText('');
    setImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  }, [text, images, isLoading, onSendMessage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages = Array.from(files).map((file: File) => ({
        file,
        preview: URL.createObjectURL(file)
      }));
      setImages(prevImages => [...prevImages, ...newImages]);
    }
  };

  const removeImage = (indexToRemove: number) => {
    const imageToRemove = images[indexToRemove];
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    setImages(prevImages => prevImages.filter((_, index) => index !== indexToRemove));
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      e.target.style.height = 'auto';
      e.target.style.height = `${e.target.scrollHeight}px`;
  }

  return (
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm transition-all focus-within:shadow-md">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 m-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="w-full flex items-center gap-2 mb-2">
            <DocumentTextIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Ready for Amharic OCR ({images.length} image{images.length > 1 ? 's' : ''})
            </span>
          </div>
          {images.map((image, index) => (
            <div key={index} className="relative w-20 h-20">
              <img src={image.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
              <button 
                onClick={() => removeImage(index)} 
                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1 text-white shadow-lg transition-colors"
                aria-label={`Remove image ${index + 1}`}
              >
                <XIcon className="w-3 h-3" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5 rounded-b-lg">
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1">
            <textarea
                ref={textareaRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                placeholder="Ask about your Amharic documents or chat in አማርኛ..."
                className="w-full bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none resize-none"
                rows={1}
                style={{maxHeight: '200px'}}
                disabled={isLoading}
            />
            <div className="flex items-center gap-2 mt-2">
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/tiff,image/tif,image/bmp,image/gif"
                    multiple
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 h-8 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                        aria-label="Upload images (PNG, JPEG, TIFF, WebP)"
                        title="Upload multiple images for Amharic OCR"
                    >
                        <PlusIcon className="w-4 h-4" />
                        <span>Images</span>
                    </button>
                    {images.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                            {images.length} image{images.length > 1 ? 's' : ''} ready
                        </span>
                    )}
                </div>
                 <button 
                    className="flex items-center gap-1.5 px-3 h-8 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    title="Advanced reasoning mode with Amharic expertise"
                >
                    <ThinkingIcon className="w-4 h-4" />
                    <span>Think</span>
                    <ChevronDownIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
        <button
            onClick={handleSend}
            disabled={isLoading || (!text.trim() && images.length === 0)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-indigo-600 transition-colors flex-shrink-0"
            aria-label="Send message"
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-200 border-t-white rounded-full animate-spin"></div>
            ) : (
                <MicrophoneIcon className="w-5 h-5" />
            )}
        </button>
      </div>
    </div>
  );
};

export default ChatInput;