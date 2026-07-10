# Audio Credits

All bundled samples are CC0 / public domain (no attribution legally required; credited here for provenance).

## Sourced samples (CC0 1.0 Universal)

| File | Use in game | Source | License |
|------|-------------|--------|---------|
| `click1.wav`, `rollover1.wav`, `switch1.wav` | UI click / hover / mode toggle | Kenney "UI Audio" pack, mirrored at github.com/Calinou/kenney-ui-audio (`addons/kenney_ui_audio/`). Original: https://kenney.nl/assets/ui-audio | CC0 1.0 |
| `mg_ppsh.ogg` | Machine-gun burst (WW2 PPSh-41 SMG) | Still North Media, via github.com/PanderMusubi/sound-effects-library-weapons (`samples/ppsh_P_22P.ogg`) | CC0 1.0 |

Direct download URLs used:
- https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/click1.wav
- https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/rollover1.wav
- https://raw.githubusercontent.com/Calinou/kenney-ui-audio/master/addons/kenney_ui_audio/switch1.wav
- https://raw.githubusercontent.com/PanderMusubi/sound-effects-library-weapons/master/samples/ppsh_P_22P.ogg

## Procedurally synthesized at load (no file, rendered to AudioBuffers in `src/audio.js`)

These are generated with layered DSP each time the game starts, so the game sounds
good even if every file above 404s:

- Prop-plane engine loop (periodic harmonic stack + cylinder-pulse modulation, seamless loop, pitch via playbackRate)
- Tank / diesel engine loop (low harmonic chug)
- Cannon fire (sub-bass thump + midrange crack)
- Big explosion (sub-bass sweep + decaying filtered-noise body + bright transient crack)
- Small impact / shell hit
- Shell whistle / flyby (descending pitch sweep with vibrato)
- Wind / airspeed loop (crossfade-looped filtered noise)
- Capture / victory / defeat stings (brass-like saw arpeggios)

If `mg_ppsh.ogg` fails to load, a procedural machine-gun burst is used as fallback.
