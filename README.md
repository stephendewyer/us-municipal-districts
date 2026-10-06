# U.S. Municipal Districts

A TypeScript/Node.js project for **discovering, validating, selecting, normalizing, and optimizing municipal political-district boundaries across the United States**.

The project is designed to answer questions such as:

* Which municipal ward contains this address?
* Which city council district contains these coordinates?
* What are the boundaries of a city's aldermanic districts?
* Which geographic dataset represents a municipality's official political districts?
* How can those boundaries be converted into consistent, compact GeoJSON?
* How can municipal district boundaries eventually be resolved nationwide from an address or geographic coordinate?

The project focuses on municipal political divisions including:

* Wards
* City council districts
* Council districts
* Aldermanic districts
* Other municipal political districts

The long-term goal is a reusable nationwide geographic-data foundation for applications that need to resolve municipal political representation from an address or geographic coordinate.

---

## Status

**Active development — pre-release**

The core discovery and geographic-data pipeline is operational and is being developed toward nationwide municipal coverage.

The current implementation includes:

* U.S. Census place discovery
* Municipality identification
* Census municipality geometry generation
* ArcGIS Online discovery
* ArcGIS REST FeatureServer and MapServer discovery
* ArcGIS Server service-root discovery
* Multi-tier candidate discovery
* Query deduplication
* ArcGIS layer inspection
* Political-boundary classification
* Thematic and derived-dataset rejection
* District-field detection
* District-value extraction
* Observed district-count validation
* Optional expected district-count validation
* District-value pattern validation
* Municipality metadata validation
* Municipality geographic validation
* Polygon geometry validation
* Validation confidence scoring
* Candidate ranking
* Temporal validation
* Equivalent-layer detection
* Canonical-source selection
* ArcGIS geometry querying
* ArcGIS geometry normalization
* GeoJSON generation
* Geometry-size optimization
* Generated municipal geometry and registry data
* Automated unit and pipeline testing

The discovery pipeline has been exercised against municipalities including:

* Tucson, Arizona
* Phoenix, Arizona
* Chicago, Illinois
* Milwaukee, Wisconsin
* Austin, Texas
* Philadelphia, Pennsylvania

Particular validation work has focused on:

* Tucson ward boundaries
* Phoenix city council districts
* Chicago ward boundaries
* Milwaukee aldermanic districts
* Historical versus current boundary datasets
* Thematic datasets that contain district attributes without representing district boundaries
* Multiple ArcGIS representations of the same logical boundary source
* Geometry size reduction while preserving usable spatial boundaries

The package API, generated data format, and nationwide coverage are still evolving and should not yet be considered stable.

---

# Project Goal

Municipal political boundaries are difficult to obtain programmatically at national scale.

Unlike congressional and state legislative districts, municipal political districts are commonly published independently by individual municipalities.

Cities and towns use different:

* GIS platforms
* ArcGIS organizations
* service structures
* layer names
* field names
* geographic formats
* publication practices
* political terminology
* boundary systems

A municipality may publish:

* a dedicated political-boundary FeatureServer
* a MapServer containing multiple layers
* multiple representations of the same boundary system
* current and historical boundary datasets
* regional datasets containing multiple municipalities
* thematic datasets containing district attributes
* derived datasets based on political boundaries

Consequently, finding municipal political boundaries is not simply a search problem.

The central problem is:

> **Given a municipality and a municipal district type, discover the correct geographic source, validate that it actually represents the intended political boundaries, select the best canonical source, and generate reliable normalized geometry.**

---

# Architecture

The project uses a staged discovery and geographic-data pipeline:

```text
U.S. Census Places
        │
        ▼
Municipality Registry
        │
        ▼
Municipality Discovery
        │
        ▼
ArcGIS Candidate Discovery
        │
        ▼
Query Deduplication
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
Municipality Validation
        │
        ▼
Geographic Validation
        │
        ▼
Temporal Validation
        │
        ▼
Candidate Ranking
        │
        ▼
Equivalent-Layer Detection
        │
        ▼
Canonical Source Selection
        │
        ▼
Geometry Query
        │
        ▼
Geometry Normalization
        │
        ▼
Geometry Optimization
        │
        ▼
GeoJSON
        │
        ▼
Generated Registry
        │
        ▼
Final Validation
```

