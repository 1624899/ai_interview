import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// 合并CSS类名的工具函数
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
