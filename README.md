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

# Status

This project is **under active development**.

The current implementation includes:

* U.S. Census place discovery
* Municipality identification
* Census municipality geometry generation
* ArcGIS Online discovery
* ArcGIS REST FeatureServer and MapServer discovery
* ArcGIS Server service-root discovery
* Multi-tier candidate searching
* ArcGIS layer inspection
* Political-boundary classification
* Thematic and derived-dataset rejection
* District-field detection
* District-value extraction
* Observed district-count validation
* Optional expected district-count validation
* District-value pattern validation
* Municipality metadata validation
* Municipality geography validation
* Polygon geometry validation
* 0–100 validation confidence scoring
* Candidate ranking
* Query-level deduplication
* Equivalent-layer detection
* Canonical-source selection
* Temporal-status detection
* Source-role classification
* ArcGIS geometry querying
* ArcGIS geometry conversion to GeoJSON
* Generated municipal geometry and registry data
* Automated unit and integration testing

The discovery pipeline has been exercised against municipalities including:

* Tucson
* Phoenix
* Chicago
* Milwaukee
* Austin
* Philadelphia

Particular validation work has focused on Tucson ward boundaries, Phoenix city council districts, and Milwaukee aldermanic districts.

The package API and generated data format are still evolving and should not yet be considered stable.

---

# Why This Project?

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

The fundamental question is not:

> "Can I find a dataset containing the word `ward`?"

It is:

> "Does this geographic dataset actually represent the municipality's political district boundaries, and is it a suitable source for generating normalized geographic data?"

---

# Architecture

The discovery and generation pipeline follows this general process:

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
Candidate Ranking
      │
      ▼
Equivalent Layer Detection
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
GeoJSON Generation
      │
      ▼
Registry
      │
      ▼