The important architectural principle is that:

**discovery, validation, ranking, canonical selection, and geometry generation are separate stages.**

A search result is not considered authoritative simply because its name contains a political keyword.

Likewise, a dataset containing a plausible set of district identifiers is not automatically considered a valid political-boundary source.

---

# Nationwide Municipality Registry

The long-term nationwide system begins with a municipality registry based on U.S. Census place data.

The registry provides a stable geographic identity for each municipality, including a Census place GEOID/FIPS identifier.

A municipality can therefore be represented using a stable identifier such as:

```text
Phoenix, AZ
    ↓
place FIPS: 0455000
```

or:

```text
Tucson, AZ
    ↓
place FIPS: 0477000
```

This separates **municipality identity** from **district-source identity**.

The municipality registry answers:

> What municipalities exist and how are they identified?

The district registry answers:

> What municipal political-boundary datasets have been discovered and generated?

This distinction is important because the absence of a discovered district source does not mean that the municipality itself does not exist.

---

# Municipality Discovery

Municipality information is derived from Census geographic data.

Municipality identity is intentionally established before district-source discovery.

This provides the geographic context needed to evaluate candidate sources.

The pipeline can therefore ask:

* Does this candidate correspond to the requested municipality?
* Does its geography overlap the municipality?
* Does it appear to cover the municipality?
* Does it span several municipalities?
* Is it municipal or regional in scope?

Municipality names are not treated as globally unique identifiers.

Stable Census place identifiers are used wherever possible.

---

# ArcGIS Candidate Discovery

The project searches ArcGIS sources for potential municipal political-boundary datasets.

Discovery is intentionally designed to favor **candidate recall**.

A discovered candidate is not automatically accepted.

The system can search:

* ArcGIS Online
* ArcGIS REST services
* ArcGIS FeatureServers
* ArcGIS MapServers
* ArcGIS service roots
* Multiple search tiers and query strategies

A municipality may expose several representations of the same underlying data:

```text
FeatureServer/0
MapServer/0
```

or:

```text
FeatureServer/1
MapServer/1
```

These candidates are retained long enough to be inspected and compared.

Validation and canonical selection determine which representation is ultimately preferred.

---

# Query Deduplication

ArcGIS services frequently expose equivalent query targets through multiple URLs or service representations.

For example:

```text
MapServer/0
FeatureServer/0
```

may expose the same logical layer.

Query-level deduplication prevents the system from repeatedly performing expensive requests against equivalent targets.

This is particularly important for:

* district-value queries
* feature counts
* geometry queries

Query deduplication is deliberately distinct from later equivalence detection.

### Query Deduplication

Asks:

> Do these URLs represent the same query target for purposes of avoiding redundant requests?

### Equivalence Detection

Asks:

> Do these validated candidates represent the same logical municipal boundary dataset?

These are related but separate problems.

---

# Layer Inspection

Potential ArcGIS services are inspected to determine their actual structure.

Inspection can identify:

* FeatureServer versus MapServer
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
* ArcGIS item identifiers
* service item identifiers
* tags
* type keywords
* ownership and organization metadata

Inspection prevents a search result from being treated as a political-boundary source merely because its title looks promising.

For example:

```text
Golf Courses
```

might contain a `WARD` field.

That does not make it a ward-boundary dataset.

Similarly:

```text
Eviction Filings by Council Districts
```

may contain every Phoenix council-district identifier without representing council-district boundaries.

---

# Classification

Candidates are classified according to what they actually represent.

Political identity may be indicated by terms such as:

```text
ward
council district
city council
aldermanic
municipal district
electoral district
voting district
political district
```

The classifier also recognizes thematic or derived datasets, including datasets associated with:

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

The key distinction is between **dataset identity** and **attributes contained within a dataset**.

A field named:

```text
WARD
```

does not establish that a dataset represents ward boundaries.

The classification stage therefore evaluates the candidate as a geographic dataset rather than relying on a single keyword or field.

---

# Attribute Validation

Candidates that appear to represent municipal political districts are validated using their actual attributes.

Validation can determine:

