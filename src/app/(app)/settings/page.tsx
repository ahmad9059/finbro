import type { Metadata } from "next";

import { PageHeader } from "~/components/shared/page-header";
import { Section } from "~/components/shared/section";
import { settingsItem } from "~/components/shell/nav";
import { PasswordForm } from "~/features/settings/password-form";
import { ThemePicker } from "~/features/settings/theme-picker";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader description={settingsItem.description} />
      <Section title="Appearance">
        <ThemePicker />
      </Section>
      <Section title="Password">
        <PasswordForm />
      </Section>
    </div>
  );
}
