# U.S. Municipal Districts

A TypeScript/Node.js package for **discovering, validating, normalizing, and generating geographic data for municipal political districts across the United States**.

The project is designed to answer questions such as:

* Which municipal ward contains this address?
* Which city council district contains these coordinates?
* What are the boundaries of a municipality's aldermanic districts?
* Which official geographic dataset represents a city's municipal districts?
* Where can normalized GeoJSON boundary data for those districts be found?

The project focuses on municipal political divisions including:

* Wards
* City council districts
* Council districts
* Aldermanic districts
* Other municipal political districts

The goal is to provide a reusable geographic-data foundation for applications that need to resolve municipal political representation from an address or geographic coordinate.

---

## Status

This project is **under active development**.

The current implementation includes:

* U.S. Census place discovery
* Municipality identification
* ArcGIS Online discovery
* ArcGIS REST FeatureServer and MapServer discovery
* Multi-tier candidate searching
* ArcGIS layer inspection
* Political-boundary classification
* Thematic and derived-dataset rejection
* District-field detection
* District-value extraction
* Expected district-count validation
* Municipality metadata validation
* Municipality geography validation
* Polygon geometry validation
* 0–100 validation confidence scoring
* Candidate ranking
* Equivalent-layer detection
* Canonical-source selection
* Temporal-status detection
* ArcGIS geometry conversion to GeoJSON
* Census place geometry generation
* Generated municipal geometry and registry data
* Automated unit and integration testing

The discovery pipeline has been exercised against municipalities including **Tucson, Phoenix, Chicago, Milwaukee, Austin, and Philadelphia**, with particular validation work around Tucson ward boundaries and Phoenix city council districts.

The package API and generated data format are still evolving and should not yet be considered stable.

---

# Why this project?

Municipal political boundaries are surprisingly difficult to obtain programmatically at national scale.

Unlike congressional and state legislative districts, municipal districts are commonly published independently by individual cities. Municipal governments use different:

* GIS platforms
* naming conventions
* service structures
* field names
* publication practices
* geographic data formats
* ArcGIS organizations and servers

A municipality may publish:

* a dedicated political-boundary FeatureServer
* a MapServer containing multiple layers
* multiple representations of the same boundary system
* current and historical boundary datasets
* political boundaries alongside unrelated thematic datasets
* derived datasets that contain district identifiers without representing district boundaries

A simple keyword search is therefore not sufficient.

This project treats municipal district discovery as a **data validation and source-selection problem**, rather than simply a search problem.

---

# Architecture

The discovery pipeline follows this general process:

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

The important architectural principle is that **discovery, validation, ranking, and canonical selection are separate stages**.

A search result is not considered authoritative simply because its name looks correct.

---

## 1. Census Places

Census place data provides the initial nationwide municipality inventory and stable geographic identifiers.

Each municipality is associated with a Census place GEOID/FIPS identifier that becomes the stable geographic key used throughout the pipeline.

Municipality records include information such as:

* city name
* state
* state abbreviation
* place FIPS/GEOID
* municipality geometry

---

## 2. Municipality Discovery

The project identifies municipalities from Census geographic data and uses the resulting place information as the foundation for district discovery.

The place identifier is particularly important because municipal names are not globally unique.

For example:

```text
Phoenix, AZ
```

is represented by its Census place identifier rather than relying on the city name alone.

---

## 3. ArcGIS Candidate Discovery

The project searches ArcGIS sources for potential municipal district datasets.

Search results are **not automatically accepted**.

Discovery uses multiple search strategies and can also discover municipal ArcGIS Server roots.

Server discovery is particularly useful for municipalities that publish large numbers of services where general ArcGIS Online search can produce noisy results.

The discovery process can encounter multiple representations of the same underlying boundary system, such as:

```text
FeatureServer/0
MapServer/0
FeatureServer/1
MapServer/1
```

These candidates are retained during discovery so that they can be compared and evaluated later.

---

## 4. Layer Inspection

Potential ArcGIS services are inspected to determine their actual structure.

Inspection can identify:

