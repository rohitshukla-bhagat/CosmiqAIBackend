import QRcode from "qrcode";

const otpAuthUri = process.argv[2];

if (!otpAuthUri) {
  throw new Error("Pass otpAuthUri as argument");
}

async function main() {
  await QRcode.toFile("totp.png", otpAuthUri);
  console.log("Saved QR Code");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});