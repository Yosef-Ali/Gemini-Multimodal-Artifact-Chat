import { GoogleGenAI, Type, Part, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const handleApiError = (error: unknown, operation: string): Error => {
  console.error(`Error during Gemini API ${operation}:`, error);
  let errorMessage: string;
  
  if (error instanceof Error) {
    const lowerCaseMessage = error.message.toLowerCase();
    if (lowerCaseMessage.includes('xhr error') || lowerCaseMessage.includes('rpc failed') || lowerCaseMessage.includes('500')) {
      errorMessage = `The ${operation} failed due to a network issue or an overly large request. Please try again, perhaps with fewer or smaller images.`;
    } else {
      errorMessage = `The ${operation} failed: ${error.message}`;
    }
  } else if (typeof error === 'object' && error !== null) {
    errorMessage = `The ${operation} failed with an unexpected error: ${JSON.stringify(error)}`;
  } else {
    errorMessage = `An unknown error occurred during the ${operation}.`;
  }

  return new Error(errorMessage);
};


const responseSchema = {
  type: Type.OBJECT,
  properties: {
    chatResponse: {
      type: Type.STRING,
      description: "A friendly, conversational response to the user's prompt. Acknowledge their request and provide any direct answers or commentary here."
    },
    artifactContent: {
      type: Type.STRING,
      description: "The complete, updated content for the artifact panel. If the user asks for code, a document, a list, etc., generate the full content here. If the user is just chatting or the artifact doesn't need to change, return the previous artifact content. This should always be the complete artifact, not just the changes."
    }
  }
};

export const generateResponse = async (
  prompt: string,
  previousArtifact: string,
  model: string,
  systemInstruction: string,
  images?: { mimeType: string; data: string }[]
): Promise<{ chatResponse: string; artifactContent: string }> => {
  try {
    const imageParts: Part[] = (images ?? []).map(image => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    }));

    const textParts: Part[] = [
        { text: `User Prompt: "${prompt}"`},
        { text: `Previous Artifact Content: \`\`\`\n${previousArtifact}\n\`\`\``}
    ];

    const parts: Part[] = [...imageParts, ...textParts];

    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.7,
      }
    });

    const text = response.text;
    if (!text) {
      console.error("Error generating response: API returned no text.", response);
      throw new Error('Received an empty or invalid response from the API.');
    }
    const jsonString = text.trim();
    
    // Basic validation that it's a JSON object
    if (!jsonString.startsWith('{') || !jsonString.endsWith('}')) {
        throw new Error('Received a non-JSON response from the API.');
    }
    
    const parsed = JSON.parse(jsonString) as { chatResponse?: string; artifactContent?: string };

    return {
        chatResponse: parsed.chatResponse ?? "I'm not sure how to respond to that, but here's the artifact.",
        artifactContent: parsed.artifactContent ?? previousArtifact
    };

  } catch (error) {
    throw handleApiError(error, "Chat Response");
  }
};

export const generateTitleFromContent = async (prompt: string, image?: { mimeType: string; data: string }): Promise<string> => {
  try {
    const parts: Part[] = [
      { text: `Generate a very short, concise title (5 words or less) for the following user prompt. The title should be plain text, without any special formatting or quotation marks. If an image is provided, incorporate a brief description of the image into the title.` },
      { text: `User Prompt: "${prompt}"` },
    ];

    if (image) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest", // Use the fast model for this simple task
      contents: [{ parts }],
      config: {
        temperature: 0.1,
        stopSequences: ["\n"]
      }
    });

    // Clean up response, remove quotes, and trim.
    const titleText = response.text;
    if (!titleText) {
      // Fallback if the API returns no text
      return prompt.substring(0, 30);
    }
    let title = titleText.trim().replace(/"/g, '');
    if (title.length > 50) { // Add a length check as a safeguard
        title = title.substring(0, 47) + '...';
    }
    return title || prompt.substring(0, 30); // Fallback to prompt if title is empty

  } catch (error) {
    console.error("Error generating title with Gemini API:", error);
    // Fallback to simple title generation on error
    const words = prompt.split(' ');
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + '...';
    }
    return prompt;
  }
};


