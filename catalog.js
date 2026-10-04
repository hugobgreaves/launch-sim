// Named-vehicle catalogue. All figures are rounded, approximate, widely published
// (encyclopedia-level) values: top speed, range, altitude, country, one-line description.
// No guidance, accuracy, warhead or targeting information. Educational use only.
(function () {
  'use strict';
  const S = window.LaunchSim;
  const P = S.PRESETS;
  const fmt = n => Math.round(n).toLocaleString('en-GB');
  const COL = {
    air: '#7dd3fc', cruise: '#86efac', cruiseSuper: '#fde047', srbm: '#fdba74', mrbm: '#fb923c',
    irbm: '#f87171', icbm: '#ef4444', hyper: '#f0abfc', rocket: '#38bdf8', starship: '#e2e8f0',
  };
  const G = {
    air: 'Aircraft (comparison)', generic: 'Generic classes', cruise: 'Cruise missiles',
    srbm: 'Short-range ballistic (SRBM)', mrbm: 'Medium-range ballistic (MRBM)', irbm: 'Intermediate-range ballistic (IRBM)',
    icbm: 'ICBMs & SLBMs', hyper: 'Hypersonic', rocket: 'Rockets (space launch)',
  };
  G.cruiseSuper = G.cruise; G.starship = G.rocket;
  const rangeTxt = r => r[1] ? `≈ ${r[0] && r[0] !== r[1] ? fmt(r[0]) + '–' : ''}${fmt(r[1])} km` : '';

  // Re-group the existing generic presets.
  P.forEach(p => {
    p.country = p.country || 'Generic';
    if (/missile|ICBM|Hypersonic glide/.test(p.name)) p.group = G.generic;
    if (p.kind === 'orbital') p.group = G.rocket;
  });

  function base(o, cat) {
    return Object.assign({ country: '', group: G[cat], color: COL[cat], range: [0, 0] }, o, {
      typicalSpeed: o.speedTxt, typicalAlt: o.altTxt, profile: o.desc, rangeTxt: o.rangeTxt || rangeTxt(o.range || [0, 0]),
    });
  }
  // --- builders ---
  // Surface/ship/sub-launched low-flying subsonic cruise missile
  const cruiseLow = (o, v, h = 0.05) => base(Object.assign({ kind: 'cruise', segments: [
    { name: 'Boost', dist: 5, h0: 0, h1: 0.3, v0: 100, v1: v * 0.9 },
    { name: 'Cruise (low altitude)', dist: 'rest', h0: h, h1: h, v0: v, v1: v },
    { name: 'Terminal', dist: 5, h0: h, h1: 0, v0: v, v1: v } ] }, o), 'cruise');
  // Air-launched cruise missile: released from an aircraft at altitude, descends to cruise height
  const cruiseAir = (o, v, h = 0.1) => base(Object.assign({ kind: 'cruise', segments: [
    { name: 'Released from aircraft', dist: 40, h0: 10, h1: h, v0: 800, v1: v },
    { name: 'Cruise', dist: 'rest', h0: h, h1: h, v0: v, v1: v },
    { name: 'Terminal', dist: 5, h0: h, h1: 0, v0: v, v1: v } ] }, o), 'cruise');
  // Supersonic (ramjet) cruise missile, high-altitude cruise
  const cruiseSuper = (o, v, h) => base(Object.assign({ kind: 'cruise', segments: [
    { name: 'Boost', dist: 30, h0: 0, h1: h, v0: 300, v1: v },
    { name: 'Supersonic cruise', dist: 'rest', h0: h, h1: h, v0: v, v1: v },
    { name: 'Terminal descent', dist: 30, h0: h, h1: 0, v0: v, v1: v * 0.85 } ] }, o), 'cruiseSuper');
  const ballistic = (o, cat, boostTime) => base(Object.assign({ kind: 'ballistic', boostTime }, o), cat);

  const add = [];

  // ===== Aircraft =====
  add.push(base({ id: 'sr71', name: 'SR-71 Blackbird', country: 'USA (retired 1999)', kind: 'cruise', range: [0, 5400],
    speedTxt: '≈ 3,500 km/h (Mach ≈ 3.2)', altTxt: '≈ 24–26 km', desc: 'Reconnaissance jet; still the fastest air-breathing crewed aircraft in regular service history.',
    segments: [
      { name: 'Climb & accelerate', dist: 600, h0: 0, h1: 24, v0: 400, v1: 3300 },
      { name: 'Mach 3+ cruise', dist: 'rest', h0: 24, h1: 25, v0: 3500, v1: 3500 },
      { name: 'Descent', dist: 400, h0: 25, h1: 0, v0: 3300, v1: 300 } ] }, 'air'));

  // ===== Cruise missiles =====
  add.push(cruiseLow({ id: 'tomahawk', name: 'Tomahawk (BGM-109)', country: 'USA', range: [1600, 2500],
    speedTxt: '≈ 880 km/h (Mach ≈ 0.75)', altTxt: 'Low, tens of metres', desc: 'Long-range subsonic cruise missile launched from ships and submarines.' }, 880));
  add.push(cruiseLow({ id: 'kalibr', name: 'Kalibr (3M-14)', country: 'Russia', range: [1500, 2500],
    speedTxt: '≈ 900 km/h (Mach ≈ 0.8)', altTxt: 'Low, tens of metres', desc: 'Ship- and submarine-launched subsonic land-attack cruise missile.' }, 900));
  add.push(cruiseAir({ id: 'kh101', name: 'Kh-101', country: 'Russia', range: [2500, 2800],
    speedTxt: '≈ 700–970 km/h', altTxt: 'Low to medium altitude', desc: 'Air-launched long-range subsonic cruise missile carried by strategic bombers.' }, 850));
  add.push(cruiseAir({ id: 'stormshadow', name: 'Storm Shadow / SCALP-EG', country: 'UK / France', range: [250, 560],
    speedTxt: '≈ 1,000 km/h (Mach ≈ 0.8)', altTxt: 'Low altitude', desc: 'Air-launched subsonic stealthy cruise missile.' }, 1000, 0.05));
  add.push(cruiseAir({ id: 'taurus', name: 'Taurus KEPD 350', country: 'Germany / Sweden', range: [500, 500],
    speedTxt: '≈ 1,100 km/h (Mach ≈ 0.9)', altTxt: 'Low altitude', desc: 'Air-launched subsonic cruise missile.' }, 1100, 0.05));
  add.push(cruiseAir({ id: 'jassm', name: 'JASSM-ER (AGM-158B)', country: 'USA', range: [900, 1000],
    speedTxt: '≈ 1,000 km/h (high subsonic)', altTxt: 'Low to medium altitude', desc: 'Air-launched stealthy subsonic cruise missile, extended-range version.' }, 1000));
  add.push(cruiseLow({ id: 'harpoon', name: 'Harpoon (RGM-84)', country: 'USA', range: [120, 280],
    speedTxt: '≈ 860 km/h (Mach ≈ 0.7)', altTxt: 'Sea-skimming', desc: 'Widely exported subsonic anti-ship missile.' }, 860, 0.02));
  add.push(cruiseLow({ id: 'babur', name: 'Babur', country: 'Pakistan', range: [450, 700],
    speedTxt: '≈ 880 km/h', altTxt: 'Low altitude', desc: 'Ground- and sea-launched subsonic cruise missile.' }, 880));
  add.push(cruiseLow({ id: 'cj10', name: 'CJ-10 (DH-10)', country: 'China', range: [1500, 2000],
    speedTxt: '≈ 800–900 km/h', altTxt: 'Low altitude', desc: 'Ground-launched subsonic land-attack cruise missile.' }, 850));
  add.push(cruiseSuper({ id: 'brahmos', name: 'BrahMos', country: 'India / Russia', range: [290, 500],
    speedTxt: '≈ 3,400 km/h (Mach ≈ 2.8)', altTxt: 'Up to ≈ 15 km cruise (or sea-skimming)', desc: 'Ramjet-powered supersonic cruise missile, among the fastest of its type.' }, 3000, 14));
  add.push(cruiseSuper({ id: 'oniks', name: 'P-800 Oniks', country: 'Russia', range: [300, 600],
    speedTxt: '≈ 2,700–3,000 km/h (Mach ≈ 2.5)', altTxt: 'Up to ≈ 14 km cruise', desc: 'Ramjet-powered supersonic anti-ship cruise missile (BrahMos was derived from it).' }, 2700, 14));

  // ===== Ballistic missiles (speed in the sim comes from route length via the simplified arc model) =====
  const B = (cat, bt) => (id, name, country, range, speedTxt, altTxt, desc) =>
    add.push(ballistic({ id, name, country, range, speedTxt, altTxt, desc }, cat, bt));
  const srbm = B('srbm', 65), mrbm = B('mrbm', 120), irbm = B('irbm', 160), icbm = B('icbm', 200);

  srbm('scudb', 'Scud-B (R-17)', 'Soviet Union (widely exported)', [300, 300], 'Up to ≈ 5,000–6,000 km/h (Mach ≈ 5)', 'Apogee ≈ 80–90 km', 'Liquid-fuelled Cold-War era short-range ballistic missile; the archetypal "Scud".');
  srbm('iskander', 'Iskander-M (9K720)', 'Russia', [400, 500], 'Up to ≈ 7,000 km/h (Mach ≈ 6–7)', 'Apogee ≈ 50 km', 'Road-mobile, solid-fuelled short-range ballistic missile.');
  srbm('atacms', 'ATACMS (MGM-140)', 'USA', [165, 300], '≈ 3,700 km/h (Mach ≈ 3)', 'Apogee ≈ 50 km', 'Army Tactical Missile System, fired from rocket-artillery launchers.');
  srbm('fateh110', 'Fateh-110', 'Iran', [200, 300], '≈ 4,000 km/h (Mach ≈ 3.5)', 'Apogee ≈ 30–60 km', 'Solid-fuelled short-range ballistic missile.');
  srbm('df15', 'DF-15 (CSS-6)', 'China', [600, 900], '≈ 7,000 km/h (Mach ≈ 6)', 'Apogee ≈ 100–150 km', 'Road-mobile, solid-fuelled short-range ballistic missile.');
  srbm('prithvi2', 'Prithvi-II', 'India', [250, 350], '≈ 4,000–6,000 km/h', 'Apogee ≈ 40–60 km', 'Liquid-fuelled short-range ballistic missile, India\'s first indigenous one.');
  srbm('kn23', 'KN-23 (Hwasong-11)', 'North Korea', [450, 900], '≈ 7,000 km/h (Mach ≈ 6)', 'Apogee ≈ 40–60 km', 'Solid-fuelled short-range ballistic missile with a relatively flat flight path.');

  mrbm('shaheen2', 'Shaheen-II', 'Pakistan', [1500, 2000], '≈ 12,000–15,000 km/h', 'Apogee ≈ 300–500 km', 'Two-stage, solid-fuelled medium-range ballistic missile.');
  mrbm('ghauri', 'Ghauri (Hatf-V)', 'Pakistan', [1300, 1500], '≈ 11,000–13,000 km/h', 'Apogee ≈ 300–400 km', 'Liquid-fuelled medium-range ballistic missile.');
  mrbm('agni2', 'Agni-II', 'India', [2000, 3000], '≈ 13,000–16,000 km/h', 'Apogee ≈ 400–600 km', 'Two-stage, solid-fuelled medium-range ballistic missile.');
  mrbm('df21', 'DF-21 (CSS-5)', 'China', [1500, 2150], 'Up to ≈ 12,000 km/h (Mach ≈ 10)', 'Apogee ≈ 300–500 km', 'Road-mobile, two-stage, solid-fuelled medium-range ballistic missile.');
  mrbm('shahab3', 'Shahab-3', 'Iran', [1300, 2000], '≈ 11,000–14,000 km/h', 'Apogee ≈ 300–450 km', 'Liquid-fuelled medium-range ballistic missile.');
  mrbm('pershing2', 'Pershing II', 'USA (retired 1991)', [1770, 1770], '≈ 10,000 km/h (Mach ≈ 8)', 'Apogee ≈ 300–400 km', 'Cold-War era two-stage solid-fuelled missile, eliminated under the 1987 INF Treaty.');
  mrbm('jericho2', 'Jericho II', 'Israel', [1500, 3500], '≈ 12,000–16,000 km/h', 'Apogee ≈ 300–600 km', 'Two-stage, solid-fuelled medium-range ballistic missile.');

  irbm('agni4', 'Agni-IV', 'India', [3500, 4000], '≈ 18,000–20,000 km/h', 'Apogee ≈ 700–900 km', 'Two-stage, solid-fuelled intermediate-range ballistic missile.');
  irbm('df26', 'DF-26', 'China', [3000, 5000], '≈ 18,000–22,000 km/h', 'Apogee ≈ 700–1,000 km', 'Road-mobile, solid-fuelled intermediate-range ballistic missile.');
  irbm('hwasong12', 'Hwasong-12', 'North Korea', [4500, 4500], '≈ 18,000–20,000 km/h', 'Apogee ≈ 800–1,000 km on a standard arc', 'Single-stage, liquid-fuelled intermediate-range ballistic missile.');

  icbm('minuteman3', 'Minuteman III (LGM-30G)', 'USA', [13000, 13000], '≈ 28,000 km/h (Mach ≈ 23)', 'Apogee ≈ 1,100–1,300 km', 'Silo-based, three-stage, solid-fuelled ICBM in service since 1970.');
  icbm('trident2', 'Trident II D5 (UGM-133)', 'USA / UK', [12000, 12000], '≈ 29,000 km/h (Mach ≈ 24)', 'Apogee ≈ 1,000–1,200 km', 'Submarine-launched ballistic missile (SLBM), three-stage, solid-fuelled.');
  icbm('sarmat', 'RS-28 Sarmat', 'Russia', [10000, 18000], '≈ 25,000+ km/h', 'Apogee ≈ 1,000+ km', 'Heavy, silo-based, liquid-fuelled ICBM.');
  icbm('yars', 'RS-24 Yars', 'Russia', [10500, 12000], '≈ 25,000+ km/h', 'Apogee ≈ 1,000+ km', 'Road-mobile and silo-based, solid-fuelled ICBM.');
  icbm('voyevoda', 'R-36M2 Voyevoda ("SS-18")', 'Russia', [11000, 16000], '≈ 25,000+ km/h', 'Apogee ≈ 1,000+ km', 'Heavy, silo-based, liquid-fuelled Cold-War era ICBM.');
  icbm('bulava', 'Bulava (RSM-56)', 'Russia', [8000, 9300], '≈ 25,000 km/h', 'Apogee ≈ 1,000 km', 'Submarine-launched, solid-fuelled ballistic missile (SLBM).');
  icbm('df41', 'DF-41', 'China', [12000, 15000], '≈ 25,000+ km/h (Mach ≈ 25)', 'Apogee ≈ 1,000+ km', 'Road-mobile, three-stage, solid-fuelled ICBM.');
  icbm('df5b', 'DF-5B', 'China', [12000, 13000], '≈ 25,000+ km/h', 'Apogee ≈ 1,000+ km', 'Silo-based, liquid-fuelled ICBM.');
  icbm('hwasong17', 'Hwasong-17', 'North Korea', [13000, 15000], '≈ 25,000+ km/h (est.)', 'Apogee ≈ 1,000+ km on a standard arc (est.)', 'Large road-mobile, liquid-fuelled ICBM; figures are external estimates.');
  icbm('m51', 'M51', 'France', [8000, 10000], '≈ 25,000 km/h (Mach ≈ 25)', 'Apogee ≈ 1,000 km', 'Submarine-launched, three-stage, solid-fuelled ballistic missile (SLBM).');
  icbm('jl2', 'JL-2 (Julang-2)', 'China', [7200, 7200], '≈ 24,000 km/h', 'Apogee ≈ 900–1,000 km', 'Submarine-launched ballistic missile (SLBM) carried by Jin-class (Type 094) submarines.');
  irbm('k4', 'K-4', 'India', [3500, 3500], '≈ 17,000–19,000 km/h', 'Apogee ≈ 600–700 km', 'Submarine-launched ballistic missile (SLBM) for Arihant-class submarines.');
  mrbm('pukguksong3', 'Pukguksong-3', 'North Korea', [1900, 1900], '≈ 14,000–16,000 km/h (est.)', 'Apogee ≈ 450 km on a standard arc (est.); tested on a lofted path', 'Solid-fuelled submarine-launched ballistic missile (SLBM); range is an external estimate.');
  icbm('agni5', 'Agni-V', 'India', [5000, 8000], '≈ 24,000–29,000 km/h', 'Apogee ≈ 600–1,000+ km', 'Three-stage, solid-fuelled, canister-launched long-range ballistic missile.');

  // ===== Hypersonic =====
  const hyper = (o, segments) => add.push(base(Object.assign({ kind: 'cruise', segments }, o), 'hyper'));
  hyper({ id: 'avangard', name: 'Avangard', country: 'Russia', range: [6000, 15000], speedTxt: 'Mach ≈ 20+ (claimed up to ≈ 27)', altTxt: 'Glide ≈ 40–100 km',
    desc: 'Hypersonic glide vehicle boosted by an ICBM, then gliding through the upper atmosphere over intercontinental distances.' }, [
    { name: 'ICBM boost', dist: 900, h0: 0, h1: 100, v0: 500, v1: 27000 },
    { name: 'Pull-down', dist: 800, h0: 100, h1: 70, v0: 27000, v1: 26000 },
    { name: 'Hypersonic glide', dist: 'rest', h0: 70, h1: 40, v0: 26000, v1: 12000 },
    { name: 'Terminal', dist: 200, h0: 40, h1: 0, v0: 12000, v1: 6000 } ]);
  hyper({ id: 'kinzhal', name: 'Kinzhal (Kh-47M2)', country: 'Russia', range: [1500, 2000], speedTxt: 'Up to Mach ≈ 10 (claimed)', altTxt: 'High quasi-ballistic arc (≈ 20–50 km)',
    desc: 'Air-launched aeroballistic missile carried by a fighter jet, flying a high, fast arc.' }, [
    { name: 'Released from aircraft', dist: 30, h0: 15, h1: 18, v0: 1500, v1: 3000 },
    { name: 'Rocket boost', dist: 150, h0: 18, h1: 50, v0: 3000, v1: 12000 },
    { name: 'Aeroballistic flight', dist: 'rest', h0: 50, h1: 30, v0: 12000, v1: 7000 },
    { name: 'Terminal dive', dist: 60, h0: 30, h1: 0, v0: 7000, v1: 4000 } ]);
  hyper({ id: 'zircon', name: 'Zircon (3M22)', country: 'Russia', range: [500, 1000], speedTxt: 'Mach ≈ 8 (claimed, ≈ 9,000+ km/h)', altTxt: 'Cruise ≈ 25–40 km',
    desc: 'Ship-launched scramjet-powered hypersonic cruise missile.' }, [
    { name: 'Rocket boost', dist: 60, h0: 0, h1: 30, v0: 300, v1: 9000 },
    { name: 'Scramjet cruise', dist: 'rest', h0: 30, h1: 30, v0: 9200, v1: 9200 },
    { name: 'Terminal dive', dist: 50, h0: 30, h1: 0, v0: 9000, v1: 6000 } ]);
  hyper({ id: 'df17', name: 'DF-17 (DF-ZF glider)', country: 'China', range: [1800, 2500], speedTxt: 'Mach ≈ 5–10', altTxt: 'Glide ≈ 40–60 km',
    desc: 'Medium-range ballistic booster carrying a hypersonic glide vehicle.' }, [
    { name: 'Boost', dist: 250, h0: 0, h1: 70, v0: 500, v1: 12000 },
    { name: 'Pull-down', dist: 200, h0: 70, h1: 55, v0: 12000, v1: 11500 },
    { name: 'Hypersonic glide', dist: 'rest', h0: 55, h1: 35, v0: 11500, v1: 6500 },
    { name: 'Terminal', dist: 80, h0: 35, h1: 0, v0: 6500, v1: 4000 } ]);
  hyper({ id: 'darkeagle', name: 'Dark Eagle (LRHW)', country: 'USA', range: [2775, 2775], speedTxt: 'Mach ≈ 5+ (reported up to ≈ 17)', altTxt: 'Glide ≈ 40–60 km',
    desc: 'Ground-launched Long-Range Hypersonic Weapon: a two-stage booster with a common hypersonic glide body.' }, [
    { name: 'Boost', dist: 300, h0: 0, h1: 80, v0: 500, v1: 17000 },
    { name: 'Pull-down', dist: 250, h0: 80, h1: 60, v0: 17000, v1: 16000 },
    { name: 'Hypersonic glide', dist: 'rest', h0: 60, h1: 35, v0: 16000, v1: 7000 },
    { name: 'Terminal', dist: 100, h0: 35, h1: 0, v0: 7000, v1: 4500 } ]);

  // ===== Rockets (space launch). Shown to a low parking orbit for comparison. =====
  const rocket = o => add.push(base(Object.assign({ kind: 'orbital', rangeTxt: 'Orbital (global)' }, o), o.id === 'starship' ? 'starship' : 'rocket'));
  rocket({ id: 'saturnv', name: 'Saturn V', country: 'USA (1967–1973)', ascentTime: 700, orbitAlt: 190, tSep: 162, vSep: 8600, hSep: 67, sepDur: 4,
    phases: [[162, 'S-IC first stage'], [166, 'S-IC separation'], [550, 'S-II second stage'], [556, 'S-II separation'], [700, 'S-IVB third stage']],
    coastName: 'Earth parking orbit', speedTxt: '≈ 28,000 km/h in parking orbit (≈ 7.8 km/s)', altTxt: 'Parking orbit ≈ 190 km',
    desc: 'Apollo Moon rocket: three stages, about 11.5 minutes to Earth parking orbit before heading to the Moon.' });
  rocket({ id: 'falcon9', name: 'Falcon 9 Block 5', country: 'USA (SpaceX)', ascentTime: 520, orbitAlt: 210, tSep: 160, vSep: 8300, hSep: 68, sepDur: 4,
    phases: [[160, 'First stage (9 Merlin 1D)'], [164, 'Stage separation'], [520, 'Second stage (Merlin Vacuum)']],
    secoName: 'SECO (engine cutoff)', booster: { tLand: 525, apo: 125, drone: 610 },
    speedTxt: '≈ 27,500 km/h in orbit', altTxt: 'Low Earth orbit ≈ 210 km (shown)',
    desc: 'The workhorse reusable rocket. The first stage flips, re-enters with an entry burn and lands on a drone ship ≈ 600 km downrange.' });
  rocket({ id: 'falconheavy', name: 'Falcon Heavy', country: 'USA (SpaceX)', ascentTime: 510, orbitAlt: 200, tSep: 185, vSep: 9000, hSep: 75, sepDur: 8,
    phases: [[150, 'Side boosters + centre core'], [155, 'Side-booster separation'], [185, 'Centre core'], [193, 'Stage separation'], [510, 'Second-stage burn']],
    speedTxt: '≈ 27,000–28,000 km/h in orbit', altTxt: 'Low Earth orbit ≈ 200 km (shown)', desc: 'Three Falcon 9-derived cores strapped together; side boosters usually fly back to land.' });
  rocket({ id: 'soyuz', name: 'Soyuz-2', country: 'Russia', ascentTime: 530, orbitAlt: 200, tSep: 287, vSep: 13000, hSep: 165, sepDur: 5, speedExp1: 1.6,
    phases: [[118, 'Boosters + core stage'], [123, 'Booster separation ("Korolev cross")'], [287, 'Core stage'], [292, 'Stage separation'], [530, 'Third stage']],
    speedTxt: '≈ 27,500 km/h in orbit', altTxt: 'Low Earth orbit ≈ 200 km', desc: 'Descendant of the R-7 family that launched Sputnik and Gagarin; still flying crews and cargo.' });
  rocket({ id: 'ariane5', name: 'Ariane 5', country: 'Europe (retired 2023)', ascentTime: 540, orbitAlt: 250, tSep: 140, vSep: 7200, hSep: 65, sepDur: 5,
    phases: [[140, 'Core + solid boosters'], [145, 'Booster separation'], [540, 'Core stage (Vulcain)']],
    speedTxt: '≈ 27,500 km/h (to low orbit, shown)', altTxt: 'Shown to ≈ 250 km (real missions often went higher)', desc: 'European heavy launcher; launched the James Webb Space Telescope in 2021.' });
  rocket({ id: 'ariane6', name: 'Ariane 6', country: 'Europe', ascentTime: 600, orbitAlt: 250, tSep: 140, vSep: 6800, hSep: 60, sepDur: 5,
    phases: [[140, 'Core + P120C boosters'], [145, 'Booster separation'], [460, 'Core stage (Vulcain 2.1)'], [470, 'Stage separation'], [600, 'Upper stage (Vinci)']],
    speedTxt: '≈ 27,500 km/h (to low orbit, shown)', altTxt: 'Shown to ≈ 250 km', desc: 'Ariane 5\'s successor, first flown in 2024.' });
  rocket({ id: 'sls', name: 'SLS Block 1', country: 'USA (NASA)', ascentTime: 490, orbitAlt: 180, tSep: 132, vSep: 4900, hSep: 48, sepDur: 4,
    phases: [[132, 'Core stage + solid boosters'], [136, 'Booster separation'], [484, 'Core stage'], [490, 'Core-stage separation']],
    speedTxt: '≈ 28,000 km/h at core-stage cutoff', altTxt: 'Initial orbit ≈ 180 km (shown)', desc: 'Space Launch System that flew Artemis I around the Moon in 2022.' });
  rocket({ id: 'longmarch5', name: 'Long March 5', country: 'China', ascentTime: 560, orbitAlt: 200, tSep: 173, vSep: 7500, hSep: 60, sepDur: 5,
    phases: [[173, 'Core + 4 boosters'], [178, 'Booster separation'], [480, 'Core stage'], [490, 'Stage separation'], [560, 'Upper stage']],
    speedTxt: '≈ 27,500 km/h in orbit', altTxt: 'Low Earth orbit ≈ 200 km (shown)', desc: 'China\'s heavy-lift launcher used for space-station modules and Moon/Mars missions.' });
  rocket({ id: 'electron', name: 'Electron', country: 'New Zealand / USA (Rocket Lab)', ascentTime: 540, orbitAlt: 300, tSep: 150, vSep: 6000, hSep: 80, sepDur: 4,
    phases: [[150, 'First stage (9 Rutherford engines)'], [154, 'Stage separation'], [540, 'Second stage']],
    speedTxt: '≈ 27,500 km/h in orbit', altTxt: 'Low Earth orbit ≈ 300–500 km', desc: 'Small-satellite launcher flying from Mahia, New Zealand.' });
  rocket({ id: 'starship', name: 'Starship (Super Heavy + Starship)', country: 'USA (SpaceX)', ascentTime: 510, orbitAlt: 190, vFinal: 26500,
    tSep: 160, vSep: 5700, hSep: 68, sepDur: 8, speedExp1: 1.8,
    phases: [[15, 'Liftoff'], [55, 'Ascent'], [75, 'Max-Q'], [160, 'Super Heavy ascent'], [168, 'Hot staging'], [510, 'Starship ascent (ship engines)']],
    secoName: 'SECO (engine cutoff)', coastName: 'Coasting (near-orbital)', booster: { tLand: 415, apo: 95 },
    speedTxt: '≈ 26,000–27,000 km/h near-orbital at engine cutoff', altTxt: '≈ 150–200 km',
    desc: 'Largest rocket ever flown. Super Heavy booster burns ~2.5 min, hot-stages, then boosts back to the launch site while Starship climbs for ~8.5 min.' });

  // Merge (skip duplicates)
  add.forEach(p => { if (!P.some(q => q.id === p.id)) P.push(p); });
  P.forEach(p => { if (!p.rangeTxt) p.rangeTxt = rangeTxt(p.range || [0, 0]) || (p.kind === 'orbital' ? 'Orbital (global)' : ''); });
  S.GROUP_ORDER = [G.air, G.generic, G.cruise, G.srbm, G.mrbm, G.irbm, G.icbm, G.hyper, G.rocket];
  S.NAMED_COUNT = add.length;
})();

