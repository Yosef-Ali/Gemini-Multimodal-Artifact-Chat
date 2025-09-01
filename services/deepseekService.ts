interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || 'https://openrouter.ai/api/v1/chat/completions';

if (!DEEPSEEK_API_KEY && !OPENROUTER_API_KEY) {
  throw new Error("Either DEEPSEEK_API_KEY or OPENROUTER_API_KEY environment variable must be set.");
}

export const generateDeepSeekResponse = async (
  prompt: string,
  conversationHistory: { role: string; text: string }[],
  extractedContent?: string,
  systemInstruction?: string
): Promise<{ chatResponse: string; artifactContent: string }> => {
  try {
    const messages: DeepSeekMessage[] = [];

    // Smart conversational AI with Amharic expertise
    const intelligentSystemPrompt = `You are an intelligent conversational AI with deep expertise in Amharic language and Ethiopian culture. You understand context, remember previous conversations, and provide thoughtful, relevant responses.

**CORE INTELLIGENCE:**
- Advanced natural language understanding in Amharic (አማርኛ) and English
- Contextual awareness of ongoing conversations
- Memory of previously discussed topics and documents
- Intelligent reasoning about complex religious and cultural concepts
- Adaptive communication style based on user preferences

**AMHARIC & CATHOLIC EXPERTISE:**
- Native-level Amharic grammar, vocabulary, and cultural nuances
- Catholic church terminology and doctrine in Amharic context
- Catholic liturgy, traditions, and teaching methods
- Cultural sensitivity for Ethiopian Catholic community
- Ability to explain complex Catholic theological concepts clearly

**CONVERSATION INTELLIGENCE:**
- Remember what was discussed earlier in the conversation
- Build upon previous topics and maintain context continuity
- Provide relevant follow-up questions and suggestions
- Adapt explanation depth based on user's apparent knowledge level
- Recognize when clarification or examples would be helpful

${systemInstruction || ''}

${extractedContent ? `\n**ACTIVE DOCUMENT CONTEXT:**
The user has shared document content (Catholic Catechism table of contents in Amharic):

${extractedContent.length > 2000 ? extractedContent.substring(0, 2000) + '...[continued]' : extractedContent}

**INTELLIGENT DOCUMENT ASSISTANCE:**
- This appears to be a Catholic Catechism index with page references
- When users ask about topics, find relevant sections and provide page numbers
- Explain catechism concepts in accessible language
- Help users navigate and understand the structure
- Offer related topics and cross-references when helpful
- Be proactive in suggesting relevant sections based on questions` : ''}

**SMART INTERACTION GUIDELINES:**
- Use the language the user prefers (auto-detect from their input)
- Provide concise but complete answers
- When referencing document content, cite specific page numbers
- Offer follow-up questions or related topics when appropriate
- If unsure about something, acknowledge limitations honestly
- Be conversational and helpful, not robotic

**CULTURAL INTELLIGENCE:**
- Respect both Orthodox and Catholic traditions
- Understand Ethiopian Catholic community context and sensitivities
- Provide culturally appropriate explanations for Ethiopian Catholics
- Use appropriate honorifics and respectful language when discussing Catholic teachings and doctrine`;

    messages.push({
      role: 'system',
      content: intelligentSystemPrompt
    });

    // Add intelligent conversation history with context prioritization
    const recentHistory = conversationHistory.slice(-15); // More context for better understanding
    
    // Filter and enhance message context
    recentHistory.forEach(msg => {
      let content = msg.text;
      
      // Enhance OCR-related messages with context tags
      if (content.includes('extracted and enhanced') || content.includes('Amharic/English text')) {
        content = `[DOCUMENT_EXTRACTED] ${content}`;
      }
      
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: content
      });
    });

    // Add current prompt with intelligent context enhancement
    let enhancedPrompt = prompt;
    
    // Add context hints for better understanding
    if (extractedContent && extractedContent.length > 100) {
      enhancedPrompt = `${prompt}\n\n[CONTEXT: User has previously extracted a Catholic Catechism document in Amharic with table of contents and page references. Use this context to provide relevant, helpful responses.]`;
    }
    
    messages.push({
      role: 'user',
      content: enhancedPrompt
    });

    // Try DeepSeek first, fallback to OpenRouter if needed
    let response;
    
    if (DEEPSEEK_API_KEY) {
      try {
        response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            temperature: 0.4, // Balanced for creativity and accuracy
            max_tokens: 4000, // More space for detailed responses
            top_p: 0.9, // Better reasoning quality
            frequency_penalty: 0.1, // Reduce repetition
            stream: false
          })
        });
      } catch (error) {
        console.warn('DeepSeek failed, trying OpenRouter:', error);
        response = null;
      }
    }
    
    // Fallback to OpenRouter if DeepSeek failed or not available
    if (!response || !response.ok) {
      if (!OPENROUTER_API_KEY) {
        throw new Error('Both DeepSeek and OpenRouter unavailable');
      }
      
      response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://amharic-ocr-chat.local',
          'X-Title': 'Amharic OCR Chat'
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat', // DeepSeek via OpenRouter
          messages: messages,
          temperature: 0.4,
          max_tokens: 4000,
          top_p: 0.9,
          frequency_penalty: 0.1,
          stream: false
        })
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DeepSeek API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data: DeepSeekResponse = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from DeepSeek API');
    }

    const chatResponse = data.choices[0].message.content;

    // For now, return empty artifact content since DeepSeek doesn't generate artifacts
    // Could be enhanced later with tool calling to generate artifacts
    return {
      chatResponse,
      artifactContent: '' // DeepSeek focuses on chat, not artifact generation
    };

  } catch (error) {
    console.error('DeepSeek API Error:', error);
    throw new Error(`DeepSeek chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const generateMixedResponse = async (
  prompt: string,
  previousArtifact: string,
  model: string,
  systemInstruction: string,
  conversationHistory: { role: string; text: string }[],
  extractedContent?: string,
  images?: { mimeType: string; data: string }[]
): Promise<{ chatResponse: string; artifactContent: string }> => {
  
  // Use reasoning models (DeepSeek/OpenRouter) for text chat - better Amharic understanding
  if (!images || images.length === 0) {
    console.log(`Using reasoning model for chat: ${model}`);
    
    const deepSeekResponse = await generateDeepSeekResponse(
      prompt, 
      conversationHistory, 
      extractedContent, 
      systemInstruction
    );
    
    // Check if user wants artifact generation
    const needsArtifact = prompt.toLowerCase().includes('create') || 
                         prompt.toLowerCase().includes('generate') || 
                         prompt.toLowerCase().includes('write') ||
                         prompt.toLowerCase().includes('ይፍጠሩ') ||
                         prompt.toLowerCase().includes('ይጻፉ') ||
                         prompt.toLowerCase().includes('code') ||
                         prompt.toLowerCase().includes('component');
    
    if (needsArtifact) {
      // Use Gemini for artifact generation but keep DeepSeek chat response
      try {
        const { generateResponse } = await import('./geminiService');
        const geminiResult = await generateResponse(prompt, previousArtifact, 'gemini-1.5-flash-latest', systemInstruction, images);
        
        return {
          chatResponse: deepSeekResponse.chatResponse, // Superior Amharic understanding
          artifactContent: geminiResult.artifactContent // Gemini's structured output
        };
      } catch (error) {
        console.warn('Gemini artifact generation failed, using DeepSeek only:', error);
        return deepSeekResponse;
      }
    }
    
    return deepSeekResponse;
  }
  
  // For image-based requests, use Gemini (multimodal capabilities)
  console.log('Using Gemini for image processing');
  const { generateResponse } = await import('./geminiService');
  return generateResponse(prompt, previousArtifact, 'gemini-1.5-flash-latest', systemInstruction, images);
};