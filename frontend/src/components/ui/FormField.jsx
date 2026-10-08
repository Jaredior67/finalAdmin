import React, { useId } from 'react';

/**
 * FormField — label-above-field wrapper with hint and error slots.
 * Error text is linked via aria-describedby so screen readers announce it.
 */
export function FormField({ label, required = false, hint = null, error = null, children, htmlFor = null, style = null }) {
  const autoId = useId();
  const fieldId = htmlFor || `ff-${autoId.replace(/:/g, '')}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  const describedBy = [
    error ? errorId : null,
    hint ? hintId : null,
  ].filter(Boolean).join(' ') || undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id || fieldId,
        'aria-describedby': [children.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        className: [
          children.props.className,
          error ? 'is-error' : null,
        ].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className="form-group" style={style || undefined}>
      {label && (
        <label className="form-label" htmlFor={fieldId}>
          {label}
          {required && <span className="label-required" aria-hidden="true"> *</span>}
          {required && <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>(required)</span>}
        </label>
      )}
      {child}
      {hint && !error && <div className="form-help" id={hintId}>{hint}</div>}
      {error && <div className="form-error-msg" id={errorId} role="alert">{error}</div>}
    </div>
  );
}

export function TextInput({ className = '', value, ...props }) {
  return <input type="text" value={value ?? ''} {...props} className={`form-input${className ? ` ${className}` : ''}`} />;
}

export function TextArea({ className = '', value, ...props }) {
  return <textarea value={value ?? ''} {...props} className={`form-textarea${className ? ` ${className}` : ''}`} />;
}

export function SelectInput({ className = '', value, ...props }) {
  return <select value={value ?? ''} {...props} className={`form-select${className ? ` ${className}` : ''}`} />;
}
