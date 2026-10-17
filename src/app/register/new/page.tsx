import type { Metadata } from "next";
import { RegistrationWizard } from "./registration-wizard";

export const metadata: Metadata = { title: "Season registration" };

export default function NewRegistrationPage() {
  return <RegistrationWizard />;
}
