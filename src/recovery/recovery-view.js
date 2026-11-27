export function showRecovery({ message, actionLabel, action, secondaryLabel, secondaryAction, extraActions = [] }) {
  document.querySelector('#recovery-message').textContent = message;
  const actions = document.querySelector('#recovery-actions'); actions.replaceChildren();
  if (actionLabel && action) {
    const button = document.createElement('button'); button.className = 'button button-primary'; button.textContent = actionLabel; button.addEventListener('click', action); actions.append(button);
  }
  if (secondaryLabel && secondaryAction) {
    const button = document.createElement('button'); button.className = 'button button-secondary'; button.textContent = secondaryLabel; button.addEventListener('click', secondaryAction); actions.append(button);
  }
  for (const item of extraActions) {
    const button = document.createElement('button'); button.className = `button ${item.variant === 'danger' ? 'button-quiet' : 'button-secondary'}`; button.textContent = item.label; button.addEventListener('click', item.action); actions.append(button);
  }
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.panel !== 'recovery'));
}