Final Validation
```

The important architectural principle is that:

**discovery, validation, ranking, canonical selection, and geometry generation are separate stages.**

A search result is not considered authoritative simply because its name looks correct.

Likewise, a dataset containing a plausible set of district identifiers is not automatically considered a valid political-boundary source.

---

# 1. Census Places

Census place data provides the initial nationwide municipality inventory and stable geographic identifiers.

Each municipality is associated with a Census place GEOID/FIPS identifier that becomes the stable geographic key used throughout the pipeline.

Municipality records include information such as:

* city name
* state
* state abbreviation
* place FIPS/GEOID
* municipality geometry

For example:

```text
Phoenix, AZ
```

is represented internally using its Census place identifier rather than relying solely on the municipality name.

This is important because municipal names are not globally unique.

---

# 2. Municipality Discovery

The project identifies municipalities from Census geographic data and uses the resulting place information as the foundation for district discovery.

Municipality identity is intentionally separated from district-source identity.

The municipality provides the geographic context against which discovered datasets can later be validated.

This allows the pipeline to ask questions such as:

* Does this candidate actually correspond to the requested municipality?
* Does its geometry substantially overlap the municipality?
* Does it appear to contain the municipality?
* Does it span multiple municipalities?
* Is the source municipal or regional in scope?

---

# 3. ArcGIS Candidate Discovery

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

These candidates are retained during discovery so that they can be inspected and compared later.

Discovery therefore intentionally favors **candidate recall** over immediate acceptance.

The validation stages are responsible for determining whether a discovered candidate is actually useful.

---

# 4. Query Deduplication

ArcGIS municipalities frequently expose the same logical layer through multiple service representations.

For example:

```text
MapServer/0
FeatureServer/0
```

may expose equivalent geographic data.

These representations can sometimes be reached through different URLs, hosts, or ArcGIS item identifiers.

The discovery pipeline therefore attempts to identify equivalent query targets before performing expensive operations.

This is particularly important for operations such as:

* querying distinct district values
* querying feature counts
* querying geometry

Query-level deduplication prevents multiple representations of the same service from causing unnecessary external requests.

This stage is distinct from later **equivalence detection**.

### Query Deduplication vs. Equivalence Detection

**Query deduplication** asks:

> "Do these URLs represent the same query target for purposes of avoiding redundant requests?"

**Equivalence detection** asks:

> "Do these successfully validated candidates represent the same logical municipal boundary dataset?"

The two problems are related but are intentionally handled separately.

---

# 5. Layer Inspection

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

For example, a dataset named:

```text
Polling places
```

may be associated with wards without actually being a ward-boundary polygon layer.

Similarly, a dataset containing a `WARD` field may be an election, housing, transportation, or other thematic dataset.

---

# 6. Classification

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

Classification provides the semantic identity of the candidate; subsequent validation determines whether its actual structure supports that identity.

---

# 7. Attribute Validation

Candidates that appear to represent municipal districts are validated using the actual attributes in the layer.

Validation can determine:

* which field identifies districts
* how many distinct district values exist
* whether district values follow a recognizable pattern
* whether the candidate contains an independently expected number of districts
* whether expected district values are missing
* whether the layer appears complete
* whether district values contain unexpected mixed types

## Observed vs. Expected District Count

The pipeline deliberately distinguishes between:

```text
observedDistrictCount
```

and:

```text
expectedDistrictCount
```

### Observed District Count

`observedDistrictCount` is derived from the actual distinct district values found in the candidate dataset.

For example:

```text
1
2
3
...
15
```

produces:

```text
observedDistrictCount: 15
```

### Expected District Count

`expectedDistrictCount` represents an **independently established expectation** for the municipality and district type.

It is not inferred from the candidate itself.

For example, if an independently established municipal expectation says that a city has eight council districts, a candidate containing:

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

can be evaluated against:

```text
expectedDistrictCount: 8
```

However, an expected district count is not necessarily available for every municipality or district type.

In that case:

```text
expectedDistrictCount: undefined
```

means:

> No independent expected count is currently available.

It does **not** mean that the candidate has an invalid district count.

This distinction is important for nationwide discovery because municipal political systems do not have a single universal district-count model.

A city may have:

* 8 council districts
* 15 aldermanic districts
* 50 wards
* 100+ voting wards
* district systems with non-numeric identifiers
* district systems whose expected count cannot yet be independently established

The pipeline therefore treats expected district count as a **validation signal when available**, rather than as a prerequisite for every candidate.

---

# 8. District-Value Validation

District values themselves provide another validation signal.

The pipeline examines whether district identifiers appear:

* numeric
* named
* mixed
* sequential
* unexpectedly duplicated
* incomplete
* inconsistent with an independently known district system

For example:

```text
1
2
3
...
15
```

is a recognizable numeric district structure.

By contrast:

```text
1
2
3
...
8
ACACIA
BARREL
CACTUS
CHOLLA
```

may indicate that a field contains multiple kinds of values and does not represent a clean district identifier.

Likewise, datasets containing hundreds of distinct values can be rejected when the observed cardinality is inconsistent with the expected municipal political system.

The purpose is not to assume that every district system must be sequentially numbered.

Rather, district-value structure is used as evidence about whether the selected field actually represents a municipal district identifier.

---

# 9. Validation Confidence

Political-boundary validation uses a **0–100 confidence scale**.

The confidence score summarizes evidence that the candidate represents the intended political boundary system.

Relevant evidence can include:

* political identity
* district-field quality
* district-value structure
* geometry type
* source authority
* completeness
* other validation signals

Validation confidence is distinct from:

* source authority
* temporal status
* municipality geography validation
* canonical ranking score

A candidate can therefore have strong source authority while still having incomplete district evidence, or have strong geographic alignment while still failing attribute validation.

The current acceptance policy uses confidence together with explicit rejection criteria rather than treating confidence as the sole decision variable.

---

# 10. Municipality Validation

The project validates whether a candidate appears to correspond to the municipality being processed.

Municipality validation can use evidence such as:

* municipality identity in the dataset
* municipality name in the URL
* municipality name in dataset metadata
* municipal service provenance
* geographic relationship to the municipality

This is especially important for regional datasets.

For example, a county-level dataset may contain districts for several cities.

The presence of the requested city's name somewhere in the dataset does not automatically make the entire dataset a municipality-specific source.

---

# 11. Geographic Validation

Attribute validation alone is not enough.

A candidate must also make geographic sense for the municipality.

The project can compare candidate geometry against municipality geography to determine whether the candidate:

* overlaps the municipality appropriately
* represents polygonal boundaries
* covers the expected municipal area
* is likely associated with a different jurisdiction
* spans multiple municipalities
* contains a substantial portion of the municipality

Geographic validation produces quantitative measurements such as:

```text
municipalityArea
candidateArea
intersectionArea
coverageOfMunicipality
candidateInsideMunicipality
candidateFeatureCount
validCandidateFeatureCount
```

For example, a strong geographic match may look like:

```text
municipality coverage: 99.9%
candidate inside municipality: 99.9%
```

Geographic validation is an important ranking signal, but it is not intended to replace semantic and attribute validation.

A dataset can have excellent geographic overlap while still representing the wrong type of boundary.

---

# 12. Candidate Acceptance

A candidate is accepted only after passing the relevant validation criteria.

The pipeline distinguishes between:

```text
discovered
```

```text
inspected
```

```text
validated
```

and:

```text
canonical
```

These states should not be conflated.

A candidate can be discovered because it contains a political keyword.

It can then be inspected and classified as political.

It may subsequently be rejected because:

* it is not polygon geometry
* it has too many district values
* it has too few district values
* the district field contains mixed values
* it does not adequately represent the requested municipality
* it is a thematic or derived dataset
* it otherwise fails validation

Only candidates that survive these checks become eligible for canonical selection.

---

# 13. Candidate Ranking

Candidates that survive validation are ranked using multiple independent signals.

Ranking can incorporate:

* official municipal provenance
* political identity
* boundary-native characteristics
* geometry quality
* district-field quality
* validation confidence
* expected district-count agreement when available
* municipality geography relationship
* source provenance
* temporal status
* source role
* review requirements
* service characteristics

Ranking is deliberately performed **after discovery and validation** rather than relying solely on search relevance.

This allows a noisy ArcGIS search result to be inspected and rejected rather than automatically becoming the selected source.

The canonical ranking score is intentionally separate from the validation confidence score.

For example:

```text
validation confidence: 85
canonical ranking score: 208
```

represent different concepts.

The first describes evidence that the candidate is a valid political-boundary source.

The second describes how the candidate compares with other eligible candidates for canonical selection.

---

# 14. Equivalent Layer Detection

Municipalities often publish multiple layers representing essentially the same boundary system.

For example, a municipality may expose the same districts through:

```text
MapServer/0
FeatureServer/0
```

or through multiple ArcGIS organizations.

The project groups equivalent candidates so that multiple representations of the same logical boundary system do not become competing canonical datasets.

Equivalence analysis can consider characteristics such as:

* dataset identity
* service identity
* layer identity
* temporal dataset family
* field structure
* district-field structure
* name-field structure
* district values
* geometry characteristics

The goal is to distinguish:

```text
multiple representations of one logical dataset
```

from:

```text
genuinely different boundary datasets
```

This is particularly important when a municipality publishes both a current authoritative source and alternate service representations.

---

# 15. Canonical Source Selection

After equivalent candidates have been grouped, the project selects a canonical source for each municipality and district type.

Canonical selection considers factors such as:

* source role
* official municipal provenance
* validation confidence
* temporal status
* municipality geography validation
* service characteristics
* district-field quality
* review status
* equivalence relationships

Canonical selection is therefore a **selection problem among already-validated candidates**, rather than a second discovery system.

Canonical groups retain information about alternative representations rather than discarding them.

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
* geographic validation
* selection reasons
* alternative sources
* review status

---

# Example: Milwaukee

Milwaukee demonstrates why multiple validation stages are necessary.

The discovery process finds several datasets containing ward-related information.

For example:

```text
MilwaukeeCounty_VotingWards
```

contains hundreds of distinct `Ward_ID` values:

```text
observedDistrictCount: 370
```

It is therefore rejected because the observed district cardinality is inconsistent with the intended municipal ward boundary system.

Likewise, several historical election datasets contain hundreds of ward-related values and are rejected because their district fields do not represent a clean municipal boundary structure.

The municipal:

```text
Voting wards
```

layer is also recognized as a political boundary dataset, but its observed district count is much larger than the intended municipal system being selected and is therefore rejected by the current validation rules.

In contrast:

```text
Aldermanic district outlines
```

contains:

```text
District field: DISTRICT

