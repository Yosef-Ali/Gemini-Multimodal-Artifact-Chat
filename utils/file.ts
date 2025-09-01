// Add this declaration to inform TypeScript about the global Tiff variable from the CDN script
declare var Tiff: any;

const MAX_IMAGE_DIMENSION = 1024; // Max width or height for API submission

// This helper function will handle resizing and encoding images to JPEG.
const processAndEncode = (
  canvas: HTMLCanvasElement, 
  resolve: (value: { mimeType: string; data: string; }) => void, 
  reject: (reason?: any) => void
) => {
  let finalCanvas = canvas;
  const { width, height } = canvas;

  // Resize if the image is larger than the max dimension
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    let newWidth, newHeight;
    if (width > height) {
      newWidth = MAX_IMAGE_DIMENSION;
      newHeight = Math.round((height * MAX_IMAGE_DIMENSION) / width);
    } else {
      newHeight = MAX_IMAGE_DIMENSION;
      newWidth = Math.round((width * MAX_IMAGE_DIMENSION) / height);
    }

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    const ctx = resizedCanvas.getContext('2d');
    if (!ctx) {
      // If context fails, warn but proceed with the original canvas for encoding
      console.warn("Could not get 2D context for resizing, using original image dimensions for encoding.");
    } else {
      ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
      finalCanvas = resizedCanvas;
    }
  }

  // Always use JPEG with a reasonable quality setting to reduce file size.
  // This is crucial for preventing API payload size errors.
  const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
  const [, data] = dataUrl.split(',');

  if (data) {
    resolve({ mimeType: 'image/jpeg', data });
  } else {
    reject(new Error("Could not parse the final image data URL."));
  }
};

export const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
  return new Promise((resolve, reject) => {
    // Handle TIFF separately as it requires a special library for decoding.
    if (file.type === 'image/tiff' || file.name.toLowerCase().endsWith('.tiff') || file.name.toLowerCase().endsWith('.tif')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result;
          if (!buffer) {
            return reject(new Error("Failed to read TIFF file into buffer."));
          }
          const tiff = new Tiff({ buffer });
          const canvas = tiff.toCanvas();
          if (!canvas) {
            return reject(new Error("Failed to convert TIFF to canvas."));
          }
          // All TIFFs are processed and encoded to JPEG.
          processAndEncode(canvas, resolve, reject);
        } catch (err) {
          console.error("Error during TIFF conversion:", err);
          reject(new Error("An error occurred while converting the TIFF file."));
        }
      };
      reader.onerror = error => reject(error);
      reader.readAsArrayBuffer(file);
      return;
    }

    // For standard image types (PNG, JPEG, WEBP), use an Image object.
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      
      // Condition to optimize: if it's already a reasonably sized JPEG, just pass it through.
      // Otherwise, process it to resize and/or convert to JPEG.
      if (img.width <= MAX_IMAGE_DIMENSION && img.height <= MAX_IMAGE_DIMENSION && file.type === 'image/jpeg') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          const [header, data] = result.split(',');
          const mimeType = header.match(/:(.*?);/)?.[1];
          if (mimeType && data) {
            resolve({ mimeType, data });
          } else {
            reject(new Error("Could not parse file data URL."));
          }
        };
        reader.onerror = error => reject(error);
      } else {
        // All large images, or non-JPEG formats like PNG, are processed via canvas.
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error("Could not get canvas context."));
        }
        ctx.drawImage(img, 0, 0);
        processAndEncode(canvas, resolve, reject);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image for processing. The file might be corrupt or an unsupported format."));
    };
    img.src = URL.createObjectURL(file);
  });
};