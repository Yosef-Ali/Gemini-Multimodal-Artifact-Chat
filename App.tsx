import React, { useState, useCallback, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import ArtifactPanel from './components/ArtifactPanel';
import Sidebar from './components/Sidebar';
import { Message, Conversation, Theme, Persona } from './types';
import { generateResponse, generateImage, editImage, performOcr, generateTitleFromContent } from './services/geminiService';
import { personas, DEFAULT_PERSONA_ID } from './personas';

const OLD_MESSAGES_KEY = 'gemini-artifact-chat-messages';
const OLD_ARTIFACT_KEY = 'gemini-artifact-chat-artifact';
const CONVERSATIONS_KEY = 'gemini-conversations';
const THEME_KEY = 'gemini-theme';


const defaultWelcomeMessage: Message = {
  role: 'model',
  text: "Hello! I'm your multimodal assistant. You can ask me questions, provide an image, and request content for the artifact panel on the right. For example, try asking me to 'write a React component for a login form' or upload a picture of a landmark and ask what it is.",
};

const defaultArtifactContent = "<!-- Artifacts will appear here -->\n\n/*\n  When you ask me to create something like code, a document, or a plan, I'll update this panel with the complete result.\n*/";

const createNewConversation = (id: string, title = "New Chat"): Conversation => ({
  id,
  title,
  messages: [defaultWelcomeMessage],
  artifactContent: defaultArtifactContent,
  isArtifactVisible: false,
  model: 'gemini-2.5-flash',
  personaId: DEFAULT_PERSONA_ID,
});

const App: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleThemeToggle = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  useEffect(() => {
    try {
      let loadedConversations: Conversation[] = [];
      const savedConversations = localStorage.getItem(CONVERSATIONS_KEY);

      if (savedConversations) {
        loadedConversations = JSON.parse(savedConversations).map((c: Conversation) => ({
          ...c,
          isArtifactVisible: c.isArtifactVisible ?? false,
          model: c.model || 'gemini-2.5-flash',
          personaId: c.personaId || DEFAULT_PERSONA_ID,
        }));
      } else {
        // Migration from old version
        const oldMessagesStr = localStorage.getItem(OLD_MESSAGES_KEY);
        if (oldMessagesStr) {
          const oldMessages = JSON.parse(oldMessagesStr);
          const oldArtifact = localStorage.getItem(OLD_ARTIFACT_KEY) || defaultArtifactContent;
          const migratedConversation = createNewConversation(Date.now().toString(), "Imported Chat");
          migratedConversation.messages = oldMessages.length > 0 ? oldMessages : [defaultWelcomeMessage];
          migratedConversation.artifactContent = oldArtifact;
          loadedConversations.push(migratedConversation);

          localStorage.removeItem(OLD_MESSAGES_KEY);
          localStorage.removeItem(OLD_ARTIFACT_KEY);
        }
      }

      if (loadedConversations.length === 0) {
        const newId = Date.now().toString();
        loadedConversations.push(createNewConversation(newId));
      }

      setConversations(loadedConversations);
      setActiveConversationId(loadedConversations[0].id);

    } catch (error) {
      console.error("Failed to load conversations from local storage", error);
      const newId = Date.now().toString();
      setConversations([createNewConversation(newId)]);
      setActiveConversationId(newId);
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      try {
        const MAX_CONTENT_LENGTH = 50000; // Limit to prevent localStorage quota errors

        const conversationsToSave = conversations.map(conversation => {
          const { artifactContent, messages, ...restOfConversation } = conversation;
          
          // Truncate long artifact content
          let truncatedArtifact = artifactContent;
          if (truncatedArtifact && truncatedArtifact.length > MAX_CONTENT_LENGTH) {
            truncatedArtifact = truncatedArtifact.substring(0, MAX_CONTENT_LENGTH) + "\n\n... [Artifact truncated for storage]";
          }
          
          const processedMessages = messages.map(message => {
            // Strip images
            const { images, ...messageWithoutImages } = message; 

            // Truncate long text content
            if (messageWithoutImages.text && messageWithoutImages.text.length > MAX_CONTENT_LENGTH) {
              messageWithoutImages.text = messageWithoutImages.text.substring(0, MAX_CONTENT_LENGTH) + "\n\n... [Message truncated for storage]";
            }

            return messageWithoutImages; 
          });

          return {
            ...restOfConversation,
            artifactContent: truncatedArtifact,
            messages: processedMessages,
          };
        });
        localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversationsToSave));
      } catch (error) {
        console.error("Failed to save conversations to local storage", error);
      }
    }
  }, [conversations]);
  
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activePersona = personas.find(p => p.id === activeConversation?.personaId) || personas[0];

  const updateActiveConversation = (updater: (conv: Conversation) => Conversation) => {
    setConversations(prev =>
      prev.map(c => (c.id === activeConversationId ? updater(c) : c))
    );
  };

  const handleSendMessage = useCallback(async (text: string, images?: { mimeType: string, data: string }[]) => {
    if (!activeConversation) return;

    const userMessage: Message = { 
        role: 'user', 
        text, 
        images: images ? images.map(img => `data:${img.mimeType};base64,${img.data}`) : undefined 
    };
    
    setIsLoading(true);
    setError(null);

    let newTitle = activeConversation.title;
    // Check if it's the first user message in a "New Chat"
    if (activeConversation.title === "New Chat" && activeConversation.messages.length === 1) {
        try {
            newTitle = await generateTitleFromContent(text, images?.[0]);
        } catch (e) {
            console.error("Failed to generate AI title, using fallback:", e);
            newTitle = text.split(' ').slice(0, 5).join(' ') + '...';
        }
    }
    
    const updatedMessages = [...activeConversation.messages, userMessage];
    updateActiveConversation(conv => ({ ...conv, title: newTitle, messages: updatedMessages }));

    try {
      const response = await generateResponse(text, activeConversation.artifactContent, activeConversation.model, activePersona.systemInstruction, images);
      
      const modelMessage: Message = { role: 'model', text: response.chatResponse };
      
      updateActiveConversation(conv => {
          const hasNewArtifact = (response.artifactContent !== null && response.artifactContent.trim() !== "") && response.artifactContent !== conv.artifactContent && response.artifactContent !== defaultArtifactContent;
          return {
            ...conv,
            messages: [...updatedMessages, modelMessage],
            artifactContent: (response.artifactContent !== null && response.artifactContent.trim() !== "") ? response.artifactContent : conv.artifactContent,
            isArtifactVisible: conv.isArtifactVisible || hasNewArtifact,
          }
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      const errorModelMessage: Message = { role: 'model', text: `Sorry, something went wrong: ${errorMessage}` };
      updateActiveConversation(conv => ({...conv, messages: [...updatedMessages, errorModelMessage] }));
    } finally {
      setIsLoading(false);
    }
  }, [activeConversation, activePersona]);

  const handleGenerateImage = useCallback(async (prompt: string) => {
    if (!activeConversation) return;
    
    const userMessage: Message = { role: 'user', text: `Generate an image of: "${prompt}"` };
    const updatedMessages = [...activeConversation.messages, userMessage];
    updateActiveConversation(conv => ({ ...conv, messages: updatedMessages }));

    setIsLoading(true);
    setError(null);

    try {
      const base64Image = await generateImage(prompt);
      const modelMessage: Message = { 
        role: 'model', 
        text: 'Here is the image you requested:', 
        images: [`data:image/png;base64,${base64Image}`] 
      };
      updateActiveConversation(conv => ({ ...conv, messages: [...updatedMessages, modelMessage] }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      const errorModelMessage: Message = { role: 'model', text: `Sorry, something went wrong while generating the image: ${errorMessage}` };
      updateActiveConversation(conv => ({ ...conv, messages: [...updatedMessages, errorModelMessage] }));
    } finally {
      setIsLoading(false);
    }
  }, [activeConversation]);

  const handleEditImage = useCallback(async (prompt: string, image: { mimeType: string; data: string; }) => {
    if (!activeConversation) return;

    const userMessage: Message = { 
        role: 'user', 
        text: `Edit Request: "${prompt}"`,
        images: [`data:${image.mimeType};base64,${image.data}`]
    };
    const updatedMessages = [...activeConversation.messages, userMessage];
    updateActiveConversation(conv => ({ ...conv, messages: updatedMessages }));
    
    setIsLoading(true);
    setError(null);

    try {
        const response = await editImage(prompt, image);
        const modelMessage: Message = {
            role: 'model',
            text: response.text || 'Here is the edited image:',
            images: response.imageBase64 ? [`data:image/png;base64,${response.imageBase64}`] : undefined,
        };
        updateActiveConversation(conv => ({...conv, messages: [...updatedMessages, modelMessage]}));
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        const errorModelMessage: Message = { role: 'model', text: `Sorry, something went wrong while editing the image: ${errorMessage}` };
        updateActiveConversation(conv => ({ ...conv, messages: [...updatedMessages, errorModelMessage] }));
    } finally {
        setIsLoading(false);
    }
  }, [activeConversation]);

  const handlePerformOcr = useCallback(async (images: { mimeType: string; data: string; }[]) => {
    if (!activeConversation || images.length === 0) return;

    const userMessage: Message = { 
        role: 'user', 
        text: `Please extract and organize the text from these ${images.length} images.`,
        images: images.map(img => `data:${img.mimeType};base64,${img.data}`)
    };
    const updatedMessages = [...activeConversation.messages, userMessage];
    updateActiveConversation(conv => ({ ...conv, messages: updatedMessages }));
    
    setIsLoading(true);
    setError(null);

    try {
        const extractedText = await performOcr(images);
        const modelMessage: Message = {
            role: 'model',
            text: `Here is the extracted and organized text:\n\n---\n\n${extractedText}`,
        };
        updateActiveConversation(conv => ({...conv, messages: [...updatedMessages, modelMessage]}));
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
        const errorModelMessage: Message = { role: 'model', text: `Sorry, something went wrong while performing OCR: ${errorMessage}` };
        updateActiveConversation(conv => ({ ...conv, messages: [...updatedMessages, errorModelMessage] }));
    } finally {
        setIsLoading(false);
    }
  }, [activeConversation]);
  
  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newConversation = createNewConversation(newId);
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newId);
  }

  const handleClearConversation = () => {
    if (!activeConversationId) return;
    updateActiveConversation(conv => ({
      ...conv,
      messages: [defaultWelcomeMessage],
      artifactContent: defaultArtifactContent,
      isArtifactVisible: false,
    }));
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
  }
  
  const handleRenameConversation = (id: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(c => (c.id === id ? { ...c, title: newTitle } : c))
    );
  };

  const handleToggleArtifactPanel = () => {
    if (!activeConversationId) return;
    updateActiveConversation(conv => ({
      ...conv,
      isArtifactVisible: !conv.isArtifactVisible,
    }));
  };

  const handleModelChange = (model: string) => {
    if (!activeConversationId) return;
    updateActiveConversation(conv => ({
      ...conv,
      model: model,
    }));
  };
  
  const handlePersonaChange = (personaId: string) => {
    if (!activeConversationId) return;
    updateActiveConversation(conv => ({
      ...conv,
      personaId: personaId,
    }));
  };

  return (
    <div className="flex h-screen font-sans bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <Sidebar 
        conversations={conversations}
        activeConversationId={activeConversationId}
        onNewChat={handleNewChat} 
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
      />
      <div className="flex flex-1" key={activeConversationId}>
        {activeConversation ? (
          <>
            <ChatPanel 
              messages={activeConversation.messages} 
              onSendMessage={handleSendMessage} 
              onGenerateImage={handleGenerateImage}
              onEditImage={handleEditImage}
              onPerformOcr={handlePerformOcr}
              onClearConversation={handleClearConversation}
              isLoading={isLoading} 
              key={activeConversationId} // Add key here to force re-mount
              isArtifactVisible={activeConversation.isArtifactVisible}
              onToggleArtifactPanel={handleToggleArtifactPanel}
              model={activeConversation.model}
              onModelChange={handleModelChange}
              personas={personas}
              activePersona={activePersona}
              onPersonaChange={handlePersonaChange}
            />
            {activeConversation.isArtifactVisible && (
              <ArtifactPanel content={activeConversation.artifactContent} />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Select a chat to begin
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
