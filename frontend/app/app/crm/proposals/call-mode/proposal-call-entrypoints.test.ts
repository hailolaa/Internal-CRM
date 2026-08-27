import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contactDetailSource = readFileSync("app/app/crm/contacts/detail/page.tsx", "utf8");
const contactsListSource = readFileSync("app/app/crm/contacts/page.tsx", "utf8");
const clientAccountDetailSource = readFileSync("app/app/ops/client-accounts/detail/page.tsx", "utf8");
const callModeSource = readFileSync("app/app/crm/proposals/call-mode/page.tsx", "utf8");

function actionBlock(source: string, routeNeedle: string, startNeedle: string, endNeedle: string) {
  const routeIndex = source.indexOf(routeNeedle);
  expect(routeIndex).toBeGreaterThanOrEqual(0);
  const startIndex = source.lastIndexOf(startNeedle, routeIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(endNeedle, routeIndex);
  expect(endIndex).toBeGreaterThanOrEqual(0);
  return source.slice(startIndex, endIndex + endNeedle.length);
}

describe("proposal call entry points", () => {
  it("uses proposal write permission for every proposal-call action", () => {
    [contactDetailSource, contactsListSource, clientAccountDetailSource].forEach((source) => {
      expect(source).toContain('hasPermission("proposals:write")');
    });

    const contactDetailAction = actionBlock(
      contactDetailSource,
      "/app/crm/proposals/call-mode?contactId=",
      "{canWriteProposals ? (",
      "</Link>",
    );
    const contactsListAction = actionBlock(
      contactsListSource,
      "/app/crm/proposals/call-mode?contactId=",
      "{canWriteProposals ? (",
      "</button>",
    );
    const clientAccountAction = actionBlock(
      clientAccountDetailSource,
      "/app/crm/proposals/call-mode?clientAccountProfileId=",
      "{canWriteProposals && account.id ? (",
      "</Link>",
    );

    [contactDetailAction, contactsListAction, clientAccountAction].forEach((source) => {
      expect(source).toContain("canWriteProposals");
      expect(source).not.toContain("canWriteContacts");
      expect(source).not.toContain("canEditProfile");
      expect(source).not.toContain("client_accounts:write");
      expect(source).not.toContain("aria-disabled");
      expect(source).not.toContain("disabled=");
      expect(source).not.toContain("pointer-events-none");
    });
  });

  it("hides contact proposal-call actions when the user cannot write proposals", () => {
    expect(contactDetailSource).toContain("{canWriteProposals ? (");
    expect(contactsListSource).toContain("{canWriteProposals ? (");
  });

  it("hides client-account proposal-call actions when the user cannot write proposals", () => {
    expect(clientAccountDetailSource).toContain("{canWriteProposals && account.id ? (");
  });

  it("passes contact IDs into the existing V5 proposal call-mode route", () => {
    [contactDetailSource, contactsListSource].forEach((source) => {
      expect(source).toContain("/app/crm/proposals/call-mode?contactId=");
      expect(source).toContain("encodeURIComponent(contact.id)");
    });
  });

  it("passes client account IDs into the existing V5 proposal call-mode route", () => {
    expect(clientAccountDetailSource).toContain("/app/crm/proposals/call-mode?clientAccountProfileId=");
    expect(clientAccountDetailSource).toContain("encodeURIComponent(account.id)");
  });

  it("routes into the existing discovery call mode context", () => {
    expect(callModeSource).toContain('searchParams.get("contactId")');
    expect(callModeSource).toContain('searchParams.get("clientAccountProfileId")');
    expect(callModeSource).toContain("api.proposals.startDiscoverySession");
    expect(callModeSource).toContain("confirmStart: true");
    expect(callModeSource).toContain("Confirm and Start");
    expect(callModeSource).toContain("No session has been created");
    expect(callModeSource).toContain("generateDiscoveryDraft");
  });

  it("keeps the legacy proposal renderer out of the proposal-call entry points", () => {
    [contactDetailSource, contactsListSource, clientAccountDetailSource, callModeSource].forEach((source) => {
      expect(source).not.toContain("ClinicGrowerProposalTemplate");
      expect(source).not.toContain("clinicgrower-proposal-template");
    });
  });
});