* FeatureServer vs. MapServer
* layer IDs
* layer names
* service names
* geometry type
* fields
* district fields
* name fields
* feature counts
* distinct district values
* GeoJSON support
* pagination support
* query support
* ownership and organization metadata
* tags
* type keywords
* ArcGIS item identifiers
* service item identifiers

Inspection prevents a search result from being treated as a political-boundary source merely because its title contains a relevant keyword.

---

# 5. Classification

Candidates are classified according to what the dataset actually represents.

Political identity can come from terms such as:

```text
ward
council district
city council
aldermanic
municipal district
electoral district
voting district
political district
legislative district
```

The classifier also recognizes thematic datasets such as:

```text
parks
golf
transit
roads
libraries
evictions
housing
water
schools
airports
parcels
```

The critical distinction is between **dataset identity** and **attributes contained in the dataset**.

A field named:

```text
WARD
```

does not automatically mean that the layer represents ward boundaries.

For example:

```text
Golf Courses
```

may contain a `WARD` field because each golf course is associated with a ward.

That does not make the golf-course layer a ward-boundary dataset.

Similarly:

```text
Eviction Filings by Council Districts
```

may contain all eight Phoenix council-district values, but it is still an eviction dataset rather than a council-boundary dataset.

Derived datasets are therefore treated separately from boundary-native datasets.

---

# 6. Attribute Validation

Candidates that appear to represent municipal districts are validated using the actual attributes in the layer.

Validation can determine:

* which field identifies districts
* how many distinct district values exist
* whether district values follow a recognizable pattern
* whether the layer contains the expected number of districts
* whether expected district values are missing
* whether the layer appears complete
* whether district values contain unexpected mixed types

Where an independently known district count is available, it is used as an external validation signal.

The candidate does **not** define its own expected district count.

For example, Phoenix has eight city council districts. A candidate containing:

```text
1
2
3
4
5
6
7
8
```

can therefore be checked against an independent expected count of eight.

This helps distinguish a complete political-boundary dataset from a partial or derived dataset.

### Validation confidence

Political-boundary validation uses a **0–100 confidence scale**.

The current ranking policy is:

| Validation confidence | Treatment                         |
| --------------------: | --------------------------------- |
|                `< 60` | Hard rejection                    |
|               `60–69` | Accepted without confidence bonus |
|               `70–79` | Ranking bonus                     |
|               `80–89` | Larger ranking bonus              |
|              `90–100` | Highest confidence bonus          |

Validation confidence is distinct from source authority and temporal status.

---

# 7. Geographic Validation

Attribute validation alone is not enough.

A candidate must also make geographic sense for the municipality.

The project can compare candidate geometry against municipality geography to determine whether the candidate:

* overlaps the municipality appropriately
* represents polygonal boundaries
* appears to cover the expected municipal area
* is likely associated with a different jurisdiction

Geographic validation is used as a ranking signal rather than being the sole eligibility criterion.

A strong municipality geography match substantially increases a candidate's ranking.

---

# 8. Candidate Ranking

Candidates that survive validation are ranked using multiple independent signals.

Ranking can incorporate:

* official municipal provenance
* political identity
* boundary-native characteristics
* geometry quality
* district-field quality
* validation confidence
* expected district-count agreement
* municipality geography relationship
* source provenance
* temporal status
* review requirements

Ranking is deliberately performed **after discovery and validation** rather than relying solely on search relevance.

This allows a noisy ArcGIS search result to be inspected and rejected rather than automatically becoming the selected source.

---

# 9. Query Deduplication

ArcGIS municipalities frequently expose the same logical layer through multiple service representations.

For example:

```text
https://maps.phoenix.gov/.../Council_Districts/MapServer/0

https://services.arcgis.com/.../Council_Districts/FeatureServer/0
```

These may represent the same underlying boundary system even though their URLs, hosts, and ArcGIS item metadata differ.

The discovery pipeline therefore groups equivalent query targets before performing expensive operations such as:

* querying distinct district values
* querying feature counts
* downloading geometry

This prevents equivalent FeatureServer and MapServer representations from causing redundant external requests.

The query identity uses municipality identity, service identity, and layer identity rather than relying exclusively on ArcGIS item IDs.

