import * as React from "react";

import { cn } from "@/lib/utils";

const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} role="alert" className={cn("relative w-full rounded-lg border border-slate-700 p-4 text-sm", className)} {...props} />,
);
Alert.displayName = "Alert";
const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cn("mb-1 font-medium", className)} {...props} />,
);
AlertTitle.displayName = "AlertTitle";
const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("leading-relaxed", className)} {...props} />,
);
AlertDescription.displayName = "AlertDescription";
export { Alert, AlertTitle, AlertDescription };
