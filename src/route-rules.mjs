export const INITIAL_FLAGS = Object.freeze({
  charter: false,
  log: false,
  statement: false,
  request: false,
  battery: false,
  map: false,
  maintenance: false,
  repair: false,
  boat: 'locked',
  record: 'locked',
  moro: 'active',
  crane: null,
  lead: null,
  stance: null,
  intent: null,
  method: null,
});

export const EVIDENCE_IDS = Object.freeze(['charter', 'log', 'statement', 'request']);
export const RESOURCE_IDS = Object.freeze(['battery', 'map', 'maintenance', 'repair']);

export function hasCorrectionEvidence(flags) {
  return (
    flags.statement ||
    ((flags.charter || flags.record === 'intact') && (flags.log || flags.request))
  );
}

/** Trusted A–D selection only; resource changes follow scene-routes.md atomically. */
export function applyRoute(sceneId, choiceId, before) {
  const flags = { ...before };
  const index = 'ABCD'.indexOf(choiceId);
  if (index < 0)
    throw new Error(`Unsupported internal choice ${choiceId}. Validate A–D at the boundary.`);
  let nextSceneId;
  const prepare = () => {
    flags[flags.map ? 'maintenance' : 'map'] = true;
  };
  const gains = {
    I01: ['log', 'battery', 'map', 'request'],
    I02: ['charter', 'request', 'battery', 'map'],
    I03: ['map', 'battery', 'request', 'log'],
    I04: ['charter', 'request', 'battery', 'map'],
  };

  if (sceneId === 'S01') {
    flags.lead = ['robot', 'archive', 'garden', 'curator'][index];
    nextSceneId = ['I01', 'I02', 'I03', 'I04'][index];
  } else if (Object.hasOwn(gains, sceneId)) {
    const gain = gains[sceneId][index];
    flags[gain] = true;
    nextSceneId = ['battery', 'map'].includes(gain) ? 'P12' : 'P11';
  } else if (['P11', 'P12'].includes(sceneId)) {
    if (choiceId === (sceneId === 'P11' ? 'A' : 'B')) flags.map = true;
    nextSceneId = 'S12';
  } else if (sceneId === 'S12') {
    flags.stance = ['listen', 'verify', 'ask', 'confront'][index];
    nextSceneId = index < 2 ? 'T21' : 'T22';
  } else if (['T21', 'T22'].includes(sceneId)) {
    flags[[sceneId === 'T21' ? 'log' : 'statement', 'request', 'battery', 'map'][index]] = true;
    nextSceneId = index < 2 ? 'D21' : 'D22';
  } else if (sceneId === 'D21') {
    flags[['charter', 'log', 'request', 'repair'][index]] = true;
    nextSceneId = 'S22';
  } else if (sceneId === 'D22') {
    if (choiceId === 'A') prepare();
    else flags[{ B: 'battery', C: 'charter', D: 'repair' }[choiceId]] = true;
    nextSceneId = 'S22';
  } else if (sceneId === 'S22') {
    if (choiceId === 'C') prepare();
    else flags[{ A: 'request', B: 'statement', D: 'battery' }[choiceId]] = true;
    nextSceneId = 'P21';
  } else if (sceneId === 'P21') {
    flags.crane = choiceId === 'B' ? 'stable' : 'stalled';
    nextSceneId = choiceId === 'B' ? 'R31' : 'R32';
  } else if (sceneId === 'R31') {
    if (choiceId === 'A') {
      flags.boat = 'intact';
      flags.record = 'unreadable';
    } else if (choiceId === 'B') {
      flags.boat = 'damaged';
      flags.record = 'intact';
    } else if (choiceId === 'C') {
      flags.boat = 'intact';
      flags.record = 'intact';
      flags.moro = 'asleep';
    } else if (flags.maintenance && flags.battery) {
      flags.boat = 'intact';
      flags.record = 'intact';
      flags.battery = false;
    } else {
      flags.boat = 'sealed';
      flags.record = 'sealed';
    }
    nextSceneId = 'S31';
  } else if (sceneId === 'R32') {
    if (choiceId === 'A') {
      flags.boat = 'damaged';
      flags.record = 'unreadable';
    } else if (choiceId === 'B') {
      flags.boat = 'damaged';
      flags.record = 'intact';
      flags.moro = 'asleep';
    } else if (choiceId === 'C') {
      flags.boat = 'intact';
      flags.moro = 'asleep';
      flags.record = flags.battery ? 'intact' : 'unreadable';
      flags.battery = false;
    } else {
      flags.boat = flags.maintenance ? 'intact' : 'sealed';
      flags.record = flags.maintenance ? 'unreadable' : 'sealed';
    }
    nextSceneId = 'S31';
  } else if (sceneId === 'S31') {
    flags.intent = ['return', 'exhibit', 'moro', 'open'][index];
    nextSceneId = ['F31', 'F32', 'F33', 'F34'][index];
  } else if (sceneId === 'F31') {
    if (choiceId === 'B' && flags.boat === 'damaged' && flags.repair) {
      flags.boat = 'intact';
      flags.repair = false;
    }
    if (choiceId === 'D') flags.method = 'carry-moro';
    nextSceneId =
      index < 2 ? (flags.boat === 'intact' ? 'E1' : 'E2') : choiceId === 'C' ? 'E2' : 'E5';
  } else if (sceneId === 'F32') {
    if (choiceId === 'B') {
      if (flags.moro === 'asleep' && flags.battery) {
        flags.moro = 'active';
        flags.battery = false;
      }
      if (flags.moro === 'active') flags.log = true;
    }
    if (choiceId === 'D') flags.method = 'protect-witness';
    nextSceneId =
      index < 2 ? (hasCorrectionEvidence(flags) ? 'E3' : 'E4') : choiceId === 'C' ? 'E4' : 'E5';
  } else if (sceneId === 'F33') {
    if (choiceId === 'B' && flags.moro === 'asleep' && flags.battery) {
      flags.moro = 'active';
      flags.battery = false;
    }
    flags.method = ['carry', 'recharge', 'sealed-witness', 'boat-first'][index];
    nextSceneId = choiceId === 'D' ? (flags.boat === 'intact' ? 'E1' : 'E2') : 'E5';
  } else if (sceneId === 'F34') {
    flags.method = ['secure-site', 'carry-records', 'open-path', 'last-check'][index];
    nextSceneId = choiceId === 'D' ? 'E5' : 'E6';
  } else {
    throw new Error(
      `Unsupported internal scene ${sceneId}. Add its reviewed route before exposing it.`,
    );
  }
  return { flags, nextSceneId };
}
