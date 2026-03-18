/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ImageGenerationRequest {
  prompt: string;
  inputImage?: string;
  outputCount?: number;
  mode: 'generate' | 'edit' | 'restore';
  // Batch generation options
  styles?: string[];
  variations?: string[];
  format?: 'grid' | 'separate';
  fileFormat?: 'png' | 'jpeg';
  seed?: number;
  // Image quality/size options
  aspectRatio?: string;
  imageSize?: string;
  // Reference image options
  referenceImages?: string[];
  referenceMode?: ReferenceMode;
  // Preview options
  preview?: boolean;
  noPreview?: boolean;
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

export interface StorySequenceArgs {
  type?: string;
  style?: string;
  transition?: string;
}

export interface IconPromptArgs {
  prompt?: string;
  type?: string;
  style?: string;
  background?: string;
  corners?: string;
}

export interface PatternPromptArgs {
  prompt?: string;
  type?: string;
  style?: string;
  density?: string;
  colors?: string;
  size?: string;
}

export interface DiagramPromptArgs {
  prompt?: string;
  type?: string;
  style?: string;
  layout?: string;
  complexity?: string;
  colors?: string;
  annotations?: string;
}

export type ReferenceMode = 'style_transfer' | 'composition' | 'consistency';

export interface ResolvedImage {
  data: string;        // base64
  mimeType: string;    // e.g. 'image/jpeg'
  sourcePath: string;  // resolved absolute path
}
