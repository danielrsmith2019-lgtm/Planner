import type { ReactNode } from "react";
import { Icon, type IconName } from "@/utils/icons";

/** Temporary body for routes whose real screens come in later days. */
export default function ComingSoon({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="bc-card">
      <div className="bc-empty py-10">
        <Icon icon={icon} size={40} className="bc-empty-icon" />
        <h1 className="bc-empty-title">{title}</h1>
        <p className="bc-empty-text">{children}</p>
      </div>
    </section>
  );
}
