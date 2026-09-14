# U.S. Municipal Districts

A TypeScript/Node.js package for discovering, validating, normalizing, and generating geographic data for **municipal political districts across the United States**.

The project is designed to make it possible to answer questions such as:

* Which municipal ward contains this address?
* Which city council district contains these coordinates?
* What are the boundaries of a municipality's aldermanic districts?
* Which official geographic dataset should be used for a city's municipal districts?
* Where can the normalized GeoJSON boundary data for those districts be found?

The project focuses on municipal political divisions such as:

* Wards
* City council districts
* Council districts
* Aldermanic districts
* Other municipal political districts

It is intended to provide a reusable geographic-data foundation for applications that need to resolve municipal political representation from an address or geographic coordinate.

## Status

This project is under active development.

The current implementation includes:

* U.S. Census place discovery
* Municipality identification
* ArcGIS Online discovery
* ArcGIS REST FeatureServer and MapServer discovery
* Multi-tier candidate searching
* ArcGIS layer inspection
* Political-boundary classification
* Thematic-dataset rejection
* District-field detection
* District-value extraction
* Expected district-count validation
* Municipality metadata validation
* Municipality geography validation
* Polygon geometry validation
* Candidate ranking
* Equivalent-layer detection
* Canonical-source selection
* ArcGIS geometry conversion to GeoJSON
* Census place geometry generation
* Generated municipal geometry and registry data
* Automated unit and integration testing

The discovery pipeline has been exercised against municipalities including **Tucson, Phoenix, Chicago, Milwaukee, Austin, and Philadelphia**, with particular validation work around Tucson ward boundaries and Phoenix city council districts.

## Why this project?

Municipal political boundaries are surprisingly difficult to obtain programmatically at national scale.

Unlike Census congressional and state legislative districts, municipal districts are commonly published independently by individual cities. Municipal governments use different GIS platforms, naming conventions, service structures, field names, and publication practices.

A municipality may publish:

* a dedicated political-boundary FeatureServer,
* a MapServer containing multiple layers,
* a map with several related layers,
* historical and current boundary datasets,
* a political boundary alongside unrelated thematic datasets,
* or a derived dataset that happens to contain a district identifier.

A simple keyword search therefore isn't sufficient.

This project treats municipal district discovery as a **data validation and source-selection problem**, not simply a search problem.

## Architecture

The discovery pipeline currently follows this general process:

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

The Census place data provides the initial nationwide municipality inventory and place identifiers.

Each municipality can be associated with a Census place GEOID/FIPS identifier that becomes the stable geographic key used throughout the pipeline.

### 2. Municipality Discovery

The project identifies municipalities from Census geographic data and associates them with:

* city name
* state
* state abbreviation
* place FIPS/GEOID
* municipality geometry

### 3. ArcGIS Candidate Discovery

The project searches ArcGIS sources for potential municipal district datasets.

Search results are not automatically accepted.

Discovery uses multiple search strategies and can also discover municipal ArcGIS Server roots. Server discovery is particularly useful for municipalities that publish large numbers of services where a general ArcGIS Online search can produce noisy results.

### 4. Layer Inspection

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
* tags and type keywords

This prevents a search result from being treated as a valid political-boundary source merely because its title contains a relevant keyword.

### 5. Classification

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

This distinction is important because a thematic dataset can contain a field such as `WARD` or `DISTRICT` without actually representing political boundaries.

For example:

```text
Eviction Filings by Council Districts
```

may contain all eight Phoenix council-district values, but it is still an eviction dataset rather than the authoritative council-boundary geometry.

Similarly:

```text
Golf Courses
```

should not become a ward-boundary dataset merely because it happens to contain a `WARD` attribute.

### 6. Attribute Validation

A candidate that appears to represent municipal districts is validated using the actual attributes in the layer.

Validation can determine:

* which field identifies districts
* how many distinct district values exist
* whether district values follow a recognizable pattern
* whether the layer contains the expected number of districts
* whether expected district values are missing
* whether the layer appears complete

Where an independently known district count is available, it is used as an external validation signal rather than deriving the expected count from the candidate itself.

For example, Phoenix has eight city council districts. A candidate containing eight distinct district values can therefore be checked against an independently known expected count.

This helps distinguish a complete boundary dataset from a partial or derived dataset.

