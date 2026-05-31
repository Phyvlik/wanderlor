// Run: node scripts/generate-keypair.mjs
// Then fund the address at https://faucet.solana.com (select Devnet, request 2 SOL)
import { Keypair } from '@solana/web3.js';

const kp = Keypair.generate();
console.log('\n=== WanderLore Solana App Keypair ===');
console.log('Public key (fund this address with devnet SOL):');
console.log(kp.publicKey.toString());
console.log('\nAdd this line to your .env.local:');
console.log('SOLANA_PRIVATE_KEY=' + JSON.stringify(Array.from(kp.secretKey)));
console.log('\nFund at: https://faucet.solana.com');