---

# 10. Equivalent Layer Detection

Municipalities often publish multiple layers representing essentially the same boundary system.

For example, Phoenix exposes multiple representations of its council districts.

The project groups equivalent candidates so that multiple representations of the same boundary system do not become competing canonical datasets.

Equivalence analysis considers characteristics such as:

* dataset identity
* service identity
* layer identity
* temporal dataset family
* field structure
* district-field structure
* name-field structure
* geometry characteristics

This stage is separate from query deduplication.

**Query deduplication** prevents redundant expensive queries.

**Equivalence detection** determines which successfully validated candidates represent the same logical dataset.

---

# 11. Canonical Source Selection

After equivalent candidates have been grouped, the project selects a canonical source for each municipality and district type.

Canonical selection considers factors such as:

* source role
* official municipal provenance
* validation confidence
* temporal status
* geography validation
* service type
* district-field quality
* review status
* equivalence relationships

The canonical source retains information about alternative representations rather than discarding them.

Canonical metadata can include:

* source URL
* ArcGIS item ID
* title
* municipality
* state
* place FIPS
* district type
* service type
* official municipal-source status
* source role
* temporal status
* district field
* name field
* geometry type
* validation confidence
* selection reasons
* alternative sources
* review status

---

# Example: Phoenix

Phoenix provides a useful example of why the validation pipeline is necessary.

The municipal source:

```text
Council Districts and Members
```

is identified as a political boundary dataset with:

```text
District field: DISTRICT
Distinct districts: 1–8
Expected district count: 8
Complete district coverage: true
Geometry: Polygon
Official municipal source: true
```

The project also discovers a FeatureServer representation of the same council-district layer.

The two representations can be recognized as equivalent, while the municipal MapServer representation can be selected as the canonical source.

A separate dataset:

```text
Eviction Filings by Council Districts
```

also contains the eight council-district values.

However, it is classified as a derived/thematic dataset rather than a political-boundary dataset.

This demonstrates why **district values alone are insufficient** to establish that a dataset represents political boundaries.

Another discovered dataset:

```text
CityCouncilDistricts
```

contains:

```text
1–8
ACACIA
BARREL
CACTUS
CHOLLA
...
```

Because its district field contains mixed numeric and named values and does not match the expected eight-district structure, it is rejected.

---

# Example: Tucson

Tucson provides another important validation case.

The city publishes municipal ward boundary data through ArcGIS, including multiple representations and historical datasets.

The project can distinguish:

```text
City of Tucson Ward Boundaries
```

from unrelated thematic datasets that happen to contain ward attributes.

Historical datasets are also tracked separately from current or undated sources.

For example:

```text
Tucson Wards 2022
```

can be identified as:

```text
sourceRole: authoritative
temporalStatus: historical
districtType: ward
```

rather than silently assuming that every ward dataset represents the current boundaries.

---

# Temporal Status

Political boundary identity and temporal status are intentionally separate concepts.

A source can be:

```text
authoritative + historical
```

or:

```text
authoritative + current
```

Temporal status currently includes:

```text
current
historical
undated
```

An explicit year in the dataset identity is used as evidence when determining temporal status.

The project deliberately does **not** assume that an undated dataset is current.

This distinction is important because source authority and boundary currency are different questions.

---

# Source Roles

Source role describes the role a dataset plays in the discovery process.

Current roles include:

```text
authoritative
derived
duplicate
unknown
```

A historical dataset is **not** itself a source role.

For example:

```text
sourceRole: authoritative
temporalStatus: historical
```

is a valid classification.

This allows the project to preserve both source authority and temporal information.

---

# GeoJSON Generation

Once a canonical source has been selected, ArcGIS geometry can be queried and normalized into GeoJSON.

The geometry pipeline handles ArcGIS polygon structures including:

* Polygon
* MultiPolygon
* interior rings / holes
* multiple exterior rings
* spatial-reference normalization

The resulting geometry can be stored as standard GeoJSON suitable for:

* Turf.js spatial queries
* web maps
* address resolution
* point-in-polygon operations
* downstream geographic applications

---

# Census Place Geometry