### 7. Geographic Validation

Attribute validation alone is not enough.

A candidate must also make geographic sense for the municipality.

The project can compare candidate geometry against municipality geography to identify whether the candidate:

* overlaps the municipality appropriately,
* represents polygonal boundaries,
* appears to cover the expected municipal area,
* or is likely associated with a different jurisdiction.

### 8. Candidate Ranking

Candidates that survive validation are ranked according to characteristics such as:

* official municipal provenance
* political identity
* boundary-native characteristics
* geometry quality
* district-field quality
* validation confidence
* municipality relationship
* source provenance
* thematic/derived characteristics

Ranking is deliberately performed after discovery and validation rather than relying solely on search-engine relevance.

### 9. Equivalent Layer Detection

Municipalities often publish multiple layers representing essentially the same boundary system.

For example, Phoenix may expose multiple layers corresponding to the same eight council districts.

The project groups equivalent candidates so that several representations of the same boundary system do not become several competing canonical datasets.

### 10. Canonical Source Selection

Each municipality/district type can ultimately receive a canonical source.

The canonical source records information such as:

* source URL
* ArcGIS item ID
* title
* municipality
* state
* place FIPS
* district type
* service type
* official municipal-source status
* district field
* name field
* geometry type
* selection reasons
* alternative sources
* review status

The goal is to select the best validated source while retaining information about alternatives.

## Example: Phoenix

Phoenix provides a useful example of why the validation pipeline is necessary.

The municipal source:

```text
Council Districts and Members
```

was identified as a political boundary dataset with:

```text
District field: DISTRICT
Distinct districts: 1–8
Feature count: 8
Expected district count: 8
Complete district coverage: true
Geometry: Polygon
Official municipal source: true
```

The discovery pipeline therefore recognizes it as a valid council-district boundary source.

A separate dataset:

```text
Eviction Filings by Council Districts
```

also contains all eight council-district values.

However, it is classified as a thematic/derived dataset rather than the primary political-boundary source. The presence of district values alone is therefore insufficient to make a dataset canonical.

## Example: Tucson

Tucson provides another important test case because the city publishes municipal ward boundary data through ArcGIS.

The project recognizes Tucson's ward boundary datasets and can distinguish them from unrelated ArcGIS services.

Historical datasets are also treated separately from current/undated sources. For example, a dataset named:

```text
Tucson Wards 2022
```

can be identified as a ward dataset with an explicit historical year rather than silently assuming that every undated or older source represents the current boundaries.

## Temporal status

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

* `current`
* `historical`
* `undated`

An explicit year in the dataset identity is used as evidence when determining temporal status.

The project deliberately does not assume that an undated dataset is current.

## Source roles

Source role describes what role a dataset plays in the discovery process.

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

is valid.

This separation allows the project to preserve both source authority and temporal information.

## GeoJSON generation

Once a canonical source has been selected, ArcGIS geometry can be queried and normalized into GeoJSON.

The geometry pipeline handles ArcGIS polygon structures including:

* Polygon
* MultiPolygon
* interior rings/holes
* multiple exterior rings
* spatial-reference normalization

The resulting geometry can be stored as standard GeoJSON suitable for:

* Turf.js spatial queries
* web maps
* address resolution
* point-in-polygon operations
* downstream geographic applications

## Registry

Generated municipal boundary datasets are associated with a registry entry containing information such as:

```json
{
  "placeFips": "0477000",
  "boundaryType": "ward",
  "generatedFile": "geometry/0477000/ward.geojson",
  "district": "WARD",
  "name": "NAME"
}
```

The registry provides a stable connection between municipality metadata, district types, generated geometry, and attribute fields.

## Installation

```bash
npm install @stephendewyer/us-municipal-districts
```

The project is currently under active development and the public package/API surface may change before the first stable release.

## Development requirements

* Node.js 20+
* npm
* TypeScript

The project uses TypeScript and Node.js, with geographic processing based on GeoJSON, Turf.js, Census geographic data, and ArcGIS REST services.

## Development commands

### Build

```bash
npm run build
```

### Type checking

```bash
npm run typecheck
```

### Run the test suite

```bash
npm test
```

### Run the complete check

```bash
npm run check
```

The complete check runs the build, test type checking, and automated tests.

