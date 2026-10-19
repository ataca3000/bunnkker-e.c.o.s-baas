import * as React from 'react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// Mirrors the shadcn/ui AlertDialog API so imports can stay the same
// once the real @radix-ui/react-alert-dialog is added.

type AlertDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

function AlertDialogContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <DialogContent className={cn('sm:max-w-md', className)} {...props}>
      {children}
    </DialogContent>
  );
}

function AlertDialogHeader(props: React.ComponentProps<'div'>) {
  return <DialogHeader {...props} />;
}

function AlertDialogFooter(props: React.ComponentProps<'div'>) {
  return <DialogFooter {...props} />;
}

function AlertDialogTitle(props: React.ComponentProps<typeof DialogTitle>) {
  return <DialogTitle {...props} />;
}

function AlertDialogDescription(props: React.ComponentProps<typeof DialogDescription>) {
  return <DialogDescription {...props} />;
}

function AlertDialogTrigger(props: React.ComponentProps<typeof DialogTrigger>) {
  return <DialogTrigger {...props} />;
}

function AlertDialogCancel({
  onClick,
  children = 'Cancel',
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="outline" onClick={onClick} {...props}>
      {children}
    </Button>
  );
}

function AlertDialogAction({
  children = 'Continue',
  ...props
}: React.ComponentProps<typeof Button>) {
  return <Button {...props}>{children}</Button>;
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
};