The project also generates municipality geometry from Census geographic data.

This provides a consistent geographic reference for:

* municipality validation
* candidate geography validation
* spatial relationships
* downstream geographic operations

Generated municipality geometry is stored alongside municipal district geometry.

---

# Registry

Generated municipal boundary datasets are associated with registry information connecting municipality metadata, district types, geometry files, and attribute fields.

A registry entry can look like:

```json
{
  "placeFips": "0477000",
  "boundaryType": "ward",
  "generatedFile": "geometry/0477000/ward.geojson",
  "district": "WARD",
  "name": "NAME"
}
```

The registry provides a stable connection between:

```text
Municipality
    ↓
District type
    ↓
Canonical source
    ↓
Generated GeoJSON
    ↓
District/name attributes
```

The generated registry format is still evolving as the project moves toward a stable package API.

---

# Installation

```bash
npm install @stephendewyer/us-municipal-districts
```

The project is currently under active development and the public package/API surface may change before the first stable release.

---

# Development Requirements

* Node.js 20+
* npm
* TypeScript

The project uses TypeScript and Node.js, with geographic processing based on:

* GeoJSON
* Turf.js
* U.S. Census geographic data
* ArcGIS REST services
* ArcGIS Online

---

# Development Commands

## Build

```bash
npm run build
```

## Type checking

```bash
npm run typecheck
```

## Run the test suite

```bash
npm test
```

## Run the complete check

```bash
npm run check
```

The complete check runs the build, test type checking, and automated tests.

## Generate Census place data

```bash
npm run places
```

## Discover municipal district sources

The CLI accepts a municipality and state abbreviation.

For example:

```bash
npm run discover -- --city Tucson --state AZ
```

or:

```bash
npm run discover -- --city Phoenix --state AZ
```

The state should currently be supplied as a two-letter abbreviation.

## Inspect an ArcGIS source

```bash
npm run inspect
```

## Generate geometry

```bash
npm run geometry
```

## Generate datasets

```bash
npm run generate
```

## Validate generated data

```bash
npm run validate
```

## Integration tests

Integration tests are separated from the normal unit-test suite because they can perform live discovery against external services.

Run the integration suite with:

```bash
npm run test:integration
```

A targeted municipality can be selected with:

```powershell
$env:DISCOVERY_CITY="Phoenix"
$env:DISCOVERY_STATE="AZ"

npm run test:integration
```

Nationwide discovery integration testing can be enabled with:

```powershell
$env:RUN_NATIONWIDE_DISCOVERY="1"

npm run test:integration
```

Live discovery tests are intentionally opt-in so that the normal test suite remains deterministic and fast.

---

# Testing Strategy

The project uses several layers of testing.

## Unit Tests

Unit tests cover individual components of the pipeline, including:

* discovery
* ArcGIS inspection
* classification
* district-field detection
* distinct district-value extraction
* candidate validation
* geometry conversion
* ranking
* canonical selection
* equivalence grouping
* registry generation

## Pipeline Tests

Pipeline tests exercise the interaction between:

```text
Discovery
    ↓
Inspection
    ↓
Classification
    ↓
Validation
    ↓
Ranking
    ↓
Equivalence
    ↓
Canonical selection
```

These tests are especially important for preventing false positives where a thematic dataset resembles a political-boundary dataset.

## Integration Tests

Integration tests exercise the live discovery pipeline against real municipal GIS sources.

Example municipalities include:

* Tucson
* Phoenix
* Chicago
* Milwaukee
* Austin
* Philadelphia

Because external GIS services can change or become unavailable, live integration tests are opt-in rather than part of the default unit-test run.

---

# Data Provenance

The project prioritizes official municipal GIS sources whenever possible.

An official municipal source may be identified through:

* municipal provenance from discovery
* government domains
* ArcGIS organization metadata
* municipal organization identity
* known municipal GIS endpoints

Source provenance is preserved through the discovery and canonical-selection pipeline rather than being discarded after geometry extraction.

This is important because the project is intended to provide not only geometry, but also a traceable explanation of where that geometry came from.

---

# Design Principles

## Prefer Authoritative Boundary Datasets

