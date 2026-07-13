export function mergeLeadRows<T extends { contactId: string | null }>(
  dealRows: T[],
  contactRows: T[],
) {
  const dealContactIds = new Set(
    dealRows.map((lead) => lead.contactId).filter((contactId): contactId is string => Boolean(contactId)),
  );

  return [
    ...dealRows,
    ...contactRows.filter((lead) => !lead.contactId || !dealContactIds.has(lead.contactId)),
  ];
}
