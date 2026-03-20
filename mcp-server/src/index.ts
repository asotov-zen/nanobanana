#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ImageGenerator } from './imageGenerator.js';
import { FileHandler } from './fileHandler.js';
import {
  ImageGenerationRequest,
  ReferenceMode,
} from './types.js';

class NanoBananaServer {
  private server: Server;
  private imageGenerator!: ImageGenerator;
  private initializationError: Error | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'nanobanana-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();
    this.setupErrorHandling();

    try {
      const authConfig = ImageGenerator.validateAuthentication();
      this.imageGenerator = new ImageGenerator(authConfig);
    } catch (error: unknown) {
      this.initializationError =
        error instanceof Error ? error : new Error(String(error));
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'generate_image',
            description:
              'Generate or edit images. Provide a prompt for text-to-image, or add inputImage to edit an existing image. Use referenceImages for style transfer, composition, or consistency.',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description:
                    'Text prompt describing the image to generate or edits to make',
                },
                inputImage: {
                  type: 'string',
                  description:
                    'File path of an existing image to edit/transform',
                },
                aspectRatio: {
                  type: 'string',
                  enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
                  description: 'Aspect ratio of the generated image (default: 1:1)',
                },
                imageSize: {
                  type: 'string',
                  enum: ['512', '1K', '2K', '4K'],
                  description: 'Resolution/quality of the generated image. 512 is fastest, 4K is highest quality (default: 1K)',
                },
                seed: {
                  type: 'number',
                  description: 'Seed for reproducible generation',
                },
                referenceImages: {
                  type: 'array',
                  items: { type: 'string' },
                  description:
                    'File paths of reference images for style transfer, composition, or consistency (1-14 images)',
                  maxItems: 14,
                },
                referenceMode: {
                  type: 'string',
                  enum: ['style_transfer', 'composition', 'consistency'],
                  description:
                    'How to use the reference images: style_transfer (apply visual style), composition (combine into one image), consistency (maintain visual identity in new scene). Default: consistency',
                  default: 'consistency',
                },
                preview: {
                  type: 'boolean',
                  description:
                    'Automatically open generated image in default viewer',
                  default: false,
                },
              },
              required: ['prompt'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.initializationError) {
        throw this.initializationError;
      }

      const { name, arguments: args } = request.params;

      try {
        let response;

        switch (name) {
          case 'generate_image': {
            const imageRequest: ImageGenerationRequest = {
              prompt: args?.prompt as string,
              inputImage: args?.inputImage as string,
              seed: args?.seed as number,
              aspectRatio: args?.aspectRatio as string,
              imageSize: args?.imageSize as string,
              referenceImages: args?.referenceImages as string[],
              referenceMode: args?.referenceMode as ReferenceMode,
              preview: args?.preview as boolean,
            };
            response = await this.imageGenerator.generateImage(imageRequest);
            break;
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        if (response.success && response.generatedFiles?.length) {
          const filePath = response.generatedFiles[0];
          const fileName = filePath.split('/').pop() || 'image.png';
          const mimeType = FileHandler.getMimeTypeFromExtension(filePath);

          return {
            content: [
              {
                type: 'text' as const,
                text: response.message,
              },
              {
                type: 'resource_link' as const,
                uri: `file://${filePath}`,
                mimeType,
                name: fileName,
              },
            ],
          };
        } else if (response.success) {
          return {
            content: [
              {
                type: 'text' as const,
                text: response.message,
              },
            ],
          };
        } else {
          throw new Error(response.error || response.message);
        }
      } catch (error: unknown) {
        console.error(`Error executing tool ${name}:`, error);
        if (error instanceof Error) {
          throw error;
        }
        throw new Error(`An unexpected error occurred: ${String(error)}`);
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Nano Banana MCP server running on stdio');
  }
}

const server = new NanoBananaServer();
server.run().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