* which field identifies districts
* how many distinct district values exist
* whether district values follow a recognizable pattern
* whether the candidate appears complete
* whether district values contain unexpected mixed types
* whether an independently established district count is available
* whether the candidate agrees with an independently established district count

## Observed District Count

The observed district count is derived from the actual distinct district values found in the candidate.

For example:

```text
1
2
3
...
8
```

produces:

```text
observedDistrictCount: 8
```

## Expected District Count

An expected district count represents an **independently established expectation** for a municipality and district type.

It is not inferred from the candidate itself.

For example:

```text
observedDistrictCount: 8
expectedDistrictCount: 8
```

provides stronger validation evidence than simply observing eight values.

However, independent expected counts will not always be available.

Therefore:

```text
expectedDistrictCount: undefined
```

means:

> No independent expected count is currently available.

It does not mean that the candidate is invalid.

---

# District-Value Validation

District identifiers themselves provide additional evidence.

The system evaluates whether district values appear:

* numeric
* named
* sequential
* mixed
* incomplete
* duplicated
* structurally inconsistent

For example:

```text
1
2
3
...
15
```

is a recognizable district structure.

The system does not assume that every municipality must use sequential numeric districts.

District-value structure is treated as evidence rather than as a universal rule.

---

# Municipality Validation

A candidate must correspond to the municipality being processed.

Municipality validation can use:

* municipality identity in metadata
* municipality names
* service provenance
* ArcGIS organization information
* URL information
* geographic relationships

This helps prevent regional or county-level datasets from being incorrectly selected for an individual municipality.

A dataset containing the requested city's name is not automatically considered municipality-specific.

---

# Geographic Validation

Attribute validation is not sufficient by itself.

A candidate must also make geographic sense for the requested municipality.

Geographic validation can evaluate:

* candidate polygon coverage
* intersection with municipality geometry
* candidate area
* municipality area
* percentage of municipality covered
* percentage of candidate geometry inside the municipality
* feature validity
* polygon structure

For example, a strong municipal boundary candidate may have:

```text
municipality coverage: ~100%
candidate geometry inside municipality: ~100%
```

Geographic validation helps identify:

* regional datasets
* county datasets
* datasets covering several municipalities
* incomplete municipal datasets
* incorrectly associated geographic sources

Geographic evidence is used alongside semantic and attribute evidence rather than replacing it.

---

# Temporal Validation

Municipal boundaries change over time.

The project therefore treats temporal status as an independent dimension of candidate evaluation.

Temporal status currently includes:

```text
current
dated
undated
historical
future
```

Examples include:

```text
Tucson Ward Boundaries
    → undated/current candidate

Tucson Wards 2022
    → dated

Historical Tucson Ward Boundaries 2015-2023
    → historical
```

A closed range such as:

```text
2015-2023
```

is not automatically classified as historical merely because it contains past years.

Explicit historical language such as:

```text
Historical
Historic
Former
Previous
Superseded
Retired
```

provides stronger evidence of historical status.

The system also avoids treating ordinary publication, maintenance, or metadata dates as evidence that a political boundary itself is historical.

---

# Candidate Ranking

Candidates that survive validation are ranked using multiple independent signals.

Ranking can consider:

* temporal priority
* boundary vintage
* canonical candidate score
* validation confidence
* official municipal provenance
* political identity
* boundary-native characteristics
* municipality geography
* district-field quality
* expected district-count agreement
* review status
* service characteristics
* source role

Temporal correctness is intentionally prioritized over raw candidate score.

The ranking hierarchy is conceptually:

```text
Temporal priority
        ↓
Temporal vintage
        ↓
Candidate score
        ↓
Validation confidence
        ↓
Review status
        ↓
Official municipal source
        ↓
Service representation
        ↓
District field
        ↓
Deterministic URL tie-breaker
```

This prevents a high-scoring historical dataset from automatically outranking a current or undated candidate simply because it has a higher raw score.

---

# Equivalent-Layer Detection

Municipalities frequently publish multiple representations of the same logical boundary system.

For example:

```text
MapServer/0
FeatureServer/0
```

may expose equivalent boundary data.

