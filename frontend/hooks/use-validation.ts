"use client";

import { useState, useCallback } from "react";

// ============================================================
// Form Validation — lightweight Zod-style validation
// No external dependency — pure TypeScript validation rules
// ============================================================

export type ValidationRule = {
  type:
    | "required"
    | "email"
    | "phone"
    | "minLength"
    | "maxLength"
    | "min"
    | "max"
    | "pattern"
    | "custom";
  message: string;
  value?: number | string | RegExp;
  validate?: (val: string, allFields?: Record<string, string>) => boolean;
};

export type FieldSchema = {
  rules: ValidationRule[];
};

export type FormSchema = Record<string, FieldSchema>;

export type ValidationErrors = Record<string, string | null>;

// ============================================================
// Validators
// ============================================================

function validateField(
  value: string,
  rules: ValidationRule[],
  allFields?: Record<string, string>,
): string | null {
  for (const rule of rules) {
    switch (rule.type) {
      case "required":
        if (!value.trim()) return rule.message;
        break;
      case "email":
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return rule.message;
        break;
      case "phone":
        if (value && !/^[\d\s+()-]{7,20}$/.test(value)) return rule.message;
        break;
      case "minLength":
        if (value && value.length < (rule.value as number)) return rule.message;
        break;
      case "maxLength":
        if (value && value.length > (rule.value as number)) return rule.message;
        break;
      case "min":
        if (value && parseFloat(value) < (rule.value as number))
          return rule.message;
        break;
      case "max":
        if (value && parseFloat(value) > (rule.value as number))
          return rule.message;
        break;
      case "pattern":
        if (value && !(rule.value as RegExp).test(value)) return rule.message;
        break;
      case "custom":
        if (rule.validate && !rule.validate(value, allFields))
          return rule.message;
        break;
    }
  }
  return null;
}

// ============================================================
// useFormValidation — hook for form validation
// ============================================================

export function useFormValidation(schema: FormSchema) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateSingleField = useCallback(
    (
      fieldName: string,
      value: string,
      allFields?: Record<string, string>,
    ): string | null => {
      const fieldSchema = schema[fieldName];
      if (!fieldSchema) return null;
      return validateField(value, fieldSchema.rules, allFields);
    },
    [schema],
  );

  const validateFieldOnBlur = useCallback(
    (fieldName: string, value: string, allFields?: Record<string, string>) => {
      setTouched((prev) => ({ ...prev, [fieldName]: true }));
      const error = validateSingleField(fieldName, value, allFields);
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
      return error;
    },
    [validateSingleField],
  );

  const validateFieldOnChange = useCallback(
    (fieldName: string, value: string, allFields?: Record<string, string>) => {
      // Only validate on change if field has been touched
      if (touched[fieldName]) {
        const error = validateSingleField(fieldName, value, allFields);
        setErrors((prev) => ({ ...prev, [fieldName]: error }));
      }
    },
    [touched, validateSingleField],
  );

  const validateAll = useCallback(
    (fields: Record<string, string>): boolean => {
      const newErrors: ValidationErrors = {};
      const newTouched: Record<string, boolean> = {};
      let isValid = true;

      for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        newTouched[fieldName] = true;
        const error = validateField(
          fields[fieldName] || "",
          fieldSchema.rules,
          fields,
        );
        newErrors[fieldName] = error;
        if (error) isValid = false;
      }

      setErrors(newErrors);
      setTouched(newTouched);
      return isValid;
    },
    [schema],
  );

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback(
    (fieldName: string): string | null => {
      return touched[fieldName] ? errors[fieldName] || null : null;
    },
    [errors, touched],
  );

  const hasErrors = Object.values(errors).some((e) => e !== null);

  return {
    errors,
    touched,
    hasErrors,
    validateFieldOnBlur,
    validateFieldOnChange,
    validateAll,
    clearErrors,
    getFieldError,
  } as const;
}

// ============================================================
// Pre-built schemas for common forms
// ============================================================

export const contactFormSchema: FormSchema = {
  firstName: {
    rules: [
      { type: "required", message: "First name is required" },
      { type: "minLength", value: 2, message: "Must be at least 2 characters" },
    ],
  },
  lastName: {
    rules: [{ type: "required", message: "Last name is required" }],
  },
  email: {
    rules: [
      { type: "required", message: "Email is required" },
      { type: "email", message: "Enter a valid email address" },
    ],
  },
  phone: {
    rules: [{ type: "phone", message: "Enter a valid phone number" }],
  },
};

export const loginFormSchema: FormSchema = {
  email: {
    rules: [
      { type: "required", message: "Email is required" },
      { type: "email", message: "Enter a valid email address" },
    ],
  },
  password: {
    rules: [
      { type: "required", message: "Password is required" },
      {
        type: "minLength",
        value: 8,
        message: "Password must be at least 8 characters",
      },
    ],
  },
};

export const callLogSchema: FormSchema = {
  contactName: {
    rules: [{ type: "required", message: "Contact name is required" }],
  },
  phone: {
    rules: [
      { type: "required", message: "Phone number is required" },
      { type: "phone", message: "Enter a valid phone number" },
    ],
  },
  outcome: {
    rules: [{ type: "required", message: "Select a call outcome" }],
  },
};

export const spendEntrySchema: FormSchema = {
  source: {
    rules: [{ type: "required", message: "Select an ad source" }],
  },
  campaign: {
    rules: [{ type: "required", message: "Campaign name is required" }],
  },
  amount: {
    rules: [
      { type: "required", message: "Amount is required" },
      { type: "min", value: 0, message: "Amount must be positive" },
    ],
  },
};
