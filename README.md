# U.S. Municipal Districts

A TypeScript/Node.js package for identifying and working with **U.S. municipal political districts**, including city wards, city council districts, aldermanic districts, and other municipal district boundaries.

The package combines Census place data with municipal GIS sources to create a normalized, machine-readable registry of municipal district boundaries.

## Status

**Version:** `0.1.0`

This project is currently in active development.

The initial implementation focuses on:

* U.S. Census place identification
* ArcGIS discovery
* ArcGIS service inspection
* Political-boundary classification
* Candidate scoring and deduplication
* Canonical municipal source selection
* Municipal registry generation
* GeoJSON geometry generation
* Registry validation

The long-term goal is to provide a nationwide dataset that can be used by applications that need to determine a user's municipal political district from geographic coordinates or an address.

---

# Features

## Municipal district registry

The package maintains a normalized registry containing information such as:

* Census place FIPS
* municipality name
* state
* district/boundary type
* authoritative municipal source
* ArcGIS service information
* field mappings
* alternative sources
* generation metadata
* review status

Example:

```json
{
  "placeFips": "0477000",
  "city": "Tucson",
  "state": "AZ",
  "boundaryType": "ward",
  "source": {
    "sourceType": "arcgis",
    "url": "https://services1.arcgis.com/Ezk9fcjSUkeadg6u/arcgis/rest/services/Tree_Equity_Score__City_of_Tucson_2020_/FeatureServer/158",
    "itemId": "1e60a4c5892340579cbf16808fcfab45",
    "serviceType": "FeatureServer",
    "title": "Tree Equity Score (City of Tucson 2020)",
    "official": true,
    "verified": true,
    "fieldMapping": {
      "district": "WARD",
      "name": "NAME"
    }
  },
  "generatedFile": "geometry/0477000/ward.geojson"
}
```

---

# Architecture

The project is divided into two primary areas:

```text
src/
    Public package API
    Registry loading
    Registry types
    District lookup

generator/
    Census data generation
    ArcGIS discovery
    ArcGIS inspection
    Classification
    Deduplication
    Canonical source selection
    Registry generation
    GeoJSON generation
    Validation
```

The separation is intentional.

The `src/` directory contains the runtime package that applications consume.

The `generator/` directory contains the tools used to discover, evaluate, validate, and generate the package's data.

---

# Data Pipeline

The generator follows this general pipeline:

```text
Census Places
     │
     ▼
ArcGIS Discovery
     │
     ▼
ArcGIS Item Resolution
     │
     ▼
ArcGIS Inspection
     │
     ▼
Classification
     │
     ▼
Validation
     │
     ▼
Deduplication
     │
     ▼
Canonical Source Selection
     │
     ▼
Registry Generation
     │
     ▼
GeoJSON Generation
     │
     ▼
Registry Validation
```

This allows the project to distinguish between:

1. discovering a possible GIS source,
2. determining whether it actually represents a political district,
3. selecting the best source when multiple datasets exist, and
4. generating stable package data.

---

# Installation

Install the package from npm:

```bash
npm install @stephendewyer/us-municipal-districts
```

For development, clone the repository and install dependencies:

```bash
git clone https://github.com/stephendewyer/us-municipal-districts.git

cd us-municipal-districts

npm install
```

---

# Package API

The main package API is exported from:

```text
src/index.ts
```

The current public API includes functionality for:

* ArcGIS discovery
* candidate classification
* ArcGIS inspection
* candidate deduplication
* canonical source selection
* Census place lookup
* municipal registry access
* package types

The registry-related functions include:

```ts
loadRegistry()
findRegistryEntry()
findRegistryEntries()
```

For example:

```ts
import {
    findRegistryEntry
} from "@stephendewyer/us-municipal-districts";

const entry =
    findRegistryEntry({
        city: "Tucson",
        state: "AZ"
    });

console.log(entry);
```

A registry entry contains information about the municipality's available district boundary source.

---

# Census Places

The generator uses U.S. Census place information as the geographic foundation for municipality identification.

Each Census place contains information including:

```ts
interface CensusPlace {
    placeFips: string;
    city: string;
    state: string;
    stateFips?: string;
    placeName?: string;
    placeType?: string;
}
```

The generated Census place data is used to associate municipal GIS sources with stable Census place identifiers.

---

# Municipal District Types

The generator currently recognizes municipal district classifications including:

```ts
type DistrictType =
    | "ward"
    | "council-district"
    | "aldermanic-district"
    | "municipal-district";
```

The public registry uses `BoundaryType` for the final normalized boundary classification.

This distinction allows the generator's internal classification system to evolve independently from the public registry format.

---

# ArcGIS Discovery

Municipal district data is frequently published through ArcGIS Online and ArcGIS REST services.

The discovery system searches for potentially relevant municipal GIS datasets and produces discovery candidates.

Candidates may include:

* ArcGIS Feature Services
* ArcGIS Map Services
* municipal ward layers
* city council district layers
* aldermanic district layers
* other potential political boundary datasets

