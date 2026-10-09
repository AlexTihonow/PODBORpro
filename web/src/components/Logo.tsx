import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("logo", className)}>
      <span className="logo__mark">П</span>
      <span className="logo__name">PODBORpro</span>
    </span>
  );
}
