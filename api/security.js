/**
 * RPKI Route Origin Validation (ROV) & Rogue Router Threat Simulation Engine
 * Compliant with RFC 6480, RFC 6811 BGP Prefix Origin Validation specifications.
 */

/**
 * Parses an IPv4 CIDR string (e.g., "10.0.0.0/24") into structured integer representation.
 * @param {string} cidr 
 * @returns {Object|null}
 */
function parseCidr(cidr) {
    if (!cidr || typeof cidr !== 'string') return null;
    const parts = cidr.trim().split('/');
    if (parts.length !== 2) return null;

    const octets = parts[0].split('.').map(o => parseInt(o, 10));
    if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) {
        return null;
    }

    const prefixLen = parseInt(parts[1], 10);
    if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) {
        return null;
    }

    const ipInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const mask = prefixLen === 0 ? 0 : ((0xFFFFFFFF << (32 - prefixLen)) >>> 0);
    const network = (ipInt & mask) >>> 0;

    return {
        cidr: `${(network >>> 24) & 255}.${(network >>> 16) & 255}.${(network >>> 8) & 255}.${network & 255}/${prefixLen}`,
        ipStr: parts[0],
        prefixLen,
        ipInt,
        mask,
        network
    };
}

/**
 * Checks if childCidr is an exact match or a subnet contained within parentCidr.
 * @param {string} childCidr 
 * @param {string} parentCidr 
 * @returns {boolean}
 */
function isSubnetOf(childCidr, parentCidr) {
    const child = parseCidr(childCidr);
    const parent = parseCidr(parentCidr);
    if (!child || !parent) return false;
    if (child.prefixLen < parent.prefixLen) return false;
    return ((child.network & parent.mask) >>> 0) === parent.network;
}

/**
 * Standard Deterministic Route Origin Authorizations (ROA) Records for Demo.
 */
const DEFAULT_ROAS = [
    {
        prefix: '10.0.0.0/24',
        asn: 100,
        maxLength: 24,
        description: 'Authorized Demo Destination Prefix (Legitimate Origin: AS 100)'
    },
    {
        prefix: '10.0.0.0/16',
        asn: 100,
        maxLength: 24,
        description: 'Authorized Supernet Aggregation Block (AS 100)'
    },
    {
        prefix: '192.168.0.0/16',
        asn: 200,
        maxLength: 24,
        description: 'Corporate Transit Network (AS 200)'
    }
];

/**
 * Validates a route announcement against a list of ROA records according to RFC 6811.
 * 
 * Outcome Rules:
 * - NOT_FOUND: No ROA covers the announced prefix.
 * - VALID: At least one covering ROA authorizes the origin ASN and announced prefix length <= maxLength.
 * - INVALID: One or more covering ROAs exist, but none authorize the origin ASN or prefix length.
 * 
 * @param {Object} announcement - { prefix, originAsn, advertisingRouter, id }
 * @param {Array} roas - Array of ROA records
 * @returns {Object} Validation outcome
 */