export const generateImage = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/png',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return base64ImageBytes;
    } else {
      throw new Error("No image was generated by the API.");
    }
  } catch (error) {
    throw handleApiError(error, "Image Generation");
  }
};

export const editImage = async (prompt: string, image: { mimeType: string; data: string }): Promise<{ text: string | null; imageBase64: string | null; }> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash-latest',
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: image.data,
                            mimeType: image.mimeType,
                        },
                    },
                    {
                        text: prompt,
                    },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        let text: string | null = null;
        let imageBase64: string | null = null;

        if (response.candidates && response.candidates.length > 0) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    text = part.text;
                } else if (part.inlineData) {
                    imageBase64 = part.inlineData.data;
                }
            }
        }
        
        if (!text && !imageBase64) {
            throw new Error("No content was generated by the API.");
        }

        return { text, imageBase64 };
    } catch (error) {
        throw handleApiError(error, "Image Editing");
    }
};

const enhanceAmharicText = async (rawText: string): Promise<string> => {
  try {
    const amharicRefinementPrompt = `Fix this AMHARIC text (NOT Tigrinya). Correct OCR errors but keep all content:

**AMHARIC CORRECTIONS NEEDED:**
1. Fix common OCR errors: ሠ→ሰ, ኣ→አ, ሃ→ሀ  
2. Ensure proper Amharic script (not Tigrinya)
3. Keep ALL table data and page numbers
4. Preserve document structure exactly
5. Fix only obvious letter errors
6. Keep all biblical book names in Amharic

**Original text to fix:**
${rawText}

**Corrected Amharic text:**`;

    // Try Flash first, fallback to basic corrections if needed
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash-latest",
        contents: [{ parts: [{ text: amharicRefinementPrompt }] }],
        config: {
          temperature: 0.1,
        }
      });
    } catch (error: any) {
      // If quota exceeded, apply basic offline corrections
      if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        console.log("Quota exceeded, applying offline Amharic corrections...");
        return applyOfflineAmharicCorrections(rawText);
      }
      throw error;
    }

    const enhancedText = response.text;
    return enhancedText?.trim() || rawText;

  } catch (error) {
    console.warn("Amharic enhancement failed, applying offline corrections:", error);
    return applyOfflineAmharicCorrections(rawText);
  }
};

const organizeExtractedContent = async (rawText: string, imageCount: number): Promise<string> => {
  try {
    const organizationPrompt = `Organize this Catholic Catechism content from ${imageCount} pages - include TITLE, DESCRIPTION, and complete table:

**DOCUMENT:** "Compendium of the Catechism of the Catholic Church" - Amharic Translation

**ORGANIZATION REQUIREMENTS:**
1. **PRESERVE DOCUMENT HEADER** - Include title, subtitle, and description text
2. **HIERARCHICAL STRUCTURE** - Maintain proper levels (ክፍል → ምዕራፍ → topics)  
3. **COMPLETE CONTENT** - Don't skip any sections or page references
4. **CLEAN FORMATTING** - Use proper markdown tables and headers

**EXPECTED CONTENT TYPES:**
- Document title and description (ማውጫ)
- Main parts and chapter divisions (ክፍል፣ ምዕራፍ)
- Catholic doctrine topics (ትምህርት)
- Faith, Hope, Charity sections (እምነት፣ ተስፋ፣ ፍቅር)
- Prayer and sacrament topics (ጸሎት፣ ቅዱስ ሥርዓት)
- Page numbers and references

**OUTPUT FORMAT:**
Create a readable hierarchy using nested headings and lists, NOT a table:

# [Document Title in Amharic]
## [Document Description/Subtitle]

## ክፍል አንድ: [Main Part Name]

### ምዕራፍ አንድ: [Chapter Name]
- [Full Topic Title] - ገጽ [page]
- [Full Topic Title] - ገጽ [page]
- [Full Topic Title] - ገጽ [page]

### ምዕራፍ ሁለት: [Chapter Name]  
- [Full Topic Title] - ገጽ [page]
- [Full Topic Title] - ገጽ [page]

## ክፍል ሁለት: [Main Part Name]

### ምዕራፍ አንድ: [Chapter Name]
- [Full Topic Title] - ገጽ [page]
- [Full Topic Title] - ገጽ [page]

**HIERARCHY RULES:**
- Use # for document title
- Use ## for main parts (ክፍል)  
- Use ### for chapters (ምዕራፍ)
- Use bullet points (-) for individual topics
- Show page numbers with dash: "Full Topic Title - ገጽ 123"
- NO duplicate titles - each topic appears only once
- Use complete topic names, not abbreviated
- Clear visual hierarchy that's easy to read

**Raw extracted text:**
${rawText}

**Complete Organized Catholic Catechism:**`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest",
      contents: [{ parts: [{ text: organizationPrompt }] }],
      config: {
        temperature: 0.1,
      }
    });

    return response.text?.trim() || rawText;

  } catch (error) {
    console.warn("Content organization failed, returning raw text:", error);
    return rawText;
  }
};

