interface CodeInputProps {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
}

/** The six-digit code from a mail: number pad on phones, and iOS offers it from Mail as autofill. */
export function CodeInput({ value, onChange, id, className, placeholder }: CodeInputProps) {
  return (
    <input
      id={id}
      className={className}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      autoComplete="one-time-code"
      pattern="\d{6}"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.trim())}
      required
    />
  );
}
