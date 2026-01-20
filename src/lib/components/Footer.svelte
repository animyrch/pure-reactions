<script>
  import { page } from '$app/stores';
  
  // Don't show footer on certain routes
  $: isReactionRoute = $page.url.pathname?.startsWith('/reaction/');
  $: isPlaylistRoute = $page.url.pathname?.startsWith('/playlist/');
  $: isSharedRoute = $page.url.pathname?.startsWith('/shared/');
  $: hideFooter = isReactionRoute || isPlaylistRoute || isSharedRoute;
</script>

{#if !hideFooter}
  <footer class="footer-container safe-padding-bottom">
    <div class="footer-content mx-auto max-w-7xl px-4 py-12 md:py-16">
      <!-- Main Footer Content -->
      <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        
        <!-- About Section -->
        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-primary">
            About
          </h3>
          <p class="text-sm text-text-secondary leading-relaxed">
            PureReactions enables synchronized twin-player viewing. Watch reactions, translations, and commentary perfectly synced with original content.
          </p>
        </div>

        <!-- Platform Links -->
        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-primary">
            Platform
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <a href="/how-it-works" class="text-text-secondary transition-colors hover:text-accent-primary">
                How It Works
              </a>
            </li>
            <li>
              <a href="/react" class="text-text-secondary transition-colors hover:text-accent-primary">
                Create Content
              </a>
            </li>
            <li>
              <a href="/search" class="text-text-secondary transition-colors hover:text-accent-primary">
                Discover
              </a>
            </li>
          </ul>
        </div>

        <!-- Insights Links -->
        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-primary">
            Insights
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <a href="/insights" class="text-text-secondary transition-colors hover:text-accent-primary">
                All Articles
              </a>
            </li>
            <li>
              <a href="/insights/why-synced-content-cant-be-claimed" class="text-text-secondary transition-colors hover:text-accent-primary">
                Why It Can't Be Claimed
              </a>
            </li>
            <li>
              <a href="/insights/monetization-safety-guide" class="text-text-secondary transition-colors hover:text-accent-primary">
                Monetization Guide
              </a>
            </li>
            <li>
              <a href="/insights/synchronized-content-legality" class="text-text-secondary transition-colors hover:text-accent-primary">
                Legal Framework
              </a>
            </li>
          </ul>
        </div>

        <!-- Community Links -->
        <div>
          <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-text-primary">
            Community
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <a href="/account" class="text-text-secondary transition-colors hover:text-accent-primary">
                My Account
              </a>
            </li>
            <li>
              <a href="/my-reactions" class="text-text-secondary transition-colors hover:text-accent-primary">
                My Content
              </a>
            </li>
            <li>
              <a href="/bookmark" class="text-text-secondary transition-colors hover:text-accent-primary">
                Bookmarks
              </a>
            </li>
          </ul>
        </div>

      </div>

      <!-- Bottom Bar -->
      <div class="mt-12 border-t border-border-subtle pt-8">
        <div class="flex flex-col gap-4">
          <!-- Legal Links Row -->
          <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
            <a href="/about" class="text-text-muted transition-colors hover:text-text-secondary">
              About
            </a>
            <span class="text-border-strong" aria-hidden="true">·</span>
            <a href="/open-source" class="text-text-muted transition-colors hover:text-text-secondary">
              Open Source
            </a>
            <span class="text-border-strong" aria-hidden="true">·</span>
            <a href="/copyright" class="text-text-muted transition-colors hover:text-text-secondary">
              Copyright
            </a>
            <span class="text-border-strong" aria-hidden="true">·</span>
            <a href="/terms" class="text-text-muted transition-colors hover:text-text-secondary">
              Terms
            </a>
            <span class="text-border-strong" aria-hidden="true">·</span>
            <a href="/privacy" class="text-text-muted transition-colors hover:text-text-secondary">
              Privacy
            </a>
          </div>
          
          <!-- Copyright Row -->
          <p class="text-center text-sm text-text-muted">
            &copy; 2023 - {new Date().getFullYear()} Pure Reactions
          </p>
        </div>
      </div>
    </div>
  </footer>
{/if}

<style>
  .footer-container {
    background: linear-gradient(to bottom, transparent 0%, rgba(15, 17, 21, 0.4) 10%, #0f1115 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    margin-top: 4rem;
  }

  @media (max-width: 768px) {
    .footer-container {
      margin-top: 3rem;
    }
  }
</style>
