// frontend/scanner.js (Phase 6)
// ---------------------------------------------------------------------
// Two ways to scan:
//   1. USB scanner: just focuses an input field. Device types like a keyboard;
//      scanner ends with Enter → triggers onDetected(code).
//   2. Camera: uses html5-qrcode from CDN, renders a video preview.
// ---------------------------------------------------------------------

import { t } from './i18n.js';
import { el, toast } from './utils.js';
import { logError, logWarning } from './logger.js';

// USB-as-keyboard input: any <input> whose value is submitted via Enter.
export function attachUSBScanner(input, onDetected) {
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = input.value.trim();
      input.value = '';
      if (code) onDetected(code);
    }
  });
}

// Camera scanner: opens a modal that shows video, fires onDetected(code) once.
export async function openCameraScanner(onDetected) {
  const dlg = el('dialog', { class: 'dialog' });
  const status = el('div', { class: 'muted' }, t('loading'));
  const container = el('div', { id: 'qr-reader', style: 'width: 300px; max-width: 100%; margin: 12px auto' });
  const stopBtn = el('button', { class: 'btn btn--ghost' }, '❌ ' + t('stop_scan'));
  let scanner = null;

  dlg.appendChild(el('div', {}, [
    el('h3', {}, '📷 ' + t('scan_barcode')),
    container,
    status,
    el('div', { class: 'form__actions' }, [stopBtn]),
  ]));
  document.body.appendChild(dlg);

  stopBtn.addEventListener('click', () => close());
  dlg.addEventListener('close', () => {
    try {
      scanner?.stop?.().catch((e) => logWarning('Scanner stop failed', {
        source: 'scanner.dialog.close.stop',
        message: e?.message,
      }));
      scanner?.clear?.();
    } catch (e) {
      logWarning('Scanner cleanup failed', {
        source: 'scanner.dialog.close.cleanup',
        message: e?.message,
      });
    }
    dlg.remove();
  });
  dlg.showModal();

  async function close() {
    try { await scanner?.stop?.(); }
    catch (e) {
      logWarning('Scanner stop failed on close', {
        source: 'scanner.close',
        message: e?.message,
      });
    }
    dlg.close();
  }

  try {
    const mod = await import('https://esm.sh/html5-qrcode@2.3.8');
    const Html5Qrcode = mod.Html5Qrcode || mod.default?.Html5Qrcode;
    if (!Html5Qrcode) throw new Error('library load failed');

    scanner = new Html5Qrcode('qr-reader');
    status.textContent = '';
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 180 } },
      (code) => {
        if (code) {
          onDetected(code);
          close();
          toast('✓ ' + code.slice(0, 20), 'success');
        }
      },
      () => {} // onError per-frame (intentionally noisy; ignored)
    );
  } catch (err) {
    logError(err, { source: 'scanner.openCameraScanner' });
    status.textContent = t('camera_error') + ': ' + (err?.message || err);
    status.className = 'form-error';
  }
}