A dataset explicitly representing municipal political boundaries should generally be preferred over a derived dataset containing political attributes.

## Validate Independently

The project avoids allowing a candidate dataset to define its own validity.

For example, the number of districts observed in a candidate should not automatically become the expected number of districts.

Where possible, expected district counts come from an independent municipal or authoritative source.

## Separate Identity from Attributes

A field such as:

```text
WARD
```

does not automatically mean that the layer is a ward-boundary dataset.

The identity of the dataset is considered separately from its attributes.

## Separate Source Role from Temporal Status

Historical status is not treated as a source role.

A source can simultaneously be:

```text
authoritative
```

and:

```text
historical
```

This prevents temporal information from being confused with source provenance.

## Preserve Historical Information

Older political-boundary datasets are not silently treated as current.

Historical and current source information should remain distinguishable throughout the pipeline.

## Deduplicate Expensive Queries

Multiple ArcGIS representations of the same service should not trigger unnecessary repeated requests for:

* district values
* feature counts
* geometry

Query-level deduplication occurs before these expensive operations.

## Preserve Equivalent Sources

Equivalent FeatureServer and MapServer representations should be recognized as alternative representations of the same logical boundary system rather than treated as unrelated datasets.

## Prefer Deterministic Validation Over Search Relevance

Search engines and ArcGIS search results are useful for discovering candidates, but they are not sufficient for determining whether a dataset is correct.

The project therefore uses:

```text
Discovery
→ Inspection
→ Classification
→ Validation
→ Geographic Validation
→ Ranking
→ Equivalence
→ Canonical Selection
```

rather than accepting the first plausible search result.

---

# Project Structure

A simplified view of the repository:

```text
generator/
├── src/
│   ├── cli.ts
│   ├── discover.ts
│   ├── pipeline.ts
│   ├── classify.ts
│   ├── validateCandidate.ts
│   ├── expectedDistrictCount.ts
│   ├── rank.ts
│   ├── canonical.ts
│   ├── equivalence.ts
│   ├── geometry/
│   └── ...
│
tests/
├── generator/
└── integration/
│
data/
├── municipalities/
│   └── geometry/
└── ...
```

The exact internal structure is expected to evolve as the project moves toward a stable package API.

---

# Current Goals

The primary development goals are:

1. Improve nationwide municipal district discovery.
2. Reduce false positives from thematic and derived ArcGIS datasets.
3. Reduce redundant external GIS queries.
4. Improve coverage across different municipal GIS architectures.
5. Improve validation of district completeness.
6. Distinguish current and historical boundary sources.
7. Improve canonical-source selection.
8. Generate consistent GeoJSON geometry.
9. Build a stable nationwide municipal-district registry.
10. Provide a reliable geographic lookup API for downstream applications.
11. Expand municipality coverage and test fixtures.
12. Improve performance while preserving source-quality validation.

---

# Relationship to Other Civic-Data Projects

There are several valuable open-source projects addressing related geographic and civic-data problems, including Open Civic Data, OpenStates, and the United States Districts project.

These projects demonstrate the value of standardized geographic and government data.

U.S. Municipal Districts focuses specifically on the difficult problem of:

> **discovering, validating, and normalizing municipal political-district boundaries across U.S. municipalities.**

The emphasis is on the **source-discovery and geographic-data normalization problem** that occurs before an application can reliably perform municipal district lookups.

---

# License

This project is currently under active development.

See the repository's `LICENSE` file for the applicable license.

---

# Contributing

Contributions, bug reports, additional municipal GIS sources, and improvements to validation logic are welcome.

Particularly useful contributions include:

* municipal GIS source discoveries
* additional municipality test fixtures
* false-positive examples
* historical boundary examples
* geometry edge cases
* validation improvements
* performance improvements
* equivalence-detection improvements
* documentation improvements

---

# Disclaimer

Municipal political boundaries can change as a result of elections, redistricting, annexation, municipal legislation, or changes to published GIS data.

This project therefore treats:

* source provenance
* temporal status
* validation confidence
* geographic validation
* equivalence
* review status

as first-class data rather than assuming that a discovered GIS layer is permanently authoritative.

```