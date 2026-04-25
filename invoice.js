// frontend/invoice.js  (Phase 15 — now uses print_templates)
import { printInvoiceDoc } from './print_templates.js';

export async function printInvoice({ kind, header, items, payments = [], party = null }) {
  printInvoiceDoc({ kind, header, items, payments, party });
}
