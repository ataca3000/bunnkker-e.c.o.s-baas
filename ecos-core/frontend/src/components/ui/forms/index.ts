/**
 * ECOS Enterprise Form System
 *
 * Single entry point for all form controls and layout components.
 * Every module must import from here — never from raw Radix or HTML directly.
 *
 * Controls:
 *   EcosInput            — text input with size variants, icons, loading
 *   EcosTextarea         — textarea with size variants
 *   EcosNumberInput      — number input, scroll-wheel disabled
 *   EcosCurrencyInput    — formatted currency with thousands separator
 *   EcosPercentageInput  — number with % suffix
 *   EcosPasswordInput    — password with show/hide toggle
 *   EcosEmailInput       — email input with mail icon
 *   EcosPhoneInput       — phone input with phone icon
 *   EcosCheckbox         — checkbox with optional label + description
 *   EcosSwitch           — toggle switch with optional label + description
 *   EcosRadioGroup       — horizontal/vertical radio options
 *   EcosDatePicker       — native date input, styled consistently
 *   EcosTagsInput        — multi-value chip input (Enter/comma to add)
 *   EcosImageUpload      — image with drag-and-drop, preview, replace, remove
 *   EcosFileUpload       — multi-file with drag-and-drop, progress, retry
 *   EcosCombobox         — portal-rendered searchable select (async-ready)
 *   Select + sub-parts   — portal-rendered static option list (Radix)
 *
 * Layout:
 *   EcosFormField  (alias: FormField)  — label + control + feedback
 *   FormSection    — collapsible section
 *   FormRow        — responsive grid row
 *   FormActions    — footer action bar
 *   FormDivider    — labeled separator
 */

// Controls
export { EcosInput, type EcosInputProps, type EcosInputSize }            from './ecos-input';
export { EcosTextarea, type EcosTextareaProps }                          from './ecos-textarea';
export { EcosNumberInput, type EcosNumberInputProps }                    from './ecos-number-input';
export { EcosCurrencyInput, type EcosCurrencyInputProps }                from './ecos-currency-input';
export { EcosPercentageInput, type EcosPercentageInputProps }            from './ecos-percentage-input';
export { EcosPasswordInput, type EcosPasswordInputProps }                from './ecos-password-input';
export { EcosEmailInput, type EcosEmailInputProps }                      from './ecos-email-input';
export { EcosPhoneInput, type EcosPhoneInputProps }                      from './ecos-phone-input';
export { EcosCheckbox, type EcosCheckboxProps }                          from './ecos-checkbox';
export { EcosSwitch, type EcosSwitchProps }                              from './ecos-switch';
export { EcosRadioGroup, type EcosRadioGroupProps, type EcosRadioOption } from './ecos-radio-group';
export { EcosDatePicker, type EcosDatePickerProps }                      from './ecos-date-picker';
export { EcosTagsInput, type EcosTagsInputProps }                        from './ecos-tags-input';
export { EcosImageUpload, type EcosImageUploadProps }                    from './ecos-image-upload';
export { EcosFileUpload, type EcosFileEntry, type EcosFileUploadProps }                from './ecos-file-upload';
export { EcosCombobox, type EcosComboboxOption, type EcosComboboxProps } from './ecos-combobox';
export {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectScrollDownButton, SelectScrollUpButton, SelectSeparator,
  SelectTrigger, SelectValue,
} from './ecos-select';

// Layout
export { EcosFormField, FormField, type FormFieldProps }  from './form-field';
export { FormSection, type FormSectionProps }              from './form-section';
export { FormRow, type FormRowProps }                      from './form-row';
export { FormActions, type FormActionsProps }              from './form-actions';
export { FormDivider, type FormDividerProps }              from './form-divider';
