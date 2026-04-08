# Changelog

All notable changes to this project will be documented in this file.

## [1.0.3] - 2026-04-08

### Added

- Subtle `dungeonmaster.guru` cross-promotion link injected at the bottom of the PlaylistConfig form. Plain unstyled link — inherits PlaylistConfig's text styles so it doesn't clash with the host window.

## [1.0.2] - 2026-04-06

### Changed
- Foundry VTT v14 compatibility: bumped `compatibility.verified` to `14`, removed `maximum` cap. **Minimum Foundry version bumped to `14`** — earlier versions of this module remain available for v13 users from the GitHub releases page; this version is v14-only by design.
- Resolve the Playlist document class via `CONFIG.Playlist.documentClass` instead of the bare `Playlist` global, and read playlist mode constants via `foundry.CONST.PLAYLIST_MODES` (with fallback). No behavior change in v13.

## [1.0.1] - 2026-03-21

### Added
- docs: add screenshot and Foundry module page HTML description
- initial release of Dorman Lakely's Playlist Enhancements v1.0.0


## [1.0.0] - 2026-03-21

### Added
- Configurable min/max silence between tracks for Sequential and Shuffle modes
- Per-playlist silence settings stored as flags
- Automatic cancellation of pending silence when playlist is stopped or track is manually changed
- Compatible with Monk's Sound Enhancements