The project attempts to group equivalent candidates so that several representations of one logical dataset do not become competing canonical sources.

Equivalence analysis can consider:

* dataset identity
* service identity
* layer identity
* temporal characteristics
* field structure
* district values
* name fields
* geometry characteristics

The goal is to distinguish:

```text
multiple representations of one logical boundary dataset
```

from:

```text
genuinely different boundary datasets
```

---

# Canonical Source Selection

After candidates have been discovered, inspected, classified, validated, ranked, and grouped, the project selects a canonical source.

Canonical selection is performed **among validated candidates**.

Relevant factors include:

* temporal status
* temporal vintage
* source authority
* validation confidence
* municipality geography
* district-field quality
* service characteristics
* review status
* equivalence relationships

The canonical source becomes the basis for geometry generation.

Alternative valid representations are retained as discovery information rather than simply being discarded.

---

# Source Roles

Source role and temporal status are separate concepts.

A candidate may have a role such as:

```text
authoritative
derived
duplicate
unknown
```

while simultaneously having a temporal status such as:

```text
current
dated
undated
historical
future
```

For example:

```text
sourceRole: authoritative
temporalStatus: historical
```

is a valid combination.

This separation allows the system to distinguish:

> Who published this dataset?

from:

> Which boundary vintage does this dataset represent?

---

# Geometry Generation

After canonical-source selection, the project queries the authoritative geographic source and converts its geometry into GeoJSON.

The geometry pipeline handles ArcGIS polygon structures including:

* Polygon
* MultiPolygon
* multiple rings
* interior rings / holes
* spatial-reference normalization
* paginated feature retrieval

The intended pipeline is:

```text
Canonical ArcGIS Source
        │
        ▼
Geometry Query
        │
        ▼
ArcGIS Geometry Normalization
        │
        ▼
GeoJSON
        │
        ▼
Geometry Optimization
        │
        ▼
Optimized GeoJSON
```

Geometry generation occurs after source selection so that expensive geometry downloads are not performed for candidates that will ultimately be rejected.

---

# Geometry Optimization

Municipal GIS boundaries can contain significantly more geometric detail than is necessary for downstream point-in-polygon lookup.

The project therefore includes geometry-size optimization as a separate stage.

The objective is:

> **Reduce geometry size while preserving reliable municipal district lookup.**

Optimization can address:

* redundant coordinate precision
* unnecessary vertices
* overly detailed boundaries
* GeoJSON file size
* polygon topology
* holes and multipolygon structure

Optimization must not silently change the semantic meaning of a municipal district boundary.

The project therefore treats geometry optimization as a correctness problem as well as a compression problem.

The desired relationship is:

```text
Source Geometry
      ↓
Normalized Geometry
      ↓
Optimized Geometry
      ↓
Validation
```

rather than simply minimizing file size.

---

# Generated Data

Generated municipal data is organized around stable Census place identifiers.

A simplified structure is:

```text
data/
└── municipalities/
    └── geometry/
        ├── 0477000/
        │   └── ward.geojson
        │
        └── 0455000/
            └── council_district.geojson
```

This avoids relying on municipality names as filesystem identifiers.

---

# Registry

Generated district datasets are associated with registry information connecting municipality identity, district type, generated geometry, and attribute fields.

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

The registry provides the connection:

```text
Municipality
    ↓
District Type
    ↓
Canonical Source
    ↓
Generated GeoJSON
    ↓
District / Name Attributes
```

The registry format is still evolving as the project moves toward a stable nationwide data model.

---

# Example: Phoenix

Phoenix provides an important example of the distinction between boundary-native and derived datasets.

The municipal source:

```text
Council Districts and Members
```

contains:

```text
District field: DISTRICT
Districts: 1–8
Geometry: Polygon
Official municipal source: true
```

The project can also discover datasets such as:

```text
Eviction Filings by Council Districts
```

which may contain the same council-district identifiers.

However, the eviction dataset represents eviction information rather than council-district boundaries.

It should therefore not be selected merely because it contains:

```text
DISTRICT = 1 ... 8
```

This illustrates a central principle of the project:

> **Matching district identifiers is evidence, but it is not sufficient evidence that a dataset represents district boundaries.**

---

# Example: Tucson

