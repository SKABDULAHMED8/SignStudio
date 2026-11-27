import '../styles/app.css';
import { openDatabase, LocalRepository } from './library/repository.js';
import { KeyManager } from './security/key-manager.js';
import { PassphraseLock } from './security/lock.js';
import { SignatureLibrary } from './library/library.js';
import { PersonalProfileStore } from './library/personal-profiles.js';
import { SessionStore } from './library/session-store.js';
import { StudioView } from './studio/studio-view.js';
import { LibraryView } from './library-view/library-view.js';
import { navigate } from './ui/nav.js';
import { getCapabilities } from './platform/capabilities.js';
import { showRecovery } from './recovery/recovery-view.js';
import { restoreFromEncryptedBackup } from './recovery/restore.js';
import { askForSecret } from './ui/dialogs.js';

const toast = (message, type = 'info', code = '') => {
  const region = document.querySelector('#toast-region'), item = document.createElement('div');
  item.className = `toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : ''}`;
  item.textContent = code ? `${message} (${code})` : message;
  region.append(item); setTimeout(() => item.remove(), 4200);
};

async function restoreBackupFromRecovery(repository) {
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.ssbackup,application/octet-stream,application/json';
  const file = await new Promise(resolve => { picker.addEventListener('change', () => resolve(picker.files?.[0] ?? null), { once: true }); picker.click(); });
  if (!file) return;
  try {
    if (file.size > 80 * 1024 * 1024) throw new RangeError('This backup is larger than the 80 MB limit.');
    const passphrase = await askForSecret({ title: 'Open backup', description: 'Enter the backup password. It will replace the signatures saved in this browser.', label: 'Backup password', confirmLabel: 'Open backup', minLength: 1 });
    if (passphrase === null) return;
    if (!confirm('The backup contents will replace the current local library. Continue?')) return;
    const result = await restoreFromEncryptedBackup({ repository, fileText: await file.text(), passphrase, replaceExisting: true, clearPassphraseLock: true });
    showRecovery({ message: `${result.restored} signature(s) restored. ${result.preservedProfiles || 0} personal profile(s) preserved. Your saved details were moved to this browser. You can turn on an app password again in Settings.`, actionLabel: 'Open SignStudio', action: () => location.reload() });
  } catch (error) {
    showRecovery({ message: `Backup restore failed. ${error.message} Existing local records were left in place.`, actionLabel: 'Try another backup', action: () => restoreBackupFromRecovery(repository) });
  }
}

async function resetLocalLibrary(repository) {
  if (!confirm('Delete all saved signatures, saved details and deleted items from this browser? This cannot be undone.')) return;
  await Promise.all(['signatures', 'trash', 'keys', 'settings', 'personal-profiles'].map(store => repository.clear(store)));
  showRecovery({ message: 'Your saved signatures have been cleared. SignStudio will start with an empty library.', actionLabel: 'Start SignStudio', action: () => location.reload() });
}

async function unlockBeforeStartup(passphraseLock) {
  if (!await passphraseLock.isConfigured()) return true;
  return new Promise(resolve => {
    const attempt = async () => {
      const passphrase = await askForSecret({ title: 'Open SignStudio', description: 'Enter your app password to open your saved signatures. If you forget it, use a backup to get your signatures back.', label: 'App password', confirmLabel: 'Open my signatures', minLength: 1 });
      if (passphrase === null) {
        showRecovery({ message: 'Your signatures are locked. Enter your app password to continue. If you forgot it, open a backup or start again with an empty library.', actionLabel: 'Try again', action: attempt, secondaryLabel: 'Open a backup', secondaryAction: () => restoreBackupFromRecovery(passphraseLock.repository), extraActions: [{ label: 'Start a new empty library', variant: 'danger', action: () => resetLocalLibrary(passphraseLock.repository) }] });
        return;
      }
      const valid = await passphraseLock.unlock(passphrase);
      if (valid) { resolve(true); return; }
      showRecovery({ message: 'That password did not work. Try again, open a backup, or start again with an empty library. There is no password reset.', actionLabel: 'Try again', action: attempt, secondaryLabel: 'Open a backup', secondaryAction: () => restoreBackupFromRecovery(passphraseLock.repository), extraActions: [{ label: 'Start a new empty library', variant: 'danger', action: () => resetLocalLibrary(passphraseLock.repository) }] });
    };
    attempt();
  });
}

