import { storage } from "./storage";
import { vectorStore } from "./lib/vectorStore";

export async function initializeApp() {
  try {
    // Initialize vector store with activities data
    console.log("Fetching activities from database...");
    const activities = await storage.getActivities();
    console.log(`Found ${activities.length} activities in database`);
    vectorStore.setData(activities);
    return true;
  } catch (error) {
    console.error("Error initializing vector store:", error);
    // Continue starting the app even if initial data load fails
    return false;
  }
}
