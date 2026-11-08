// Mouse-accessible confirmation for embedded browsers such as Wallpaper Engine.
let pending = null;

export function confirmInPage({ title, message, confirmLabel, cancelLabel }) {
  if (pending) return pending;
  let finish;
  pending = new Promise((resolve) => { finish = resolve; });
  const result = pending;
  const previousFocus = document.activeElement;
  const root = document.createElement('div');
  root.className = 'app-confirm';
  const panel = document.createElement('section');
  panel.setAttribute('role', 'alertdialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'appConfirmTitle');
  panel.setAttribute('aria-describedby', 'appConfirmMessage');
  const heading = document.createElement('h2');
  heading.id = 'appConfirmTitle';
  heading.textContent = title;
  const description = document.createElement('p');
  description.id = 'appConfirmMessage';
  description.textContent = message;
  const buttons = document.createElement('div');
  buttons.className = 'app-confirm-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = cancelLabel;
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'app-confirm-accept';
  confirm.textContent = confirmLabel;
  function close(accepted) {
    root.remove();
    pending = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    finish(accepted);
  }
  cancel.addEventListener('click', () => close(false));
  confirm.addEventListener('click', () => close(true));
  root.addEventListener('click', (event) => {
    event.stopPropagation();
    if (event.target === root) close(false);
  });
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'contextmenu', 'wheel']) {
    root.addEventListener(type, (event) => event.stopPropagation());
  }
  root.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(false); }
    if (event.key === 'Tab') {
      event.preventDefault();
      (document.activeElement === cancel ? confirm : cancel).focus();
    }
  });
  buttons.append(cancel, confirm);
  panel.append(heading, description, buttons);
  root.append(panel);
  document.body.append(root);
  cancel.focus({ preventScroll: true });
  return result;
}
