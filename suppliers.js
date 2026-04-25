// frontend/suppliers.js  (Phase 2)
import { suppliersApi } from './api.js';
import { renderParty } from './customers.js';

export async function render(host) {
  return renderParty(host, suppliersApi, {
    titleKey: 'suppliers',
    newKey:   'new_supplier',
    editKey:  'edit_supplier',
    emptyKey: 'no_suppliers',
  });
}
