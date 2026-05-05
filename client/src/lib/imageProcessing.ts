/**
 * Utility functions for HTML5 Canvas image processing.
 * No external dependencies required.
 */

export interface ImageAdjustments {
  brightness: number; // 0 to 200 (100 = default)
  contrast: number;   // 0 to 200 (100 = default)
  saturation: number; // 0 to 200 (100 = default)
  blur: number;       // 0 to 20px (0 = default)
}

export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorState {
  rotation: number; // 0, 90, 180, 270
  flipH: boolean;
  flipV: boolean;
  filter: string; // CSS filter string like "sepia(100%)"
  adjustments: ImageAdjustments;
  crop: ImageCrop | null;
}

export const defaultEditorState: EditorState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  filter: 'none',
  adjustments: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
  crop: null,
};

/**
 * Helper to build the CSS filter string
 */
export function buildFilterString(state: EditorState): string {
  const { brightness, contrast, saturation, blur } = state.adjustments;
  let filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;
  if (state.filter !== 'none') {
    filterStr += ` ${state.filter}`;
  }
  return filterStr;
}

/**
 * Loads an image from a URL into an HTMLImageElement
 */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Important for canvas CORS
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

/**
 * Applies all edits (crop, rotate, filters) and returns a Blob
 */
export async function processImage(imageUrl: string, state: EditorState, mimeType = 'image/jpeg', quality = 0.9): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Cannot get canvas context');

  // 1. Calculate dimensions after rotation
  const isRotated = state.rotation === 90 || state.rotation === 270;
  
  let sourceWidth = img.width;
  let sourceHeight = img.height;
  let sourceX = 0;
  let sourceY = 0;

  // Apply crop initially if exists (before rotation transformations)
  // For MVP: we assume crop is just a subset of the original image box
  if (state.crop) {
    sourceX = state.crop.x;
    sourceY = state.crop.y;
    sourceWidth = state.crop.width;
    sourceHeight = state.crop.height;
  }

  // Set final canvas bounds based on rotation
  if (isRotated) {
    canvas.width = sourceHeight;
    canvas.height = sourceWidth;
  } else {
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;
  }

  // 2. Set filters *before* drawing
  ctx.filter = buildFilterString(state);

  // 3. Move origin to center for rotation/flip
  ctx.translate(canvas.width / 2, canvas.height / 2);
  
  // 4. Apply transformations
  // Flip
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  // Rotate
  ctx.rotate((state.rotation * Math.PI) / 180);

  // 5. Draw image
  // We draw it offset by half its source dimensions because we translated to the center
  ctx.drawImage(
    img, 
    sourceX, sourceY, sourceWidth, sourceHeight, 
    -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, mimeType, quality);
  });
}
