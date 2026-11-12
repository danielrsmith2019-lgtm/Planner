"use client";

import type { ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/utils/cn";
import { Icon } from "@/utils/icons";

/**
 * The app's one sheet: a vaul Drawer (drag handle, swipe down to close) on
 * phones and a centered Radix Dialog from 640px up. Same props either way.
 *
 * Layout: header (title, optional description, close button), a scrolling
 * body, and a footer with the primary action anchored to the bottom, so the
 * main button stays in thumb reach however long the form is.
 *
 * For forms, give the <form> an id and pass it as primaryAction.form: the
 * footer button then submits it with type="submit" (Enter works too).
 */
export type BottomSheetAction = {
  label: string;
  /** Submit this form id instead of calling onClick. */
  form?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Shows the pending label and blocks double submits. */
  pending?: boolean;
  pendingLabel?: string;
};

export type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  primaryAction?: BottomSheetAction;
  /** Optional footer text above the button, e.g. a form-level error. */
  footerNote?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  primaryAction,
  footerNote,
  children,
  className,
}: BottomSheetProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const Root = desktop ? Dialog : Drawer;
  const Content = desktop ? DialogContent : DrawerContent;
  const Title = desktop ? DialogTitle : DrawerTitle;
  const Description = desktop ? DialogDescription : DrawerDescription;
  const Close = desktop ? DialogClose : DrawerClose;

  return (
    <Root open={open} onOpenChange={onOpenChange}>
      <Content
        className={className}
        // Without a description, tell Radix/vaul there isn't one on purpose.
        {...(description === undefined ? { "aria-describedby": undefined } : {})}
      >
        <header className="flex shrink-0 items-start gap-2 px-5 pt-2 sm:pt-5">
          <div className="min-w-0 flex-1 pt-2.5">
            <Title>{title}</Title>
            {description !== undefined && <Description className="mt-1">{description}</Description>}
          </div>
          <Close
            aria-label="Close"
            className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-alt"
          >
            <Icon icon="close" size={20} />
          </Close>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-4">{children}</div>

        {(primaryAction !== undefined || footerNote !== undefined) && (
          <footer className="shrink-0 border-t border-border bg-surface px-5 pt-3 pb-[calc(16px+var(--safe-bottom))] sm:rounded-b-[24px] sm:pb-5">
            {footerNote !== undefined && <div className="mb-3">{footerNote}</div>}
            {primaryAction !== undefined && <PrimaryButton action={primaryAction} />}
          </footer>
        )}
      </Content>
    </Root>
  );
}

function PrimaryButton({ action }: { action: BottomSheetAction }) {
  const busy = action.pending === true;
  return (
    <button
      type={action.form === undefined ? "button" : "submit"}
      form={action.form}
      onClick={action.onClick}
      disabled={action.disabled === true || busy}
      aria-busy={busy}
      className={cn("bc-btn-primary min-h-11")}
    >
      {busy ? (action.pendingLabel ?? "Saving...") : action.label}
    </button>
  );
}
