"use client";

import { Toaster } from "sonner";

export function ToastContainer() {
  return (
    <Toaster
      closeButton
      richColors
      expand={false}
      gap={10}
      offset={{ top: 18 }}
      position="top-center"
      theme="system"
      visibleToasts={4}
      swipeDirections={["top"]}
      containerAriaLabel="Notifications"
      className="cg-sonner"
      toastOptions={{
        classNames: {
          actionButton: "cg-sonner-action",
          cancelButton: "cg-sonner-cancel",
          closeButton: "cg-sonner-close",
          content: "cg-sonner-content",
          description: "cg-sonner-description",
          icon: "cg-sonner-icon",
          title: "cg-sonner-title",
          toast: "cg-sonner-toast",
        },
      }}
    />
  );
}
