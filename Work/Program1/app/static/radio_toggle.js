(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.radioToggleHelper = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function getRadioFromTarget(target) {
    if (!target) return null;
    if (typeof target.matches === 'function' && target.matches('input[type="radio"]')) {
      return target;
    }
    const label = typeof target.closest === 'function' ? target.closest('label') : null;
    if (!label || typeof label.querySelector !== 'function') return null;
    return label.querySelector('input[type="radio"]');
  }

  function rememberRadioCheckedState(target) {
    const radio = getRadioFromTarget(target);
    if (radio && radio.dataset) {
      radio.dataset.wasChecked = radio.checked ? '1' : '0';
    }
    return radio;
  }

  function dispatchRadioChange(radio) {
    if (!radio || typeof radio.dispatchEvent !== 'function') return;
    const changeEvent = typeof Event === 'function'
      ? new Event('change', { bubbles: true })
      : { type: 'change', bubbles: true };
    radio.dispatchEvent(changeEvent);
  }

  function maybeToggleCheckedRadio(target, event) {
    const radio = getRadioFromTarget(target);
    if (!radio) return false;
    const wasChecked = !!(radio.dataset && radio.dataset.wasChecked === '1');
    if (radio.dataset) delete radio.dataset.wasChecked;
    if (!wasChecked) return false;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    radio.checked = false;
    dispatchRadioChange(radio);
    return true;
  }

  return {
    getRadioFromTarget,
    rememberRadioCheckedState,
    maybeToggleCheckedRadio,
  };
});
