/**
 * Builds a VideoObject JSON-LD structured data object for a reaction page.
 *
 * @param {object} params
 * @param {string|null} params.name - Video title (reaction or original)
 * @param {string} params.description - Video description
 * @param {string|null|undefined} params.thumbnailUrl - Thumbnail URL
 * @param {string|null|undefined} params.uploadDate - ISO 8601 upload date
 * @param {string|null|undefined} params.embedUrl - Embeddable video URL
 * @returns {object} JSON-LD VideoObject schema object
 */
export function buildVideoObjectJsonLd({ name, description, thumbnailUrl, uploadDate, embedUrl }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    // Fall back to a generic label when neither reaction nor original title is available.
    name: name || 'Reaction',
    description,
    publisher: {
      '@type': 'Organization',
      name: 'Pure Reactions',
      url: 'https://purereactions.com',
    },
  };

  if (thumbnailUrl) schema.thumbnailUrl = thumbnailUrl;
  if (uploadDate) schema.uploadDate = uploadDate;
  if (embedUrl) schema.embedUrl = embedUrl;

  return schema;
}

/**
 * Serializes a JSON-LD object to a string safe for injection into an HTML
 * <script type="application/ld+json"> element.
 *
 * Encodes `<`, `>`, and `&` as Unicode escapes so that the serialized JSON
 * cannot inadvertently close the surrounding script tag or be misinterpreted
 * as HTML markup. The resulting string remains valid JSON.
 *
 * @param {object} obj - The JSON-LD object to serialize
 * @returns {string} Safe JSON string
 */
export function serializeJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
