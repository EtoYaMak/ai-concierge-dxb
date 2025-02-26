import { processNestedData } from "@/app/api/lib/processData";

async function main() {
  try {
    console.log("Starting data processing...");
    await processNestedData();
    console.log("Data processing completed successfully!");
  } catch (error) {
    console.error("Error processing data:", error);
    process.exit(1);
  }
}

main();
