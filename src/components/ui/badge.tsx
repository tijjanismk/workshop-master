import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      default: "border-zinc-300 bg-zinc-100 text-zinc-700",
      success: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
      warning: "border-amber-400/30 bg-amber-400/10 text-amber-100",
      danger: "border-rose-400/30 bg-rose-400/10 text-rose-100",
      outline: "border-zinc-300 bg-white text-zinc-600",
    },
    },
  defaultVariants: { variant: "default" },
});
function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
