import Bundlr from "@bundlr-network/client"

import type { NextApiRequest, NextApiResponse } from "next";
import { Keypair, PublicKey } from "@solana/web3.js";

if(!process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE || !process.env.SOLANA_PRIVATE_KEY) {
  throw new Error("missing env variables");
}

const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY)));


// Endpoint protected by middleware.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if(req.method !== 'POST') {
    return res.status(404).end();
  }
  if(!process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE) {
    return res.status(404).end();
  }

  const body = JSON.parse(req.body);

  const signatureData = new Uint8Array(Buffer.from(body.signatureData, "base64"));
  const size = body.size;

  const serverBundlr = new Bundlr(process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE, "solana", keypair.secretKey);

  const price = await serverBundlr.getPrice(size);
  const balance = await serverBundlr.getLoadedBalance();

  if(price.multipliedBy(10).gt(balance)) {
    await serverBundlr.fund(price.multipliedBy(10).minus(balance));
  }

  console.log(serverBundlr.utils.unitConverter(balance).toNumber(), "Balance");
  console.log(serverBundlr.utils.unitConverter(price).toNumber(), "Price");

  const signature = await serverBundlr.currencyConfig.sign(signatureData);

  const pubkey = new PublicKey(await serverBundlr.currencyConfig.getPublicKey())

  res.setHeader("Cache-Control", "no-cache")
  res.json({
    pubkey: pubkey.toString(),
    signature: Buffer.from(signature).toString("base64")
  });
}
