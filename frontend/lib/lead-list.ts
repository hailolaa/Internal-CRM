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

export function leadContactDetailHref(contactId: string) {
  return `/app/crm/contacts/detail?id=${encodeURIComponent(contactId)}`;
}

export function formatLeadListValue(value: string) {
  if (!value || value === "-") return value;

  const trimmedValue = value.trim();
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)) return trimmedValue;

  return trimmedValue
    .replace(/[_-]+/g, " ")
    .replace(/\S+/g, (word) =>
      word === word.toUpperCase()
        ? word
        : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    );
}
