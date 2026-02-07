import { z } from 'zod';
import { normalizeEmail } from '@/lib/utils';

const roleOptions = ['admin', 'super_admin'] as const;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Enter a valid email')
    .transform((v) => normalizeEmail(v)),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean(),
});

export type LoginFormSchema = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    first_name: z.string().trim().min(1, 'First name is required'),
    last_name: z.string().trim().min(1, 'Last name is required'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email')
      .transform((v) => normalizeEmail(v)),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Confirm password is required'),
    role: z.enum(roleOptions, { message: 'Select a role' }),
    rememberMe: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords must match',
      });
    }
  });

export type RegisterFormSchema = z.infer<typeof registerSchema>;
