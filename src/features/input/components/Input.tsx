import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../../shared/utils/cn';
import type { InputProps } from '../types';

// Input variants using class-variance-authority
const inputVariants = cva(
  'flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        small: 'input-small h-8 px-2 text-xs',
        medium: 'input-medium h-10 px-3 text-sm',
        large: 'input-large h-12 px-4 text-base',
      },
      hasError: {
        true: 'input-error border-red-500 focus-visible:ring-red-500',
        false: '',
      },
    },
    defaultVariants: {
      size: 'medium',
      hasError: false,
    },
  },
);

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
  {
    variants: {
      hasError: {
        true: 'text-red-600',
        false: 'text-gray-700',
      },
    },
    defaultVariants: {
      hasError: false,
    },
  },
);

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      size = 'medium',
      error,
      label,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const hasError = !!error;

    return (
      <div className="flex w-full flex-col gap-2">
        {label && (
          <label htmlFor={inputId} className={cn(labelVariants({ hasError }))}>
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            type={type}
            className={cn(
              inputVariants({ size, hasError }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              disabled && 'input-disabled',
              className,
            )}
            ref={ref}
            disabled={disabled}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
