export function load({ data, params }) {
  return {
    ...data,
    slug: params.slug
  };
}