Tucson provides several important discovery and validation cases.

The project has encountered multiple representations of Tucson ward boundaries, including current and dated sources.

For example:

```text
Tucson Wards 2022
```

can be recognized as a dated boundary source rather than automatically treating its year as evidence that it is the current source.

The discovery system also needs to distinguish actual Tucson ward boundaries from unrelated datasets that happen to contain ward-related attributes.

This provides a useful test case for:

* political classification
* temporal validation
* municipality validation
* geographic validation
* canonical selection
* geometry generation

---

# Example: Chicago

Chicago provides an important temporal-ranking test case because multiple ward-boundary vintages can coexist.

The system needs to distinguish current boundary sources from historical boundary sources rather than selecting solely on raw search or candidate scores.

This provides a test case for the principle:

```text
current > dated > undated > historical > future
```

when candidates are otherwise comparable.

---

# Installation

Install the package from npm:

```bash
npm install @stephendewyer/us-municipal-districts
```

The package is currently version `0.1.0` and remains under active development.

The public API and generated data format may change before a stable release.

---

# Development Requirements

* Node.js 20+
* npm
* TypeScript

The project uses geographic processing based on:

* GeoJSON
* Turf.js
* U.S. Census geographic data
* ArcGIS REST services
* ArcGIS Online

---

# Development Commands

## Install dependencies

```bash
npm install
```

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

`npm run check` runs:

```text
build
  ↓
typecheck
  ↓
tests
```

The normal test suite is intended to remain deterministic and does not require live external discovery.

---

# Generate Census Place Data

```bash
npm run places
```

This generates the municipality/place data used by the discovery pipeline.

---

# Generate Census Municipality Geometry

```bash
npm run census-geometries
```

This generates municipality geometry used for geographic validation and related geographic operations.

---

# Discover Municipal District Sources

The discovery CLI accepts a municipality and state abbreviation.

For example:

```bash
npm run discover -- --city Tucson --state AZ
```

```bash
npm run discover -- --city Phoenix --state AZ
```

```bash
npm run discover -- --city Milwaukee --state WI
```

The state should currently be supplied using its two-letter abbreviation.

For example:

```text
Tucson AZ
```

rather than:

```text
Tucson Arizona
```

---

# Inspect an ArcGIS Source

```bash
npm run inspect
```

Inspection is used to examine the structure and metadata of an ArcGIS service or layer.

---

# Generate Data

```bash
npm run generate
```

The generation pipeline produces normalized municipal geographic data and associated registry information.

---

# Generate Geometry

```bash
npm run geometry
```

This runs the geometry-generation stage for selected canonical sources.

---

# Validate Generated Data

```bash
npm run validate
```

Generated data validation checks the resulting geographic data and associated metadata.

---

# Coverage Evaluation

The repository includes a coverage evaluation command:

```bash
npm run coverage
```

This is intended to measure discovery and geographic-data coverage as the project expands across municipalities.

Coverage evaluation will become increasingly important as the project moves from individual municipality testing toward nationwide discovery.

---

# Integration Tests

Live integration tests are separated from the normal test suite because they can communicate with external GIS services.

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

Live discovery tests are intentionally opt-in so that normal development remains deterministic and does not depend on the availability of external municipal GIS services.

---

# Testing Strategy

The project uses several layers of testing.

## Unit Tests

Unit tests cover individual components including:

* ArcGIS discovery
* layer inspection
* classification
* district-field detection
* district-value extraction
* candidate validation
* municipality validation
* geographic validation
* temporal validation
* geometry conversion
* geometry optimization
* candidate ranking
* equivalence detection
* canonical selection
* registry generation

## Pipeline Tests

Pipeline tests exercise interactions between:

```text
Discovery
    ↓
Inspection
    ↓
Classification
    ↓
Validation
    ↓
Municipality Validation
    ↓
Geographic Validation
    ↓
Temporal Validation
    ↓
Ranking
    ↓
Equivalence
    ↓
Canonical Selection
```

These tests are especially important for preventing false positives where thematic datasets resemble municipal political-boundary datasets.

## Integration Tests

Integration tests exercise the discovery pipeline against real municipal GIS sources.

