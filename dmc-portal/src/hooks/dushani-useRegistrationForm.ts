import { useCallback, useState } from "react";

import {
  validateField,
  validateForm,
  type FieldErrors,
  type Validator,
} from "../utils/dushani-registrationValidation";

export type FormValues = Record<string, string>;

interface Options {
  initialValues: FormValues;
  rules: Record<string, Validator>;
  onSubmit: (values: FormValues) => Promise<unknown>;
}

export function useRegistrationForm({
  initialValues,
  rules,
  onSubmit,
}: Options) {
  const [formData, setFormData] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = useCallback((field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const blurField = useCallback(
    (field: string) => {
      const message = validateField(field, formData, rules);
      setErrors((prev) => {
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    },
    [formData, rules]
  );

  const submit = useCallback(async () => {
    const nextErrors = validateForm(formData, rules);
    setErrors(nextErrors);
    setSubmitError(null);

    if (Object.keys(nextErrors).length > 0) return false;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      return true;
    } catch (error) {
      const serverErrors = (error as { fieldErrors?: FieldErrors })
        ?.fieldErrors;
      if (serverErrors) {
        setErrors((prev) => ({ ...prev, ...serverErrors }));
      }
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong."
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, onSubmit, rules]);

  return {
    formData,
    errors,
    submitError,
    isSubmitting,
    setField,
    blurField,
    submit,
  };
}
