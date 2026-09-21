import { useId } from 'react';
import './Dropdown.css';

/**
 * Reusable dropdown built on native select/option.
 *
 * props:
 *  options            array of objects (or primitives)
 *  labelProcessor     (option) => string shown to the user
 *  valueProcessor     (option) => unique value, defaults to option.id
 *  onOptionSelected   (selectedObjectFromOptions) => void
 *  placeholder        text of the disabled first option
 */
const Dropdown = ({
  options = [],
  labelProcessor = (option) => String(option?.name ?? option),
  valueProcessor = (option) => String(option?.id ?? option),
  onOptionSelected,
  placeholder = 'Select an option',
  label,
  value = '',
  disabled = false,
  required = false,
  name,
  error,
}) => {
  const id = useId();

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    const selected = options.find((option) => valueProcessor(option) === selectedValue) ?? null;
    console.log('[Dropdown] selected', label || name, selected);
    onOptionSelected?.(selected, selectedValue);
  };

  return (
    <div className="field dropdown-field">
      {label ? (
        <label htmlFor={id}>
          {label}
          {required ? <span className="req"> *</span> : null}
        </label>
      ) : null}
      <div className={`dropdown-shell ${disabled ? 'is-disabled' : ''}`}>
        <select
          id={id}
          name={name}
          className="dropdown-select"
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={valueProcessor(option)} value={valueProcessor(option)}>
              {labelProcessor(option)}
            </option>
          ))}
        </select>
        <span className="dropdown-caret" aria-hidden="true" />
      </div>
      {error ? <span className="inline-error">{error}</span> : null}
    </div>
  );
};

export default Dropdown;
