import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Disabled treatment for the filled variants.
 *
 * `opacity-50` on a filled button fades the label along with the fill: white
 * on the accent measured 2.1:1 that way, on the "Nästa" button someone stares
 * at while working out what they still have to fill in. Swapping the fill for
 * a flat grey keeps the label at 10:1 and reads as inactive because it has
 * lost its colour, not because it has gone faint.
 */
const filledDisabled =
  "disabled:bg-secondary disabled:text-secondary-foreground disabled:shadow-none";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground hover:bg-primary/90 ${filledDisabled}`,
        destructive: `bg-destructive text-destructive-foreground hover:bg-destructive/90 ${filledDisabled}`,
        outline:
          "border border-input bg-background hover:bg-secondary hover:text-secondary-foreground disabled:text-muted-foreground disabled:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:text-muted-foreground",
        ghost: "hover:bg-secondary hover:text-secondary-foreground disabled:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline",
        hero: `bg-primary text-primary-foreground hover:bg-primary/90 ${filledDisabled}`,
        accent: `bg-accent text-accent-foreground hover:bg-accent/90 ${filledDisabled}`,
        soft: "bg-accent/10 text-accent hover:bg-accent/20 disabled:bg-secondary disabled:text-muted-foreground",
        warning: `bg-warning text-warning-foreground hover:bg-warning/90 ${filledDisabled}`,
        success: `bg-success text-success-foreground hover:bg-success/90 ${filledDisabled}`,
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-6 text-base",
        xl: "h-14 rounded-md px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