Distinct districts:
1
2
3
...
15

Geometry: Polygon

Official municipal source: true

Source role: authoritative

Municipality geography: strong-match
```

The candidate covers approximately the entire municipality and its features are overwhelmingly contained within the municipality.

It therefore survives validation and becomes the canonical Milwaukee municipal district source currently discovered by the pipeline.

This example illustrates several important principles:

1. A political keyword does not guarantee that a dataset is usable.
2. A district field does not guarantee that the dataset represents the intended municipality.
3. Observed district count is useful even when no independent expected count is available.
4. Municipality geography provides an additional independent validation signal.
5. Canonical selection happens only after invalid candidates have been removed.

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

The project also discovers other datasets containing the same eight district identifiers.

For example:

```text
Eviction Filings by Council Districts
```

also contains the eight Phoenix council-district values.

However, it is classified as a derived/thematic dataset rather than a political-boundary dataset.

This demonstrates why **district values alone are insufficient** to establish that a dataset represents political boundaries.

The project also encounters alternate representations of the council-district boundary source.

Those representations can be recognized as equivalent candidates and evaluated for canonical selection.

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

An explicit year in the dataset identity or metadata can provide evidence when determining temporal status.

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

# Geometry Generation

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

Geometry generation is intentionally performed **after canonical source selection**.

This prevents unnecessary geometry downloads from candidates that will ultimately be rejected.

---

# Geometry Optimization

The next stage of the geographic-data pipeline is geometry optimization.

Municipal GIS datasets can contain geometry that is significantly more detailed than necessary for downstream point-in-polygon lookup.

A useful normalized dataset should preserve the geographic correctness of district boundaries while avoiding unnecessarily large geometry files.

Geometry optimization is therefore being developed as a separate stage from:

```text
geometry acquisition
```

and:

```text
geometry normalization
```

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

Potential optimization work includes:

* removing redundant coordinate precision
* simplifying geometries
* preserving polygon topology
* preserving holes and multipolygon structure
* reducing file size
* measuring simplification error
* validating optimized geometry against the source geometry

Optimization should not be allowed to silently change district boundaries.

The long-term goal is therefore not simply:

> "make the GeoJSON smaller"

but:

> **"produce the smallest practical representation that preserves reliable municipal district lookup."**

Geometry optimization will become particularly important as the project expands from individual municipality testing toward nationwide generated data.

---

# Census Place Geometry

The project also generates municipality geometry from Census geographic data.

This provides a consistent geographic reference for:

* municipality validation
* candidate geography validation
* spatial relationships
* downstream geographic operations

Generated municipality geometry is stored alongside municipal district geometry.

The Census municipality geometry is not itself treated as the municipal district source.

Instead, it provides geographic context against which discovered district candidates can be evaluated.

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

The project uses geographic processing based on:

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

The complete check runs the project's build, type checking, and automated tests.

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

or:

```bash
npm run discover -- --city Milwaukee --state WI
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
* municipality validation
* geographic validation
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
Municipality Validation
    ↓
