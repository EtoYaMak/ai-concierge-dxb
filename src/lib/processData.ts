import { type InsertActivity } from "@/shared/schema";
import { generateEmbeddings } from "@/lib/openai";
import { storage } from "@/lib/storage";
import nestedData from "@/assets/nested_data.json";

const BATCH_SIZE = 5; // Process 5 activities at a time to avoid rate limits

async function processNestedData(forceReprocess = false) {
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let total = 0;
  const failedEntries: {
    id: string | null;
    category: string;
    subcategory: string;
    error: string;
  }[] = [];

  // First, count total activities
  for (const categoryData of Object.values(nestedData as Record<string, any>)) {
    for (const subcategoryData of Object.values(
      categoryData.subcategories as Record<string, any>
    )) {
      total += (subcategoryData.activities as any[]).length;
    }
  }

  console.log(`Found ${total} total activities to process`);

  // Check which activities are already in the database
  const existingActivities = forceReprocess
    ? []
    : await storage.getAllActivitiesOriginalIds();
  const existingIds = new Set(existingActivities.map((a) => a.original_id));

  console.log(`Found ${existingIds.size} activities already in database`);

  // Process category by category, subcategory by subcategory
  for (const [category, categoryData] of Object.entries(
    nestedData as Record<string, any>
  )) {
    console.log(`Processing category: ${category}`);

    for (const [subcategory, subcategoryData] of Object.entries(
      categoryData.subcategories as Record<string, any>
    )) {
      console.log(
        `  Processing subcategory: ${subcategory} (${
          (subcategoryData.activities as any[]).length
        } activities)`
      );

      let currentBatch: (InsertActivity & { embeddings: number[] })[] = [];

      for (const activity of subcategoryData.activities as any[]) {
        try {
          // Skip if already processed (unless forcing reprocess)
          if (!forceReprocess && existingIds.has(activity.id)) {
            skipped++;
            continue;
          }

          // Generate content for embeddings by combining relevant fields
          const contentForEmbedding = [
            activity.name,
            activity.description,
            activity.information,
            category,
            subcategory,
          ]
            .filter(Boolean)
            .join("\n");

          // Generate embeddings
          const embeddings = await generateEmbeddings(contentForEmbedding);

          currentBatch.push({
            originalId: activity.id,
            name: activity.name,
            slug: activity.slug,
            address: activity.address,
            category,
            subcategory,
            description: activity.description,
            information: activity.information,
            timing: activity.timing_content,
            pricing: activity.pricing_content,
            booking_type: activity.booking_type,
            redirect_url: activity.redirect_url,
            embeddings,
          });

          processed++;

          // Status report every 20 activities
          if (processed % 20 === 0) {
            console.log(
              `Progress: ${
                processed + skipped
              }/${total} (${processed} processed, ${skipped} skipped, ${failed} failed)`
            );
          }

          // Process batch when it reaches BATCH_SIZE
          if (currentBatch.length >= BATCH_SIZE) {
            await storage.createManyActivities([...currentBatch]);
            console.log(`Saved batch of ${currentBatch.length} activities`);
            currentBatch = []; // Create a new array rather than clearing
          }
        } catch (error) {
          failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `Error processing activity ${activity.id} (${activity.name}):`,
            error
          );
          failedEntries.push({
            id: activity.id,
            category,
            subcategory,
            error: errorMessage,
          });
          // Continue with other activities even if one fails
        }
      }

      // Save any remaining activities in the batch for this subcategory
      if (currentBatch.length > 0) {
        try {
          await storage.createManyActivities([...currentBatch]);
          console.log(
            `Saved final batch of ${currentBatch.length} activities for subcategory ${subcategory}`
          );
          currentBatch = [];
        } catch (error) {
          console.error(
            `Failed to save batch for subcategory ${subcategory}:`,
            error
          );
          failed += currentBatch.length;
          for (const activity of currentBatch) {
            failedEntries.push({
              id: activity.originalId || null,
              category,
              subcategory,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  // Final report
  console.log(`
    Processing complete:
    - Total entries: ${total}
    - Successfully processed: ${processed}
    - Skipped (already existed): ${skipped}
    - Failed: ${failed}
  `);

  if (failedEntries.length > 0) {
    console.log("Failed entries:", JSON.stringify(failedEntries, null, 2));
  }

  // Validation step
  const afterCount = await storage.getActivitiesCount();
  console.log(`
    Database validation:
    - Expected total count: ${existingIds.size + processed}
    - Actual count in database: ${afterCount}
    - Missing entries: ${existingIds.size + processed - afterCount}
  `);

  return {
    total,
    processed,
    skipped,
    failed,
    failedEntries,
  };
}

// Helper function to resume processing only failed entries
async function reprocessFailedEntries(
  failedEntries: { id: string; category: string; subcategory: string }[]
) {
  console.log(`Attempting to reprocess ${failedEntries.length} failed entries`);

  let succeeded = 0;
  let failed = 0;
  const newFailures: {
    id: string;
    category: string;
    subcategory: string;
    error: string;
  }[] = [];

  // Process in smaller batches
  let currentBatch: (InsertActivity & { embeddings: number[] })[] = [];

  for (const { id, category, subcategory } of failedEntries) {
    try {
      // Find the activity in the original data
      const activityData = findActivityInNestedData(id, category, subcategory);

      if (!activityData) {
        console.error(`Could not find activity ${id} in original data`);
        failed++;
        continue;
      }

      // Generate content for embeddings
      const contentForEmbedding = [
        activityData.name,
        activityData.description,
        activityData.information,
        category,
        subcategory,
      ]
        .filter(Boolean)
        .join("\n");

      // Generate embeddings
      const embeddings = await generateEmbeddings(contentForEmbedding);

      currentBatch.push({
        originalId: activityData.id,
        name: activityData.name,
        slug: activityData.slug,
        address: activityData.address,
        category,
        subcategory,
        description: activityData.description,
        information: activityData.information,
        timing: activityData.timing_content,
        pricing: activityData.pricing_content,
        booking_type: activityData.booking_type,
        redirect_url: activityData.redirect_url,
        embeddings,
      });

      // Process batch when it reaches size 3 (smaller for retries)
      if (currentBatch.length >= 3) {
        await storage.createManyActivities([...currentBatch]);
        succeeded += currentBatch.length;
        currentBatch = [];
      }
    } catch (error) {
      failed++;
      newFailures.push({
        id,
        category,
        subcategory,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Save any remaining activities
  if (currentBatch.length > 0) {
    try {
      await storage.createManyActivities([...currentBatch]);
      succeeded += currentBatch.length;
    } catch (error) {
      failed += currentBatch.length;
      console.error("Failed to save final batch:", error);
    }
  }

  console.log(`
    Reprocessing complete:
    - Total retry attempts: ${failedEntries.length}
    - Succeeded: ${succeeded}
    - Failed again: ${failed}
  `);

  if (newFailures.length > 0) {
    console.log(
      "Entries that failed again:",
      JSON.stringify(newFailures, null, 2)
    );
  }

  return { succeeded, failed, newFailures };
}

// Helper function to find an activity in the nested data
function findActivityInNestedData(
  id: string,
  category: string,
  subcategory: string
) {
  try {
    const categoryData = (nestedData as Record<string, any>)[category];
    if (!categoryData) return null;

    const subcategoryData = categoryData.subcategories[subcategory];
    if (!subcategoryData) return null;

    return subcategoryData.activities.find((a: any) => a.id === id) || null;
  } catch (e) {
    console.error(`Error finding activity ${id}:`, e);
    return null;
  }
}

// New function to find missing activities
async function findMissingActivities() {
  const existingActivities = await storage.getAllActivitiesOriginalIds();
  const existingIds = new Set(existingActivities.map((a) => a.original_id));

  const missing: {
    id: string;
    name: string;
    category: string;
    subcategory: string;
  }[] = [];

  for (const [category, categoryData] of Object.entries(
    nestedData as Record<string, any>
  )) {
    for (const [subcategory, subcategoryData] of Object.entries(
      categoryData.subcategories as Record<string, any>
    )) {
      for (const activity of subcategoryData.activities as any[]) {
        if (!existingIds.has(activity.id)) {
          missing.push({
            id: activity.id,
            name: activity.name,
            category,
            subcategory,
          });
        }
      }
    }
  }

  console.log(`Found ${missing.length} missing activities`);
  return missing;
}

export { processNestedData, reprocessFailedEntries, findMissingActivities };
