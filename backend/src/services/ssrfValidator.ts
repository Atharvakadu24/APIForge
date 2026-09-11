import net from 'net';
import dns from 'dns';

// IPv4 blocked CIDR definitions: [baseIp, prefixLength]
const BLOCKED_IPV4_RANGES: [string, number][] = [
  ['0.0.0.0', 8],          // "This" network (RFC 1122)
  ['10.0.0.0', 8],         // Private-Use Class A (RFC 1918)
  ['100.64.0.0', 10],      // Shared Address Space / Carrier-Grade NAT (RFC 6598)
  ['127.0.0.0', 8],        // Loopback (RFC 1122)
  ['169.254.0.0', 16],     // Link-Local / Cloud Metadata (RFC 3927)
  ['172.16.0.0', 12],      // Private-Use Class B (RFC 1918)
  ['192.0.0.0', 24],       // IETF Protocol Assignments (RFC 6890)
  ['192.0.2.0', 24],       // TEST-NET-1 (RFC 5737)
  ['192.88.99.0', 24],     // 6to4 Relay Anycast (RFC 3068)
  ['192.168.0.0', 16],     // Private-Use Class C (RFC 1918)
  ['198.18.0.0', 15],      // Network Benchmark Testing (RFC 2544)
  ['198.51.100.0', 24],    // TEST-NET-2 (RFC 5737)
  ['203.0.113.0', 24],     // TEST-NET-3 (RFC 5737)
  ['224.0.0.0', 4],        // Multicast (RFC 5771)
  ['240.0.0.0', 4],        // Reserved for future use (RFC 1112)
  ['255.255.255.255', 32], // Limited Broadcast (RFC 919)
];

// IPv6 blocked CIDR definitions: [baseIp, prefixLength]
const BLOCKED_IPV6_RANGES: [string, number][] = [
  ['::', 128],             // Unspecified (RFC 4291)
  ['::1', 128],            // Loopback (RFC 4291)
  ['100::', 64],           // Discard-Only Prefix (RFC 6666)
  ['2001:db8::', 32],      // Documentation (RFC 3849)
  ['fc00::', 7],           // Unique Local Address - ULA (RFC 4193)
  ['fe80::', 10],          // Link-Local Unicast (RFC 4291)
  ['fec0::', 10],          // Site-Local Unicast (Deprecated RFC 3879)
  ['ff00::', 8],           // Multicast (RFC 4291)
];

// Blocked hostnames & cloud metadata hosts
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.azure.internal',
  'instance-data',
  '169.254.169.254',
  '100.100.100.200',
]);

// Blocked private/internal domain suffixes
const BLOCKED_TLDS = ['.localhost', '.local', '.internal', '.corp', '.lan', '.home', '.localdomain'];

/**
 * Converts standard IPv4 string into unsigned 32-bit integer.
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Checks if IPv4 address integer falls within a CIDR subnet.
 */
