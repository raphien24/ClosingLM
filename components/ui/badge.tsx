import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "green" | "yellow" | "red" | "orange" | "gray" | "blue";
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  const variants = {
    green: "bg-green-100 text-green-800 dark:ring-1 dark:ring-inset dark:ring-emerald-500/30",
    yellow: "bg-yellow-100 text-yellow-800 dark:ring-1 dark:ring-inset dark:ring-yellow-400/30",
    red: "bg-red-100 text-red-800 dark:ring-1 dark:ring-inset dark:ring-rose-400/30",
    orange: "bg-orange-100 text-orange-800 dark:ring-1 dark:ring-inset dark:ring-orange-400/30",
    gray: "bg-gray-100 text-gray-700 dark:ring-1 dark:ring-inset dark:ring-slate-500/30",
    blue: "bg-blue-100 text-blue-800 dark:ring-1 dark:ring-inset dark:ring-blue-400/30",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
