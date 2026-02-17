/**
 * Custom Quill Blots for Inline Attachments
 *
 * This module provides custom Quill blots that store attachment references
 * instead of raw data URLs. This ensures images and files render correctly
 * after page reload by fetching from the attachment store.
 */

import Quill from 'quill';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { getAttachmentData, createDataUrl } from './attachmentsApi';
import { logger } from './logger';
import { formatFileSize, getFileIconSvg } from './formatters';

const LOG_CONTEXT = 'QuillBlots';

// Get the base classes from Quill
const BlockEmbed = Quill.import('blots/block/embed') as any;
const _Inline = Quill.import('blots/inline') as any;

/**
 * Attachment Image Blot
 * Stores attachment metadata and loads the image dynamically
 */
export class AttachmentImageBlot extends BlockEmbed {
  static blotName = 'attachment-image';
  static tagName = 'div';
  static className = 'ql-attachment-image';

  static create(value: AttachmentImageValue): HTMLElement {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-attachment-id', value.attachmentId || '');
    node.setAttribute('data-blob-hash', value.blobHash);
    node.setAttribute('data-mime-type', value.mimeType);
    node.setAttribute('data-filename', value.filename || '');
    node.setAttribute('contenteditable', 'false');

    // Create wrapper for styling
    node.classList.add('attachment-image-wrapper');

    // Create image element
    const img = document.createElement('img');
    img.alt = value.filename || 'Attached image';
    img.className = 'attachment-image';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '4px';
    img.style.cursor = 'pointer';

    // Create loading placeholder
    const placeholder = document.createElement('div');
    placeholder.className = 'attachment-image-loading';
    placeholder.innerHTML = `
      <span class="loading loading-spinner loading-sm"></span>
      <span class="text-xs">Loading image...</span>
    `;
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.gap = '8px';
    placeholder.style.padding = '12px';
    placeholder.style.backgroundColor = 'oklch(var(--b2))';
    placeholder.style.borderRadius = '4px';

    node.appendChild(placeholder);

    // Load the image asynchronously
    AttachmentImageBlot.loadImage(node, img, value.blobHash, value.mimeType, placeholder);

    // Add click handler to open in new window
    img.addEventListener('click', () => {
      const src = img.src;
      if (src && !src.startsWith('data:')) {
        window.open(src, '_blank');
      }
    });

    return node;
  }

  static async loadImage(
    node: HTMLElement,
    img: HTMLImageElement,
    blobHash: string,
    mimeType: string,
    placeholder: HTMLElement
  ): Promise<void> {
    try {
      const data = await getAttachmentData(blobHash);
      const url = createDataUrl(data, mimeType);
      img.src = url;

      img.onload = () => {
        placeholder.remove();
        node.appendChild(img);
      };

      img.onerror = () => {
        placeholder.innerHTML = `
          <span class="text-error text-xs">Failed to load image</span>
        `;
      };
    } catch (error) {
      logger.error('Failed to load attachment image', LOG_CONTEXT, error);
      placeholder.innerHTML = `
        <span class="text-error text-xs">Failed to load image</span>
      `;
    }
  }

  static value(node: HTMLElement): AttachmentImageValue {
    return {
      attachmentId: node.getAttribute('data-attachment-id') || '',
      blobHash: node.getAttribute('data-blob-hash') || '',
      mimeType: node.getAttribute('data-mime-type') || '',
      filename: node.getAttribute('data-filename') || '',
    };
  }
}

export interface AttachmentImageValue {
  attachmentId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
}

/**
 * Attachment File Blot
 * Renders non-image attachments as clickable file chips
 */
export class AttachmentFileBlot extends BlockEmbed {
  static blotName = 'attachment-file';
  static tagName = 'div';
  static className = 'ql-attachment-file';

