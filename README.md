# U.S. Municipal Districts

A TypeScript/Node.js package and data-generation pipeline for discovering, validating, and resolving **U.S. municipal wards and city council district boundaries**.

The project is designed to provide a reliable nationwide source of municipal political-division geometry that can be queried by address or geographic coordinates.

> **Status:** Active development — currently building and validating the nationwide discovery pipeline.

## Overview

Municipal political boundaries are difficult to obtain consistently across the United States. Cities and municipalities publish their ward and council-district data using different names, schemas, geographic services, and data providers.

`@stephendewyer/us-municipal-districts` is being developed to solve this problem by combining:

* U.S. Census municipal-place data
* ArcGIS service discovery
* Layer inspection
* Political-boundary classification
* Attribute validation
* Geographic validation
* Candidate ranking
* Equivalent-layer detection
* Canonical-source selection
* Normalized GeoJSON generation
* Registry-based data management
* Automated validation and testing

The goal is to turn heterogeneous municipal GIS data into a consistent dataset that software applications can use to determine the municipal district associated with a geographic location.

## Project Goals

The long-term goal is to support queries such as:

```ts
const district = await findMunicipalDistrict({
  latitude: 32.2226,
  longitude: -110.9747
});
```

and return information such as:

```ts
{
  city: "Tucson",
  state: "AZ",
  districtType: "ward",
  district: "6"
}
```

The underlying data-generation system is intended to identify the appropriate municipal boundary source automatically rather than requiring every municipality to be configured manually.

## Current Coverage

The project is currently being developed against real municipal GIS data, including:

* **Tucson, Arizona** — municipal wards
* **Phoenix, Arizona** — city council districts
* **Chicago, Illinois** — current and historical ward layers

These municipalities are being used as representative test cases for different discovery, temporal, geographic, and data-source scenarios.

The current Census-place generation pipeline has successfully generated municipal records for Tucson and Phoenix.

## Architecture

The data pipeline follows this general process:

```text
Census Places
     │
     ▼
Municipality Discovery
     │
     ▼
ArcGIS Candidate Discovery
     │
     ▼
Layer Inspection
     │
     ▼
Classification
     │
     ▼
Attribute Validation
     │
     ▼
Geographic Validation
     │
     ▼
Candidate Ranking
     │
     ▼
Equivalent Layer Detection
     │
     ▼
Canonical Source Selection
     │
     ▼
Geometry Generation
     │
     ▼
Registry
     │
     ▼
Final Validation
```

### 1. Census Places

The project starts with Census municipal-place data to establish the municipalities that need to be resolved.

Each municipality is represented using information such as:

* Place FIPS
* City name
* State abbreviation
* State FIPS
* Census place metadata

### 2. Municipality Discovery

For each municipality, the discovery system searches for potential GIS datasets containing municipal political boundaries.

The discovery process uses multiple search strategies and candidate-scoring criteria rather than assuming that municipalities use the same terminology.

For example, municipal boundaries may be described as:

* Wards
* City wards
* Council districts
* City council districts
* Aldermanic districts
* Municipal districts
* Political districts

### 3. ArcGIS Inspection

Potential ArcGIS services are inspected to determine whether they actually contain usable boundary layers.

Inspection can identify:

* FeatureServer vs. MapServer
* Layer IDs
* Geometry type
* District fields
* Name fields
* Feature counts
* Object IDs
* Spatial reference
* GeoJSON support
* Pagination support
* ArcGIS item metadata
* Organization and ownership information
* Tags and type keywords

This prevents a search result from being treated as a valid municipal boundary simply because its title contains words such as "ward" or "district."

### 4. Classification

Candidates are classified according to the type of dataset they represent.

The pipeline distinguishes political boundary datasets from unrelated datasets such as:

* Housing datasets
* Parcel datasets
* Census datasets
* Crime or incident datasets
* Transit datasets
* School districts
* Other thematic datasets

A dataset can contain the word "ward" or "district" without actually representing municipal political boundaries, so classification is an important part of the discovery process.

### 5. Attribute Validation

Candidate layers are examined for evidence that their attributes actually represent political districts.

Validation considers:

* District fields
* District field names and aliases
* Number of distinct district values
* District-value patterns
* Polygon geometry
* Sample features
* Political-boundary classification

For example, a field named `WARD` containing multiple ward values is substantially stronger evidence than a generic field containing unrelated geographic information.

### 6. Geographic Validation

A candidate can also be compared geographically with the Census municipality geometry.

The geographic validation system evaluates:

* Municipality area
* Candidate area
* Intersection area
* Percentage of municipality covered
* Percentage of candidate contained within the municipality
* Number of candidate features
* Valid candidate geometry

Candidates are categorized as:

* `strong-match`
* `probable-match`
* `weak-match`
* `no-match`
* `invalid`

This helps prevent an otherwise convincing GIS layer from being selected when it represents the wrong geography.

### 7. Candidate Ranking

Valid candidates receive relevance scores based on multiple signals, including:

* Political-boundary validation
* Official municipal ownership
* District type
* District fields
* Polygon geometry
* Attribute validation confidence
* Number of district values
* District naming patterns
* Geographic match
* Municipality metadata
* Temporal information

Negative evidence is also considered. For example, datasets primarily representing housing, parcels, or other thematic information can be rejected or substantially penalized even if they contain ward-related attributes.

### 8. Equivalent Layer Detection

Municipalities can publish the same boundary data through multiple ArcGIS services or publish different temporal versions of the same boundaries.

The project groups equivalent candidates so that multiple copies of the same underlying boundary system do not become competing municipal sources.

For example, current and historical Chicago ward layers can be recognized as different versions of the same municipal ward system.

### 9. Canonical Source Selection

Once equivalent candidates have been identified, the pipeline selects a canonical source.

Canonical selection considers:

1. Temporal status
2. Whether the source is boundary-native
3. Official municipal provenance
4. Existing candidate ranking
5. Geographic and attribute evidence

This is intentionally different from simply selecting the candidate with the highest raw discovery score.

For example, the Phoenix tests verify that a boundary-native **Council Districts** dataset is selected over a derived **Eviction Filings** dataset even when raw candidate scores alone could produce a different result.

Canonical selection is also deterministic and independent of the order in which discovery results are returned.

## Generated Geometry

Validated municipal boundary sources can be converted into normalized GeoJSON.

Generated geometry is stored under:

```text
data/municipalities/geometry/
```

For example:

```text
data/
└── municipalities/
    └── geometry/
        └── 0477000/
            └── ward.geojson
```

The generated GeoJSON contains normalized municipal district features with consistent district information.

Both `Polygon` and `MultiPolygon` geometries are supported.

The geometry-generation pipeline also handles ArcGIS-specific geometry concerns such as:

* Rings
* Holes
* Disjoint polygons
* Ring ordering
* Unclosed rings
* Zero-area rings
* MultiPolygon construction

## Municipal Registry

The project maintains a registry describing the canonical municipal district source.

A registry entry contains information such as:

```json
{
  "placeFips": "0477000",
  "city": "Tucson",
  "state": "AZ",
  "boundaryType": "ward",
  "source": {
    "title": "Tree Equity Score (City of Tucson 2020)"
  },
  "generatedFile": "geometry/0477000/ward.geojson",
  "fieldMapping": {
    "district": "WARD",
    "name": "NAME"
  }
}
```

The registry provides a stable interface between external GIS sources and the normalized data distributed by this package.

## Usage

### Commands

```bash
# Download the Census National Places Gazetteer
# and generate the Census places data
npm run places

# Discover municipal district boundary sources
npm run discover

# Discover a specific municipality
npm run discover -- --city Tucson --state AZ

# Discover all municipalities in a state
npm run discover -- --state AZ

# Discover a specific Census place
npm run discover -- --placeFips 0477000

# Discover with detailed output
npm run discover -- --placeFips 0477000 --verbose

# Generate the municipal registry
npm run generate

# Generate the registry for a specific municipality
npm run generate -- --city Tucson --state AZ

# Generate the registry for all municipalities in a state
npm run generate -- --state AZ

# Generate the registry for a specific Census place
npm run generate -- --placeFips 0477000

# Generate normalized GeoJSON geometry
npm run geometry

# Generate geometry for a specific municipality
npm run geometry -- --city Tucson --state AZ

# Validate the municipal registry
npm run validate

# Validate a specific registry file
npm run validate -- --registry data/municipalities/registry.json
```