async function managePassphraseLock(passphraseLock) {
  if (await passphraseLock.isConfigured()) {
    if (!confirm('Turn off the app password? Your saved signatures will still stay private on this device.')) return;
    const current = await askForSecret({ title: 'Turn off app password', description: 'Enter your current app password.', label: 'Current app password', confirmLabel: 'Turn off password', minLength: 1 });
    if (current === null) return;
    if (!await passphraseLock.disable(current)) { toast('That password is not correct. The app password is still on.', 'error', 'SS-STO-302'); return; }
    toast('App password turned off. Your saved signatures are still kept private on this device.', 'success');
    return;
  }
  const passphrase = await askForSecret({ title: 'Turn on app password', description: 'Use at least 12 characters. You will need this password each time you open SignStudio. If you forget it, use a backup. This password screen does not protect files if someone can already use your open browser.', label: 'New app password', confirmLabel: 'Continue', minLength: 12, autocomplete: 'new-password' });
  if (passphrase === null) return;
  const confirmation = await askForSecret({ title: 'Confirm app password', description: 'Type the same password again.', label: 'Confirm password', confirmLabel: 'Turn on password', minLength: 12, autocomplete: 'new-password' });
  if (confirmation === null) return;
  if (confirmation !== passphrase) { toast('The passwords do not match. App password was not turned on.', 'error'); return; }
  try { await passphraseLock.enable(passphrase); toast('App password is on. You will need it next time you open SignStudio.', 'success'); }
  catch (error) { toast(error.message, 'error', 'SS-STO-302'); }
}

