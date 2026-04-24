const assert = require('node:assert/strict');

const {
  rememberRadioCheckedState,
  maybeToggleCheckedRadio,
} = require('../app/static/radio_toggle.js');

function createRadioFixture({ checked = false } = {}) {
  const radio = {
    checked,
    dataset: {},
    dispatchedEvents: [],
    matches(selector) {
      return selector === 'input[type="radio"]';
    },
    closest(selector) {
      return selector === 'label' ? label : null;
    },
    dispatchEvent(event) {
      this.dispatchedEvents.push(event);
      return true;
    },
  };

  const label = {
    querySelector(selector) {
      return selector === 'input[type="radio"]' ? radio : null;
    },
    closest(selector) {
      return selector === 'label' ? label : null;
    },
  };

  const text = {
    closest(selector) {
      return selector === 'label' ? label : null;
    },
    matches() {
      return false;
    },
  };

  return { radio, label, text };
}

function runTest(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

runTest('repeat click on checked radio row clears selection and prevents default re-check', () => {
  const { radio, text } = createRadioFixture({ checked: true });
  let prevented = false;

  rememberRadioCheckedState(text);
  const toggled = maybeToggleCheckedRadio(text, {
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(toggled, true);
  assert.equal(prevented, true);
  assert.equal(radio.checked, false);
  assert.equal(radio.dataset.wasChecked, undefined);
  assert.equal(radio.dispatchedEvents.length, 1);
  assert.equal(radio.dispatchedEvents[0].type, 'change');
});

runTest('first click on unchecked radio row keeps native selection behavior', () => {
  const { radio, text } = createRadioFixture({ checked: false });
  let prevented = false;

  rememberRadioCheckedState(text);
  const toggled = maybeToggleCheckedRadio(text, {
    preventDefault() {
      prevented = true;
    },
  });

  assert.equal(toggled, false);
  assert.equal(prevented, false);
  assert.equal(radio.checked, false);
  assert.equal(radio.dispatchedEvents.length, 0);
  assert.equal(radio.dataset.wasChecked, undefined);
});