Geographic Validation
    ↓
Ranking
    ↓
Equivalence
    ↓
Canonical Selection
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

The pipeline therefore distinguishes between:

```text
official municipal source
```

and:

```text
dataset that happens to contain municipal district attributes
```

These are not equivalent.

---

# Design Principles

## Prefer Authoritative Boundary Datasets

A dataset explicitly representing municipal political boundaries should generally be preferred over a derived dataset containing political attributes.

## Validate Independently

The project avoids allowing a candidate dataset to define its own validity.

For example, the number of districts observed in a candidate should not automatically become the expected number of districts.

Where an independently established district count is available, it can be used as an external validation signal.

Where no independent expectation is available, the pipeline does not manufacture one.

## Separate Identity from Attributes

A field such as:

```text
WARD
```

does not automatically mean that the layer is a ward-boundary dataset.

The identity of the dataset is considered separately from its attributes.

## Separate Observed and Expected Values

Observed values describe what the candidate actually contains.

Expected values describe what independent evidence says the candidate should contain.

For example:

```text
observedDistrictCount: 15
expectedDistrictCount: undefined
```

means that 15 district values were observed but no independent expected count is currently available.

This is different from:

```text
observedDistrictCount: 15
expectedDistrictCount: 15
```

where the candidate agrees with an independently established expectation.

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

## Validate Geography Independently

A candidate should not be accepted solely because its attributes look correct.

Geographic comparison against the municipality provides an additional independent signal that helps identify:

* regional datasets
* county datasets
* datasets covering multiple municipalities
* incorrectly associated sources
* incomplete municipal coverage

## Deduplicate Expensive Queries

Multiple ArcGIS representations of the same service should not trigger unnecessary repeated requests for:

* district values
* feature counts
* geometry

