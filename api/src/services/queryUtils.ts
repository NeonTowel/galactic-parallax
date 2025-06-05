/**
 * Universal query crafting utility for optimizing search queries
 * across all search engines to return high-quality wallpapers
 */

import { SEARCH_ENGINE_CONFIG } from '../config/searchEngines';

/**
 * Debug logging utility that respects configuration settings
 */
export function debugLog(category: keyof typeof SEARCH_ENGINE_CONFIG.DEBUG, message: string, data?: any): void {
  if (!SEARCH_ENGINE_CONFIG.DEBUG.ENABLED) return;
  
  const shouldLog = SEARCH_ENGINE_CONFIG.DEBUG[category];
  if (!shouldLog) return;
  
  if (data) {
    console.log(message, data);
  } else {
    console.log(message);
  }
}

export interface QueryCraftingOptions {
  orientation?: 'landscape' | 'portrait';
  includeQualityTerms?: boolean;
  includeOrientationTerms?: boolean;
  useTbsParameters?: boolean;
  engine?: string;
}

export interface TbsParameters {
  imageSize?: 'isz:l' | 'isz:m' | 'isz:i' | 'isz:lt' | 'isz:mt';
  imageSizeLimit?: 'islt:2mp' | 'islt:4mp' | 'islt:6mp' | 'islt:8mp' | 'islt:10mp' | 'islt:12mp' | 'islt:15mp' | 'islt:20mp' | 'islt:40mp' | 'islt:70mp';
  imageType?: 'itp:photo' | 'itp:clipart' | 'itp:lineart' | 'itp:face' | 'itp:news' | 'itp:stock';
  aspectRatio?: 'imgar:t' | 'imgar:s' | 'imgar:w' | 'imgar:xw' | 'imgar:xxw';
  imageColor?: 'ic:color' | 'ic:gray' | 'ic:mono' | 'ic:trans';
  imageColorFilter?: 'ic:specific,isc:black' | 'ic:specific,isc:blue' | 'ic:specific,isc:brown' | 'ic:specific,isc:gray' | 'ic:specific,isc:green' | 'ic:specific,isc:orange' | 'ic:specific,isc:pink' | 'ic:specific,isc:purple' | 'ic:specific,isc:red' | 'ic:specific,isc:teal' | 'ic:specific,isc:white' | 'ic:specific,isc:yellow';
  usage?: 'sur:fmc' | 'sur:fc' | 'sur:fm' | 'sur:f';
  time?: 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y';
}

/**
 * Generates TBS parameters for Google Image Search optimization
 */
export function generateTbsParameters(
  orientation?: 'landscape' | 'portrait',
  customTbs?: Partial<TbsParameters>
): string {
  const tbsParams: string[] = [];

  // High-quality image parameters for wallpapers
  tbsParams.push('isz:lt'); // Large or larger images
  tbsParams.push('islt:2mp'); // 2MP or higher resolution
  tbsParams.push('itp:photo'); // Photo type only (excludes clipart, drawings)
  tbsParams.push('ic:color'); // Color images only (excludes grayscale)

  // Orientation-based aspect ratio
  if (orientation === 'portrait') {
    tbsParams.push('imgar:t'); // Tall/portrait aspect ratio
  } else if (orientation === 'landscape') {
    tbsParams.push('imgar:w'); // Wide/landscape aspect ratio
  }

  // Apply custom TBS parameters if provided
  if (customTbs) {
    Object.values(customTbs).forEach(param => {
      if (param && typeof param === 'string') {
        tbsParams.push(param);
      }
    });
  }

  return tbsParams.join(',');
}

/**
 * Crafts a search query optimized for high-quality wallpapers
 * This function is used universally across all search engines
 */
export function craftWallpaperQuery(
  userQuery: string, 
  options: QueryCraftingOptions = {}
): { query: string; tbs?: string } {
  const {
    orientation,
    includeQualityTerms = false, // Default to false when using TBS
    includeOrientationTerms = false, // Default to false when using TBS
    useTbsParameters = true
  } = options;

  const queryParts: string[] = [userQuery];

  // Only add manual quality terms if not using TBS parameters
  if (includeQualityTerms && !useTbsParameters) {
    const qualityTerms = [
      'wallpaper',
      '2K OR UHD OR 4K OR "ultra hd"',
      'high resolution',
      '-screenshot',
      '-icon',
      '-logo'
    ];
    queryParts.push(...qualityTerms);
  }

  // Only add manual orientation terms if not using TBS parameters
  if (includeOrientationTerms && orientation && !useTbsParameters) {
    const orientationTerms = orientation === 'portrait' 
      ? ['mobile', 'vertical', 'portrait'] 
      : ['widescreen', 'desktop', 'landscape'];
    queryParts.push(...orientationTerms);
  }

  const result: { query: string; tbs?: string } = {
    query: queryParts.join(' ')
  };

  // Generate TBS parameters if enabled
  if (useTbsParameters) {
    result.tbs = generateTbsParameters(orientation);
  }

  return result;
}

/**
 * Validates if a URL is a proper image URL
 * Used to filter out invalid thumbnail URLs
 */
export function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    
    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) return false;
    
    // Should not be data URLs or blob URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) return false;
    
    // Should have a reasonable length
    if (url.length > 2000) return false;
    
    // Should contain common image file extensions or be from known image services
    const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
    const isKnownImageService = /\b(gstatic|imgur|unsplash|pexels|pixabay|flickr)\b/i.test(url);
    
    return hasImageExtension || isKnownImageService;
  } catch {
    return false;
  }
}

/**
 * Extracts MIME type from URL
 */
export function getMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg'; // Default fallback
  }
}

/**
 * Extracts file format from URL
 */
export function getFileFormatFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0];
  return extension || 'jpg';
}

/**
 * Minimal wallpaper query that lets TBS parameters do the heavy lifting
 * This approach maximizes flexibility while maintaining quality through technical filters
 */
export function craftMinimalWallpaperQuery(
  userQuery: string, 
  options: QueryCraftingOptions = {}
): { query: string; orTerms?: string; excludeTerms?: string; tbs?: string } {
  
  const {
    orientation,
    useTbsParameters = true
  } = options;

  const result = {
    // Pure user input - maximum flexibility
    query: userQuery,
    
    // OPTIONAL quality/context boost (not required)
    // This just helps ranking but doesn't exclude results
    orTerms: 'wallpaper background 4K UHD "high resolution"',
    
    // Focus on excluding obvious non-wallpapers
    excludeTerms: 'screenshot thumbnail preview icon logo clipart avatar profile "stock photo" pinterest getty steamusercontent steamcommunity webp youtube',
    
    // Let TBS parameters handle size, quality, and type filtering
    tbs: useTbsParameters ? generateAdvancedTbsParameters(orientation) : undefined
  };

  return result;
}

/**
 * Generates advanced TBS parameters for aggressive technical filtering
 */
function generateAdvancedTbsParameters(orientation?: 'landscape' | 'portrait'): string {
  const tbsParams: string[] = [];

  // Very aggressive technical filtering since we're being flexible with keywords
  tbsParams.push('isz:lt');        // Large or larger images only
  tbsParams.push('islt:2mp');      // 6MP minimum (higher than before)
  tbsParams.push('itp:photo');     // Photos only, no clipart
  tbsParams.push('ic:color');      // Color images only

  // Strict aspect ratio filtering
  if (orientation === 'portrait') {
    tbsParams.push('imgar:t');     // Tall aspect ratio
  } else if (orientation === 'landscape') {
    tbsParams.push('imgar:w');     // Wide aspect ratio
  }

  return tbsParams.join(',');
} 