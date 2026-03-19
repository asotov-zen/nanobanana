/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ImageGenerationRequest {
  prompt: string;
  inputImage?: string;
  seed?: number;
  aspectRatio?: string;
  imageSize?: string;
  referenceImages?: string[];
  referenceMode?: ReferenceMode;
  preview?: boolean;
}

export interface ImageGenerationResponse {
  success: boolean;
  message: string;
  generatedFiles?: string[];
  error?: string;
}

export interface AuthConfig {
  apiKey: string;
}

export interface FileSearchResult {
  found: boolean;
  filePath?: string;
  searchedPaths: string[];
}

export type ReferenceMode = 'style_transfer' | 'composition' | 'consistency';

export interface ResolvedImage {
  data: string;        // base64
  mimeType: string;    // e.g. 'image/jpeg'
  sourcePath: string;  // resolved absolute path
}