function validateRouteOrigin(announcement, roas = DEFAULT_ROAS) {
    if (!announcement || !announcement.prefix) {
        return {
            status: 'INVALID',
            reason: 'Missing or null route announcement prefix',
            coveringRoas: [],
            matchedRoa: null
        };
    }

    const parsed = parseCidr(announcement.prefix);
    if (!parsed) {
        return {
            status: 'INVALID',
            reason: `Malformed IP prefix format: "${announcement.prefix}"`,
            coveringRoas: [],
            matchedRoa: null
        };
    }

    const annAsn = Number(announcement.originAsn);
    if (isNaN(annAsn)) {
        return {
            status: 'INVALID',
            reason: `Invalid origin ASN: "${announcement.originAsn}"`,
            coveringRoas: [],
            matchedRoa: null
        };
    }

    // Step 1: Find all ROAs that cover the announced prefix
    const coveringRoas = (roas || []).filter(roa => isSubnetOf(announcement.prefix, roa.prefix));

    if (coveringRoas.length === 0) {
        return {
            status: 'NOT_FOUND',
            reason: `No covering ROA registered for prefix ${announcement.prefix}`,
            coveringRoas: [],
            matchedRoa: null
        };
    }

    // Step 2: Check if any covering ROA authorizes the announcement
    for (const roa of coveringRoas) {
        const roaParsed = parseCidr(roa.prefix);
        const maxLen = (roa.maxLength !== undefined && roa.maxLength !== null)
            ? Number(roa.maxLength)
            : roaParsed.prefixLen;

        const asnMatches = Number(roa.asn) === annAsn;
        const lenValid = parsed.prefixLen <= maxLen;

        if (asnMatches && lenValid) {
            return {
                status: 'VALID',
                reason: `Authorized by ROA ${roa.prefix} (Origin ASN ${roa.asn}, maxLength /${maxLen})`,
                coveringRoas,
                matchedRoa: roa
            };
        }
    }

    // Step 3: Covering ROAs exist, but none matched both conditions -> INVALID
    const matchingAsnRoa = coveringRoas.find(r => Number(r.asn) === annAsn);
    let reason;
    if (matchingAsnRoa) {
        const maxLen = matchingAsnRoa.maxLength !== undefined ? matchingAsnRoa.maxLength : parseCidr(matchingAsnRoa.prefix).prefixLen;
        reason = `Prefix length /${parsed.prefixLen} exceeds authorized maxLength /${maxLen} in covering ROA for AS ${annAsn}`;
    } else {
        const authorizedAsns = coveringRoas.map(r => `AS${r.asn}`).join(', ');
        reason = `Unauthorized origin AS ${annAsn} for prefix ${announcement.prefix}. Authorized AS(es): ${authorizedAsns}`;
    }

    return {
        status: 'INVALID',
        reason,
        coveringRoas,
        matchedRoa: null
    };
}

/**
 * Creates deterministic route announcements for a simulation run.
 * 
 * @param {Object} params
 * @param {string} params.target - Destination router ID
 * @param {string} params.prefix - Destination IP prefix (default "10.0.0.0/24")
 * @param {number} params.targetAsn - Legitimate origin ASN (default 100)
 * @param {boolean} params.simulateRogue - Whether rogue router attack is armed
 * @param {string} params.rogueNodeId - Compromised router ID
 * @param {number} params.rogueAsn - Rogue origin ASN (default 999)
 * @returns {Array} List of route announcements
 */
function createRouteAnnouncements({
    target,
    prefix = '10.0.0.0/24',
    targetAsn = 100,
    simulateRogue = false,
    rogueNodeId = null,
    rogueAsn = 999
}) {
    const announcements = [];

    // 1. Legitimate Route Announcement from the actual destination router
    announcements.push({
        id: `ann-legit-${target}`,
        prefix,
        originAsn: Number(targetAsn),
        advertisingRouter: target,
        nextHop: target,
        metric: 0,
        type: 'legitimate',
        description: `Legitimate route originated by router ${target} for prefix ${prefix}`
    });

    // 2. Malicious Route Announcement injected by rogue router if attack enabled
    if (simulateRogue && rogueNodeId) {
        announcements.push({
            id: `ann-rogue-${rogueNodeId}`,
            prefix,
            originAsn: Number(rogueAsn),
            advertisingRouter: rogueNodeId,
            nextHop: rogueNodeId,
            metric: 0,
            type: 'forged_origin_hijack',
            attackType: 'blackhole',
            description: `Forged BGP route announcement injected by rogue router ${rogueNodeId} claiming origin AS ${rogueAsn}`
        });
    }

    return announcements;
}

/**
 * Applies RPKI security policy to filter route announcements.
 * 
 * Policy:
 * - If RPKI Defense is ENABLED:
 *   - INVALID announcements are REJECTED and quarantined.
 *   - VALID announcements are ACCEPTED.
 *   - NOT_FOUND announcements are ACCEPTED unless options.rejectNotFound is true.
 * - If RPKI Defense is DISABLED:
 *   - All announcements remain eligible (attack routes are NOT filtered).
 * 
 * @param {Array} announcements 
 * @param {Array} roas 
 * @param {Object} options - { rpkiEnabled: boolean, rejectNotFound: boolean }
 * @returns {Object} Filtered results
 */