### Generate Census place data

```bash
npm run places
```

### Discover municipal district sources

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

### Inspect an ArcGIS source

```bash
npm run inspect
```

### Generate geometry

```bash
npm run geometry
```

### Generate datasets

```bash
npm run generate
```

### Validate generated data

```bash
npm run validate
```

### Integration tests

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

## Testing strategy

The project uses several layers of testing.

### Unit tests

Unit tests cover individual pieces of the pipeline, including:

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

### Pipeline tests

Pipeline tests exercise the interaction between discovery, inspection, classification, validation, ranking, and canonical selection.

These tests are especially important for preventing false positives where a thematic dataset resembles a political-boundary dataset.

### Integration tests

Integration tests exercise the live discovery pipeline against real municipal GIS sources.

Examples include:

* Tucson wards
* Phoenix council districts
* Chicago wards
* Milwaukee aldermanic districts
* Austin council districts
* Philadelphia wards

Because external GIS services can change or become unavailable, live integration tests are opt-in rather than part of the default unit-test run.

## Data provenance

The project prioritizes official municipal GIS sources whenever possible.

An official municipal source may be identified through:

* municipal provenance from discovery
* government domains
* ArcGIS organization metadata
* municipal organization identity
* known municipal GIS endpoints

Source provenance is preserved through the discovery and canonical-selection pipeline rather than being discarded after geometry extraction.

This is important because the project is intended to provide not only geometry, but also a traceable explanation of where that geometry came from.

## Design principles

### Prefer authoritative boundary datasets

A dataset explicitly representing municipal political boundaries should generally be preferred over a derived dataset containing political attributes.

### Validate independently

The project avoids allowing a candidate dataset to define its own validity.

For example, the number of districts observed in a candidate should not automatically become the expected number of districts.

Where possible, expected district counts come from an independent municipal or authoritative source.

### Separate identity from attributes

A field such as:

```text
WARD
```

does not automatically mean that the layer is a ward-boundary dataset.

The identity of the dataset is considered separately from its attributes.

### Preserve historical information

Older political-boundary datasets are not silently treated as current.

Historical and current source information should remain distinguishable throughout the pipeline.

### Prefer deterministic validation over search relevance

Search engines and ArcGIS search results are useful for discovering candidates, but they are not sufficient for determining whether a dataset is correct.

The project therefore uses a sequence of:

```text
Discovery
→ Inspection
→ Classification
→ Validation
→ Ranking
```

rather than accepting the first plausible search result.

## Project structure

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
│   ├── geometry/
│   └── ...
│
tests/
├── generator/
└── integration/

data/
├── municipalities/
│   └── geometry/
└── ...
```

The exact internal structure is expected to evolve as the project moves toward a stable package API.

## Current goals

The primary development goals are:

1. Improve nationwide municipal district discovery.
2. Reduce false positives from thematic ArcGIS datasets.
3. Improve discovery performance without sacrificing candidate quality.
4. Increase coverage across different municipal GIS architectures.
5. Improve validation of district completeness.
6. Distinguish current and historical boundary sources.
7. Improve canonical-source selection.
8. Generate consistent GeoJSON geometry.
9. Build a stable nationwide municipal-district registry.
10. Provide a reliable geographic lookup API for downstream applications.

## Relationship to other civic-data projects

There are several valuable open-source projects addressing related geographic and civic-data problems, including Open Civic Data, OpenStates, and the United States Districts project. These projects demonstrate the value of standardized geographic and government data, but this project focuses specifically on the difficult problem of **discovering and normalizing municipal political-district boundaries across U.S. municipalities**.

## License

This project is currently under active development. See the repository's `LICENSE` file for the applicable license.

## Contributing

Contributions, bug reports, additional municipal GIS sources, and improvements to validation logic are welcome.

Particularly useful contributions include:

* municipal GIS source discoveries
* additional municipality test fixtures
* false-positive examples
* historical boundary examples
* geometry edge cases
* validation improvements
* performance improvements
* documentation improvements

## Disclaimer

Municipal political boundaries can change as a result of elections, redistricting, annexation, municipal legislation, or changes to published GIS data.

This project therefore treats source provenance, temporal status, validation, and review status as first-class data rather than assuming that a discovered GIS layer is permanently authoritative.
