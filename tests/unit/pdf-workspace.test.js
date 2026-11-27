import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { toPdfPoint, toPdfRect } from '../../src/pdf/placement.js';
import { describeFormField, applyFormValues } from '../../src/pdf/forms.js';

describe('PDF coordinate conversion', () => {
  test('maps a point from the top-left canvas origin to PDF bottom-left coordinates', () => {
    assert.deepEqual(toPdfPoint(150, 250, { left: 100, top: 200, width: 200, height: 400 }, 600, 800), { x: 150, y: 700 });
  });
  test('maps and clamps a rectangle to page bounds', () => {
    assert.deepEqual(toPdfRect({ x: 190, y: 390, width: 40, height: 30 }, { width: 200, height: 400 }, 200, 400), { x: 160, y: 0, width: 40, height: 30 });
  });
});

describe('AcroForm fields', () => {
  test('describes supported field kinds and options', () => {
    const fields = [
      { getName: () => 'Full name', constructor: { name: 'PDFTextField' } },
      { getName: () => 'Agree', constructor: { name: 'PDFCheckBox' } },
      { getName: () => 'Country', constructor: { name: 'PDFDropdown' } },
      { getName: () => 'Choice', constructor: { name: 'PDFRadioGroup' } },
      { getName: () => 'Ink', constructor: { name: 'PDFSignature' } }
    ];
    const form = { getFields: () => fields, getDropdown: () => ({ getOptions: () => ['IN', 'US'] }), getRadioGroup: () => ({ getOptions: () => ['A', 'B'] }) };
    const result = describeFormField(form, fields[2]);
    assert.equal(result.kind, 'dropdown');
    assert.deepEqual(result.options, ['IN', 'US']);
    assert.equal(describeFormField(form, fields[4]).supported, false);
  });
  test('detects AcroForm field kinds when production minification renames constructors', () => {
    const text = { getName: () => 'FullName', constructor: { name: 'e' }, getText: () => '', setText() {} };
    const checkbox = { getName: () => 'Agree', constructor: { name: 'e' }, isChecked: () => false, check() {}, uncheck() {} };
    const dropdown = { getName: () => 'Country', constructor: { name: 'e' }, getOptions: () => ['IN', 'US'], getSelected: () => [], select() {}, isEditable: () => false };
    const optionList = { getName: () => 'Regions', constructor: { name: 'e' }, getOptions: () => ['North', 'South'], getSelected: () => [], select() {} };
    const radio = { getName: () => 'Choice', constructor: { name: 'e' }, getOptions: () => ['A', 'B'], getSelected: () => '', select() {}, isMutuallyExclusive: () => true };
    const form = {
      getFields: () => [text, checkbox, dropdown, optionList, radio],
      getTextField: () => ({ getText: () => '' }), getCheckBox: () => ({ isChecked: () => false }),
      getDropdown: () => ({ getSelected: () => [], getOptions: () => ['IN', 'US'] }),
      getOptionList: () => ({ getSelected: () => [], getOptions: () => ['North', 'South'] }),
      getRadioGroup: () => ({ getSelected: () => '', getOptions: () => ['A', 'B'] })
    };
    assert.deepEqual(form.getFields().map(field => describeFormField(form, field).kind), ['text', 'checkbox', 'dropdown', 'option-list', 'radio']);
  });

  test('applies text, checkbox, dropdown and radio values', () => {
    const values = { Name: 'Ada Lovelace', Agree: true, Country: 'IN', Choice: 'B' };
    const calls = [];
    const form = {
      getTextField: name => ({ setText: value => calls.push([name, value]) }),
      getCheckBox: name => ({ check: () => calls.push([name, true]), uncheck: () => calls.push([name, false]) }),
      getDropdown: name => ({ select: value => calls.push([name, value]) }),
      getRadioGroup: name => ({ select: value => calls.push([name, value]) })
    };
    applyFormValues(form, [
      { name: 'Name', kind: 'text' }, { name: 'Agree', kind: 'checkbox' },
      { name: 'Country', kind: 'dropdown' }, { name: 'Choice', kind: 'radio' }
    ], values);
    assert.deepEqual(calls, [['Name', 'Ada Lovelace'], ['Agree', true], ['Country', 'IN'], ['Choice', 'B']]);
  });
});

import { toPdfTextPlacement } from '../../src/pdf/placement.js';

describe('PDF manual text placement', () => {
  test('converts a top-left screen text position into PDF bottom-left coordinates', () => {
    assert.deepEqual(
      toPdfTextPlacement({ x: 20, y: 30, fontSize: 16 }, { width: 200, height: 400 }, 600, 800),
      { x: 60, y: 708, fontSize: 32 }
    );
  });

  test('clamps manual text placement inside page bounds', () => {
    assert.deepEqual(
      toPdfTextPlacement({ x: 190, y: 390, fontSize: 30 }, { width: 200, height: 400 }, 200, 400),
      { x: 190, y: 0, fontSize: 30 }
    );
  });
});
