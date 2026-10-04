// Major, widely publicised military bases / test ranges (encyclopedia-level, approximate locations).
// role is a short public description only. host = host country/territory for overseas bases.
(function () {
  'use strict';
  const B = [
    // United Kingdom
    ['UK', 'faslane', 'HMNB Clyde (Faslane)', 'Naval base (submarines)', 56.07, -4.82],
    ['UK', 'lossiemouth', 'RAF Lossiemouth', 'Air base', 57.71, -3.34],
    ['UK', 'marham', 'RAF Marham', 'Air base', 52.65, 0.55],
    ['UK', 'coningsby', 'RAF Coningsby', 'Air base', 53.09, -0.17],
    ['UK', 'brizenorton', 'RAF Brize Norton', 'Air base (transport)', 51.75, -1.58],
    ['UK', 'portsmouth', 'HMNB Portsmouth', 'Naval base', 50.80, -1.11],
    ['UK', 'devonport', 'HMNB Devonport', 'Naval base', 50.38, -4.18],
    ['UK', 'hebrides', 'MOD Hebrides Range', 'Missile test range', 57.35, -7.38],
    ['UK', 'akrotiri', 'RAF Akrotiri', 'Air base', 34.59, 32.99, 'Cyprus'],
    ['UK', 'mountpleasant', 'RAF Mount Pleasant', 'Air base', -51.82, -58.45, 'Falkland Islands'],
    ['UK', 'gibraltar', 'HM Naval Base Gibraltar', 'Naval base', 36.14, -5.35, 'Gibraltar'],
    ['UK', 'diegogarcia-uk', 'Diego Garcia (shared UK/US)', 'Naval & air facility', -7.31, 72.41, 'Chagos Archipelago'],
    // United States
    ['US', 'vandenberg', 'Vandenberg Space Force Base', 'Space launch & missile test base', 34.74, -120.57],
    ['US', 'capecanaveral', 'Cape Canaveral Space Force Station', 'Space launch base', 28.49, -80.58],
    ['US', 'minot', 'Minot Air Force Base', 'Air base (ICBM & bomber wings)', 48.42, -101.36],
    ['US', 'malmstrom', 'Malmstrom Air Force Base', 'Air base (ICBM wing)', 47.51, -111.18],
    ['US', 'fewarren', 'F. E. Warren Air Force Base', 'Air base (ICBM wing)', 41.13, -104.87],
    ['US', 'kitsap', 'Naval Base Kitsap (Bangor)', 'Naval base (submarines)', 47.73, -122.71],
    ['US', 'kingsbay', 'Naval Submarine Base Kings Bay', 'Naval base (submarines)', 30.80, -81.52],
    ['US', 'norfolk', 'Naval Station Norfolk', 'Naval base', 36.95, -76.31],
    ['US', 'pmrf', 'Pacific Missile Range Facility', 'Missile test range', 22.02, -159.78],
    ['US', 'guam', 'Andersen Air Force Base', 'Air base', 13.58, 144.93, 'Guam (US territory)'],
    ['US', 'kwajalein', 'Reagan Test Site, Kwajalein', 'Missile test range', 8.72, 167.73, 'Marshall Islands'],
    ['US', 'ramstein', 'Ramstein Air Base', 'Air base', 49.44, 7.60, 'Germany'],
    ['US', 'lakenheath', 'RAF Lakenheath', 'Air base (US-operated)', 52.41, 0.56, 'United Kingdom'],
    ['US', 'kadena', 'Kadena Air Base', 'Air base', 26.36, 127.77, 'Japan'],
    ['US', 'yokosuka', 'Fleet Activities Yokosuka', 'Naval base', 35.29, 139.67, 'Japan'],
    ['US', 'humphreys', 'Camp Humphreys', 'Army garrison', 36.97, 127.03, 'South Korea'],
    ['US', 'diegogarcia-us', 'Naval Support Facility Diego Garcia', 'Naval & air facility', -7.31, 72.41, 'Chagos Archipelago (UK territory)'],
    // France
    ['FR', 'ilelongue', 'Île Longue', 'Naval base (submarines)', 48.31, -4.51],
    ['FR', 'toulon', 'Toulon Naval Base', 'Naval base', 43.11, 5.92],
    ['FR', 'brest', 'Brest Naval Base', 'Naval base', 48.38, -4.49],
    ['FR', 'saintdizier', 'BA 113 Saint-Dizier', 'Air base', 48.64, 4.90],
    ['FR', 'istres', 'BA 125 Istres', 'Air base', 43.52, 4.92],
    ['FR', 'biscarrosse', 'DGA Essais de missiles (Biscarrosse)', 'Missile test range', 44.37, -1.25],
    ['FR', 'kourou-base', 'Guiana Space Centre', 'Space launch base', 5.24, -52.77, 'French Guiana (France)'],
    ['FR', 'djibouti-fr', 'French Forces in Djibouti', 'Military base', 11.55, 43.15, 'Djibouti'],
    ['FR', 'abudhabi-fr', 'French base Abu Dhabi', 'Naval & air base', 24.52, 54.40, 'United Arab Emirates'],
    // Germany
    ['DE', 'buechel', 'Büchel Air Base', 'Air base', 50.17, 7.06],
    ['DE', 'noervenich', 'Nörvenich Air Base', 'Air base', 50.83, 6.66],
    ['DE', 'wilhelmshaven', 'Wilhelmshaven Naval Base', 'Naval base', 53.52, 8.15],
    ['DE', 'kiel', 'Kiel Naval Base', 'Naval base', 54.35, 10.17],
    // Sweden
    ['SE', 'karlskrona', 'Karlskrona Naval Base', 'Naval base', 56.16, 15.59],
    ['SE', 'esrange-b', 'Esrange Space Center', 'Rocket range', 67.89, 21.10],
    // Russia
    ['RU', 'plesetsk-b', 'Plesetsk Cosmodrome', 'Space launch & missile test site', 62.93, 40.57],
    ['RU', 'vostochny', 'Vostochny Cosmodrome', 'Space launch base', 51.88, 128.33],
    ['RU', 'kapustinyar', 'Kapustin Yar', 'Missile test range', 48.59, 45.72],
    ['RU', 'severomorsk', 'Severomorsk', 'Naval base (Northern Fleet)', 69.07, 33.42],
    ['RU', 'gadzhiyevo', 'Gadzhiyevo', 'Naval base (submarines)', 69.25, 33.33],
    ['RU', 'vilyuchinsk', 'Vilyuchinsk', 'Naval base (submarines, Pacific)', 52.93, 158.40],
    ['RU', 'baltiysk', 'Baltiysk (Kaliningrad)', 'Naval base (Baltic Fleet)', 54.65, 19.90],
    ['RU', 'engels', 'Engels Air Base', 'Air base (bombers)', 51.48, 46.21],
    ['RU', 'baikonur-b', 'Baikonur Cosmodrome (leased)', 'Space launch base', 45.96, 63.31, 'Kazakhstan'],
    // China
    ['CN', 'jiuquan-b', 'Jiuquan Satellite Launch Center', 'Space launch & test centre', 40.96, 100.29],
    ['CN', 'taiyuan', 'Taiyuan Satellite Launch Center', 'Space launch centre', 38.85, 111.61],
    ['CN', 'xichang', 'Xichang Satellite Launch Center', 'Space launch centre', 28.25, 102.03],
    ['CN', 'wenchang-b', 'Wenchang Space Launch Site', 'Space launch site', 19.61, 110.95],
    ['CN', 'yulin', 'Yulin Naval Base (Hainan)', 'Naval base (submarines)', 18.22, 109.55],
    ['CN', 'qingdao', 'Qingdao Naval Base', 'Naval base', 36.07, 120.38],
    ['CN', 'djibouti-cn', 'PLA Support Base Djibouti', 'Naval support base', 11.59, 43.06, 'Djibouti'],
    // India
    ['IN', 'sriharikota-b', 'Satish Dhawan Space Centre', 'Space launch base', 13.72, 80.23],
    ['IN', 'kalam', 'Abdul Kalam Island', 'Missile test range', 20.76, 87.08],
    ['IN', 'karwar', 'INS Kadamba (Karwar)', 'Naval base', 14.81, 74.12],
    ['IN', 'vizag', 'Visakhapatnam (Eastern Naval Command)', 'Naval base', 17.69, 83.29],
    ['IN', 'ambala', 'Ambala Air Force Station', 'Air base', 30.37, 76.82],
    // Pakistan
    ['PK', 'sonmiani', 'Sonmiani Flight Test Range', 'Missile test range', 25.20, 66.75],
    ['PK', 'karachi-n', 'Karachi Naval Base', 'Naval base', 24.84, 66.98],
    ['PK', 'masroor', 'PAF Base Masroor', 'Air base', 24.89, 66.94],
    ['PK', 'mushaf', 'PAF Base Mushaf (Sargodha)', 'Air base', 32.05, 72.67],
    // North Korea
    ['KP', 'sohae-b', 'Sohae Satellite Launching Station', 'Launch site', 39.66, 124.71],
    ['KP', 'tonghae', 'Tonghae (Musudan-ri)', 'Launch site', 40.86, 129.67],
    ['KP', 'sinpo', 'Sinpo', 'Naval base / shipyard', 40.03, 128.18],
    ['KP', 'sunan', 'Pyongyang Sunan', 'Airfield (also used for launches)', 39.22, 125.67],
    // Iran
    ['IR', 'semnan-b', 'Semnan Space Centre', 'Space launch site', 35.23, 53.92],
    ['IR', 'shahroud', 'Shahroud Space Centre', 'Launch site', 36.20, 55.33],
    ['IR', 'bandarabbas', 'Bandar Abbas Naval Base', 'Naval base', 27.15, 56.22],
    ['IR', 'isfahan', 'Isfahan Air Base', 'Air base', 32.62, 51.70],
    // Israel
    ['IL', 'palmachim-b', 'Palmachim Air Base', 'Air base & launch site', 31.88, 34.68],
    ['IL', 'nevatim', 'Nevatim Air Base', 'Air base', 31.21, 35.01],
    ['IL', 'ramatdavid', 'Ramat David Air Base', 'Air base', 32.67, 35.18],
    ['IL', 'haifa', 'Haifa Naval Base', 'Naval base', 32.82, 35.00],
  ];
  window.LaunchBases = B.map(([cc, id, name, role, lat, lng, host]) => ({ cc, id: 'base:' + id, baseId: id, name, role, lat, lng, host: host || null, isBase: true }));
})();
