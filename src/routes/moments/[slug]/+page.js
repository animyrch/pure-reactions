/** @type {import('./$types').PageLoad} */
export function load({ data, parent }) {
  return parent().then((parentData) => ({
    ...data,
    userId: parentData?.userId ?? null,
    displayName: parentData?.displayName ?? null
  }));
}
