import { compressPayload, decompressPayload } from '../lib/db/compression';

const sample = { id: "123", title: "Test Audit", items: [1, 2, 3] };
console.log("Original Size:", JSON.stringify(sample).length);

const compressed = compressPayload(sample);
console.log("Compressed Payload:", compressed);
console.log("Compressed Size:", compressed.length);

const decompressed = decompressPayload(compressed);
console.log("Decompressed Result:", decompressed);
console.log("Match:", JSON.stringify(sample) === JSON.stringify(decompressed));
