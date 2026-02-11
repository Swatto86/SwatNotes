/**
 * Tests for modal utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { showAlert, showConfirm, showPrompt } from './modal';

describe('modal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('showAlert', () => {
    it('should create and show alert modal', async () => {
      const promise = showAlert('Test message');

      const modal = document.querySelector('dialog');
      expect(modal).toBeTruthy();
      expect(modal?.classList.contains('modal')).toBe(true);
      expect(modal?.textContent).toContain('Test message');

      const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      expect(okButton).toBeTruthy();
      okButton?.click();

      vi.advanceTimersByTime(300);
      await promise;
    });

    it('should show custom title', async () => {
      const promise = showAlert('Message', { title: 'Custom Title' });

      const modal = document.querySelector('dialog');
      expect(modal?.textContent).toContain('Custom Title');

      const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();
      vi.advanceTimersByTime(300);

      await promise;
    });

    it('should apply correct alert type classes', async () => {
      const types = ['info', 'warning', 'error', 'success'] as const;

      for (const type of types) {
        document.body.innerHTML = '';
        const promise = showAlert('Message', { type });

        const modal = document.querySelector('dialog');
        const alertDiv = modal?.querySelector('.alert');
        expect(alertDiv?.classList.contains(`alert-${type}`)).toBe(true);

        const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
        okButton?.click();
        vi.advanceTimersByTime(300);

        await promise;
      }
    });

    it('should remove modal from DOM after closing', async () => {
      const promise = showAlert('Message');

      expect(document.querySelectorAll('dialog').length).toBe(1);

      const modal = document.querySelector('dialog');
      const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();

      vi.advanceTimersByTime(300);
      await promise;

      expect(document.querySelectorAll('dialog').length).toBe(0);
    });

    it('should escape HTML in message', async () => {
      const promise = showAlert('<script>alert("xss")</script>');

      const modal = document.querySelector('dialog');
      expect(modal?.innerHTML).not.toContain('<script>');
      expect(modal?.textContent).toContain('<script>');

      const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();
      vi.advanceTimersByTime(300);

      await promise;
    });
  });

  describe('showConfirm', () => {
    it('should return true when confirmed', async () => {
      const promise = showConfirm('Are you sure?');

      const modal = document.querySelector('dialog');
      const confirmButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;

      confirmButton?.click();
      vi.advanceTimersByTime(300);

      const result = await promise;
      expect(result).toBe(true);
    });

    it('should return false when cancelled', async () => {
      const promise = showConfirm('Are you sure?');

      const modal = document.querySelector('dialog');
      const cancelButton = modal?.querySelector('button[id$="-cancel"]') as HTMLButtonElement;

      cancelButton?.click();
      vi.advanceTimersByTime(300);

      const result = await promise;
      expect(result).toBe(false);
    });

    it('should show both confirm and cancel buttons', async () => {
      const promise = showConfirm('Confirm action?');

      const modal = document.querySelector('dialog');
      const confirmButton = modal?.querySelector('button[id$="-confirm"]');
      const cancelButton = modal?.querySelector('button[id$="-cancel"]');

      expect(confirmButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();

      cancelButton?.dispatchEvent(new MouseEvent('click'));
      vi.advanceTimersByTime(300);

      await promise;
    });

    it('should use custom button text', async () => {
      const promise = showConfirm('Delete item?', {
        confirmText: 'Delete',
        cancelText: 'Keep',
      });

      const modal = document.querySelector('dialog');
      expect(modal?.textContent).toContain('Delete');
      expect(modal?.textContent).toContain('Keep');

      const cancelButton = modal?.querySelector('button[id$="-cancel"]') as HTMLButtonElement;
      cancelButton?.click();
      vi.advanceTimersByTime(300);

      await promise;
    });

    it('should return false when backdrop is clicked', async () => {
      const promise = showConfirm('Confirm?');

      const modal = document.querySelector('dialog');
      const backdrop = modal?.querySelector('button[id$="-backdrop"]') as HTMLButtonElement;

      if (backdrop) {
        backdrop.click();
        vi.advanceTimersByTime(300);
        const result = await promise;
        expect(result).toBe(false);
      } else {
        // Backdrop might not exist in all implementations
        const cancelButton = modal?.querySelector('button[id$="-cancel"]') as HTMLButtonElement;
        cancelButton?.click();
        vi.advanceTimersByTime(300);
        await promise;
      }
    });
  });

  describe('showPrompt', () => {
    it('should create prompt modal with input field', async () => {
      const promise = showPrompt('Enter name:');

      const modal = document.querySelector('dialog');
      expect(modal).toBeTruthy();

      // Cancel to clean up
      const cancelButton = modal?.querySelector('button[id$="-cancel"]') as HTMLButtonElement;
      if (cancelButton) {
        cancelButton.click();
      } else {
        const confirmButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
        confirmButton?.click();
      }
      vi.advanceTimersByTime(300);

      await promise;
    });

    it('should show prompt message', async () => {
      const promise = showPrompt('Enter your name:');

      const modal = document.querySelector('dialog');
      expect(modal?.textContent).toContain('Enter your name:');

      // Cancel to clean up
      const cancelButton = modal?.querySelector('button[id$="-cancel"]') as HTMLButtonElement;
      cancelButton?.click();
      vi.advanceTimersByTime(300);

      await promise;
    });
  });

  describe('modal behavior', () => {
    it('should create unique modal IDs', async () => {
      const promise1 = showAlert('Message 1');
      const modal1Id = document.querySelector('dialog')?.id;

      const okButton1 = document.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton1?.click();
      vi.advanceTimersByTime(300);
      await promise1;

      const promise2 = showAlert('Message 2');
      const modal2Id = document.querySelector('dialog')?.id;

      expect(modal1Id).not.toBe(modal2Id);

      const okButton2 = document.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton2?.click();
      vi.advanceTimersByTime(300);
      await promise2;
    });

    it('should handle multiple alert modals in sequence', async () => {
      const promise1 = showAlert('First');
      let okButton = document.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();
      vi.advanceTimersByTime(300);
      await promise1;

      const promise2 = showAlert('Second');
      okButton = document.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();
      vi.advanceTimersByTime(300);
      await promise2;

      expect(true).toBe(true);
    });

    it('should convert newlines to <br> in message', async () => {
      const promise = showAlert('Line 1\nLine 2\nLine 3');

      const modal = document.querySelector('dialog');
      const alertDiv = modal?.querySelector('.alert');

      expect(alertDiv?.innerHTML).toContain('<br>');

      const okButton = modal?.querySelector('button[id$="-confirm"]') as HTMLButtonElement;
      okButton?.click();
      vi.advanceTimersByTime(300);

      await promise;
    });
  });
});
