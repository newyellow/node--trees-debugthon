# Planner terrain estimate source audit

2026-10-24. Purpose: one chosen map point to coarse terrain elevation, not a survey, building/balcony height, sunlight or habitat inference.

- Documentation: https://open-meteo.com/en/docs/elevation-api
- Data: Copernicus DEM 2021 release GLO-90, 90 m resolution. Attribute Open-Meteo and Copernicus, DOI https://doi.org/10.5270/ESA-c5d3d65 . Provider documentation describes a free worldwide dataset; no claim of survey precision or full plant suitability validation.
- API: explicit user map click makes one anonymous GET to https://api.open-meteo.com/v1/elevation with latitude/longitude rounded to four decimals. No browser geolocation, photos, auth, credentials or persisted site data. UI discloses coordinate transmission.
- Real Chrome fetch from production planner origin: (25.033,121.5654) HTTP200 elevation[12]; (25.167,121.55) HTTP200 elevation[952]. These are two bounded CORS checks, not citywide accuracy validation.
- Adapter bounds Taipei study rectangle (24.9–25.3 N,121.4–121.7 E); finite typed inputs; one-value finite numeric response; plausible -500–9000 m;8s timeout; abort signal;32-memory-entry cache; at most one uncached request/second;429 cooldown respects Retry-After with at least60s; no automatic retry. Failure is unknown, never zero. User corrections and newer point/reset win over stale replies.
- Negative valid terrain must not be sent to Flora API which accepts nonnegative elevation. DEM estimates may differ from local site levels. API filtering against a single coarse elevation can exclude uncertain records and is not a scientific validation.
- Habitat: administrative policy grouping is not measured habitat. No verified river/Shezi polygons available; map choices must remain explicit user designation, not fabricated buffers.
- Sunlight: no obstruction/sky-view/building model available. Setting-based defaults are provisional assumptions with manual override, not coordinate-derived solar exposure measurements.
- Watering frequency is care availability, not observed soil moisture or species water demand. Do not convert it into a hard water_needs filter or promise a universal plant watering schedule.
