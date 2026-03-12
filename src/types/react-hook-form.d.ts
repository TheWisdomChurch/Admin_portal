declare module 'react-hook-form' {
  import type * as React from 'react';

  export type FieldValues = Record<string, unknown>;
  export type Path<TFieldValues extends FieldValues> = Extract<keyof TFieldValues, string>;
  export type Control<TFieldValues extends FieldValues = FieldValues> = {
    readonly __control?: TFieldValues;
  };

  export type RegisterOptions = Record<string, unknown>;
  export type SetValueOptions = {
    shouldDirty?: boolean;
    shouldTouch?: boolean;
    shouldValidate?: boolean;
  };
  export type RegisterReturn<TName extends string = string> = {
    name: TName;
    onChange: (...event: unknown[]) => void;
    onBlur: (...event: unknown[]) => void;
    ref: React.Ref<HTMLInputElement>;
  };

  export type SubmitHandler<TFieldValues extends FieldValues> = (
    data: TFieldValues,
    event?: React.BaseSyntheticEvent
  ) => unknown | Promise<unknown>;

  export type ControllerRenderProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends Path<TFieldValues> = Path<TFieldValues>,
  > = {
    name: TName;
    value: TFieldValues[TName];
    onChange: (value: unknown) => void;
    onBlur: () => void;
    ref: React.Ref<HTMLInputElement>;
    disabled?: boolean;
  };

  export type FieldError = {
    type?: string;
    message?: string;
  };

  export type FieldErrors<TFieldValues extends FieldValues = FieldValues> =
    Partial<Record<Path<TFieldValues>, FieldError>> &
      Record<string, FieldError | undefined>;

  export type UseFormReturn<TFieldValues extends FieldValues = FieldValues> = {
    register: (
      name: Path<TFieldValues>,
      options?: RegisterOptions
    ) => RegisterReturn<Path<TFieldValues>>;
    control: Control<TFieldValues>;
    handleSubmit: (
      handler: SubmitHandler<TFieldValues>
    ) => (event?: React.BaseSyntheticEvent) => Promise<void>;
    clearErrors: (name?: Path<TFieldValues> | Path<TFieldValues>[]) => void;
    setError: (name: Path<TFieldValues>, error: FieldError) => void;
    setValue: <TName extends Path<TFieldValues>>(
      name: TName,
      value: TFieldValues[TName],
      options?: SetValueOptions
    ) => void;
    getValues: {
      (): TFieldValues;
      <TName extends Path<TFieldValues>>(name: TName): TFieldValues[TName];
    };
    watch: {
      (): TFieldValues;
      <TName extends Path<TFieldValues>>(name: TName): TFieldValues[TName];
    };
    reset: (values?: Partial<TFieldValues>) => void;
    formState: {
      errors: FieldErrors<TFieldValues>;
      isSubmitting?: boolean;
    };
  };

  export function useForm<TFieldValues extends FieldValues = FieldValues>(
    props?: Record<string, unknown>
  ): UseFormReturn<TFieldValues>;

  export function useWatch<
    TFieldValues extends FieldValues = FieldValues,
    TName extends Path<TFieldValues> = Path<TFieldValues>,
  >(props: {
    control?: Control<TFieldValues>;
    name?: TName;
  }): TFieldValues[TName];

  export type ControllerProps<
    TFieldValues extends FieldValues = FieldValues,
    TName extends Path<TFieldValues> = Path<TFieldValues>,
  > = {
    name: TName;
    control: Control<TFieldValues>;
    render: (props: { field: ControllerRenderProps<TFieldValues, TName> }) => React.ReactNode;
  };

  export function Controller<
    TFieldValues extends FieldValues = FieldValues,
    TName extends Path<TFieldValues> = Path<TFieldValues>,
  >(props: ControllerProps<TFieldValues, TName>): React.ReactElement | null;
}
