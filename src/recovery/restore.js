import { openEncryptedBackup } from '../library/backup.js';
import { KeyManager } from '../security/key-manager.js';
import { SignatureLibrary } from '../library/library.js';
import { PersonalProfileStore } from '../library/personal-profiles.js';

export async function restoreFromEncryptedBackup({ repository, fileText, passphrase, replaceExisting = false, clearPassphraseLock = false }) {
  const backup = await openEncryptedBackup(fileText, passphrase);
  const previous = {
    signatures: await repository.getAll('signatures'),
    trash: await repository.getAll('trash'),
    key: await repository.get('keys', 'device'),
    lock: await repository.get('settings', 'passphrase-lock'),
    personalProfiles: await repository.getAll('personal-profiles')
  };
  if ((previous.signatures.length || previous.key) && !replaceExisting) throw new Error('Replacing the current local library requires confirmation.');
  let profilePlaintext = [];
  if (previous.personalProfiles.length) {
    if (!previous.key?.key) throw new Error('Saved personal profiles cannot be decrypted because the device key is missing. Do not replace local data.');
    const oldKeyManager = new KeyManager(repository);
    const profileStore = new PersonalProfileStore(repository, () => oldKeyManager.getDeviceKey());
    profilePlaintext = await profileStore.exportForRekey();
  }
  try {
    await repository.clear('signatures');
    await repository.clear('trash');
    await repository.delete('keys', 'device');
    if (clearPassphraseLock) await repository.delete('settings', 'passphrase-lock');
    const keyManager = new KeyManager(repository);
    await keyManager.getDeviceKey();
    const library = new SignatureLibrary(repository, () => keyManager.getDeviceKey());
    const restored = await library.importRecords(backup.records);
    if (profilePlaintext.length) {
      const profiles = new PersonalProfileStore(repository, () => keyManager.getDeviceKey());
      await profiles.importAfterRekey(profilePlaintext);
    }
    return { restored, createdAt: backup.createdAt, preservedProfiles: profilePlaintext.length };
  } catch (error) {
    await repository.clear('signatures');
    await repository.clear('trash');
    await repository.delete('keys', 'device');
    await repository.clear('personal-profiles');
    for (const record of previous.personalProfiles) await repository.put('personal-profiles', record);
    for (const record of previous.signatures) await repository.put('signatures', record);
    for (const record of previous.trash) await repository.put('trash', record);
    if (previous.key) await repository.put('keys', previous.key);
    if (previous.lock) await repository.put('settings', previous.lock);
    throw error;
  }
}
