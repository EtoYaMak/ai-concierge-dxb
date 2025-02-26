import { type InsertActivity } from "@/shared/schema";
import { generateEmbeddings } from "./openai";
import { storage } from "../storage";
import nestedData from "../../../assests/nested_data.json";

const BATCH_SIZE = 5; // Process 5 activities at a time to avoid rate limits

async function processNestedData() {
  //const activities: (InsertActivity & { embeddings: number[] })[] = [];
  let processed = 0;
  let total = 0;

  // First, count total activities
  for (const categoryData of Object.values(nestedData)) {
    for (const subcategoryData of Object.values(categoryData.subcategories)) {
      total += subcategoryData.activities.length;
    }
  }

  for (const [category, categoryData] of Object.entries(nestedData)) {
    for (const [subcategory, subcategoryData] of Object.entries(
      categoryData.subcategories
    )) {
      const batch: (InsertActivity & { embeddings: number[] })[] = [];

      for (const activity of subcategoryData.activities) {
        try {
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

          batch.push({
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

          // When batch is full or it's the last item, store the batch
          if (batch.length >= BATCH_SIZE || processed === total) {
            await storage.createManyActivities(batch);
            batch.length = 0; // Clear the batch
          }
        } catch (error) {
          console.error(`Error processing activity ${activity.id}:`, error);
          // Continue with other activities even if one fails
        }
      }
    }
  }

  console.log(`Processed and stored ${processed} activities`);
}

export { processNestedData };
