import { GoogleGenAI, Type, Part, Modality } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
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
      model: "gemini-2.5-flash", // Use the fast model for this simple task
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
            model: 'gemini-2.5-flash-image-preview',
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

export const performOcr = async (images: { mimeType: string; data: string }[]): Promise<string> => {
  try {
    const parts: Part[] = [
      { text: "You are an Optical Character Recognition (OCR) specialist. Your task is to extract all text from the provided image(s). If multiple images are pages of a single document, return the text in the correct order. If you cannot find any text in the images, you MUST return the string 'No text found.'. Do not add any other commentary or explanations." },
    ];

    for (const image of images) {
        parts.push({
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            },
        });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts }],
      config: {
        temperature: 0,
      }
    });

    const extractedText = response.text;

    // Handle cases where the API returns no text content
    if (!extractedText) { 
        console.warn("Gemini API for OCR returned no text.", response);
        const finishReason = response?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
            throw new Error("The OCR request was blocked due to safety settings. Please check the input images.");
        }
        if (finishReason && finishReason !== 'STOP') {
             throw new Error(`OCR failed. The model stopped for reason: ${finishReason}.`);
        }
        // Fallback message if the model ignores instructions and returns nothing.
        return "No text could be extracted from the provided image(s). They may be empty or unclear.";
    }
    
    // Handle the case where the model correctly follows the prompt for no text.
    if (extractedText.trim().toLowerCase() === 'no text found.') {
        return "No text could be extracted from the provided image(s).";
    }

    return extractedText.trim();

  } catch (error) {
    throw handleApiError(error, "OCR Operation");
  }
};