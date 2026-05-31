import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@metaplex-foundation/umi',
    '@metaplex-foundation/umi-bundle-defaults',
    '@metaplex-foundation/mpl-token-metadata',
    '@metaplex-foundation/umi-uploader-irys',
    '@solana/web3.js',
  ],
};

export default nextConfig;
