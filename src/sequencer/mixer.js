import { clampVolume } from '../utils/helpers.js';

/**
 * Mixer rules for the existing UI: hidden tracks are silent, solo takes
 * precedence over mute, and every channel has a 0–1 gain. Channels are track
 * ids, which can be fixed instrument ids or imported sample ids.
 */
export function isChannelAudible(workspace, trackId) {
  const visibility = workspace && workspace.visibleTracks;
  if (visibility && visibility[trackId] === false) return false;

  const anySolo = Object.values(workspace.solo || {}).some(Boolean);
  if (anySolo) return Boolean(workspace.solo && workspace.solo[trackId]);
  return !(workspace.muted && workspace.muted[trackId]);
}

export function getChannelVolume(workspace, trackId) {
  const volumes = workspace && workspace.trackVolumes;
  return clampVolume(volumes ? volumes[trackId] : undefined, 1);
}

export function getGlobalVolume(workspace) {
  return clampVolume(workspace ? workspace.globalVolume : undefined, 0.85);
}
