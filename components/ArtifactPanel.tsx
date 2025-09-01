import React, { useState, useCallback } from 'react';
import { ClipboardCopyIcon } from './Icons';

interface ArtifactPanelProps {
  content: string;
}

const ArtifactPanel: React.FC<ArtifactPanelProps> = ({ content }) => {
  const [copyText, setCopyText] = useState('Copy');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopyText('Copied!');
      setTimeout(() => setCopyText('Copy'), 2000);
    }, () => {
      setCopyText('Failed!');
      setTimeout(() => setCopyText('Copy'), 2000);
    });
  }, [content]);

  return (
    <div className="hidden md:flex flex-col w-1/2 h-screen bg-gray-50 dark:bg-gray-900/50 border-l border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Artifact</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI-generated content will appear here.</p>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ClipboardCopyIcon className="w-4 h-4" />
          <span>{copyText}</span>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800/50">
        <pre className="whitespace-pre-wrap break-words text-sm font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-900 p-4 rounded-lg">
          <code>
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default ArtifactPanel;