import type {
    CandidateScore,
    InspectedCandidate
} from "./types.js";

import {
    rankCandidates
} from "./rank.js";


// =============================================================================
// Valid candidate report
// =============================================================================

export function printValidCandidates(
    candidates: InspectedCandidate[]
): void {

    const ranked =
        rankCandidates(
            candidates
        );


    console.log(
        "\nValid candidates:"
    );


    console.log(
        `  Total: ${ranked.length}`
    );


    for (
        const [index, item]
        of ranked.entries()
    ) {

        printCandidate(
            item,
            index + 1
        );
    }
}


// =============================================================================
// Print one candidate
// =============================================================================

function printCandidate(
    item: CandidateScore,
    rank: number
): void {

    const candidate =
        item.candidate;

    const inspection =
        candidate.inspection;

    const classification =
        candidate.classification;

    const validation =
        candidate.validation;


    console.log(
        `\n  ${rank}. ${inspection.title ?? "(untitled)"}`
    );

    console.log(
        `     Score: ${item.score}`
    );

    console.log(
        `     URL: ${inspection.url}`
    );

    console.log(
        `     Service: ${inspection.serviceType}`
    );

    console.log(
        `     Geometry: ${
            inspection.geometryType ?? "unknown"
        }`
    );

    console.log(
        `     Political boundary: ${
            classification.isPoliticalBoundary
        }`
    );

    console.log(
        `     Official municipal source: ${
            classification.officialMunicipalSource
        }`
    );

    console.log(
        `     District type: ${
            classification.districtType ?? "none"
        }`
    );

    console.log(
        `     District field: ${
            inspection.districtField ?? "none"
        }`
    );

    console.log(
        `     District fields: ${
            inspection.districtFields.join(", ") || "none"
        }`
    );

    console.log(
        `     Name field: ${
            inspection.nameField ?? "none"
        }`
    );

    console.log(
        `     Name fields: ${
            inspection.nameFields.join(", ") || "none"
        }`
    );


    if (
        validation
    ) {

        console.log(
            `     Validation political: ${
                validation.isLikelyPoliticalBoundary
            }`
        );

        console.log(
            `     Validation confidence: ${
                validation.confidence
            }`
        );

        console.log(
            `     Validation district field: ${
                validation.districtField ?? "none"
            }`
        );

        console.log(
            `     Validation samples: ${
                validation.sampleCount
            }`
        );

        console.log(
            `     Distinct district values: ${
                validation.distinctDistrictValues
            }`
        );

        console.log(
            `     District value pattern: ${
                validation.districtValuePattern ?? "none"
            }`
        );
    }


    console.log(
        `     Requires review: ${
            candidate.candidate.requiresReview ||
            classification.requiresReview
        }`
    );


    console.log(
        `     Reasons:`
    );


    for (
        const reason of item.reasons
    ) {

        console.log(
            `       ${reason}`
        );
    }
}