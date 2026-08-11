/** Type surface for `scripts/install-warp-bins.mjs` (plain ESM, Node + Bun). */

export declare const WGCF_VERSION: string;
export declare const WIREPROXY_VERSION: string;
export declare const WGCF_RELEASE_BASE: string;
export declare const WIREPROXY_RELEASE_BASE: string;
export declare const WGCF_SHA256: Readonly<Record<string, string>>;
export declare const WIREPROXY_SHA256: Readonly<Record<string, string>>;

export interface WarpBinDownloadPlan {
  name: "wgcf" | "wireproxy";
  kind: "binary" | "tar.gz";
  url: string;
  sha256: string;
  targetFile: string;
  innerFile?: string;
}

export declare function platformKey(platform?: string, arch?: string): string | null;
export declare function sha256Hex(buffer: Uint8Array | ArrayBuffer): string;
export declare function planDownloads(platform?: string, arch?: string): {
  key: string | null;
  downloads: WarpBinDownloadPlan[];
  notes: string[];
};
