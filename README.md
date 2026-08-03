# Contact Directory Review Package

Open `contact-directory.html` through a static web server (for example VS Code Live Server or `python -m http.server`) so JSON fetches work.

## Included changes
- `officer.pin` is the unique selection and history identifier.
- `officer.email` remains displayed and copied by individual and bulk email controls.
- Search includes PIN.
- `service-history.json` is read-only static data.
- A responsive profile service-history modal is included.

## Review caveat
This package contains a five-contact representative fixture, not the full original contact dataset. Apply the same `officer.pin` addition to each original record before production integration.