function isIpv4InCidr(ipInt: number, cidrIp: string, prefixLen: number): boolean {
  const baseInt = ipv4ToInt(cidrIp);
  if (baseInt === null) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/**
 * Converts standard or expanded IPv6 string into a 128-bit BigInt.
 */
function ipv6ToBigInt(ip: string): bigint {
  let normalized = ip;
  if (normalized.includes('.')) {
    const lastColon = normalized.lastIndexOf(':');
    const ipv4Part = normalized.slice(lastColon + 1);
    const parts = ipv4Part.split('.').map(Number);
    if (parts.length === 4) {
      const hex1 = ((parts[0] << 8) | parts[1]).toString(16).padStart(4, '0');
      const hex2 = ((parts[2] << 8) | parts[3]).toString(16).padStart(4, '0');
      normalized = normalized.slice(0, lastColon + 1) + hex1 + ':' + hex2;
    }
  }

  const parts = normalized.split('::');
  const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
  const right = parts[1] ? parts[1].split(':').filter(Boolean) : [];

  const missing = 8 - (left.length + right.length);
  const full = [...left, ...Array(missing).fill('0'), ...right].map((p) => p || '0');

  let result = 0n;
  for (const part of full) {
    result = (result << 16n) + BigInt(parseInt(part, 16) || 0);
  }
  return result;
}

/**
 * Checks if IPv6 address BigInt falls within an IPv6 CIDR subnet.
 */
function isIpv6InCidr(ipBigInt: bigint, cidrIp: string, prefixLen: number): boolean {
  const baseBigInt = ipv6ToBigInt(cidrIp);
  const mask = prefixLen === 0 ? 0n : ((~0n << BigInt(128 - prefixLen)) & ((1n << 128n) - 1n));
  return (ipBigInt & mask) === (baseBigInt & mask);
}

export class SSRFSecurityError extends Error {
  public readonly code: string;
  public readonly target?: string;
  public readonly blockedAddress?: string;

  constructor(message: string, code: string, target?: string, blockedAddress?: string) {
    super(message);
    this.name = 'SSRFSecurityError';
    this.code = code;
    this.target = target;
    this.blockedAddress = blockedAddress;
  }
}

export class SSRFValidator {
  /**
   * Checks if an IP address (v4 or v6) is private, loopback, link-local, or restricted.
   */
  public static isBlockedIp(ip: string): boolean {
    if (!ip) return true;

    // IPv4 Check
    if (net.isIPv4(ip)) {
      const ipInt = ipv4ToInt(ip);
      if (ipInt === null) return true;
      return BLOCKED_IPV4_RANGES.some(([cidr, len]) => isIpv4InCidr(ipInt, cidr, len));
    }

    // IPv6 Check
    if (net.isIPv6(ip)) {
      // Check IPv4-Mapped IPv6 (e.g. ::ffff:127.0.0.1)
      if (ip.toLowerCase().startsWith('::ffff:')) {
        const lastColon = ip.lastIndexOf(':');
        const ipv4Part = ip.slice(lastColon + 1);
        if (net.isIPv4(ipv4Part)) {
          return this.isBlockedIp(ipv4Part);
        }
      }

      try {
        const ipBigInt = ipv6ToBigInt(ip);

        // Check standard IPv6 blocked ranges
        const isStandardBlocked = BLOCKED_IPV6_RANGES.some(([cidr, len]) => isIpv6InCidr(ipBigInt, cidr, len));
        if (isStandardBlocked) return true;

        // Check NAT64 Prefix (64:ff9b::/96) - extract embedded IPv4 in bottom 32 bits and evaluate
        const nat64Prefix = ipv6ToBigInt('64:ff9b::');
        const nat64Mask = ((~0n << 32n) & ((1n << 128n) - 1n));
        if ((ipBigInt & nat64Mask) === (nat64Prefix & nat64Mask)) {
          const embeddedIpv4Int = Number(ipBigInt & 0xffffffffn);
          const octet1 = (embeddedIpv4Int >>> 24) & 255;
          const octet2 = (embeddedIpv4Int >>> 16) & 255;
          const octet3 = (embeddedIpv4Int >>> 8) & 255;
          const octet4 = embeddedIpv4Int & 255;
          const embeddedIpStr = `${octet1}.${octet2}.${octet3}.${octet4}`;
          return this.isBlockedIp(embeddedIpStr);
        }

        return false;
      } catch {
        return true; // Reject on parse failure
      }
    }

    return true; // Not a recognized IP
  }

  /**
   * Checks if a hostname matches forbidden hostnames, TLDs, or cloud metadata aliases.
   */
  public static isBlockedHostname(hostname: string): boolean {
    if (!hostname) return true;
    const lower = hostname.toLowerCase().trim().replace(/\.$/, ''); // Strip trailing dot

    if (BLOCKED_HOSTNAMES.has(lower)) {
      return true;
    }

    if (BLOCKED_TLDS.some((tld) => lower.endsWith(tld))) {
      return true;
    }

    // Check if hostname is direct IP string
    if (net.isIP(lower)) {
      return this.isBlockedIp(lower);
    }

    return false;
  }

  /**
   * Validates URL format and protocol.
   * Only allows http: and https: schemes.
   */
  public static validateUrlProtocolAndFormat(rawUrl: string): URL {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      throw new SSRFSecurityError('URL cannot be empty.', 'INVALID_URL');
    }

    let parsed: URL;
    const trimmed = rawUrl.trim();

    try {
      // If URL does not have a scheme (e.g. api.example.com/path), default to http://
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
        parsed = new URL(`http://${trimmed}`);
      } else {
        parsed = new URL(trimmed);
      }
    } catch {
      throw new SSRFSecurityError(`Invalid URL format: "${rawUrl}"`, 'INVALID_URL', rawUrl);
    }

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SSRFSecurityError(
        `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.`,
        'INVALID_PROTOCOL',
        rawUrl
      );
    }

    // Port range check
    if (parsed.port) {
      const portNum = Number(parsed.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        throw new SSRFSecurityError(`Invalid port number: "${parsed.port}"`, 'INVALID_URL', rawUrl);
      }
    }

    // Reject embedded credentials in URL (security best practice)
    if (parsed.username || parsed.password) {
      throw new SSRFSecurityError(
        'Embedded credentials in URL are not permitted for security.',
        'INVALID_URL',
        rawUrl
      );
    }

    // Hostname check
    const hostname = parsed.hostname;
    if (!hostname || this.isBlockedHostname(hostname)) {
      throw new SSRFSecurityError(
        `Access to destination host "${hostname}" is blocked for security.`,
        'SSRF_BLOCKED',
        rawUrl,
        hostname
      );
    }

    return parsed;
  }

  /**
   * Asynchronously validates hostname DNS resolution against private and restricted IP ranges.
   */
  public static async validateDestination(url: URL): Promise<void> {
    const hostname = url.hostname;

    // If direct numeric IP
    if (net.isIP(hostname)) {
      if (this.isBlockedIp(hostname)) {
        throw new SSRFSecurityError(
          `Access to restricted IP address "${hostname}" is blocked for security.`,
          'SSRF_BLOCKED',
          url.toString(),
          hostname
        );
      }
      return;
    }

    // Static hostname pattern check
    if (this.isBlockedHostname(hostname)) {
      throw new SSRFSecurityError(
        `Access to restricted host "${hostname}" is blocked for security.`,
        'SSRF_BLOCKED',
        url.toString(),
        hostname
      );
    }

    // DNS Resolution Check
    try {
      const addresses = await dns.promises.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) {
        throw new SSRFSecurityError(
          `Could not resolve destination hostname "${hostname}".`,
          'DNS_LOOKUP_FAILED',
          url.toString()
        );
      }

      for (const record of addresses) {
        if (this.isBlockedIp(record.address)) {
          throw new SSRFSecurityError(
            `Destination hostname "${hostname}" resolved to restricted IP "${record.address}" and was blocked for security.`,
            'SSRF_BLOCKED',
            url.toString(),
            record.address
          );
        }
      }
    } catch (err: any) {
      if (err instanceof SSRFSecurityError) throw err;
      throw new SSRFSecurityError(
        `DNS resolution failed for hostname "${hostname}": ${err.message}`,
        'DNS_LOOKUP_FAILED',
        url.toString()
      );
    }
  }

  /**
   * Creates a socket-level DNS lookup function for Node http/https Agents.
   * Intercepts and validates every address right before socket creation.
   */
  public static createSsrfSafeLookup() {
    return (
      hostname: string,
      options: any,
      callback: (err: Error | null, addressOrAddresses?: any, family?: number) => void
    ) => {
      // Direct IP check
      if (net.isIP(hostname)) {
        if (SSRFValidator.isBlockedIp(hostname)) {
          return callback(
            new SSRFSecurityError(
              `Socket connection to restricted IP "${hostname}" is blocked for security.`,
              'SSRF_BLOCKED',
              undefined,
              hostname
            )
          );
        }
        if (options && options.all) {
          return callback(null, [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }]);
        }
        return callback(null, hostname, net.isIPv6(hostname) ? 6 : 4);
      }

      // Static hostname check
      if (SSRFValidator.isBlockedHostname(hostname)) {
        return callback(
          new SSRFSecurityError(
            `Socket connection to restricted host "${hostname}" is blocked for security.`,
            'SSRF_BLOCKED',
            undefined,
            hostname
          )
        );
      }

      // Resolve DNS with { all: true }
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (err) return callback(err);
        if (!addresses || addresses.length === 0) {
          return callback(
            new SSRFSecurityError(
              `DNS lookup returned no addresses for "${hostname}".`,
              'DNS_LOOKUP_FAILED'
            )
          );
        }

        // Validate EVERY returned IP
        for (const addr of addresses) {
          if (SSRFValidator.isBlockedIp(addr.address)) {
            return callback(
              new SSRFSecurityError(
                `DNS resolution for "${hostname}" returned restricted IP "${addr.address}" and was blocked for security.`,
                'SSRF_BLOCKED',
                undefined,
                addr.address
              )
            );
          }
        }

        // Return validated address matching requested format
        if (options && options.all) {
          return callback(null, addresses);
        }
        return callback(null, addresses[0].address, addresses[0].family);
      });
    };
  }
}
