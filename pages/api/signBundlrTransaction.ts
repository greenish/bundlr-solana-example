import Bundlr from "@bundlr-network/client"

import type { NextApiRequest, NextApiResponse } from "next";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
if (!process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE || !process.env.SOLANA_PRIVATE_KEY || !process.env.SOLANA_RPC) {
  throw new Error("missing env variables");
}

const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.SOLANA_PRIVATE_KEY)));
const connection = new Connection(process.env.SOLANA_RPC);

// Endpoint protected by middleware.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(404).end();
  }
  if (!process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE) {
    return res.status(404).end();
  }
  let balanceToppedUp = 0;
  const body = JSON.parse(req.body);

  const signatureData = new Uint8Array(Buffer.from(body.signatureData, "base64"));
  const size = body.size;

  const serverBundlr = new Bundlr(process.env.NEXT_PUBLIC_BUNDLR_NETWORK_NODE, "solana", keypair.secretKey);

  const sign = async (message: Uint8Array): Promise<Uint8Array> => {
    return serverBundlr.currencyConfig.sign(Buffer.from(Buffer.from(message).toString("hex")));
  };

  const [solBalance, price, balance, signature] = await Promise.all([
    (async () => (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL)(),
    serverBundlr.getPrice(size),
    serverBundlr.getLoadedBalance(),
    sign(signatureData),
  ]);

  if (price.multipliedBy(10).gt(balance)) {
    const topUp = price.multipliedBy(10).minus(balance);
    await serverBundlr.fund(price.multipliedBy(10).minus(balance));
    balanceToppedUp = serverBundlr.utils.unitConverter(topUp).toNumber()
  }

  res.setHeader("Cache-Control", "no-cache")
  res.json({
    signature: Buffer.from(signature).toString("base64"),
    price: serverBundlr.utils.unitConverter(price).toNumber(),
    bundlrBalance: serverBundlr.utils.unitConverter(balance).toNumber(),
    solBalance,
    balanceToppedUp
  });
}
