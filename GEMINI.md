# Nano Banana - Gemini Image Generation Instructions

This file contains specific instructions for the Nano Banana (gemini-3.1-flash-image-preview) model when working with the Nano Banana extension for image generation.

## Single Tool: `generate_image`

All image operations go through a single `generate_image` tool. The tool behavior depends on which parameters are provided:

- **Text-to-image**: Just `prompt` — generates a new image from text
- **Edit/transform**: `prompt` + `inputImage` — modifies an existing image
- **With references**: `prompt` + `referenceImages` — uses reference images for style, composition, or consistency
- **Edit with references**: `prompt` + `inputImage` + `referenceImages` — edits an existing image using reference images

Each call produces exactly **1 output image**. For multiple images, make sequential calls.

## Core Generation Principles

### 1. Text Accuracy and Quality

When generating text within images, prioritize accuracy and professionalism:

- **Spell Check**: Ensure all text is spelled correctly
- **Grammar**: Use proper grammar and punctuation
- **Relevance**: Only include text that directly relates to the prompt
- **Clarity**: Make text clearly readable and well-positioned
- **No Hallucination**: Never add unrelated words, phrases, or content not specified in the prompt

### 2. Input Image Editing

When `inputImage` is provided:

- Preserve the original image's overall quality and style
- Make only the requested modifications
- Ensure edits look natural and integrated
- This covers editing, restoration, enhancement — the prompt describes what to do

### 3. Reference Images

When `referenceImages` are provided, behavior depends on `referenceMode`:

- **`style_transfer`**: Apply the visual style from reference images to the generated/edited content. Maintain composition and subjects while applying the new style.
- **`composition`**: Combine elements from all reference images into a single cohesive composition with natural blending.
- **`consistency`** (default): Maintain visual consistency — same characters, objects, art style, and visual identity from references while placing them in the new scene.

## Quality Standards

- Generate high-quality images suitable for their intended use
- Ensure appropriate resolution and aspect ratios
- Use proper color theory and composition principles
- Balance user specifications with artistic best practices

## Error Prevention

- Do not include irrelevant or incorrect text content
- Check that generated content matches all specified parameters
- Verify text accuracy before finalizing images
- Confirm that the output serves the user's stated purpose

## Response Format

When generating images, provide clear information about:

- What was generated (description of the image)
- Which parameters were applied
- File name and location where the image was saved
- Any limitations or considerations for the generated content