### Command descriptions

#### `places`

Downloads the Census National Places Gazetteer and generates the Census municipality/place data used by the discovery pipeline.

#### `discover`

Searches for municipal district boundary sources, inspects discovered ArcGIS layers, classifies candidates, detects equivalent layers, selects canonical sources, and writes the municipal registry.

#### `generate`

Generates or updates the municipal registry using the discovered and selected canonical municipal district sources.

#### `geometry`

Downloads and normalizes the GeoJSON geometry for registry entries and writes the resulting geometry files under `data/geometry/`.

#### `validate`

Validates the generated municipal registry and its entries.

### Discovery and generation options

The `discover` and `generate` commands support the following filters:

```text
--city <city>
    Process only municipalities matching this city name.

--state <state>
    Process only municipalities in this state.

--placeFips <fips>
    Process only the specified Census place.

--review
    Enable manual-review handling.

--verbose
    Print detailed discovery information.
```

For example:

```bash
npm run discover -- --city Tucson --state AZ
npm run generate -- --city Tucson --state AZ
```


## Technology

The project is built with:

* TypeScript
* Node.js 20+
* Turf.js
* ArcGIS REST services
* U.S. Census geographic data
* GeoJSON
* Shapefile processing
* Node's built-in test runner
* `tsx`

### Dependencies

Key geographic dependencies include:

* `@turf/turf`
* `@turf/boolean-point-in-polygon`
* `@turf/helpers`
* `shapefile`
* `adm-zip`

## Repository Structure

The repository is organized approximately as follows:

```text
.
├── data/
│   └── municipalities/
│       └── geometry/
│
├── generator/
│   └── src/
│       ├── cli.ts
│       ├── discovery
│       ├── inspection
│       ├── classification
│       ├── validation
│       ├── ranking
│       ├── canonical
│       ├── geometry
│       └── registry
│
├── src/
│   └── package source
│
├── tests/
│   ├── generator/
│   └── integration/
│
├── package.json
├── tsconfig.json
└── README.md
```

The exact implementation is evolving as the nationwide discovery system develops.

## Design Principles

### Accuracy over simple keyword matching

A GIS layer should not be considered a municipal political boundary merely because its title contains "ward" or "district."

The pipeline combines metadata, fields, attributes, geometry, geographic coverage, provenance, and temporal evidence.

### Deterministic results

Given the same candidate data, canonical-source selection should produce the same result regardless of discovery order.

This is explicitly tested.

### Prefer authoritative sources

Official municipal GIS sources receive additional consideration when selecting canonical datasets.

### Preserve alternatives

Selecting a canonical source does not discard other valid sources. Equivalent and alternative candidates can be retained for auditing, review, and future source changes.

### Separate discovery from generated data

External GIS services are treated as discovery sources. Generated GeoJSON provides a normalized representation that applications can consume consistently.

### Validate geography, not just metadata

A candidate that looks correct in metadata can still represent the wrong geographic area. Geographic overlap and containment therefore form an independent validation layer.

## Current Development Status

This project is in active development.

The discovery and validation architecture is currently being expanded from a small set of real municipalities toward nationwide coverage.

Current work includes improving:

* Search-query discovery
* Candidate ranking
* Municipal-source detection
* ArcGIS service inspection
* Geographic validation
* Temporal source selection
* Equivalent-layer detection
* Canonical source selection
* Automated geometry generation
* Nationwide municipality coverage

The immediate objective is to make the discovery pipeline robust enough to process a large number of U.S. municipalities with minimal manual intervention.

## Package

The npm package is:

```text
@stephendewyer/us-municipal-districts
```

Current version:

```text
0.1.0
```

The package is intended to provide a normalized, reusable source of U.S. municipal district information for applications that need to associate geographic locations with municipal political divisions.

## Author

Stephen Dewyer

GitHub:

https://github.com/stephendewyer/us-municipal-districts
