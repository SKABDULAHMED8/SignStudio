const FIELD_TYPES = new Map([
  ['PDFTextField', 'text'], ['PDFCheckBox', 'checkbox'], ['PDFDropdown', 'dropdown'],
  ['PDFOptionList', 'option-list'], ['PDFRadioGroup', 'radio'], ['PDFButton', 'button'],
  ['PDFSignature', 'signature']
]);

function fieldKind(field) {
  // Constructor names are not stable in minified production bundles. Prefer
  // public PDFField capabilities and AcroField flags, then retain the
  // constructor-name fallback for older pdf-lib shapes.
  if (typeof field?.getText === 'function' && typeof field?.setText === 'function') return 'text';
  if (typeof field?.isChecked === 'function' && typeof field?.check === 'function' && typeof field?.uncheck === 'function') return 'checkbox';
  if (typeof field?.getOptions === 'function' && typeof field?.getSelected === 'function' && typeof field?.select === 'function') {
    if (typeof field.isMutuallyExclusive === 'function') return 'radio';
    if (typeof field.isEditable === 'function') return 'dropdown';
    return 'option-list';
  }
  return FIELD_TYPES.get(field?.constructor?.name) ?? 'unsupported';
}

export function describeFormField(form, field) {
  const name = field.getName();
  const kind = fieldKind(field);
  const supported = ['text', 'checkbox', 'dropdown', 'option-list', 'radio'].includes(kind);
  let options = [];
  if (kind === 'dropdown' || kind === 'option-list' || kind === 'radio') {
    try {
      const accessor = kind === 'radio' ? 'getRadioGroup' : kind === 'dropdown' ? 'getDropdown' : 'getOptionList';
      options = form[accessor](name).getOptions();
    } catch { options = []; }
  }
  let value = '';
  try {
    if (kind === 'text') value = form.getTextField(name).getText() ?? '';
    if (kind === 'checkbox') value = form.getCheckBox(name).isChecked();
    if (kind === 'dropdown') value = form.getDropdown(name).getSelected()?.[0] ?? '';
    if (kind === 'option-list') value = form.getOptionList(name).getSelected() ?? [];
    if (kind === 'radio') value = form.getRadioGroup(name).getSelected() ?? '';
  } catch { /* Some malformed PDFs have unreadable field defaults. */ }
  return { name, kind, supported, options, value };
}

export function listAcroFormFields(pdfDocument) {
  try {
    const form = pdfDocument.getForm();
    return form.getFields().map(field => describeFormField(form, field));
  } catch { return []; }
}

export function applyFormValues(form, fields, values) {
  for (const field of fields) {
    if (!Object.hasOwn(values, field.name)) continue;
    const value = values[field.name];
    if (field.kind === 'text') form.getTextField(field.name).setText(String(value ?? ''));
    else if (field.kind === 'checkbox') value ? form.getCheckBox(field.name).check() : form.getCheckBox(field.name).uncheck();
    else if (field.kind === 'dropdown') form.getDropdown(field.name).select(String(value));
    else if (field.kind === 'option-list') form.getOptionList(field.name).select(Array.isArray(value) ? value : [value]);
    else if (field.kind === 'radio') form.getRadioGroup(field.name).select(String(value));
  }
}
