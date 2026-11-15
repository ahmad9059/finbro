import type { Metadata } from "next";

import { PageHeader } from "~/components/shared/page-header";
import { Section } from "~/components/shared/section";
import { settingsItem } from "~/components/shell/nav";
import { CategoriesSection } from "~/features/settings/categories-section";
import { PasswordForm } from "~/features/settings/password-form";
import { ThemePicker } from "~/features/settings/theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={settingsItem.description} />
      <Section title="Appearance">
        <ThemePicker />
      </Section>
      <Section title="Categories" description="Used by expenses and subscriptions">
        <CategoriesSection />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
    </div>
  );
}