Current test municipalities include examples such as:

* Tucson
* Phoenix
* Chicago
* Milwaukee
* Austin
* Philadelphia

Because external GIS services can change or become unavailable, these tests are opt-in.

---

# Data Provenance

The project prioritizes official municipal GIS sources whenever possible.

Evidence for official provenance may include:

* municipal GIS domains
* municipal ArcGIS organizations
* service ownership
* organization metadata
* municipal service provenance
* known municipal GIS endpoints

Source provenance is preserved throughout discovery, validation, canonical selection, and geometry generation.

The project therefore distinguishes between:

```text
official municipal boundary source
```

and:

```text
dataset that happens to contain municipal district attributes
```

These are not equivalent.

---

# Design Principles

## 1. Discovery Is Not Validation

Finding a dataset is only the beginning.

```text
discovered
    ≠
validated
```

A candidate must survive inspection and validation before becoming eligible for canonical selection.

---

## 2. Prefer Boundary-Native Sources

A dataset explicitly representing municipal political boundaries should generally be preferred over a thematic or derived dataset containing political attributes.

---

## 3. Separate Identity From Attributes

A field such as:

```text
WARD
```

does not automatically establish that a layer represents ward boundaries.

Dataset identity must be evaluated separately from its attributes.

---

## 4. Separate Observed and Expected Values

Observed values describe what a candidate contains.

Expected values describe what independent evidence says a candidate should contain.

The candidate must not be allowed to define its own expected district count.

---

## 5. Expected District Counts Are Optional

Not every municipality or district type will have an independently established expected count.

Therefore:

```text
expectedDistrictCount: undefined
```

is a legitimate state.

The system should continue to validate the candidate using other available evidence.

---

## 6. Separate Source Role From Temporal Status

A source can be:

```text
authoritative + historical
```

or:

```text
authoritative + current
```

Source authority and boundary vintage are different concepts and should remain separate.

---

## 7. Preserve Historical Information

Older political-boundary datasets should not silently be treated as current.

Historical, dated, undated, and current sources should remain distinguishable throughout the pipeline.

---

## 8. Validate Geography Independently

A candidate can have convincing metadata and still represent the wrong geographic jurisdiction.

Geographic comparison against municipality geometry provides an independent validation signal.

---

## 9. Deduplicate Expensive Queries

Equivalent ArcGIS query targets should not cause repeated expensive requests for:

* district values
* feature counts
* geometry

---

## 10. Preserve Equivalent Sources

Multiple ArcGIS representations of the same logical boundary system should be recognized as alternatives rather than incorrectly treated as unrelated political systems.

---

## 11. Temporal Correctness Has Priority

When selecting between otherwise eligible candidates, current and appropriately dated boundary sources should not lose to older sources simply because the older source has a higher raw candidate score.

Temporal priority is therefore evaluated before the general candidate score.

---

## 12. Optimize Geometry Without Changing Its Meaning

Geometry optimization should reduce data volume while preserving reliable point-in-polygon behavior.

The objective is not merely:

> Make the GeoJSON smaller.

The objective is:

> **Produce compact geographic data that remains reliable for municipal district lookup.**

---

## 13. Prefer Deterministic Evidence Over Search Relevance

ArcGIS search relevance is useful for finding candidates but should not determine the final source.

The project instead uses:

```text
Discovery
    ↓
Inspection
    ↓
Classification
    ↓
Attribute Validation
    ↓
Municipality Validation
    ↓
Geographic Validation
    ↓
Temporal Validation
    ↓
Ranking
    ↓
Equivalence
    ↓
Canonical Selection
    ↓
Geometry Generation
    ↓
Geometry Optimization
```

---

# Nationwide Expansion Strategy

The ultimate goal is nationwide municipal coverage.

The development strategy is to expand incrementally rather than assume that the discovery logic developed against a handful of municipalities will work everywhere.

A representative nationwide expansion should test municipalities across:

* all 50 states
* different municipal sizes
* different political district systems
* different GIS vendors
* different ArcGIS architectures
* different naming conventions
* current and historical datasets

A representative municipality from each state provides an important early test because it exposes geographic and GIS variations that are not apparent from testing only a few large cities.

