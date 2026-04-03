<script>
  import { onMount, tick } from 'svelte';

  export let selector = 'article .prose-custom';

  const slugify = (value) =>
    value
      .toLowerCase()
      .trim()
      .replace(/['"’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const enhanceHeadings = () => {
    const articleRoots = document.querySelectorAll(selector);

    articleRoots.forEach((root) => {
      const headings = root.querySelectorAll('h2, h3');
      const usedIds = new Map();

      headings.forEach((heading) => {
        const existingId = heading.id?.trim();
        const text = heading.textContent ?? '';
        const baseId = existingId || slugify(text);

        if (!baseId || heading.dataset.linkableHeading === 'true') {
          return;
        }

        const currentCount = usedIds.get(baseId) ?? 0;
        const nextCount = currentCount + 1;
        usedIds.set(baseId, nextCount);

        const uniqueId = nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
        heading.id = uniqueId;
        heading.dataset.linkableHeading = 'true';
        heading.classList.add('scroll-mt-28', 'group');

        const link = document.createElement('a');
        link.href = `#${uniqueId}`;
        link.className =
          'ml-2 inline-flex items-center text-text-muted opacity-0 transition-opacity hover:text-accent-primary group-hover:opacity-100 group-focus-within:opacity-100';
        link.setAttribute('aria-label', `Link to section ${text}`);
        link.textContent = '#';

        heading.appendChild(link);
      });
    });
  };

  onMount(async () => {
    await tick();
    enhanceHeadings();
  });
</script>