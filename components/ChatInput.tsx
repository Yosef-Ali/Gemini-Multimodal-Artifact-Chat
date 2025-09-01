
import React, { useState, useRef, useCallback } from 'react';
import { PlusIcon, MicrophoneIcon, XIcon, ThinkingIcon, GlobeIcon, ChevronDownIcon } from './Icons';
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
      const newImages = Array.from(files).map(file => ({
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
        <div className="flex flex-wrap gap-3 m-2">
          {images.map((image, index) => (
            <div key={index} className="relative w-20 h-20">
              <img src={image.preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover rounded-lg" />
              <button onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-gray-700 rounded-full p-1 text-white hover:bg-red-500 transition-colors">
                <XIcon className="w-4 h-4" />
              </button>
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
                placeholder="How can I help you today?"
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
                    accept="image/png, image/jpeg, image/webp, image/tiff"
                    multiple
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    disabled={isLoading}
                    aria-label="Attach file"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
                 <button className="flex items-center gap-1.5 px-3 h-8 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <ThinkingIcon className="w-5 h-5" />
                    <span>Thinking</span>
                    <ChevronDownIcon className="w-4 h-4" />
                </button>
                <button className="flex items-center gap-1.5 px-3 h-8 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                    <GlobeIcon className="w-5 h-5" />
                    <span>Search</span>
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