const applyOfflineAmharicCorrections = (text: string): string => {
  // Apply common Amharic OCR corrections offline
  let corrected = text;
  
  // Common OCR mistakes in Amharic
  const corrections = [
    [/ሠ/g, 'ሰ'],     // ሠ → ሰ
    [/ኣ/g, 'አ'],      // ኣ → አ  
    [/ሃ/g, 'ሀ'],      // ሃ → ሀ
    [/ኧ/g, 'እ'],      // ኧ → እ
    [/ቀ([ይዩየዮዪዒ])/g, 'ቅ$1'], // ቀ + certain vowels → ቅ
  ];
  
  corrections.forEach(([pattern, replacement]) => {
    corrected = corrected.replace(pattern, replacement as string);
  });
  
  return corrected;
};

export const performOcr = async (images: { mimeType: string; data: string }[]): Promise<string> => {
  try {
    const enhanceImageForOcr = (imageDataUrl: string, maxWidth: number = 2048, maxHeight: number = 2048): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Scale up small images, down large ones for optimal OCR
          const scale = Math.min(maxWidth / width, maxHeight / height, 2); // Max 2x upscale
          width = Math.round(width * scale);
          height = Math.round(height * scale);

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Could not get canvas context'));
          }
          
          // Use better scaling algorithm
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Apply contrast enhancement instead of harsh binarization
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1]; 
            const b = data[i + 2];
            
            // Enhance contrast while preserving detail
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            const enhanced = Math.pow(gray / 255, 0.8) * 255; // Gamma correction
            const final = enhanced < 140 ? Math.max(0, enhanced - 20) : Math.min(255, enhanced + 20);
            
            data[i] = final;     // red
            data[i + 1] = final; // green  
            data[i + 2] = final; // blue
          }
          
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/png', 0.95)); // Use PNG for better text quality
        };
        img.onerror = (error) => {
          reject(error);
        };
        img.src = imageDataUrl;
      });
    };

    const processedImages = await Promise.all(
      images.map(async (image) => {
        try {
          if (image.mimeType !== 'image/gif') {
            const processedData = await enhanceImageForOcr(`data:${image.mimeType};base64,${image.data}`);
            const [_, base64Data] = processedData.split(',');
            return {
              mimeType: 'image/png',
              data: base64Data,
            };
          }
          return image;
        } catch (error) {
          console.warn("Image preprocessing failed, using original:", error);
          return image; // Fallback to original image
        }
      })
    );

    console.log(`Processing ${images.length} images for OCR...`);
    
    // Enhanced OCR prompt for complete Catholic Catechism with title and description
    const parts: Part[] = [
      { text: `EXTRACT COMPLETE CATHOLIC CATECHISM CONTENT from these ${images.length} images. Extract EVERYTHING: titles, descriptions, and hierarchical table.

**DOCUMENT:** "የካቶሊክ ቤተ ክርስቲያን ትምህርት ማጠቃለያ" (Compendium of Catholic Catechism)

**COMPLETE EXTRACTION REQUIRED:**

1. **DOCUMENT HEADER** - Extract title, subtitle, and any description text at the top
2. **TABLE OF CONTENTS** - Extract complete hierarchical structure:
   - **MAIN PARTS** (ክፍል) - Highest level sections 
   - **CHAPTERS** (ምዕራፍ) - Mid-level chapters
   - **TOPICS** - Individual doctrine topics with page numbers

**CRITICAL SCANNING:**
- Read EVERY line of text from top to bottom
- Don't skip headers, titles, or descriptions  
- Identify actual hierarchy levels: main parts (ክፍል), chapters (ምዕራፍ), and individual topics
- Extract real topic names, not generic repeated phrases
- Include EVERY page number reference
- Preserve exact Amharic text and formatting
- Look for actual content structure, not just keywords

**OUTPUT FORMAT:**
First show the document header/title information, then the complete table:

**Document Title & Description:**
[Extract any title, subtitle, and description text here]

**Complete Table of Contents:**
| Level | Content (ክፍል/ምዕራፍ/ርዕስ) | Page (ገጽ) |
|---|---|---|
| Part | [Main section name] | |
| Chapter | [Chapter name] | |
| Topic | [Individual topic] | [page] |

**SCAN ALL ${images.length} IMAGES COMPLETELY - MISS NOTHING:**` },
    ];

    // Add images in order with page labels
    processedImages.forEach((image, index) => {
        parts.push({
            text: `--- IMAGE ${index + 1} OF ${images.length} ---`
        });
        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            },
        });
    });

    // Stage 1: Enhanced OCR with Amharic-specific prompts
    const ocrResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash-latest", // Use Flash to avoid quota limits
      contents: [{ parts }],
      config: {
        temperature: 0,
      }
    });

    const rawExtractedText = ocrResponse.text;

    // Handle cases where the API returns no text content
    if (!rawExtractedText) { 
        console.warn("Gemini API for OCR returned no text.", ocrResponse);
        const finishReason = ocrResponse?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error("The OCR request was blocked due to safety settings. Please check the input images.");
        }
        if (finishReason && finishReason !== 'STOP') {
             throw new Error(`OCR failed. The model stopped for reason: ${finishReason}.`);
        }
        return "No text could be extracted from the provided image(s). They may be empty or unclear.";
    }
    
    // Handle the case where the model correctly follows the prompt for no text.
    if (rawExtractedText.trim().toLowerCase() === 'no text found.') {
        return "No text could be extracted from the provided image(s).";
    }

    const trimmedText = rawExtractedText.trim();

    // Debug logging
    console.log("OCR Raw result:", rawExtractedText.substring(0, 200) + "...");
    console.log("OCR Full length:", rawExtractedText.length);
    
    // Stage 2: Enhance Amharic text only if it contains Amharic characters
    const hasAmharicText = /[\u1200-\u137F]/.test(trimmedText);
    console.log("Amharic detected:", hasAmharicText);
    
    // Stage 2: Organize and structure the extracted content
    const organizedText = await organizeExtractedContent(trimmedText, images.length);
    
    // Stage 3: Apply Amharic corrections
    if (hasAmharicText) {
      console.log("Applying Amharic corrections...");
      const correctedText = applyOfflineAmharicCorrections(organizedText);
      console.log("Correction result:", correctedText.substring(0, 200) + "...");
      return correctedText;
    }

    return organizedText;

  } catch (error) {
    throw handleApiError(error, "OCR Operation");
  }
};