(function () {
  'use strict';
  const S = window.LaunchSim;
  const P = S.PRESETS;

  // ---- Country codes <-> names (names must match the loaded country outlines) ----
  S.CC_NAME = {
    US: 'United States', UK: 'United Kingdom', FR: 'France', DE: 'Germany', SE: 'Sweden',
    RU: 'Russia', CN: 'China', IN: 'India', PK: 'Pakistan', KP: 'North Korea', KR: 'South Korea',
    IR: 'Iran', IL: 'Israel', JP: 'Japan', NZ: 'New Zealand', AU: 'Australia', CA: 'Canada',
    KZ: 'Kazakhstan', BY: 'Belarus', EU: 'Europe (ESA)',
  };
  // Map outline polygon names -> our codes (only those we care about).
  S.NAME_CC = {
    'United States of America': 'US', 'United Kingdom': 'UK', 'France': 'FR', 'Germany': 'DE',
    'Sweden': 'SE', 'Russia': 'RU', 'China': 'CN', 'India': 'IN', 'Pakistan': 'PK',
    'North Korea': 'KP', 'South Korea': 'KR', 'Iran': 'IR', 'Israel': 'IL', 'Japan': 'JP',
    'New Zealand': 'NZ', 'Australia': 'AU', 'Canada': 'CA', 'Kazakhstan': 'KZ', 'Belarus': 'BY',
  };

  // ---- Simple, public alliance / partnership groupings ----
  const BLOCS = [
    ['US', 'UK', 'FR', 'DE', 'SE', 'CA', 'IT', 'NL', 'NO', 'PL', 'TR', 'ES'], // NATO (subset)
    ['US', 'UK', 'AU', 'CA', 'NZ'], // Five Eyes / AUKUS
  ];
  const PARTNERS = { // bidirectional partnerships beyond the blocs above
    RU: ['BY', 'IR', 'KP', 'IN'], BY: ['RU'], IR: ['RU'], KP: ['RU', 'CN'],
    CN: ['PK', 'KP'], PK: ['CN'], IN: ['RU'],
    US: ['IL', 'JP', 'KR'], IL: ['US'], JP: ['US'], KR: ['US'],
    EU: ['US', 'UK', 'FR', 'DE'],
  };
  S.alliesOf = function (cc) {
    const set = new Set();
    BLOCS.forEach(b => { if (b.includes(cc)) b.forEach(x => set.add(x)); });
    (PARTNERS[cc] || []).forEach(x => set.add(x));
    // partnerships are bidirectional
    Object.keys(PARTNERS).forEach(k => { if (PARTNERS[k].includes(cc)) set.add(k); });
    set.delete(cc);
    return set;
  };

  // ---- Per-vehicle operators / builder / retired flags ----
  const GENERIC = ['airliner', 'concorde', 'cm-sub', 'cm-super', 'srbm', 'mrbm', 'irbm', 'icbm', 'hgv', 'orbital'];
  const CIVIL = ['airliner', 'concorde'];
  const OPS = {
    sr71: { ops: ['US'], retired: true },
    tomahawk: { ops: ['US', 'UK'], built: 'US', note: 'US-built; operated by USA & UK (Astute-class subs)' }, kalibr: { ops: ['RU'] }, kh101: { ops: ['RU'] },
    stormshadow: { ops: ['UK', 'FR'] }, taurus: { ops: ['DE', 'SE'] }, jassm: { ops: ['US'] },
    harpoon: { ops: ['US'] }, babur: { ops: ['PK'] }, cj10: { ops: ['CN'] },
    brahmos: { ops: ['IN', 'RU'] }, oniks: { ops: ['RU'] },
    scudb: { ops: ['RU'], note: 'Soviet-era; widely exported' }, iskander: { ops: ['RU'] },
    atacms: { ops: ['US'] }, fateh110: { ops: ['IR'] }, df15: { ops: ['CN'] },
    prithvi2: { ops: ['IN'] }, kn23: { ops: ['KP'] },
    shaheen2: { ops: ['PK'] }, ghauri: { ops: ['PK'] }, agni2: { ops: ['IN'] },
    df21: { ops: ['CN'] }, shahab3: { ops: ['IR'] }, pershing2: { ops: ['US'], retired: true },
    jericho2: { ops: ['IL'] }, agni4: { ops: ['IN'] }, df26: { ops: ['CN'] }, hwasong12: { ops: ['KP'] },
    jl2: { ops: ['CN'] }, k4: { ops: ['IN'] }, pukguksong3: { ops: ['KP'] },
    minuteman3: { ops: ['US'] }, trident2: { ops: ['US', 'UK'], built: 'US', note: 'US-built; operated by USA & UK' },
    sarmat: { ops: ['RU'] }, yars: { ops: ['RU'] }, voyevoda: { ops: ['RU'] }, bulava: { ops: ['RU'] },
    df41: { ops: ['CN'] }, df5b: { ops: ['CN'] }, hwasong17: { ops: ['KP'] }, m51: { ops: ['FR'] },
    agni5: { ops: ['IN'] },
    avangard: { ops: ['RU'] }, kinzhal: { ops: ['RU'] }, zircon: { ops: ['RU'] }, df17: { ops: ['CN'] },
    darkeagle: { ops: ['US'] },
    saturnv: { ops: ['US'], retired: true }, falcon9: { ops: ['US'] }, falconheavy: { ops: ['US'] }, soyuz: { ops: ['RU'] },
    ariane5: { ops: ['FR', 'EU'], retired: true }, ariane6: { ops: ['FR', 'EU'] }, sls: { ops: ['US'] },
    longmarch5: { ops: ['CN'] }, electron: { ops: ['NZ', 'US'] }, starship: { ops: ['US'] },
  };
  const SUB = { trident2: ['US', 'UK'], tomahawk: ['US', 'UK'], bulava: ['RU'], kalibr: ['RU'], zircon: ['RU'],
    jl2: ['CN'], m51: ['FR'], k4: ['IN'], pukguksong3: ['KP'] };
  S.SUB_CLASSES = { UK: 'Vanguard / Astute class', US: 'Ohio / Virginia class', RU: 'Borei / Yasen class', CN: 'Jin class (Type 094)',
    FR: 'Triomphant class', IN: 'Arihant class', KP: 'Experimental SLBM submarine' };
  S.SUB_DEFAULT_POS = { UK: [58.5, -16], US: [33, -62], RU: [74, 38], CN: [15, 114], FR: [46, -9], IN: [15, 88], KP: [40.5, 131] };
  S.platform = 'land';
  { const b = P.find(p => p.id === 'sr71'); if (b) { b.aar = true; b.aarNote = 'Air-to-air refuelled by KC-135Q tankers in service'; } }
  { const t = P.find(p => p.id === 'tomahawk'); if (t) t.country = 'USA / UK'; }
  P.forEach(p => {
    p.subOps = SUB[p.id] || [];
    const t = OPS[p.id] || {};
    p.ops = t.ops || [];
    if (t.built) p.built = t.built;
    if (t.note) p.opNote = t.note;
    p.retired = !!t.retired;
    p.isCivil = CIVIL.includes(p.id);
    p.isGeneric = GENERIC.includes(p.id) && !p.isCivil;
    // numeric enforced max range (km); orbital & generic-hgv are treated as unlimited
    p.maxRange = (p.kind === 'orbital') ? Infinity : ((p.range && p.range[1]) ? p.range[1] : Infinity);
    if (p.retired && p.name && !/retired|\bRetired\b/.test(p.name) && !/\(.*retired.*\)/i.test(p.country || '')) p.retiredTag = true;
  });

  // Relation of a vehicle to a launch-site country.
  // -> { rel: 'own'|'ally'|'civilian'|'generic'|'foreign', ally?: cc }
  S.vehicleRelation = function (p, cc) {
    if (S.platform === 'sub') { // submarine launch: only sub-launched missiles of the country or its allies
      if (!cc || !p.subOps.length) return { rel: 'foreign' };
      if (p.subOps.includes(cc)) return { rel: 'own' };
      const al = S.alliesOf(cc), a = p.subOps.find(o => al.has(o));
      return a ? { rel: 'ally', ally: a } : { rel: 'foreign' };
    }
    if (p.isCivil) return { rel: 'civilian' };
    if (p.isGeneric) return { rel: 'generic' };
    if (!cc) return { rel: 'foreign' };
    if (p.ops.includes(cc)) return { rel: 'own' };
    const allies = S.alliesOf(cc);
    const allyOp = p.ops.find(o => allies.has(o));
    if (allyOp) return { rel: 'ally', ally: allyOp };
    return { rel: 'foreign' };
  };
  S.relationLabel = function (p, cc) {
    const r = S.vehicleRelation(p, cc);
    if (r.rel === 'own') return 'Own equipment';
    if (r.rel === 'ally') return 'Ally (' + (S.CC_NAME[r.ally] || r.ally) + ')';
    if (r.rel === 'civilian') return 'Civilian';
    if (r.rel === 'generic') return 'Generic class';
    return 'Not operated here';
  };
  // Vehicles available from a given country, grouped for the picker.
  S.availableGroups = function (cc) {
    const own = [], allyBy = {}, civ = [], gen = [];
    const GO = S.GROUP_ORDER || [];
    const catRank = p => { const i = GO.indexOf(p.group); return i < 0 ? 99 : i; };
    P.forEach(p => {
      const r = S.vehicleRelation(p, cc);
      if (r.rel === 'civilian') civ.push(p);
      else if (r.rel === 'generic') gen.push(p);
      else if (r.rel === 'own') own.push(p);
      else if (r.rel === 'ally') (allyBy[r.ally] = allyBy[r.ally] || []).push(p);
    });
    const sortCat = arr => arr.sort((a, b) => catRank(a) - catRank(b) || a.name.localeCompare(b.name));
    const groups = [];
    const sub = S.platform === 'sub' ? ' – submarine-launched' : '';
    if (own.length) groups.push({ key: 'own', label: 'Own equipment' + (cc ? ' (' + (S.CC_NAME[cc] || cc) + ')' : '') + sub, items: sortCat(own) });
    Object.keys(allyBy).sort((a, b) => (S.CC_NAME[a] || a).localeCompare(S.CC_NAME[b] || b))
      .forEach(a => groups.push({ key: 'ally-' + a, label: 'Ally equipment (' + (S.CC_NAME[a] || a) + ')' + sub, items: sortCat(allyBy[a]) }));
    if (civ.length) groups.push({ key: 'civ', label: 'Civilian & comparison', items: civ });
    if (gen.length) groups.push({ key: 'gen', label: 'Generic classes', items: sortCat(gen) });
    return groups;
  };
  S.isAllowed = function (p, cc) { return S.vehicleRelation(p, cc).rel !== 'foreign'; };
  S.firstAllowed = function (cc, prefer) {
    const g = S.availableGroups(cc);
    const all = g.flatMap(x => x.items);
    if (prefer) { const m = all.find(p => p.kind === prefer) || all.find(p => p.id === prefer); if (m) return m; }
    return all[0];
  };
})();

