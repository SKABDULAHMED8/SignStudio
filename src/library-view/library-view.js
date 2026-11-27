import { createEncryptedBackup, openEncryptedBackup } from '../library/backup.js';
import { askForText, askForSecret, askForChoice } from '../ui/dialogs.js';

export class LibraryView {
  constructor({ library, sessionStore, notify, onOpen }) {
    this.library = library; this.sessionStore = sessionStore; this.notify = notify; this.onOpen = onOpen;
    this.trashTimer = null;
    document.querySelector('#delete-all-button').addEventListener('click', () => this.deleteAll());
    document.querySelector('#backup-button').addEventListener('click', () => this.exportBackup());
    document.querySelector('#restore-backup-button').addEventListener('click', () => document.querySelector('#backup-picker').click());
    document.querySelector('#backup-picker').addEventListener('change', event => this.importBackup(event.target.files?.[0]));
  }
  async render() {
    const list = document.querySelector('#library-list'); list.replaceChildren();
    try {
      await this.library.purgeExpiredTrash();
      const saved = await this.library.list(), session = this.sessionStore.list();
      document.querySelector('#library-count').textContent = `${saved.length} saved · ${session.length} session only`;
      document.querySelector('#library-empty').classList.toggle('is-hidden', saved.length + session.length > 0);
      for (const record of [...saved, ...session]) {
        const row = document.createElement('article'); row.className = 'signature-row';
        const image = document.createElement('img'); image.alt = `${record.name} thumbnail`; image.src = this.#toDataUrl(record.thumbnail?.data ? record.thumbnail : record.image);
        const thumb = document.createElement('div'); thumb.className = 'signature-thumb'; thumb.append(image);
        const name = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = record.name; const small = document.createElement('small'); small.textContent = record.storage === 'session' ? 'Session only · cleared when tab closes' : `Saved on this device · ${record.ink}`; name.append(strong, small);
        const actions = document.createElement('div'); actions.className = 'signature-actions';
        actions.append(this.#action('Open signature', 'pen-tool', () => this.onOpen?.(record)));
        if (record.storage === 'device') {
          actions.append(this.#action('Rename', 'edit-3', async () => { const next = await askForText({ title: 'Rename signature', description: 'Choose a name for this saved signature.', label: 'Signature name', value: record.name, confirmLabel: 'Rename' }); if (next) { await this.library.rename(record.id, next); await this.render(); } }));
          if (record.versions > 0) actions.append(this.#action('Version history', 'clock', async () => { const versions = await this.library.listVersions(record.id); const choice = await askForChoice({ title: 'Signature history', description: 'Restore a previous saved version. The current version will be kept in history.', choices: [...versions.map(version => ({ label: `Restore “${version.name}”${version.savedAt ? ` · ${new Date(version.savedAt).toLocaleString()}` : ''}`, value: String(version.index) })), { label: 'Cancel', value: 'cancel' }] }); if (choice !== null && choice !== 'cancel') { await this.library.restoreVersion(record.id, Number(choice)); this.notify('Previous signature version restored.', 'success'); await this.render(); } }));
          actions.append(this.#action('Move to Trash', 'trash-2', async () => { await this.library.discard(record.id); this.notify('Moved to Trash. Undo is available for 60 seconds.', 'success'); await this.render(); }));
        } else actions.append(this.#action('Discard session signature', 'trash-2', async () => { this.sessionStore.delete(record.id); await this.render(); }));
        row.append(thumb, name, actions); list.append(row);
      }
      const estimate = await navigator.storage?.estimate?.();
      document.querySelector('#storage-usage').textContent = estimate?.quota ? `${(estimate.usage / 1048576).toFixed(1)} MB of ${(estimate.quota / 1048576).toFixed(0)} MB used by this site` : 'Browser-managed local storage';
      await this.renderTrash();
    } catch (error) { this.notify(`The local signature library could not be read. ${error.message}`, 'error', 'SS-STO-303'); }
  }
  async renderTrash() {
    const section = document.querySelector('#trash-section'); const list = document.querySelector('#trash-list');
    const entries = await this.library.listTrash(); list.replaceChildren(); section.classList.toggle('is-hidden', entries.length === 0);
    for (const entry of entries) {
      const row = document.createElement('div'); row.className = 'trash-row';
      const title = document.createElement('strong'); title.textContent = entry.name;
      const remaining = document.createElement('span'); remaining.className = 'muted'; remaining.textContent = `Expires in ${Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000))}s`;
      const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'button button-secondary'; undo.textContent = 'Undo';
      undo.addEventListener('click', async () => { const restored = await this.library.restore(entry.id); this.notify(restored ? 'Signature restored.' : 'The undo period has expired.', restored ? 'success' : 'info'); await this.render(); });
      row.append(title, remaining, undo); list.append(row);
    }
    clearInterval(this.trashTimer);
    if (entries.length) this.trashTimer = setInterval(() => {
      [...list.children].forEach((row, index) => {
        const item = entries[index];
        if (item) row.children[1].textContent = `Expires in ${Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000))}s`;
      });
      if (entries.every(entry => entry.expiresAt <= Date.now())) this.render();
    }, 1000);
  }
  #toDataUrl(image) {
    if (!image?.data) return '';
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    return canvas.toDataURL('image/png');
  }
  #action(label, icon, handler) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-button'; button.setAttribute('aria-label', label); button.title = label;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `${import.meta.env.BASE_URL}icons/ui.svg#${icon}`); svg.append(use); button.append(svg); button.addEventListener('click', handler); return button;
  }
  async deleteAll() {
    if (!confirm('Move all saved signatures to Trash? Each can be restored for 60 seconds.')) return;
    const records = await this.library.repository.getAll('signatures');
    for (const record of records) await this.library.discard(record.id);
    await this.render(); this.notify('Saved signatures moved to Trash for 60 seconds.', 'success');
  }
  async exportBackup() {
    const passphrase = await askForSecret({ title: 'Protect your backup', description: 'Create a passphrase with at least 12 characters. You need it to restore this backup. It cannot be recovered if forgotten.', label: 'New backup passphrase', confirmLabel: 'Create encrypted backup', minLength: 12, autocomplete: 'new-password' });
    if (passphrase === null) return;
    const confirmation = await askForSecret({ title: 'Confirm backup passphrase', description: 'Enter the same passphrase again.', label: 'Confirm passphrase', confirmLabel: 'Confirm', minLength: 12, autocomplete: 'new-password' });
    if (confirmation === null) return;
    if (confirmation !== passphrase) { this.notify('The passphrases do not match. No backup was created.', 'error', 'SS-ENC-601'); return; }
    try {
      const records = await this.library.exportRecords();
      const blob = await createEncryptedBackup(records, passphrase);
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `signstudio-backup-${new Date().toISOString().slice(0, 10)}.ssbackup`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      this.notify(`Encrypted backup created for ${records.length} signatures.`, 'success');
    } catch (error) { this.notify(error.message, 'error', 'SS-ENC-601'); }
  }
  async importBackup(file) {
    if (!file) return;
    try {
      if (file.size > 80 * 1024 * 1024) throw new RangeError('This backup is larger than the 80 MB limit.');
      const passphrase = await askForSecret({ title: 'Unlock backup', description: 'Enter the passphrase used when this backup was created.', label: 'Backup passphrase', confirmLabel: 'Verify backup', minLength: 1 });
      if (passphrase === null) return;
      const backup = await openEncryptedBackup(await file.text(), passphrase);
      const count = await this.library.importRecords(backup.records);
      this.notify(`${count} signature${count === 1 ? '' : 's'} restored into this device library.`, 'success');
      await this.render();
    } catch (error) { this.notify(error.message || 'The backup could not be restored. Check the passphrase and file.', 'error', 'SS-ENC-601'); }
    finally { document.querySelector('#backup-picker').value = ''; }
  }
  destroy() { clearInterval(this.trashTimer); }
}
