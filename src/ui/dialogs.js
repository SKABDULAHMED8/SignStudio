function getDialog() { return document.querySelector('#app-dialog'); }

export function showDialog(content) {
  const dialog = getDialog();
  const target = document.querySelector('#dialog-content');
  target.replaceChildren();
  target.append(content);
  if (!dialog.open) dialog.showModal();
}

export function askForText({ title, description, label, value = '', confirmLabel = 'Save', inputType = 'text', minLength = 0 }) {
  return ask({ title, description, label, value, confirmLabel, inputType, minLength, trim: true, maxLength: 80 });
}

export function askForSecret({ title, description, label, confirmLabel = 'Continue', minLength = 1, autocomplete = 'current-password' }) {
  return ask({ title, description, label, confirmLabel, inputType: 'password', minLength, maxLength: 256, autocomplete, trim: false });
}

// A single native dialog is reused for all prompts. Resolve only after the
// close event belonging to this invocation has completed. This prevents a
// queued close event from an earlier prompt from closing the next prompt.
function closePrompt(dialog, result, state) {
  if (state.settled) return;
  state.settled = true;
  state.result = result;
  if (dialog.open) dialog.close();
  else state.resolve(result);
}

function ask({ title, description, label, value = '', confirmLabel, inputType, minLength, maxLength, autocomplete, trim }) {
  return new Promise(resolve => {
    const dialog = getDialog();
    const content = document.querySelector('#dialog-content');
    content.replaceChildren();
    const wrapper = document.createElement('div'); wrapper.className = 'dialog-content';
    const heading = document.createElement('h2'); heading.textContent = title;
    const detail = document.createElement('p'); detail.textContent = description;
    const field = document.createElement('label'); field.className = 'dialog-field'; field.textContent = label;
    const input = document.createElement('input'); input.value = value; input.maxLength = maxLength; input.required = true; input.type = inputType; input.minLength = minLength;
    if (autocomplete) input.autocomplete = autocomplete;
    field.append(input);
    const error = document.createElement('p'); error.className = 'dialog-error'; error.setAttribute('role', 'alert');
    const actions = document.createElement('div'); actions.className = 'dialog-actions';
    const cancel = document.createElement('button'); cancel.className = 'button button-secondary'; cancel.type = 'button'; cancel.textContent = 'Cancel';
    const save = document.createElement('button'); save.className = 'button button-primary'; save.type = 'button'; save.textContent = confirmLabel;
    actions.append(cancel, save); wrapper.append(heading, detail, field, error, actions); content.append(wrapper);
    const state = { settled: false, result: null, resolve };
    const cleanup = () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      dialog.querySelector('.dialog-close')?.removeEventListener('click', onCloseButton);
      cancel.removeEventListener('click', onCancelButton);
      save.removeEventListener('click', onSave);
    };
    const onClose = () => { cleanup(); resolve(state.settled ? state.result : null); };
    const onCancel = event => { event.preventDefault(); closePrompt(dialog, null, state); };
    const onCloseButton = () => closePrompt(dialog, null, state);
    const onCancelButton = () => closePrompt(dialog, null, state);
    const onSave = () => {
      const result = trim ? input.value.trim() : input.value;
      if (result.length < minLength) { error.textContent = `Enter at least ${minLength} characters.`; input.focus(); return; }
      closePrompt(dialog, result, state);
    };
    const form = dialog.querySelector('form'); if (form) form.onsubmit = event => event.preventDefault();
    dialog.querySelector('.dialog-close')?.addEventListener('click', onCloseButton);
    cancel.addEventListener('click', onCancelButton);
    save.addEventListener('click', onSave);
    dialog.addEventListener('cancel', onCancel);
    dialog.addEventListener('close', onClose, { once: true });
    if (!dialog.open) dialog.showModal();
    input.focus();
  });
}

export function askForChoice({ title, description, choices }) {
  return new Promise(resolve => {
    const dialog = getDialog(), content = document.querySelector('#dialog-content');
    content.replaceChildren();
    const wrapper = document.createElement('div'); wrapper.className = 'dialog-content';
    const heading = document.createElement('h2'); heading.textContent = title;
    const detail = document.createElement('p'); detail.textContent = description;
    const actions = document.createElement('div'); actions.className = 'dialog-actions dialog-choice-actions';
    const state = { settled: false, result: null, resolve };
    const cleanup = () => {
      dialog.removeEventListener('cancel', onCancel);
      dialog.removeEventListener('close', onClose);
      dialog.querySelector('.dialog-close')?.removeEventListener('click', onCloseButton);
    };
    const finish = value => closePrompt(dialog, value, state);
    const onClose = () => { cleanup(); resolve(state.settled ? state.result : null); };
    const onCancel = event => { event.preventDefault(); finish(null); };
    const onCloseButton = () => finish(null);
    for (const choice of choices) {
      const button = document.createElement('button'); button.type = 'button'; button.className = `button ${choice.variant === 'primary' ? 'button-primary' : choice.variant === 'danger' ? 'button-quiet' : 'button-secondary'}`;
      button.textContent = choice.label; button.addEventListener('click', () => finish(choice.value)); actions.append(button);
    }
    wrapper.append(heading, detail, actions); content.append(wrapper);
    const form = dialog.querySelector('form'); if (form) form.onsubmit = event => event.preventDefault();
    dialog.querySelector('.dialog-close')?.addEventListener('click', onCloseButton);
    dialog.addEventListener('cancel', onCancel); dialog.addEventListener('close', onClose, { once: true });
    if (!dialog.open) dialog.showModal();
  });
}
