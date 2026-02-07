# Contributing to Pure Reactions


Thank you for your interest in contributing to Pure Reactions! This document provides guidelines for contributing to the open-source parts of the project.


## Scope of Contributions


Pure Reactions is an open-source project with a publicly hosted platform.


- The open-source repository contains the core application code, shared logic, and public-facing features.
- The hosted Pure Reactions service includes platform-specific concerns such as infrastructure, operations, moderation workflows, and business-related logic.


Some issues and tasks are intentionally not open to external contribution.


### Issue Labels


- **maintainer-only**
Issues labeled maintainer-only are handled exclusively by project maintainers.
These typically relate to the hosted Pure Reactions platform and are outside the scope of community contributions.


Please do not open pull requests for issues labeled maintainer-only, unless explicitly invited by a maintainer.


## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment for all contributors with regard to all interactions around the codebase such as PR discussions and commit messages.

## Getting Started

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm or pnpm
- Firebase account for backend services
- Algolia account for search functionality

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/animyrch/pure-reactions.git
   cd pure-reactions
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase, Algolia, and YouTube API credentials
   - Place your Firebase Admin SDK JSON file in the secrets folder (it will be automatically ignored by git)

4. Start the development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Code Organization

Please follow the project's code organization guidelines outlined in the README:

1. **Keep files focused** — prefer small, single-responsibility modules
2. **Extract pure helpers** — deterministic logic belongs in `src/lib/helpers/`
3. **Name by role** — use folders like `helpers`, `composables`, `components` to signal intent
4. **Document rationale** — explain architectural decisions in comments or documentation

### Running Tests

```bash
# Run end-to-end tests
npm run e2e

# Run specific test suite
npm run test:e2e
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Submitting Changes

1. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the project's coding style and conventions

3. **Test your changes**:
   - Run the linter
   - Run relevant tests
   - Test manually in the browser

4. **Commit your changes** with clear, descriptive commit messages

5. **Push to your fork** and create a Pull Request

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Include screenshots for UI changes
- Ensure all tests pass
- Keep changes focused and atomic
- Update documentation if needed
- Do not submit pull requests for issues labeled maintainer-only unless explicitly requested by a project maintainer

## Reporting Issues

When reporting issues, please include:

- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots or error messages if applicable

## Security Vulnerabilities

Please review our [Security Policy](SECURITY.md) for reporting security vulnerabilities.

## Questions?

Feel free to open an issue for questions or discussions about the project.

## License

By contributing to Pure Reactions, you agree that your contributions will be licensed under the Apache License 2.0.

This license permits use, modification, and distribution of contributions in both open-source and commercial contexts, including use as part of the hosted Pure Reactions service.