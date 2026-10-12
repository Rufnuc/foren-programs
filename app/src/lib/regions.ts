/**
 * Region directory.
 *
 * Each region carries the local emergency phone number, a short legal
 * disclaimer about right-to-erasure, and a list of support organisations.
 *
 * Adding a region: append an entry to REGIONS and (optionally) register a
 * matching language pack in `lib/i18n.ts`. The structure is intentionally
 * flat so that a future admin panel can render it as a JSON form.
 */

export type RegionId = "us" | "gb" | "es" | "fr" | "de";

export interface SupportOrg {
  name: string;
  phone?: string;
  url?: string;
}

export interface Region {
  id: RegionId;
  label: string;
  /** Default UI locale used when this region is selected. */
  defaultLocale: "en" | "es" | "fr" | "de";
  emergencyNumber: string;
  legalDisclaimer: string;
  supportOrgs: SupportOrg[];
}

export const REGIONS: Region[] = [
  {
    id: "us",
    label: "United States",
    defaultLocale: "en",
    emergencyNumber: "911",
    legalDisclaimer:
      "Recordings made on this device are encrypted before they leave it. State laws vary on consent to record; check your local law.",
    supportOrgs: [
      { name: "RAINN (National Sexual Assault Hotline)", phone: "1-800-656-4673", url: "https://www.rainn.org" },
      { name: "National Domestic Violence Hotline", phone: "1-800-799-7233", url: "https://www.thehotline.org" },
    ],
  },
  {
    id: "gb",
    label: "United Kingdom",
    defaultLocale: "en",
    emergencyNumber: "999",
    legalDisclaimer:
      "You have the right to erasure under UK GDPR. Burning your identity removes the keys linking you to anchored evidence on this device.",
    supportOrgs: [
      { name: "Refuge (Domestic Abuse Helpline)", phone: "0808 2000 247", url: "https://www.refuge.org.uk" },
      { name: "Samaritans", phone: "116 123", url: "https://www.samaritans.org" },
    ],
  },
  {
    id: "es",
    label: "España",
    defaultLocale: "es",
    emergencyNumber: "112",
    legalDisclaimer:
      "Tienes derecho de supresión conforme al RGPD. Destruir tu identidad elimina las claves que te vinculan con las pruebas ancladas en este dispositivo.",
    supportOrgs: [
      { name: "016 — Atención violencia de género", phone: "016", url: "https://violenciagenero.igualdad.gob.es" },
      { name: "Teléfono de la Esperanza", phone: "717 003 717", url: "https://telefonodelaesperanza.org" },
    ],
  },
  {
    id: "fr",
    label: "France",
    defaultLocale: "fr",
    emergencyNumber: "112",
    legalDisclaimer:
      "Vous disposez d’un droit à l’effacement au titre du RGPD. Détruire votre identité supprime les clés qui vous relient aux preuves ancrées sur cet appareil.",
    supportOrgs: [
      { name: "Violences Femmes Info", phone: "3919", url: "https://www.solidaritefemmes.org" },
      { name: "SOS Amitié", phone: "09 72 39 40 50", url: "https://www.sos-amitie.com" },
    ],
  },
  {
    id: "de",
    label: "Deutschland",
    defaultLocale: "de",
    emergencyNumber: "112",
    legalDisclaimer:
      "Du hast ein Recht auf Löschung nach DSGVO. Das Vernichten deiner Identität entfernt die Schlüssel, die dich mit verankerten Beweisen auf diesem Gerät verbinden.",
    supportOrgs: [
      { name: "Hilfetelefon Gewalt gegen Frauen", phone: "08000 116 016", url: "https://www.hilfetelefon.de" },
      { name: "Telefonseelsorge", phone: "0800 111 0 111", url: "https://www.telefonseelsorge.de" },
    ],
  },
];

export function findRegion(id: RegionId): Region {
  const r = REGIONS.find((r) => r.id === id);
  if (!r) throw new Error(`unknown region: ${id}`);
  return r;
}
