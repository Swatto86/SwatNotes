/**
 * DaisyUI Modal System
 * Custom modal dialogs to replace native browser dialogs
 */

interface ModalOptions {
  title?: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmText?: string;
  cancelText?: string;
  input?: {
    placeholder?: string;
    type?: string;
    value?: string;
  };
}

/**
 * Show a custom alert modal
 */
export function showAlert(message: string, options: Partial<ModalOptions> = {}): Promise<void> {
  return new Promise((resolve) => {
    const modal = createModal({
      title: options.title || 'Alert',
      message,
      type: options.type || 'info',
      confirmText: 'OK',
      onConfirm: () => {
        closeModal(modal);
        resolve();
      }
    });
    document.body.appendChild(modal);
    showModal(modal);
  });
}

/**
 * Show a custom confirm modal
 */
export function showConfirm(message: string, options: Partial<ModalOptions> = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const modal = createModal({
      title: options.title || 'Confirm',
      message,
      type: options.type || 'warning',
      confirmText: options.confirmText || 'Yes',
      cancelText: options.cancelText || 'No',
      onConfirm: () => {
        closeModal(modal);
        resolve(true);
      },
      onCancel: () => {
        closeModal(modal);
        resolve(false);
      }
    });
    document.body.appendChild(modal);
    showModal(modal);
  });
}

/**
 * Show a custom prompt modal
 */
export function showPrompt(message: string, options: Partial<ModalOptions> = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let inputElement: HTMLInputElement;

    const modal = createModal({
      title: options.title || 'Input',
      message,
      type: options.type || 'info',
      confirmText: options.confirmText || 'OK',
      cancelText: options.cancelText || 'Cancel',
      input: options.input,
      onConfirm: () => {
        const value = inputElement?.value || null;
        closeModal(modal);
        resolve(value);
      },
      onCancel: () => {
        closeModal(modal);
        resolve(null);
      },
      onInputCreated: (input) => {
        inputElement = input;
      }
    });
    document.body.appendChild(modal);
    showModal(modal);
  });
}

interface CreateModalOptions extends ModalOptions {
  onConfirm: () => void;
  onCancel?: () => void;
  onInputCreated?: (input: HTMLInputElement) => void;
}

/**
 * Create modal DOM structure
 */
function createModal(options: CreateModalOptions): HTMLElement {
  const modalId = `modal-${Date.now()}`;

  // Get alert color class
  const alertClass = {
    info: 'alert-info',
    warning: 'alert-warning',
    error: 'alert-error',
    success: 'alert-success'
  }[options.type || 'info'];

  // Create modal HTML
  const modal = document.createElement('dialog');
  modal.id = modalId;
  modal.className = 'modal';

  const modalContent = `
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">${escapeHtml(options.title || '')}</h3>
      <div class="alert ${alertClass} mb-4">
        <span>${escapeHtml(options.message).replace(/\n/g, '<br>')}</span>
      </div>
      ${options.input ? `
        <input
          type="${options.input.type || 'text'}"
          placeholder="${escapeHtml(options.input.placeholder || '')}"
          value="${escapeHtml(options.input.value || '')}"
          class="input input-bordered w-full mb-4"
          id="${modalId}-input"
        />
      ` : ''}
      <div class="modal-action">
        ${options.onCancel ? `
          <button class="btn btn-ghost" id="${modalId}-cancel">
            ${escapeHtml(options.cancelText || 'Cancel')}
          </button>
        ` : ''}
        <button class="btn btn-primary" id="${modalId}-confirm">
          ${escapeHtml(options.confirmText || 'OK')}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button id="${modalId}-backdrop">close</button>
    </form>
  `;

  modal.innerHTML = modalContent;

  // Attach event listeners
  const confirmBtn = modal.querySelector(`#${modalId}-confirm`) as HTMLButtonElement;
  const cancelBtn = modal.querySelector(`#${modalId}-cancel`) as HTMLButtonElement;
  const backdrop = modal.querySelector(`#${modalId}-backdrop`) as HTMLButtonElement;
  const inputEl = modal.querySelector(`#${modalId}-input`) as HTMLInputElement;

  if (confirmBtn) {
    confirmBtn.onclick = (e) => {
      e.preventDefault();
      options.onConfirm();
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      options.onCancel?.();
    };
  }

  if (backdrop) {
    backdrop.onclick = () => {
      options.onCancel?.();
    };
  }

  // Handle Enter key for input
  if (inputEl) {
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        options.onConfirm();
      }
    };

    // Call the callback with the input element
    if (options.onInputCreated) {
      options.onInputCreated(inputEl);
    }
  }

  return modal;
}

/**
 * Show modal
 */
function showModal(modal: HTMLElement): void {
  (modal as any).showModal();

  // Focus input if present
  const input = modal.querySelector('input');
  if (input) {
    setTimeout(() => input.focus(), 100);
  }
}

/**
 * Close and remove modal
 */
function closeModal(modal: HTMLElement): void {
  (modal as any).close();
  setTimeout(() => {
    modal.remove();
  }, 200);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
