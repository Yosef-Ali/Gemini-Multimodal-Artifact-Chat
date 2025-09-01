
import React, { useEffect, useRef } from 'react';
import { Message, Persona } from '../types';

interface ChatHistoryProps {
  messages: Message[];
  activePersona: Persona;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ messages, activePersona }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {messages.map((msg, index) => (
        <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          {msg.role === 'model' && (
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-indigo-500 dark:text-indigo-400">
              {activePersona.avatar}
            </div>
          )}
          <div className={`max-w-xl rounded-2xl p-4 ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none'}`}>
            {msg.images && msg.images.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap -m-1">
                    {msg.images.map((imgSrc, imgIndex) => (
                      <div key={imgIndex} className="p-1 w-1/2">
                        <img src={imgSrc} alt={`Attachment ${imgIndex + 1}`} className="rounded-lg w-full h-auto object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
            )}
            <div className="prose prose-sm max-w-none text-current whitespace-pre-wrap break-words">
              {msg.text}
            </div>
          </div>
           {msg.role === 'user' && (
             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
              Y
            </div>
          )}
        </div>
      ))}
      <div ref={endOfMessagesRef} />
    </div>
  );
};

export default ChatHistory;