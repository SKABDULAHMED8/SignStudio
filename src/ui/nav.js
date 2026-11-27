export function navigate(view) {
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('is-hidden', panel.dataset.panel !== view));
  document.querySelectorAll('[data-view]').forEach(button => {
    const selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  document.querySelector('#main-content').focus({ preventScroll: true });
}
