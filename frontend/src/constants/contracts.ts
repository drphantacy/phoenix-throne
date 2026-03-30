// Contract addresses per chain ID
// Update these after deploying to each network
export const CONTRACT_ADDRESSES: Record<string, string> = {
  '31337': '0x0000000000000000000000000000000000000000', // localcofhe - update after deploy
  '11155111': '0x09Aa8623807CfEC82c05242DFa53F8ec5428fEf2', // eth-sepolia
  '421614': '0x0000000000000000000000000000000000000000', // arb-sepolia - update after deploy
};

export function getContractAddress(chainId: string): string | null {
  return CONTRACT_ADDRESSES[chainId] || null;
}