async function boot() {
  const capabilities = getCapabilities();
  if (!capabilities.secureContext || !capabilities.webCrypto || !capabilities.indexedDB) {
    showRecovery({ message: 'This browser does not provide the secure local features SignStudio needs. Use a current browser over HTTPS, or open the app through localhost for development.', actionLabel: 'Reload', action: () => location.reload() });
    return;
  }

  let repository, keyManager, library, passphraseLock;
  try {
    const database = await openDatabase();
    repository = new LocalRepository(database);
    const [storedKey, storedRecords, storedTrash, storedProfiles] = await Promise.all([repository.get('keys', 'device'), repository.getAll('signatures'), repository.getAll('trash'), repository.getAll('personal-profiles')]);
    if (!storedKey?.key && (storedRecords.length || storedTrash.length || storedProfiles.length)) {
      showRecovery({ message: 'This browser cannot open your saved signatures right now. Restore an protected backup or start a new empty library. Existing saved items are not removed until you confirm a recovery action.', actionLabel: 'Open a backup', action: () => restoreBackupFromRecovery(repository), secondaryLabel: 'Start a new empty library', secondaryAction: () => resetLocalLibrary(repository) });
      return;
    }
    passphraseLock = new PassphraseLock(repository);
    if (!await unlockBeforeStartup(passphraseLock)) return;
    // A failed unlock attempt switches the shell to the recovery panel.
    // After a later successful unlock, restore the normal initial route.
    navigate('studio');
    keyManager = new KeyManager(repository);
    await keyManager.getDeviceKey();
    library = new SignatureLibrary(repository, async () => {
      if (await passphraseLock.isConfigured() && !passphraseLock.unlocked) throw new Error('Unlock the signature library before accessing saved signatures.');
      return keyManager.getDeviceKey();
    });
    await library.purgeExpiredTrash();
  } catch (error) {
    showRecovery({ message: `SignStudio could not open your saved signatures. ${error.message}`, actionLabel: repository ? 'Open a backup' : 'Try again', action: repository ? () => restoreBackupFromRecovery(repository) : () => location.reload(), secondaryLabel: repository ? 'Start a new empty library' : undefined, secondaryAction: repository ? () => resetLocalLibrary(repository) : undefined });
    return;
  }

  const sessionStore = new SessionStore();
  const personalProfiles = new PersonalProfileStore(repository, () => library.keyProvider());
  const libraryView = new LibraryView({ library, sessionStore, notify: toast, onOpen: async record => {
    try { const fullRecord = record.storage === 'session' ? record : await library.get(record.id); navigate('studio'); studio.loadSavedRecord(fullRecord); }
    catch (error) { toast(error.message || 'The saved signature could not be opened.', 'error', 'SS-STO-303'); }
  } });
  const studio = new StudioView({ library, sessionStore, notify: toast, onSaved: () => libraryView.render() });
  const profileSelect = document.querySelector('#profile-select');
  const renderPersonalProfiles = async () => {
    const profiles = await personalProfiles.list();
    profileSelect.replaceChildren();
    if (!profiles.length) { const option=document.createElement('option'); option.value=''; option.textContent='No saved details'; profileSelect.append(option); }
    else for (const profile of profiles) { const option=document.createElement('option'); option.value=profile.id; option.textContent=profile.name; profileSelect.append(option); }
    document.querySelector('#profile-delete').disabled = !profiles.length;
  };
  document.querySelector('#profile-save').addEventListener('click', async () => {
    try {
      const fields = {
        fullName: document.querySelector('#profile-full-name').value,
        dateOfBirth: document.querySelector('#profile-dob').value,
        mobile: document.querySelector('#profile-mobile').value,
        email: document.querySelector('#profile-email').value,
        address: document.querySelector('#profile-address').value,
        city: document.querySelector('#profile-city').value,
        state: document.querySelector('#profile-state').value,
        pinCode: document.querySelector('#profile-pin').value
      };
      await personalProfiles.save({name:document.querySelector('#profile-name').value,fields}, profileSelect.value || null);
      await renderPersonalProfiles();
      toast('Your details were saved on this device.','success');
    } catch(error) { toast(error.message || 'The profile could not be saved.','error'); }
  });
  document.querySelector('#profile-select').addEventListener('change', async () => {
    const profile=await personalProfiles.get(profileSelect.value);
    if(!profile)return;
    document.querySelector('#profile-name').value=profile.name;
    document.querySelector('#profile-full-name').value=profile.fields.fullName;
    document.querySelector('#profile-dob').value=profile.fields.dateOfBirth;
    document.querySelector('#profile-mobile').value=profile.fields.mobile;
    document.querySelector('#profile-email').value=profile.fields.email;
    document.querySelector('#profile-address').value=profile.fields.address;
    document.querySelector('#profile-city').value=profile.fields.city;
    document.querySelector('#profile-state').value=profile.fields.state;
    document.querySelector('#profile-pin').value=profile.fields.pinCode;
  });
  document.querySelector('#profile-delete').addEventListener('click', async () => {
    if(!profileSelect.value || !confirm('Delete these saved details?'))return;
    await personalProfiles.delete(profileSelect.value);
    await renderPersonalProfiles();
    toast('Saved details deleted.','success');
  });
  await renderPersonalProfiles();

  let pdfWorkspace = null;

  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', async () => {
    const view = button.dataset.view;
    if (view === 'pdf') {
      navigate('pdf');
      if (!document.querySelector('#pdf-workspace').classList.contains('is-hidden')) return;
      document.querySelector('#pdf-empty').classList.remove('is-hidden');
      return;
    }
    if (view === 'library') await libraryView.render();
    navigate(view);
  }));
  document.querySelectorAll('[data-go-studio]').forEach(button => button.addEventListener('click', () => navigate('studio')));

  const openPdfButton = document.querySelector('#open-pdf');
  const pdfPicker = document.querySelector('#pdf-picker');
  openPdfButton.addEventListener('click', () => pdfPicker.click());
  pdfPicker.addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (!pdfWorkspace) {
        const { PdfWorkspace } = await import('./pdf/document-view.js');
        pdfWorkspace = new PdfWorkspace({
          canvas: document.querySelector('#pdf-canvas'), overlay: document.querySelector('#pdf-overlay'),
          pagesContainer: document.querySelector('#pdf-pages'), toolsContainer: document.querySelector('#pdf-tools'),
          getSignatures: () => library.list(), getSignature: id => library.get(id), getPersonalProfiles: () => personalProfiles.list(), notify: toast
        });
      }
      const info = await pdfWorkspace.open(file);
      document.querySelector('#pdf-empty').classList.add('is-hidden');
      document.querySelector('#pdf-workspace').classList.remove('is-hidden');
      toast(`PDF opened. ${info.pageCount} pages · ${info.fieldCount} fillable fields.`, 'success');
    } catch (error) {
      const message = !navigator.onLine ? 'This PDF module has not been cached on this device yet. Connect once, open the PDF workspace, and try again.' : (error.message || 'This PDF could not be opened.');
      toast(message, 'error');
    }
    finally { pdfPicker.value = ''; }
  });

  document.querySelector('#theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next; localStorage.setItem('signstudio-theme', next);
  });
  document.documentElement.dataset.theme = localStorage.getItem('signstudio-theme') || 'light';
  document.querySelector('#settings-button').addEventListener('click', () => managePassphraseLock(passphraseLock));
  document.querySelector('#privacy-link').addEventListener('click', () => toast('Your signatures are kept private in this browser. Clearing browser data can delete them. Download a backup before clearing browser data.', 'info'));
  document.querySelector('#offline-status span').textContent = navigator.onLine ? 'Works offline after first visit' : 'Working offline';
  window.addEventListener('offline', () => { document.querySelector('#offline-status span').textContent = 'Working offline'; });
  window.addEventListener('online', () => { document.querySelector('#offline-status span').textContent = 'Works offline after first visit'; });

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      document.querySelector('#offline-status span').textContent = 'Ready to work offline';
      registration.update().catch(() => {});
    } catch { toast('Offline setup could not finish. Reopen the app while connected.', 'error', 'SS-OFF-501'); }
  }
  if (!localStorage.getItem('signstudio-privacy-seen')) {
    localStorage.setItem('signstudio-privacy-seen', 'true');
    toast('Your photos and signatures stay on this device. Open SignStudio once while online to prepare it for offline use.', 'success');
  }
  window.addEventListener('pagehide', () => { sessionStore.clear(); studio.destroy(); libraryView.destroy(); passphraseLock.lock(); keyManager.lock(); });
}

boot().catch(error => {
  console.error('SignStudio startup failed', error);
  showRecovery({ message: 'SignStudio could not start. Reload the page or open a backup of your saved signatures.', actionLabel: 'Reload app', action: () => location.reload() });
});