Discovery alone does not make a source authoritative.

Each candidate is subsequently inspected and classified.

---

# ArcGIS Inspection

Discovered ArcGIS sources are inspected to determine information such as:

* service type
* layer name
* service name
* geometry type
* fields
* district fields
* representative/name fields
* feature count
* GeoJSON support
* query support
* ArcGIS item information
* organization information

For example:

```ts
interface ArcGISInspection {
    url: string;
    isArcGIS: boolean;
    serviceType:
        | "FeatureServer"
        | "MapServer"
        | "unknown";
    isLayer: boolean;
    districtFields: string[];
    nameFields: string[];
    fieldSamples: ArcGISFieldSample[];
}
```

---

# Candidate Classification

Not every GIS layer discovered through an ArcGIS search represents a political boundary.

The classification system evaluates evidence indicating whether a candidate is:

* a political boundary
* a thematic dataset
* a Census dataset
* a parcel dataset
* a housing dataset
* a generic boundary
* an official municipal source

This prevents datasets such as tree equity, parcels, housing, or demographic data from automatically being treated as municipal district boundaries merely because they contain geographic polygons.

---

# Deduplication

Municipalities may publish the same district boundaries through multiple ArcGIS layers.

The generator therefore compares candidates using layer fingerprints.

Relevant information includes:

* title
* service name
* layer name
* geometry type
* field names
* district fields
* name fields
* feature count

Equivalent candidates are grouped before canonical source selection.

---

# Canonical Source Selection

When multiple valid sources exist, the generator selects a canonical source.

Selection considers factors such as:

* official municipal ownership
* political-boundary classification
* district fields
* geometry
* source quality
* candidate score
* inspection results

Alternative sources are retained in registry metadata rather than discarded.

For example:

```json
"alternatives": [
  {
    "url": "...",
    "itemId": "...",
    "title": "COT_wards",
    "serviceType": "FeatureServer",
    "official": false,
    "score": 138
  }
]
```

This makes it possible to audit and replace the canonical source later.

---

# Generated GeoJSON

After a canonical source has been selected, the generator can retrieve the municipal boundary layer and normalize it into GeoJSON.

Generated geometry is stored under:

```text
geometry/
    <placeFips>/
        <boundaryType>.geojson
```

For example:

```text
geometry/
    0477000/
        ward.geojson
```

The normalized GeoJSON contains standardized properties such as:

```json
{
  "placeFips": "0477000",
  "city": "Tucson",
  "state": "AZ",
  "boundaryType": "ward",
  "district": "1",
  "name": "..."
}
```

The original ArcGIS field names are mapped to normalized package fields using the registry's `fieldMapping`.

---

# Generator CLI

The generator can be run through the npm scripts defined in `package.json`.

## Generate Census places

```bash
npm run places
```

This downloads and processes the Census National Places Gazetteer and generates the package's Census place dataset.

---

## Discover municipal district sources

Run discovery for all available municipalities:

```bash
npm run discover
```

Run discovery for one municipality:

```bash
npm run discover -- --city Tucson --state AZ
```

Run discovery for a state:

```bash
npm run discover -- --state AZ
```

Run discovery for a specific Census place:

```bash
npm run discover -- --placeFips 0477000
```

Enable verbose output:

```bash
npm run discover -- --placeFips 0477000 --verbose
```

Discovery performs:

```text
ArcGIS search
    ↓
candidate inspection
    ↓
classification
    ↓
validation
    ↓
deduplication
    ↓
canonical selection
    ↓
registry generation
```

The resulting registry is written to:

```text
data/municipalities/registry.json
```

---

# Generate Geometry

After the registry has been generated, municipal GeoJSON geometry can be generated with:

```bash
npm run geometry
```

For a specific municipality:

```bash
npm run geometry -- --city Tucson --state AZ
```

For a specific Census place:

```bash
npm run geometry -- --placeFips 0477000
```

For a state:

```bash
npm run geometry -- --state AZ
```

The geometry generator retrieves the selected ArcGIS source and writes normalized GeoJSON to the package geometry directory.

Example:

```text
geometry/
    0477000/
        ward.geojson
```

---

# Validate the Registry

Validate the generated registry with:

```bash
npm run validate
```

Validation checks the structure of the generated registry and verifies required fields such as:

* version
* generated timestamp
* registry entries
* Census place FIPS
* city
* state
* boundary type
* source
* source URL
* source type
* verification information
* field mapping
* generated geometry path
* metadata
* alternatives

---

# Build

Compile the TypeScript source:

```bash
npm run build
```

The project uses TypeScript to produce the compiled package.

---

# Testing

Run the complete project check:

```bash
npm run check
```

The check currently performs:

```text
npm run build
    ↓
npm run typecheck
    ↓
npm test
```

You can also run the test suite directly:

```bash
npm test
```

Type-check the source:

```bash
npx tsc --noEmit
```

---

# Example Registry

