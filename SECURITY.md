# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Pure Reactions, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email the maintainers with details about the vulnerability
3. Include steps to reproduce if possible
4. Allow time for the issue to be addressed before public disclosure

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Security Best Practices

When contributing to or deploying Pure Reactions:

- Never commit API keys, tokens, or credentials to the repository
- Use environment variables for all sensitive configuration
- Keep dependencies up to date
- Follow the setup instructions in the README for proper configuration
- Use Firebase security rules to protect your data
- Ensure your Firebase Admin SDK credentials are kept secure and never committed

## Known Security Considerations

- Firebase client API keys in source code are expected and safe (they are meant to identify your Firebase project)
- Firebase Admin SDK credentials must NEVER be committed and should be configured via environment variables
- YouTube API keys should be server-side only and configured via environment variables
