import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string };

/** Labelled bc-input, 44px tall. */
export default function FormField({ id, label, className = "", ...input }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="bc-label text-fg">
        {label}
      </label>
      <input id={id} name={id} className={`bc-input min-h-11 ${className}`} {...input} />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  return (
    // The live region always exists so screen readers announce new errors;
    // when empty it cancels the form's gap instead of leaving a hole.
    <div aria-live="polite" className={message ? "" : "-mt-4"}>
      {message && (
        <p role="alert" className="rounded-[10px] bg-bc-red-light px-3 py-2.5 text-[13px] font-medium text-bc-red-dark">
          {message}
        </p>
      )}
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-border" />
      <span className="bc-caption">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
