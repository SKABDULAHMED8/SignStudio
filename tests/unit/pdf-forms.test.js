import test from 'node:test';
import assert from 'node:assert/strict';
import { describeFormField, applyFormValues } from '../../src/pdf/forms.js';

test('detects supported AcroForm fields and excludes signature fields', () => {
  const fields = [
    { getName: () => 'Full name', constructor: { name: 'PDFTextField' }, getText: () => '', setText() {} },
    { getName: () => 'Agree', constructor: { name: 'PDFCheckBox' }, isChecked: () => false, check() {}, uncheck() {} },
    { getName: () => 'Ink', constructor: { name: 'PDFSignature' } }
  ];
  const form = {
    getFields: () => fields,
    getTextField: () => ({ getText: () => '' }),
    getCheckBox: () => ({ isChecked: () => false })
  };
  assert.equal(describeFormField(form, fields[0]).supported, true);
  assert.equal(describeFormField(form, fields[1]).supported, true);
  assert.equal(describeFormField(form, fields[2]).supported, false);
});

test('applies text and checkbox values to the in-memory PDF form', () => {
  const calls = [];
  const form = {
    getTextField: name => ({ setText: value => calls.push([name, value]) }),
    getCheckBox: name => ({ check: () => calls.push([name, true]), uncheck: () => calls.push([name, false]) })
  };
  applyFormValues(form, [
    { name: 'Name', kind: 'text' }, { name: 'Agree', kind: 'checkbox' }
  ], { Name: 'Ada Lovelace', Agree: true });
  assert.deepEqual(calls, [['Name', 'Ada Lovelace'], ['Agree', true]]);
});