// ---- Rated (listed, approximate) top speed km/h and apogee km at max range, for named ballistic missiles ----
(function () {
  const S = window.LaunchSim;
  const RATED = {
    scudb: [5500, 85], iskander: [7000, 50], atacms: [3700, 50], fateh110: [4300, 45], df15: [7000, 125],
    prithvi2: [5000, 50], kn23: [7000, 50],
    jl2: [24000, 950], k4: [18000, 650], pukguksong3: [15000, 450],
    shaheen2: [13500, 400], ghauri: [12000, 350], agni2: [14500, 500], df21: [12000, 400], shahab3: [12500, 375],
    pershing2: [10000, 350], jericho2: [14000, 450],
    agni4: [19000, 800], df26: [20000, 850], hwasong12: [19000, 900],
    minuteman3: [28000, 1200], trident2: [29000, 1100], sarmat: [26000, 1200], yars: [26000, 1200],
    voyevoda: [26000, 1200], bulava: [25000, 1000], df41: [27000, 1200], df5b: [26000, 1200],
    hwasong17: [26000, 1200], m51: [27000, 1000], agni5: [26000, 800],
  };
  S.PRESETS.forEach(p => { const r = RATED[p.id]; if (r) { p.ratedV = r[0]; p.ratedApo = r[1]; } });

  // Scale a ballistic run so that, flown at max range, it matches the listed top speed & apogee.
  const baseSim = S.simulate;
  S.simulate = function (p, L) {
    const r = baseSim(p, L);
    if (p.kind === 'ballistic' && p.ratedV && isFinite(p.maxRange)) {
      if (!p._ref) { const ref = baseSim(p, p.maxRange); p._ref = { v: ref.maxV, h: ref.maxH }; }
      const kv = p.ratedV / p._ref.v, kh = p.ratedApo / p._ref.h;
      r.samples = r.samples.map(q => ({ ...q, t: q.t / kv, v: q.v * kv, h: q.h * kh }));
      r.arrival /= kv; r.end /= kv; r.maxV *= kv; r.maxH *= kh;
      r.scaled = { kv, kh };
    }
    return r;
  };
  // Range-enforced flight: fly min(route, maxRange); stop short if out of range.
  S.simulateRoute = function (p, routeKm) {
    const max = p.maxRange;
    const out = isFinite(max) && routeKm > max;
    const flyKm = out ? max : routeKm;
    const r = S.simulate(p, flyKm);
    r.flyKm = flyKm; r.outOfRange = out; r.shortBy = out ? routeKm - max : 0;
    return r;
  };
})();
