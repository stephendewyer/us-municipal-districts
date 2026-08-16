a nation-wide search for municipal districts in the U.S. using geocoordinates

# Build npm package
npm run build

# Run tests
npm test

# Run everything
npm run check

# Search for potential municipal datasets
npm run discover

# Build municipal GeoJSON
npm run generate

                    ┌──────────────────────────┐
                    │       City Registry      │
                    │ city / state / FIPS      │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │       Discovery          │
                    │ Find possible GIS URLs   │
                    │ ArcGIS / other sources   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │     inspectArcGIS()      │
                    │                          │
                    │ • FeatureServer?         │
                    │ • MapServer?             │
                    │ • Layer?                 │
                    │ • Polygon?               │
                    │ • District fields?       │
                    │ • Name fields?           │
                    │ • Geometry               │
                    │ • Boundary likelihood   │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │     scoreCandidate()     │
                    │                          │
                    │ + ward/district terms   │
                    │ + polygon               │
                    │ + ArcGIS service        │
                    │ + district fields       │
                    │ + boundary likelihood   │
                    │                          │
                    │ - housing               │
                    │ - parcels               │
                    │ - census blocks          │
                    │ - crime                 │
                    │ - zoning                │
                    └────────────┬─────────────┘
                                 │
                       score / review decision
                                 │
                    ┌────────────┴─────────────┐
                    │                          │
                High score                Low score
                    │                          │
                    ▼                          ▼
               Candidate                 Manual review
                    │
                    ▼
             Fetch boundary data
                    │
                    ▼
              GeoJSON source
                    │
                    ▼
           normalizeGeoJSON()
                    │
                    │
                    ├── polygon validation
                    ├── district extraction
                    ├── name extraction
                    ├── ID extraction
                    ├── add city/state/FIPS
                    ├── add boundaryType
                    └── deterministic sorting
                    │
                    ▼
                 validate()
                    │
                    ▼
             Generated dataset
                    │
                    ▼
              Registry / package