A municipality entry has the following general structure:

```json
{
  "placeFips": "0477000",
  "city": "Tucson",
  "state": "AZ",
  "boundaryType": "ward",

  "source": {
    "sourceType": "arcgis",
    "url": "...",
    "itemId": "...",
    "serviceType": "FeatureServer",
    "title": "...",
    "official": true,
    "verified": true,

    "fieldMapping": {
      "district": "WARD",
      "name": "NAME"
    }
  },

  "generatedFile": "geometry/0477000/ward.geojson",

  "metadata": {
    "generatedAt": "...",
    "generatorVersion": "0.1.0",
    "alternatives": [],
    "requiresReview": false
  }
}
```

---

# Directory Structure

The current project is organized approximately as follows:

```text
us-municipal-districts/
│
├── data/
│   └── municipalities/
│       └── registry.json
│
├── geometry/
│   └── <placeFips>/
│       └── <boundaryType>.geojson
│
├── generator/
│   └── src/
│       ├── canonical.ts
│       ├── classify.ts
│       ├── cli.ts
│       ├── dedupe.ts
│       ├── discover.ts
│       ├── generateCensusPlaces.ts
│       ├── geometry.ts
│       ├── inspectArcGIS.ts
│       ├── registry.ts
│       ├── types.ts
│       └── validate.ts
│
├── src/
│   ├── index.ts
│   ├── registry.ts
│   └── types.ts
│
├── tests/
│   └── package/
│       └── registry.test.ts
│
├── package.json
├── tsconfig.json
└── README.md
```

---

# Design Principles

## 1. Use authoritative municipal data when possible

The project prefers official municipal GIS sources over third-party datasets.

## 2. Keep discovery separate from runtime data

The discovery system is responsible for finding and evaluating sources.

The published package should contain stable, validated data rather than requiring every consumer to perform ArcGIS searches.

## 3. Preserve alternatives

When multiple sources appear to represent the same district boundaries, alternatives are retained for auditing and future source replacement.

## 4. Normalize different municipal schemas

Different municipalities use different field names.

For example:

```text
WARD
WARD_NUM
WARDNO
DISTRICT
DISTRICT_ID
COUNCIL_DIST
```

The registry maps these municipal-specific fields into a consistent package-level representation.

## 5. Generate deterministic data

Registry entries are sorted deterministically so that repeated generation does not produce unnecessary Git diffs.

## 6. Make the data auditable

The registry retains information about:

* source URLs
* ArcGIS item IDs
* source titles
* verification
* field mappings
* alternative sources
* generator version
* review requirements

This is particularly important for political-boundary data, which can change after elections or municipal redistricting.

---

# Intended Use

This package is intended to support applications such as:

* voter-information applications
* civic technology
* election-information interfaces
* municipal information systems
* political campaign applications
* address-based political lookups
* geospatial applications
* civic data analysis

A typical application could use an address or latitude/longitude to determine:

```text
Address
   ↓
Geocode
   ↓
Latitude / Longitude
   ↓
Municipality
   ↓
Municipal district geometry
   ↓
Point-in-polygon lookup
   ↓
Ward / Council District
```

The package is designed to work particularly well alongside a geocoder and a geospatial library such as Turf.

---

# Accuracy and Verification

Municipal political boundaries can change.

Sources may also:

* move to a new ArcGIS service
* change layer IDs
* change field names
* change service URLs
* be replaced following redistricting
* become unavailable

For this reason, the package treats source discovery and verification as an ongoing data-generation process.

Entries that cannot be confidently verified can be marked for review rather than silently treated as authoritative.

---

# Contributing

Contributions are welcome.

Useful contributions include:

* identifying municipal GIS sources
* improving ArcGIS discovery
* improving political-boundary classification
* improving canonical-source scoring
* adding tests
* improving GeoJSON normalization
* identifying municipalities requiring manual review
* improving documentation
* improving geographic lookup performance

Before submitting changes, run:

```bash
npm run check
```

If you modify the generator, it is also useful to test the relevant pipeline manually:

```bash
npm run places
npm run discover -- --city Tucson --state AZ
npm run geometry -- --city Tucson --state AZ
npm run validate
```

---

# Roadmap

Potential future development includes:

* [ ] Nationwide municipal district coverage
* [ ] Automated scheduled source verification
* [ ] Automatic detection of changed ArcGIS services
* [ ] Redistricting/change detection
* [ ] Point-in-polygon municipal district lookup
* [ ] Latitude/longitude lookup API
* [ ] Address-to-district lookup
* [ ] Improved non-ArcGIS source discovery
* [ ] Support for additional municipal GIS platforms
* [ ] More municipal boundary types
* [ ] Automated quality scoring
* [ ] Expanded test coverage
* [ ] Published npm package data
* [ ] Versioned historical municipal boundaries


---

# Author

**Stephen Dewyer**

GitHub:

https://github.com/stephendewyer

Repository:

https://github.com/stephendewyer/us-municipal-districts

