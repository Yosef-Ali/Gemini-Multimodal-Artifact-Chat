import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Theme } from '../types';
import { QwenLogoIcon, PanelRightOpenIcon, PanelLeftCloseIcon, PlusIcon, SearchIcon, DotsHorizontalIcon, SunIcon, MoonIcon, PencilIcon } from './Icons';

interface SidebarProps {
    conversations: Conversation[];
    activeConversationId: string | null;
    onNewChat: () => void;
    onSelectConversation: (id: string) => void;
    onRenameConversation: (id: string, newTitle: string) => void;
    theme: Theme;
    onThemeToggle: () => void;
    isCollapsed: boolean;
    onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ conversations, activeConversationId, onNewChat, onSelectConversation, onRenameConversation, theme, onThemeToggle, isCollapsed, onToggle }) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempTitle, setTempTitle] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const handleRenameStart = (conv: Conversation) => {
        setEditingId(conv.id);
        setTempTitle(conv.title);
    };

    const handleRenameConfirm = () => {
        if (editingId && tempTitle.trim() !== '') {
            onRenameConversation(editingId, tempTitle.trim());
        }
        setEditingId(null);
    };
    
    useEffect(() => {
        if (isCollapsed) {
            setEditingId(null);
        }
    }, [isCollapsed]);


    return (
        <aside className={`h-screen bg-gray-50 border-r border-gray-200 flex flex-col dark:bg-gray-800/50 dark:border-gray-700 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20 p-2' : 'w-80 p-4'}`}>
            <header className={`flex items-center mb-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                 {!isCollapsed && (
                    <div className="flex items-center gap-2">
                        <QwenLogoIcon className="w-7 h-7 flex-shrink-0" />
                        <span className="text-xl font-bold text-gray-800 dark:text-gray-100">Qwen</span>
                    </div>
                 )}
                <button onClick={onToggle} className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700">
                     {isCollapsed ? <PanelRightOpenIcon className="w-5 h-5" /> : <PanelLeftCloseIcon className="w-5 h-5" />}
                </button>
            </header>

            <div className="mb-4">
                <button 
                    onClick={onNewChat} 
                    className={`w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors font-semibold dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30 ${isCollapsed ? 'px-2' : 'px-4'}`}
                    title={isCollapsed ? 'New Chat' : ''}
                >
                    <PlusIcon className="w-5 h-5" />
                    {!isCollapsed && <span>New Chat</span>}
                </button>
            </div>

            {!isCollapsed && (
                <div className="relative mb-4">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input type="text" placeholder="Search" className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:focus:ring-indigo-500" />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                        <DotsHorizontalIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
            
            <nav className={`flex-1 overflow-y-auto ${isCollapsed ? '' : '-mx-2 pr-2'}`}>
                 {!isCollapsed && <h3 className="px-2 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Recent Chats</h3>}
                <ul className="space-y-0.5">
                    {conversations.map(conv => (
                        <li key={conv.id} className="group relative" title={isCollapsed ? conv.title : undefined}>
                             {editingId === conv.id && !isCollapsed ? (
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={tempTitle}
                                    onChange={(e) => setTempTitle(e.target.value)}
                                    onBlur={handleRenameConfirm}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setEditingId(null); }}
                                    className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-600 border border-indigo-400 rounded-md focus:outline-none"
                                />
                            ) : (
                                <a 
                                    href="#" 
                                    onClick={(e) => { e.preventDefault(); onSelectConversation(conv.id); }}
                                    className={`flex items-center w-full text-sm text-left rounded-md truncate transition-colors ${
                                        isCollapsed 
                                            ? `justify-center h-10 ${conv.id === activeConversationId ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`
                                            : `justify-between px-2 py-1.5 text-gray-600 dark:text-gray-300 ${conv.id === activeConversationId ? 'bg-gray-200 font-semibold text-gray-800 dark:bg-gray-700 dark:text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`
                                    }`}
                                >
                                    {isCollapsed ? (
                                        <span className="font-semibold">{conv.title === 'New Chat' ? 'N' : conv.title.charAt(0).toUpperCase()}</span>
                                    ) : (
                                        <>
                                            <span className="truncate">{conv.title}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRenameStart(conv); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                                                aria-label="Rename conversation"
                                            >
                                                <PencilIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </a>
                            )}
                        </li>
                    ))}
                </ul>
            </nav>

            <footer className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                <div className={`flex ${isCollapsed ? 'flex-col items-center gap-4' : 'items-center gap-3'}`}>
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        Y
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 truncate">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">Yosef Ali</span>
                        </div>
                    )}
                    <button onClick={onThemeToggle} className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700">
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                    </button>
                </div>
            </footer>
        </aside>
    );
};

export default Sidebar;