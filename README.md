# Galactic Parallax 🌌

_A project conceived somewhere between improbable timelines, existential programming, and the distinct feeling you've just left your towel on another planet._

---

## Brief Introduction

The universe is full of strange things: sentient doorbells, rain in Islington, and all the wrong sorts of lizards in power. It also desperately needs better desktop wallpapers. **Galactic Parallax** is a web app that aims to correct that last bit, by making intergalactic-quality backgrounds easier to discover than Arthur Dent's misplaced cup of tea.

The initial launch phase is complete! **Galactic Parallax** now boasts a SvelteKit frontend (live on Netlify) and a powerful Cloudflare Worker API backend, actively delivering those once-awaited, marvelous wallpaper-search features. It's proven to be more reliable than a Babel fish, though perhaps just as surprising at times.

You can find the live application at: [https://parallax.neontowel.dev](https://parallax.neontowel.dev)

**Please Note:** For now and the foreseeable future, usage is limited to permitted email accounts solely for internal use.

---

## Technology (Probably Harmless)

- **Frontend**: SvelteKit, Tailwind CSS, TypeScript, Vite
- **Backend**: Hono (JavaScript/TypeScript) on Cloudflare Workers, utilizing Auth0 for authentication and Cloudflare D1 for data persistence. For detailed API documentation, see `api/README.md`.

---

## Setup Guide (May Require a Duck Pond)

1. **Clone the repository** (Don't panic!)

   ```
   git clone https://github.com/NeonTowel/galactic-parallax.git
   cd galactic-parallax
   ```

2. **Install dependencies**

   **Frontend**

   ```
   cd ui
   bun install   # Uses bun as package manager (bun.lockb present)
   ```

   **Backend**

   ```
   cd ../api
   yarn install   # See api/README.md for required environment variable setup (e.g., API keys)
   ```

3. **Running in development**

   **Frontend**

   ```
   bun run dev   # or npm run dev
   ```

   **Backend**

   ```
   yarn dev
   ```

---

## Features (So Far)

- SvelteKit frontend, almost as friendly as the Sirius Cybernetics Corporation's products (but much more functional).
- **Powerful Cloudflare Worker API Backend**:
  - Supports multiple search engines (Brave Search, Zenserp, Serper, Google) for diverse results.
  - Delivers high-quality image search, optimized for 2K+ wallpapers with orientation filtering and smart query crafting (including TBS parameters).
  - Features an intelligent in-memory caching system for search results and suggestions, significantly boosting performance.
  - Utilizes Cloudflare D1 for persistent data storage (e.g., operational data, potentially user-related information).
  - Offers categorized search suggestions to aid discovery.
  - All core search endpoints are secured with Auth0 JWT authentication, including user context tracking.
  - Provides configurable search engine selection and detailed debug logging.
  - Implements advanced URL validation and image filtering to ensure quality.
  - _For a comprehensive guide to API features, all endpoints, and detailed configuration options, please consult `api/README.md`._
- Authentication via Auth0—no need to forge Vogon paperwork for the frontend.

---

## License

**Unlicense**  
Absolutely free. Like dolphins, this code is released to the world with minimal explanation.

---

## Contributing

Contributions, bug reports, limericks about rain or doom, and especially improbable pull requests are welcomed. Please, no poetry in the code—unless it's very, very good.