The system should then expand from representative municipalities toward broader nationwide coverage.

---

# Future Lookup Architecture

The long-term application architecture is:

```text
Address
   │
   ▼
Geocoder
   │
   ▼
Latitude / Longitude
   │
   ▼
Municipality Resolver
   │
   ▼
Census Place
   │
   ▼
Municipal District Geometry
   │
   ▼
Point-in-Polygon
   │
   ▼
Municipal District
```

For example:

```text
Address
    ↓
Coordinates
    ↓
Tucson, AZ
    ↓
Tucson ward geometry
    ↓
Point-in-polygon
    ↓
Ward 6
```

The discovery and generation system is therefore the data-acquisition layer beneath a future municipal geographic lookup API.

---

# Future API

The long-term goal is an API capable of resolving municipal political districts from geographic coordinates or addresses.

A conceptual interface might eventually look like:

```ts
resolveMunicipalDistrict({
    latitude,
    longitude
});
```

and return information such as:

```ts
{
    municipality: {
        name: "Tucson",
        state: "AZ",
        placeFips: "0477000"
    },

    districts: {
        ward: {
            district: "6",
            name: "Ward 6"
        }
    }
}
```

The exact public API has not yet been finalized.

---

# Current Development Priorities

The project's major development priorities are:

1. Build a reliable nationwide municipality registry.
2. Expand discovery across all 50 states.
3. Improve coverage across different municipal GIS architectures.
4. Reduce false positives from thematic and derived datasets.
5. Improve district completeness validation.
6. Improve current-versus-historical source selection.
7. Improve municipality geographic validation.
8. Improve canonical-source selection.
9. Generate consistent normalized GeoJSON.
10. Optimize geometry size while preserving spatial correctness.
11. Build a reproducible generated-data pipeline.
12. Establish a nationwide coverage evaluation dataset.
13. Expand regression tests using real municipal examples.
14. Develop a stable municipal-district lookup API.

---

# Known Limitations

## Municipal District Expectations

Independent expected district counts are not yet available for every municipality and district type.

Some valid candidates will therefore have:

```text
expectedDistrictCount: undefined
```

---

## GIS Platform Diversity

A significant amount of municipal GIS infrastructure is published through ArcGIS.

Municipalities using other GIS platforms may require additional discovery adapters as nationwide coverage expands.

---

## Temporal Metadata

Many municipal datasets do not clearly identify their effective date.

An undated source therefore cannot automatically be assumed to represent the current boundary system.

---

## External GIS Services

Live discovery depends on external municipal and ArcGIS services.

Services may:

* change URLs
* change layer identifiers
* change field structures
* become unavailable
* publish new boundary datasets
* remove historical datasets

The discovery pipeline is therefore designed to re-evaluate sources rather than assuming discovered URLs are permanent.

---

## Geometry Complexity

Municipal boundary geometries can be large and complex.

Geometry optimization must balance:

```text
file size
```

against:

```text
spatial accuracy
```

and:

```text
point-in-polygon reliability
```

---

## Nationwide Coverage

The project is not yet a complete nationwide municipal-district database.

The discovery engine is being developed specifically to make nationwide coverage possible, but additional municipalities, GIS platforms, district types, and edge cases remain to be incorporated and evaluated.

---

# Contributing

Contributions, municipal GIS source discoveries, false-positive examples, test fixtures, and improvements to validation logic are welcome.

Particularly useful contributions include:

* municipal GIS source discoveries
* additional municipality test fixtures
* false-positive examples
* historical boundary examples
* geometry edge cases
* expected district-count sources
* geographic-validation improvements
* classification improvements
* equivalence-detection improvements
* geometry-optimization improvements
* performance improvements
* documentation improvements

---

# Disclaimer

Municipal political boundaries can change as a result of:

* elections
* redistricting
* municipal legislation
* annexation
* boundary changes
* changes to published GIS data

This project therefore treats:

* source provenance
* temporal status
* observed district structure
* expected district structure
* validation confidence
* geographic validation
* equivalence
* review status

as first-class information.

The project is intended to provide reproducible and validated geographic data, but downstream applications should account for the possibility that municipal boundaries and published GIS sources can change over time.
