import { NextResponse } from 'next/server';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createSignerFromKeypair,
  signerIdentity,
  generateSigner,
  percentAmount,
  publicKey as umiPublicKey,
} from '@metaplex-foundation/umi';
import { createNft, mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import { irysUploader } from '@metaplex-foundation/umi-uploader-irys';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { GoogleGenerativeAI } from '@google/generative-ai';

function getPayerKeypairBytes(): Uint8Array {
  const raw = process.env.SOLANA_PRIVATE_KEY;
  if (!raw) throw new Error('SOLANA_PRIVATE_KEY not set');
  return Uint8Array.from(JSON.parse(raw) as number[]);
}

// Generate landmark image using Gemini
async function generateLandmarkImage(landmarkName: string, era: string): Promise<Buffer | null> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: `Create a vivid, detailed artistic painting of ${landmarkName} from the ${era} era. Make it look like a collectible digital artwork with rich colors and dramatic lighting. No text or labels.` }],
      }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } as any,
    });

    for (const part of result.response.candidates?.[0]?.content?.parts ?? []) {
      if ((part as any).inlineData?.data) {
        return Buffer.from((part as any).inlineData.data, 'base64');
      }
    }
    return null;
  } catch (err) {
    console.error('[Gemini image gen]', err);
    return null;
  }
}

// Fallback: fetch Wikipedia image as buffer
async function fetchWikipediaImage(landmarkName: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(landmarkName)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const imgUrl = data.originalimage?.source || data.thumbnail?.source;
    if (!imgUrl) return null;
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(8000) });
    return Buffer.from(await imgRes.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { walletAddress, landmarkName, era, lat, lng } = await request.json();

    if (!walletAddress) return NextResponse.json({ error: 'walletAddress required' }, { status: 400 });
    if (!process.env.SOLANA_PRIVATE_KEY) return NextResponse.json({ error: 'Keypair not configured' }, { status: 500 });

    // Set up UMI with Irys uploader (free on devnet)
    const umi = createUmi('https://api.devnet.solana.com')
      .use(mplTokenMetadata())
      .use(irysUploader({ address: 'https://devnet.irys.xyz' }));

    const payerKeypair = umi.eddsa.createKeypairFromSecretKey(getPayerKeypairBytes());
    const payer = createSignerFromKeypair(umi, payerKeypair);
    umi.use(signerIdentity(payer));

    // 1. Generate image with Gemini, fallback to Wikipedia
    console.log('[mint-nft] Generating image for', landmarkName);
    let imageBuffer = await generateLandmarkImage(landmarkName, era || 'historical');
    if (!imageBuffer) {
      console.log('[mint-nft] Gemini failed, trying Wikipedia');
      imageBuffer = await fetchWikipediaImage(landmarkName);
    }

    // 2. Upload image to Arweave via Irys
    let imageUri = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=400x400&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;
    if (imageBuffer) {
      console.log('[mint-nft] Uploading image to Arweave...');
      const [uploadedImageUri] = await umi.uploader.upload([
        { buffer: imageBuffer, fileName: 'landmark.jpg', displayName: landmarkName, contentType: 'image/jpeg', uniqueName: `${landmarkName}-${Date.now()}`, tags: [] },
      ]);
      imageUri = uploadedImageUri;
      console.log('[mint-nft] Image uploaded:', imageUri);
    }

    // 3. Upload metadata JSON to Arweave
    const shortAddr = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    const metadataUri = await umi.uploader.uploadJson({
      name: `WanderLore: ${landmarkName}`.slice(0, 32),
      symbol: 'WLORE',
      description: `A landmark discovered in WanderLore by operative ${shortAddr}. Era: ${era || 'Unknown'}. Part of the WanderLore real-world RPG built on Solana.`,
      image: imageUri,
      external_url: 'https://wanderlore.io',
      attributes: [
        { trait_type: 'Landmark',   value: landmarkName },
        { trait_type: 'Era',        value: era || 'Unknown' },
        { trait_type: 'Discoverer', value: shortAddr },
        { trait_type: 'Latitude',   value: String(lat ?? 0) },
        { trait_type: 'Longitude',  value: String(lng ?? 0) },
        { trait_type: 'Game',       value: 'WanderLore' },
        { trait_type: 'Network',    value: 'Solana Devnet' },
      ],
      properties: {
        files: [{ uri: imageUri, type: 'image/jpeg' }],
        category: 'image',
      },
    });
    console.log('[mint-nft] Metadata uploaded:', metadataUri);

    // 4. Mint the NFT on Solana Devnet
    const mint = generateSigner(umi);
    const { signature } = await createNft(umi, {
      mint,
      name: `WanderLore: ${landmarkName}`.slice(0, 32),
      symbol: 'WLORE',
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(0),
      tokenOwner: umiPublicKey(walletAddress),
    }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });

    const txSignature = base58.deserialize(signature)[0];
    const mintAddress = mint.publicKey.toString();

    console.log('[mint-nft] Minted:', mintAddress, 'tx:', txSignature);

    return NextResponse.json({
      mint: mintAddress,
      signature: txSignature,
      imageUri,
      metadataUri,
      explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`,
      mintUrl: `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`,
    });
  } catch (err: any) {
    console.error('[mint-nft]', err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
