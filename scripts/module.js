const MODULE_ID = 'dorman-lakelys-playlist-enhancements';
const MODULE_TITLE = "Dorman Lakely's Playlist Enhancements";
const LOG_PREFIX = 'Dorman Lakely -';

/**
 * Get the module version from the game API
 */
function getModuleVersion() {
  return game.modules.get(MODULE_ID)?.version ?? 'unknown';
}

/**
 * Log styled module header to console
 */
function logModuleHeader() {
  const version = getModuleVersion();
  console.log(
    '%c⚔️ ' + MODULE_TITLE + ' %cv' + version,
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #ff9800; font-weight: bold; font-size: 14px;'
  );
}

/**
 * Log styled ready message to console
 */
function logModuleReady() {
  console.log(
    '%c⚔️ ' + MODULE_TITLE + ' %c✓ Ready!',
    'color: #d32f2f; font-weight: bold; font-size: 16px;',
    'color: #4caf50; font-weight: bold; font-size: 14px;'
  );
}

/**
 * Show a pulsing silence indicator in the playlist sidebar.
 * @param {Playlist} playlist - The playlist in its silence gap
 */
function showSilenceIndicator(playlist) {
  removeSilenceIndicator(playlist);
  const i18n = game.i18n.localize.bind(game.i18n);

  // Inject into the playlist's sound list in the sidebar
  const playlistEl = document.querySelector(`.document[data-entry-id="${playlist.id}"]`);
  if (playlistEl) {
    const soundList = playlistEl.querySelector('.playlist-sounds');
    if (soundList) {
      const indicator = document.createElement('li');
      indicator.className = 'dlpe-silence-indicator';
      indicator.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${i18n('DLPLAYLIST.WaitingForNext')}`;
      soundList.prepend(indicator);
    }
  }

  // Inject into the "Currently Playing" section
  const currentlyPlaying = document.querySelector('.currently-playing .playlist-sounds');
  if (currentlyPlaying) {
    const indicator = document.createElement('li');
    indicator.className = 'dlpe-silence-indicator';
    indicator.dataset.playlistId = playlist.id;
    indicator.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${i18n('DLPLAYLIST.WaitingForNext')}`;
    currentlyPlaying.appendChild(indicator);
  }
}

/**
 * Remove all silence indicators for a playlist.
 * @param {Playlist} playlist - The playlist to clear indicators for
 */
function removeSilenceIndicator(playlist) {
  document.querySelectorAll('.dlpe-silence-indicator').forEach(el => {
    // Remove if it belongs to this playlist or has no playlist filter
    const elPlaylistId = el.dataset.playlistId;
    if (!elPlaylistId || elPlaylistId === playlist.id) {
      el.remove();
    }
  });
}

Hooks.once('init', () => {
  logModuleHeader();

  const { ApplicationV2, DialogV2 } = foundry.applications.api;

  class PatreonLink extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: 'dlpe-patreon-link',
      window: {
        title: 'Support on Patreon',
        icon: 'fab fa-patreon'
      }
    };

    async _renderHTML() {
      return document.createElement('div');
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }

    async _onFirstRender(context, options) {
      this.element.style.display = 'none';
      await DialogV2.prompt({
        window: { title: 'Support on Patreon' },
        content: '<p>Open the Patreon page in a new tab.</p>',
        ok: {
          label: '<i class="fab fa-patreon"></i> Visit Patreon',
          callback: () => window.open('https://www.patreon.com/c/DormanLakely', '_blank', 'noopener,noreferrer')
        }
      });
      this.close();
    }
  }

  class DmGuruLink extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: 'dlpe-dmguru-link',
      window: {
        title: 'Dungeon Master Guru',
        icon: 'fas fa-dragon'
      }
    };

    async _renderHTML() {
      return document.createElement('div');
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }

    async _onFirstRender(context, options) {
      this.element.style.display = 'none';
      await DialogV2.prompt({
        window: { title: 'Dungeon Master Guru' },
        content: '<p>Open the Dungeon Master Guru site in a new tab.</p>',
        ok: {
          label: '<i class="fas fa-dragon"></i> Visit Dungeon Master Guru',
          callback: () => window.open('https://dungeonmaster.guru', '_blank', 'noopener,noreferrer')
        }
      });
      this.close();
    }
  }

  game.settings.registerMenu(MODULE_ID, 'patreonLink', {
    name: 'Support on Patreon',
    label: 'Visit Patreon',
    hint: 'Support the development of this module on Patreon! Your contributions help fund new features and updates.',
    icon: 'fab fa-patreon',
    type: PatreonLink,
    restricted: true
  });
  game.settings.registerMenu(MODULE_ID, 'dmGuruLink', {
    name: 'Dungeon Master Guru',
    label: 'Visit Dungeon Master Guru',
    hint: 'SRD rules and DM tools. Free resources for Dungeon Masters at dungeonmaster.guru.',
    icon: 'fas fa-dragon',
    type: DmGuruLink,
    restricted: true
  });

  // Resolve the Playlist document class via CONFIG (v14-safe; the bare global
  // may be removed or shimmed in future Foundry releases).
  const PlaylistClass = CONFIG.Playlist?.documentClass ?? globalThis.Playlist;

  // Wrap PlaylistClass.prototype._onSoundEnd to add silence between tracks
  const originalOnSoundEnd = PlaylistClass.prototype._onSoundEnd;
  PlaylistClass.prototype._onSoundEnd = async function(sound) {
    const MODES = foundry.CONST?.PLAYLIST_MODES ?? CONST.PLAYLIST_MODES;

    // Only intercept Sequential and Shuffle modes
    if (this.mode !== MODES.SEQUENTIAL && this.mode !== MODES.SHUFFLE) {
      return originalOnSoundEnd.call(this, sound);
    }

    const silenceMin = this.getFlag(MODULE_ID, 'silenceMin') ?? 0;
    const silenceMax = this.getFlag(MODULE_ID, 'silenceMax') ?? 0;

    // No silence configured, use original behavior
    if (silenceMin <= 0 && silenceMax <= 0) {
      return originalOnSoundEnd.call(this, sound);
    }

    // Calculate random delay within range
    const min = Math.max(0, silenceMin);
    const max = Math.max(min, silenceMax);
    const delaySec = min + (Math.random() * (max - min));
    const delayMs = delaySec * 1000;

    // Clear any existing silence timeout
    if (this._dlSilenceTimeout) {
      clearTimeout(this._dlSilenceTimeout);
    }

    // Check if there is a next sound before entering the silence gap
    const nextSound = this._getNextSound(sound.id);
    if (!nextSound) {
      // No next track — fall through to original behavior (stops the playlist)
      return originalOnSoundEnd.call(this, sound);
    }

    // Show the silence indicator
    showSilenceIndicator(this);

    console.debug(
      `${LOG_PREFIX} "${this.name}" — silence gap ${delaySec.toFixed(1)}s before next track "${nextSound.name}"`
    );

    // Debug countdown logging
    const countdownInterval = setInterval(() => {
      if (!this._dlSilenceTimeout) {
        clearInterval(countdownInterval);
        return;
      }
      const remaining = Math.max(0, (this._dlSilenceTargetTime - Date.now()) / 1000);
      if (remaining > 0) {
        console.debug(`${LOG_PREFIX} "${this.name}" — next track in ${remaining.toFixed(1)}s`);
      }
    }, 1000);

    this._dlSilenceTargetTime = Date.now() + delayMs;

    // Delay before playing next track.
    // Do NOT update the current sound to playing:false here — playNext handles
    // that atomically (sets current to false and next to true in one update),
    // which keeps the playlist's playing state consistent.
    return new Promise((resolve) => {
      this._dlSilenceTimeout = setTimeout(() => {
        clearInterval(countdownInterval);
        delete this._dlSilenceTimeout;
        delete this._dlSilenceTargetTime;
        removeSilenceIndicator(this);
        // Only play next if playlist is still active
        if (this.playing) {
          console.debug(`${LOG_PREFIX} "${this.name}" — playing next track "${nextSound.name}"`);
          resolve(this.playNext(sound.id));
        } else {
          console.debug(`${LOG_PREFIX} "${this.name}" — playlist stopped during silence gap, skipping`);
          resolve();
        }
      }, delayMs);
    });
  };

  // Wrap stopAll to cancel pending silence timeout
  const originalStopAll = PlaylistClass.prototype.stopAll;
  PlaylistClass.prototype.stopAll = async function() {
    if (this._dlSilenceTimeout) {
      clearTimeout(this._dlSilenceTimeout);
      delete this._dlSilenceTimeout;
      delete this._dlSilenceTargetTime;
      removeSilenceIndicator(this);
      console.debug(`${LOG_PREFIX} "${this.name}" — silence gap cancelled (playlist stopped)`);
    }
    return originalStopAll.call(this);
  };

  // Wrap playSound to cancel pending silence timeout on manual track selection
  const originalPlaySound = PlaylistClass.prototype.playSound;
  PlaylistClass.prototype.playSound = async function(sound) {
    if (this._dlSilenceTimeout) {
      clearTimeout(this._dlSilenceTimeout);
      delete this._dlSilenceTimeout;
      delete this._dlSilenceTargetTime;
      removeSilenceIndicator(this);
      console.debug(`${LOG_PREFIX} "${this.name}" — silence gap cancelled (manual track selection)`);
    }
    return originalPlaySound.call(this, sound);
  };
});

