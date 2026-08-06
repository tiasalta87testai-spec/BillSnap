import imageCompression from 'browser-image-compression';
import { ProcessedImage } from './types';

export async function processImage(file: File): Promise<ProcessedImage> {
  const originalSize = file.size;
  let processedFile = file;

  // 1. Converti HEIC → JPEG se necessario
  if (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')
  ) {
    try {
      const heic2any = (await import('heic2any')).default;
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const convertedBlob = Array.isArray(blob) ? blob[0] : blob;
      processedFile = new File(
        [convertedBlob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg' }
      );
    } catch (e) {
      console.warn('Conversione HEIC non riuscita, procedo con file originale', e);
    }
  }

  // 2. Comprimi e ridimensiona
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  try {
    const compressed = await imageCompression(processedFile, options);
    return {
      file: compressed,
      previewUrl: URL.createObjectURL(compressed),
      originalSize,
      compressedSize: compressed.size,
    };
  } catch (err) {
    console.error('Errore durante la compressione immagine:', err);
    return {
      file: processedFile,
      previewUrl: URL.createObjectURL(processedFile),
      originalSize,
      compressedSize: processedFile.size,
    };
  }
}
