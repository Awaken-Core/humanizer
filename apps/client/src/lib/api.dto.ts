import { z } from "zod";

const ApiErrorMessageDto = z
  .object({ message: z.string().optional() })
  .passthrough();

export const ApiErrorDto = z.union([z.string(), ApiErrorMessageDto]);

export const ToolApiResponseDto = z
  .object({
    success: z.boolean().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    error: ApiErrorDto.optional(),
  })
  .passthrough();

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const parsed = ApiErrorDto.safeParse(error);
  if (!parsed.success) return fallback;
  const stringError = z.string().safeParse(parsed.data);
  if (stringError.success) return stringError.data;
  const messageError = ApiErrorMessageDto.safeParse(parsed.data);
  return messageError.success
    ? messageError.data.message || fallback
    : fallback;
}