Query-level deduplication occurs before these expensive operations.

## Preserve Equivalent Sources

Equivalent FeatureServer and MapServer representations should be recognized as alternative representations of the same logical boundary system rather than treated as unrelated datasets.

## Optimize Geometry Without Changing Its Meaning

Geometry optimization should reduce unnecessary data volume while preserving reliable spatial lookup.

The optimized geometry must remain semantically equivalent to the canonical source for the purposes of municipal district lookup.

## Prefer Deterministic Validation Over Search Relevance

Search engines and ArcGIS search results are useful for discovering candidates, but they are not sufficient for determining whether a dataset is correct.

The project therefore uses:

```text
Discovery
→ Inspection
→ Classification
→ Attribute Validation
→ Municipality Validation
→ Geographic Validation
→ Ranking
→ Equivalence
→ Canonical Selection
→ Geometry Generation
→ Geometry Optimization
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

# Current Development Goals

The primary development goals are:

1. Improve nationwide municipal district discovery.
2. Reduce false positives from thematic and derived ArcGIS datasets.
3. Reduce redundant external GIS queries.
4. Improve coverage across different municipal GIS architectures.
5. Improve validation of district completeness.
6. Distinguish current and historical boundary sources.
7. Improve municipality geographic validation.
8. Improve canonical-source selection.
9. Generate consistent GeoJSON geometry.
10. Optimize generated geometry while preserving spatial correctness.
11. Build a stable nationwide municipal-district registry.
12. Provide a reliable geographic lookup API for downstream applications.
13. Expand municipality coverage and test fixtures.
14. Improve performance while preserving source-quality validation.

---

# Future Geographic Lookup

The long-term goal is to make the generated data useful for applications that need to answer questions such as:

```text
Given an address:
    ↓
Resolve latitude/longitude
    ↓
Identify municipality
    ↓
Load municipality district geometry
    ↓
Perform point-in-polygon lookup
    ↓
Return municipal district
```

For example:

```text
Address
   ↓
Coordinates
   ↓
Municipality
   ↓
Canonical district GeoJSON
   ↓
Point-in-polygon
   ↓
Ward / Council District / Aldermanic District
```

The discovery pipeline therefore serves as the data-acquisition and normalization layer beneath a future geographic lookup API.

---

# Relationship to Other Civic-Data Projects

There are several valuable open-source projects addressing related geographic and civic-data problems, including Open Civic Data, OpenStates, and the United States Districts project.

These projects demonstrate the value of standardized geographic and government data.

U.S. Municipal Districts focuses specifically on the difficult problem of:

> **discovering, validating, and normalizing municipal political-district boundaries across U.S. municipalities.**

The emphasis is on the **source-discovery and geographic-data normalization problem** that occurs before an application can reliably perform municipal district lookups.

---

# Limitations

The project currently has several important limitations.

## Municipal District Expectations

Independent expected district counts are not yet available for every municipality and district type.

Consequently, some candidates may have:

```text
expectedDistrictCount: undefined
```

even when their observed district structure is valid.

## ArcGIS Dependency

A significant portion of municipal GIS infrastructure is published through ArcGIS.

Municipalities using other GIS platforms may require additional discovery adapters.

## Temporal Metadata

Some municipal datasets do not clearly identify their publication or effective date.

An undated source therefore cannot automatically be assumed to represent the current boundary system.

## External Services

Live discovery depends on external municipal and ArcGIS services.

Services may:

* change URLs
* change layer identifiers
* change field structures
* become unavailable
* publish new boundary datasets
* remove historical datasets

The discovery pipeline is therefore designed to re-evaluate sources rather than treating discovered URLs as permanent.

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

and must preserve reliable point-in-polygon behavior.

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
* expected district-count sources
* geographic-validation improvements
* performance improvements
* geometry-optimization improvements
* equivalence-detection improvements
* documentation improvements

---

# Disclaimer

Municipal political boundaries can change as a result of elections, redistricting, annexation, municipal legislation, or changes to published GIS data.

This project therefore treats:

* source provenance
* temporal status
* observed district structure
* expected district structure
* validation confidence
* geographic validation
* equivalence
* review status

as first-class data rather than assuming that a discovered GIS layer is permanently authoritative.

The project is intended to provide reproducible, validated geographic data, but downstream applications should account for the possibility that municipal boundaries and published GIS sources may change over time.