  static create(value: AttachmentFileValue): HTMLElement {
    const node = super.create() as HTMLElement;
    node.setAttribute('data-attachment-id', value.attachmentId || '');
    node.setAttribute('data-blob-hash', value.blobHash);
    node.setAttribute('data-mime-type', value.mimeType);
    node.setAttribute('data-filename', value.filename);
    node.setAttribute('data-size', String(value.size || 0));
    node.setAttribute('contenteditable', 'false');

    // Create file chip
    node.classList.add('attachment-file-chip');
    node.style.display = 'inline-flex';
    node.style.alignItems = 'center';
    node.style.gap = '8px';
    node.style.padding = '8px 12px';
    node.style.margin = '4px 0';
    node.style.backgroundColor = 'oklch(var(--b2))';
    node.style.borderRadius = '8px';
    node.style.cursor = 'pointer';
    node.style.transition = 'background-color 0.2s';
    node.style.maxWidth = '100%';

    // File icon
    const iconWrapper = document.createElement('span');
    iconWrapper.innerHTML = getFileIconSvg(value.mimeType);
    iconWrapper.style.flexShrink = '0';

    // File info
    const info = document.createElement('div');
    info.style.overflow = 'hidden';
    info.style.flex = '1';
    info.style.minWidth = '0';

    const filename = document.createElement('div');
    filename.textContent = value.filename;
    filename.style.fontWeight = '500';
    filename.style.overflow = 'hidden';
    filename.style.textOverflow = 'ellipsis';
    filename.style.whiteSpace = 'nowrap';
    filename.style.fontSize = '0.875rem';

    const size = document.createElement('div');
    size.textContent = formatFileSize(value.size || 0);
    size.style.fontSize = '0.75rem';
    size.style.opacity = '0.7';

    info.appendChild(filename);
    info.appendChild(size);

    // Download icon
    const downloadIcon = document.createElement('span');
    downloadIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    downloadIcon.style.flexShrink = '0';
    downloadIcon.style.opacity = '0.5';

    node.appendChild(iconWrapper);
    node.appendChild(info);
    node.appendChild(downloadIcon);

    // Hover effect
    node.addEventListener('mouseenter', () => {
      node.style.backgroundColor = 'oklch(var(--b3))';
      downloadIcon.style.opacity = '1';
    });
    node.addEventListener('mouseleave', () => {
      node.style.backgroundColor = 'oklch(var(--b2))';
      downloadIcon.style.opacity = '0.5';
    });

    // Click to download
    node.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await AttachmentFileBlot.downloadFile(value.blobHash, value.mimeType, value.filename);
    });

    return node;
  }

  static async downloadFile(blobHash: string, mimeType: string, filename: string): Promise<void> {
    try {
      // Get the attachment data
      const data = await getAttachmentData(blobHash);

      // Get file extension from filename
      const ext = filename.includes('.') ? filename.split('.').pop() : undefined;

      // Show save dialog
      const filePath = await save({
        defaultPath: filename,
        filters: ext ? [{ name: 'File', extensions: [ext] }] : undefined,
      });

      if (filePath) {
        // Write the file to the selected location
        await writeFile(filePath, data);
        logger.info(`Downloaded attachment to ${filePath}`, LOG_CONTEXT);
      }
    } catch (error) {
      logger.error('Failed to download attachment', LOG_CONTEXT, error);
    }
  }

  static value(node: HTMLElement): AttachmentFileValue {
    return {
      attachmentId: node.getAttribute('data-attachment-id') || '',
      blobHash: node.getAttribute('data-blob-hash') || '',
      mimeType: node.getAttribute('data-mime-type') || '',
      filename: node.getAttribute('data-filename') || '',
      size: parseInt(node.getAttribute('data-size') || '0', 10),
    };
  }
}

export interface AttachmentFileValue {
  attachmentId: string;
  blobHash: string;
  mimeType: string;
  filename: string;
  size: number;
}

/**
 * Register custom blots with Quill
 */
export function registerAttachmentBlots(): void {
  Quill.register('formats/attachment-image', AttachmentImageBlot);
  Quill.register('formats/attachment-file', AttachmentFileBlot);
  logger.debug('Registered attachment blots', LOG_CONTEXT);
}

/**
 * Insert an inline attachment into the editor
 */
export function insertInlineAttachment(
  quill: Quill,
  attachment: {
    id: string;
    blob_hash: string;
    mime_type: string;
    filename: string;
    size: number;
  }
): void {
  const range = quill.getSelection(true);
  const index = range ? range.index : quill.getLength();

  if (attachment.mime_type.startsWith('image/')) {
    quill.insertEmbed(index, 'attachment-image', {
      attachmentId: attachment.id,
      blobHash: attachment.blob_hash,
      mimeType: attachment.mime_type,
      filename: attachment.filename,
    } as AttachmentImageValue);
  } else {
    quill.insertEmbed(index, 'attachment-file', {
      attachmentId: attachment.id,
      blobHash: attachment.blob_hash,
      mimeType: attachment.mime_type,
      filename: attachment.filename,
      size: attachment.size,
    } as AttachmentFileValue);
  }

  // Move cursor after the embedded attachment
  quill.setSelection(index + 1);
}
