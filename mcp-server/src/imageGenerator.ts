/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { FileHandler } from './fileHandler.js';
import {
  ImageGenerationRequest,
  ImageGenerationResponse,
  AuthConfig,
  ReferenceMode,
} from './types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ImageGenerator {
  private ai: GoogleGenAI;
  private modelName: string;
  private static readonly DEFAULT_MODEL = 'gemini-3.1-flash-image-preview';

  constructor(authConfig: AuthConfig) {
    this.ai = new GoogleGenAI({
      apiKey: authConfig.apiKey,
    });
    this.modelName =
      process.env.NANOBANANA_MODEL || ImageGenerator.DEFAULT_MODEL;
    console.error(`DEBUG - Using image model: ${this.modelName}`);
  }

  private async openImagePreview(filePath: string): Promise<void> {
    try {
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'darwin': // macOS
          command = `open "${filePath}"`;
          break;
        case 'win32': // Windows
          command = `start "" "${filePath}"`;
          break;
        default: // Linux and others
          command = `xdg-open "${filePath}"`;
          break;
      }

      await execAsync(command);
      console.error(`DEBUG - Opened preview for: ${filePath}`);
    } catch (error: unknown) {
      console.error(
        `DEBUG - Failed to open preview for ${filePath}:`,
        error instanceof Error ? error.message : String(error),
      );
      // Don't throw - preview failure shouldn't break image generation
    }
  }

  private shouldAutoPreview(request: { preview?: boolean }): boolean {
    return request.preview === true;
  }

  private buildGenerationConfig(request: { aspectRatio?: string; imageSize?: string; seed?: number }): Record<string, unknown> {
    const config: Record<string, unknown> = {
      responseModalities: ['TEXT', 'IMAGE'],
    };

    if (request.seed !== undefined) {
      config.seed = request.seed;
    }

    const imageConfig: Record<string, string> = {};
    if (request.aspectRatio) {
      imageConfig.aspectRatio = request.aspectRatio;
    }
    if (request.imageSize) {
      imageConfig.imageSize = request.imageSize;
    }
    if (Object.keys(imageConfig).length > 0) {
      config.imageConfig = imageConfig;
    }

    return config;
  }

  private async handlePreview(
    files: string[],
    request: { preview?: boolean },
  ): Promise<void> {
    if (!this.shouldAutoPreview(request) || !files.length) {
      return;
    }

    console.error(
      `DEBUG - Opening ${files.length} image(s) for preview`,
    );

    const previewPromises = files.map((file) => this.openImagePreview(file));
    await Promise.all(previewPromises);
  }

  static validateAuthentication(): AuthConfig {
    const nanoKey = process.env.NANOBANANA_API_KEY;
    if (nanoKey) {
      console.error('✓ Found NANOBANANA_API_KEY environment variable');
      return { apiKey: nanoKey };
    }

    const nanoGeminiKey = process.env.NANOBANANA_GEMINI_API_KEY;
    if (nanoGeminiKey) {
      console.error('✓ Found NANOBANANA_GEMINI_API_KEY environment variable (fallback)');
      return { apiKey: nanoGeminiKey };
    }

    const nanoGoogleKey = process.env.NANOBANANA_GOOGLE_API_KEY;
    if (nanoGoogleKey) {
      console.error('✓ Found NANOBANANA_GOOGLE_API_KEY environment variable (fallback)');
      return { apiKey: nanoGoogleKey };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      console.error(
        '✓ Found GEMINI_API_KEY environment variable (fallback)',
      );
      return { apiKey: geminiKey };
    }

    const googleKey = process.env.GOOGLE_API_KEY;
    if (googleKey) {
      console.error(
        '✓ Found GOOGLE_API_KEY environment variable (fallback)',
      );
      return { apiKey: googleKey };
    }

    throw new Error(
      'ERROR: No valid API key found. Please set NANOBANANA_API_KEY environment variable.\n' +
        'Fallback variables: NANOBANANA_GEMINI_API_KEY, NANOBANANA_GOOGLE_API_KEY, GEMINI_API_KEY, GOOGLE_API_KEY.\n' +
        'For more details on authentication, visit: https://geminicli.com/docs/get-started/authentication/',
    );
  }

  private isValidBase64ImageData(data: string): boolean {
    if (!data || data.length < 100) {
      return false;
    }

    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(data)) {
      return false;
    }

    if (data.length < 1000) {
      console.error(
        'DEBUG - Skipping short data that may not be image:',
        data.length,
        'characters',
      );
      return false;
    }

    return true;
  }

  async generateImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    if (request.referenceImages && request.referenceImages.length > 0) {
      return this.generateWithReferences(request);
    }

    if (request.inputImage) {
      return this.generateWithInputImage(request);
    }

    return this.generateFromText(request);
  }

  private async generateFromText(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    try {
      const outputPath = FileHandler.ensureOutputDirectory();

      console.error('DEBUG - Generating image from text prompt');

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: request.prompt }],
          },
        ],
        config: this.buildGenerationConfig(request),
      });

      console.error('DEBUG - API Response received');

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          let imageBase64: string | undefined;

          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            console.error('DEBUG - Found image data in inlineData:', {
              length: imageBase64.length,
              mimeType: part.inlineData.mimeType,
            });
          } else if (part.text && this.isValidBase64ImageData(part.text)) {
            imageBase64 = part.text;
            console.error(
              'DEBUG - Found image data in text field (fallback)',
            );
          }

          if (imageBase64) {
            const filename = FileHandler.generateFilename(
              request.prompt,
              'png',
              0,
            );
            const fullPath = await FileHandler.saveImageFromBase64(
              imageBase64,
              outputPath,
              filename,
            );

            await this.handlePreview([fullPath], request);

            return {
              success: true,
              message: 'Successfully generated image',
              generatedFiles: [fullPath],
            };
          }
        }
      }

      return {
        success: false,
        message: 'Failed to generate image',
        error: 'No image data found in API response',
      };
    } catch (error: unknown) {
      console.error('DEBUG - Error in generateFromText:', error);
      return {
        success: false,
        message: 'Failed to generate image',
        error: this.handleApiError(error),
      };
    }
  }

  private async generateWithInputImage(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    try {
      if (!request.inputImage) {
        return {
          success: false,
          message: 'Input image file is required for editing',
          error: 'Missing inputImage parameter',
        };
      }

      const fileResult = FileHandler.findInputFile(request.inputImage);
      if (!fileResult.found) {
        return {
          success: false,
          message: `Input image not found: ${request.inputImage}`,
          error: `Searched in: ${fileResult.searchedPaths.join(', ')}`,
        };
      }

      const outputPath = FileHandler.ensureOutputDirectory();
      const imageBase64 = await FileHandler.readImageAsBase64(
        fileResult.filePath!,
      );

      const mimeType = FileHandler.getMimeTypeFromExtension(fileResult.filePath!);

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: request.prompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType,
                },
              },
            ],
          },
        ],
        config: this.buildGenerationConfig(request),
      });

      console.error('DEBUG - Edit API Response received');

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          let resultImageBase64: string | undefined;

          if (part.inlineData?.data) {
            resultImageBase64 = part.inlineData.data;
            console.error('DEBUG - Found edited image in inlineData:', {
              length: resultImageBase64.length,
              mimeType: part.inlineData.mimeType,
            });
          } else if (part.text && this.isValidBase64ImageData(part.text)) {
            resultImageBase64 = part.text;
            console.error(
              'DEBUG - Found edited image in text field (fallback)',
            );
          }

          if (resultImageBase64) {
            const filename = FileHandler.generateFilename(
              request.prompt,
              'png',
              0,
            );
            const fullPath = await FileHandler.saveImageFromBase64(
              resultImageBase64,
              outputPath,
              filename,
            );

            await this.handlePreview([fullPath], request);

            return {
              success: true,
              message: 'Successfully edited image',
              generatedFiles: [fullPath],
            };
          }
        }
      }

      return {
        success: false,
        message: 'Failed to edit image',
        error: 'No image data in response',
      };
    } catch (error: unknown) {
      console.error('DEBUG - Error in generateWithInputImage:', error);
      return {
        success: false,
        message: 'Failed to edit image',
        error: this.handleApiError(error),
      };
    }
  }

  private handleApiError(error: unknown): string {
    const errorMessage =
      error instanceof Error ? error.message : String(error).toLowerCase();

    if (errorMessage.includes('api key not valid')) {
      return 'Authentication failed: The provided API key is invalid. Please check your NANOBANANA_API_KEY environment variable.';
    }

    if (errorMessage.includes('permission denied')) {
      return 'Authentication failed: The provided API key does not have the necessary permissions for the Gemini API. Please check your Google Cloud project settings.';
    }

    if (errorMessage.includes('quota exceeded')) {
      return 'API quota exceeded. Please check your usage and limits in the Google Cloud console.';
    }

    if (
      error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response
    ) {
      const responseError = error as {
        response: { status: number; statusText: string };
      };
      const { status } = responseError.response;

      switch (status) {
        case 400:
          return 'The request was malformed. This may be due to an issue with the prompt. Please check for safety violations or unsupported content.';
        case 403:
          return 'Authentication failed. Please ensure your API key (e.g., NANOBANANA_API_KEY) is valid and has the necessary permissions.';
        case 500:
          return 'The image generation service encountered a temporary internal error. Please try again later.';
        default:
          return `API request failed with status ${status}. Please check your connection and API key.`;
      }
    }

    return `An unexpected error occurred: ${errorMessage}`;
  }

  private async loadAndBuildReferenceImageParts(
    filenames: string[],
  ): Promise<{
    parts: Array<{ inlineData: { data: string; mimeType: string } }>;
    loadedCount: number;
    errors: string[];
  }> {
    const { images, errors } =
      await FileHandler.findAndReadMultipleImages(filenames);

    const parts = images.map((img) => ({
      inlineData: {
        data: img.data,
        mimeType: img.mimeType,
      },
    }));

    return { parts, loadedCount: images.length, errors };
  }

  private buildReferencePrompt(
    basePrompt: string,
    mode: ReferenceMode | undefined,
    referenceCount: number,
    hasPrimaryImage: boolean,
  ): string {
    const effectiveMode = mode || 'consistency';
    let prompt = basePrompt;

    switch (effectiveMode) {
      case 'style_transfer':
        if (hasPrimaryImage) {
          prompt += `. The first image is the content to transform.`;
          prompt += ` The remaining ${referenceCount} image(s) are the style references.`;
          prompt += ' Apply the visual style from the style reference images to the content image.';
        } else {
          prompt += `. Use the ${referenceCount} provided reference image(s) as style references.`;
          prompt += ' Apply the visual style from the reference images to the generated content.';
        }
        prompt += ' Maintain the composition and subjects while applying the new style.';
        break;

      case 'composition':
        prompt += `. Combine all ${referenceCount} provided reference image(s) into a single cohesive composition.`;
        prompt += ' Blend the elements naturally, maintaining visual harmony and consistent lighting.';
        break;

      case 'consistency':
        prompt += `. Use the ${referenceCount} provided reference image(s) to maintain visual consistency.`;
        prompt += ' Keep the same characters, objects, art style, and visual identity from the references while placing them in the new scene described above.';
        break;
    }

    return prompt;
  }

  private async generateWithReferences(
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    try {
      const refImages = request.referenceImages!;
      if (refImages.length < 1 || refImages.length > 14) {
        return {
          success: false,
          message: 'Reference images must contain between 1 and 14 images',
          error: `Received ${refImages.length} images`,
        };
      }

      const { parts: referenceParts, loadedCount, errors } =
        await this.loadAndBuildReferenceImageParts(refImages);

      if (loadedCount === 0) {
        return {
          success: false,
          message: 'Failed to load any reference images',
          error: errors.join('; '),
        };
      }

      if (errors.length > 0) {
        console.error(
          `DEBUG - Partial image load failures: ${errors.join('; ')}`,
        );
      }

      const outputPath = FileHandler.ensureOutputDirectory();
      const hasPrimaryImage = !!request.inputImage;

      const augmentedPrompt = this.buildReferencePrompt(
        request.prompt,
        request.referenceMode,
        loadedCount,
        hasPrimaryImage,
      );

      const parts: Array<
        { text: string } | { inlineData: { data: string; mimeType: string } }
      > = [{ text: augmentedPrompt }];

      if (request.inputImage) {
        const fileResult = FileHandler.findInputFile(request.inputImage);
        if (!fileResult.found || !fileResult.filePath) {
          return {
            success: false,
            message: `Input image not found: ${request.inputImage}`,
            error: `Searched in: ${fileResult.searchedPaths.join(', ')}`,
          };
        }
        const primaryBase64 = await FileHandler.readImageAsBase64(
          fileResult.filePath,
        );
        const primaryMimeType = FileHandler.getMimeTypeFromExtension(
          fileResult.filePath,
        );
        parts.push({
          inlineData: {
            data: primaryBase64,
            mimeType: primaryMimeType,
          },
        });
      }

      parts.push(...referenceParts);

      console.error(
        `DEBUG - Sending reference request with ${loadedCount} reference image(s)${hasPrimaryImage ? ' + primary image' : ''}`,
      );

      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: this.buildGenerationConfig(request),
      });

      console.error('DEBUG - Reference API Response received');

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          let imageBase64: string | undefined;

          if (part.inlineData?.data) {
            imageBase64 = part.inlineData.data;
            console.error('DEBUG - Found image in inlineData:', {
              length: imageBase64.length,
              mimeType: part.inlineData.mimeType,
            });
          } else if (part.text && this.isValidBase64ImageData(part.text)) {
            imageBase64 = part.text;
            console.error(
              'DEBUG - Found image in text field (fallback)',
            );
          }

          if (imageBase64) {
            const filename = FileHandler.generateFilename(
              request.prompt,
              'png',
              0,
            );
            const fullPath = await FileHandler.saveImageFromBase64(
              imageBase64,
              outputPath,
              filename,
            );

            await this.handlePreview([fullPath], request);

            const warningNote =
              errors.length > 0
                ? ` (warning: ${errors.length} reference image(s) failed to load)`
                : '';

            return {
              success: true,
              message: `Successfully generated image with ${loadedCount} reference(s)${warningNote}`,
              generatedFiles: [fullPath],
            };
          }
        }
      }

      return {
        success: false,
        message: 'Failed to generate image with references',
        error: 'No image data in response',
      };
    } catch (error: unknown) {
      console.error('DEBUG - Error in generateWithReferences:', error);
      return {
        success: false,
        message: 'Failed to generate image with references',
        error: this.handleApiError(error),
      };
    }
  }
}
