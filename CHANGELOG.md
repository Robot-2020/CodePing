# Changelog

All notable changes to CodePing will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] - 2026-04-20

### Added
- **Comate process monitoring** - Checks Comate process health every 5 seconds
- **File timeout re-parsing** - Re-validates session state after 2 minutes of inactivity
- **Installation guide** - Complete user installation documentation
- **Code signing guide** - Guide for Apple Developer ID setup
- **Release documentation** - Detailed release summary and technical analysis

### Fixed
- **Comate sessions stuck in "running" state** - Fixed issue where CodePing displayed "running" status even after Comate conversations ended
- **Session state synchronization** - Improved reliability of state transitions

### Changed
- **Improved session file caching** - Better handling of stale cache entries
- **Enhanced diagnostic logging** - More detailed state transition logs
- **Optimized file parsing** - Reduced redundant file reads

### Removed
- Deprecated test scripts (test-*.sh)
- Old Clawd branding references

## [0.5.0] - 2026-03-XX

### Added
- Initial public release
- Multi-agent support (Claude Code, Comate, Codex, etc.)
- Theme system with built-in themes
- Mini mode with edge snapping
- Sleep animations
- Multi-language support (en/zh/ko)

## [Unreleased]

### Planned for v0.7.0
- Full Apple code signing + notarization
- Additional agent support (Aider, Continue.dev)
- Performance optimizations
- Enhanced test coverage
- Windows and Linux builds

---

[0.6.0]: https://github.com/YOUR_USERNAME/codeping/releases/tag/v0.6.0
[0.5.0]: https://github.com/YOUR_USERNAME/codeping/releases/tag/v0.5.0