function applySecurityPolicy(announcements, roas = DEFAULT_ROAS, options = {}) {
    const rpkiEnabled = Boolean(options.rpkiEnabled);
    const rejectNotFound = Boolean(options.rejectNotFound);

    const rpkiResults = [];
    const eligibleRoutes = [];
    const rejectedRoutes = [];
    const quarantinedRoutes = [];
    const securityEvents = [];

    announcements.forEach(ann => {
        const validation = validateRouteOrigin(ann, roas);
        const record = {
            announcementId: ann.id,
            prefix: ann.prefix,
            originAsn: ann.originAsn,
            advertisingRouter: ann.advertisingRouter,
            isRogue: ann.type === 'forged_origin_hijack',
            attackType: ann.attackType || null,
            status: validation.status,
            reason: validation.reason,
            matchedRoa: validation.matchedRoa ? {
                prefix: validation.matchedRoa.prefix,
                asn: validation.matchedRoa.asn,
                maxLength: validation.matchedRoa.maxLength
            } : null
        };
        rpkiResults.push(record);

        if (rpkiEnabled) {
            if (validation.status === 'INVALID') {
                rejectedRoutes.push(ann);
                quarantinedRoutes.push(ann);
                securityEvents.push({
                    type: 'RPKI_INVALID_REJECTED',
                    routerId: ann.advertisingRouter,
                    prefix: ann.prefix,
                    originAsn: ann.originAsn,
                    message: `[RPKI Origin Validation: INVALID] Announcement ${ann.id} from router ${ann.advertisingRouter} for ${ann.prefix} (Origin AS ${ann.originAsn}) REJECTED. Reason: ${validation.reason}. Route quarantined.`,
                    action: 'QUARANTINE_ROUTE',
                    timestamp: new Date().toISOString()
                });
            } else if (validation.status === 'NOT_FOUND') {
                if (rejectNotFound) {
                    rejectedRoutes.push(ann);
                    securityEvents.push({
                        type: 'RPKI_NOT_FOUND_REJECTED',
                        routerId: ann.advertisingRouter,
                        prefix: ann.prefix,
                        originAsn: ann.originAsn,
                        message: `[RPKI Strict Policy: NOT_FOUND REJECTED] Route for ${ann.prefix} rejected because no covering ROA exists.`,
                        action: 'REJECT_ROUTE',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    eligibleRoutes.push(ann);
                    securityEvents.push({
                        type: 'RPKI_NOT_FOUND_PERMITTED',
                        routerId: ann.advertisingRouter,
                        prefix: ann.prefix,
                        originAsn: ann.originAsn,
                        message: `[RPKI Origin Validation: NOT_FOUND] No ROA covers ${ann.prefix}. Route accepted under standard permissive policy.`,
                        action: 'PERMIT_ROUTE',
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                // VALID
                eligibleRoutes.push(ann);
                securityEvents.push({
                    type: 'RPKI_VALID_ACCEPTED',
                    routerId: ann.advertisingRouter,
                    prefix: ann.prefix,
                    originAsn: ann.originAsn,
                    message: `[RPKI Origin Validation: VALID] Announcement ${ann.id} from router ${ann.advertisingRouter} for ${ann.prefix} (Origin AS ${ann.originAsn}) verified against ROA. Route accepted.`,
                    action: 'PERMIT_ROUTE',
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            // Defense OFF: All announcements are accepted into route selection
            eligibleRoutes.push(ann);
            if (ann.type === 'forged_origin_hijack') {
                securityEvents.push({
                    type: 'ROUGE_ATTACK_UNPROTECTED',
                    routerId: ann.advertisingRouter,
                    prefix: ann.prefix,
                    originAsn: ann.originAsn,
                    message: `[SECURITY WARNING: RPKI Defense Inactive] Malicious route announcement from rogue router ${ann.advertisingRouter} (Origin AS ${ann.originAsn}) accepted into routing table without cryptographic validation!`,
                    action: 'ATTACK_ACCEPTED',
                    timestamp: new Date().toISOString()
                });
            }
        }
    });

    return {
        rpkiResults,
        eligibleRoutes,
        rejectedRoutes,
        quarantinedRoutes,
        securityEvents
    };
}

module.exports = {
    parseCidr,
    isSubnetOf,
    DEFAULT_ROAS,
    validateRouteOrigin,
    createRouteAnnouncements,
    applySecurityPolicy
};