Hooks.once('ready', () => {
  logModuleReady();
});

// Re-inject silence indicator after sidebar re-renders (e.g. when sound state updates)
Hooks.on('renderPlaylistDirectory', () => {
  for (const playlist of game.playlists) {
    if (playlist._dlSilenceTimeout) {
      showSilenceIndicator(playlist);
    }
  }
});

// Inject silence range UI into PlaylistConfig sheet
Hooks.on('renderPlaylistConfig', (app, element, context, options) => {
  const playlist = app.document;

  // Find the fade duration form group
  const fadeInput = element.querySelector('[name="fade"]');
  if (!fadeInput) return;
  const fadeGroup = fadeInput.closest('.form-group');
  if (!fadeGroup) return;

  // Read current flag values
  const silenceMin = playlist.getFlag(MODULE_ID, 'silenceMin') ?? 0;
  const silenceMax = playlist.getFlag(MODULE_ID, 'silenceMax') ?? 0;

  // Build the silence range HTML
  const i18n = game.i18n.localize.bind(game.i18n);
  const html = `
    <div class="form-group dlpe-silence-range">
      <label>${i18n('DLPLAYLIST.SilenceBetweenTracks')}</label>
      <div class="form-fields">
        <label class="dlpe-label">${i18n('DLPLAYLIST.Min')}</label>
        <input type="number" name="flags.${MODULE_ID}.silenceMin"
               min="0" max="300" step="1" value="${silenceMin}">
        <label class="dlpe-label">${i18n('DLPLAYLIST.Max')}</label>
        <input type="number" name="flags.${MODULE_ID}.silenceMax"
               min="0" max="300" step="1" value="${silenceMax}">
        <span class="dlpe-units">${i18n('DLPLAYLIST.Seconds')}</span>
      </div>
    </div>`;

  fadeGroup.insertAdjacentHTML('afterend', html);

  // Validate: ensure max >= min on change
  const container = fadeGroup.nextElementSibling;
  const minInput = container.querySelector(`[name="flags.${MODULE_ID}.silenceMin"]`);
  const maxInput = container.querySelector(`[name="flags.${MODULE_ID}.silenceMax"]`);

  minInput.addEventListener('change', () => {
    const minVal = Number(minInput.value) || 0;
    const maxVal = Number(maxInput.value) || 0;
    if (maxVal < minVal) {
      maxInput.value = minVal;
    }
  });

  maxInput.addEventListener('change', () => {
    const minVal = Number(minInput.value) || 0;
    const maxVal = Number(maxInput.value) || 0;
    if (maxVal < minVal) {
      minInput.value = maxVal;
    }
  });

  // Inject a subtle Dungeon Master Guru cross-promotion link at the bottom of
  // the form. No custom styling — this module doesn't own the PlaylistConfig
  // window, so the link inherits the host window's text styles.
  //
  // PlaylistConfig can re-render (e.g. after updates), so guard the insertion
  // with a wrapper class and bail out if a previous render already added it.
  const form = element.querySelector('form') ?? element;
  if (form.querySelector('.dlpe-dmguru-promo')) return;
  const footer = form.querySelector('footer') ?? form.querySelector('.form-footer');
  const dmguruHtml = `
    <p class="notes dlpe-dmguru-promo">
      More DM tools and SRD rules at
      <a href="https://dungeonmaster.guru" target="_blank" rel="noopener noreferrer">dungeonmaster.guru</a>
    </p>`;
  if (footer) {
    footer.insertAdjacentHTML('beforebegin', dmguruHtml);
  } else {
    form.insertAdjacentHTML('beforeend', dmguruHtml);
  }
});
