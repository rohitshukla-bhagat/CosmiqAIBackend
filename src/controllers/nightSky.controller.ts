import { Request, Response } from "express";
import * as Astronomy from "astronomy-engine";

function getPlanetsData(lat: number, lon: number) {
  const date = new Date();
  const observer = new Astronomy.Observer(lat, lon, 0);
  const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

  return planets.map(planetName => {
    const body = (Astronomy.Body as any)[planetName];
    const equatorial = Astronomy.Equator(body, date, observer, true, true);
    const hor = Astronomy.Horizon(date, observer, equatorial.ra, equatorial.dec, 'normal');

    let rise_time = null, set_time = null;
    try {
      const rise = Astronomy.SearchRiseSet(body, observer, +1, date, 1);
      const set  = Astronomy.SearchRiseSet(body, observer, -1, date, 1);
      if (rise) rise_time = rise.date.toTimeString().slice(0, 5);
      if (set)  set_time  = set.date.toTimeString().slice(0, 5);
    } catch(e) {}

    let magnitude = null;
    try {
      magnitude = Math.round(Astronomy.Illumination(body, date).mag * 10) / 10;
    } catch(e) {}

    return {
      name: planetName,
      altitude: Math.round(hor.altitude * 10) / 10,
      azimuth: Math.round(hor.azimuth * 10) / 10,
      above_horizon: hor.altitude > 0,
      rise_time,
      set_time,
      magnitude,
    };
  });
}

export const getNightSkyData = async (req: Request, res: Response) => {
  try {
    const { lat, lon, date, tz } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const currentDate = date || new Date().toISOString().split('T')[0];
    const timeZone = tz || '5.5';

    const moonSunUrl = `https://aa.usno.navy.mil/api/rstt/oneday?date=${currentDate}&coords=${lat},${lon}&tz=${timeZone}`;
    const issUrl = `https://iss-api.polluxlabs.io/iss-pass?lat=${lat}&lon=${lon}`;

    const [moonSunRes, issRes] = await Promise.all([
      fetch(moonSunUrl).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(issUrl).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);

    // Planets — calculated locally, no API needed
    const planetsData = getPlanetsData(Number(lat), Number(lon));

    return res.json({
      moonSunData: moonSunRes,
      planetsData,
      issData: issRes
    });

  } catch (error) {
    console.error("Error fetching Night Sky data:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};