import { storage } from "./storage";
import { vectorStore } from "./lib/vectorStore";

export async function initializeApp() {
  try {
    console.log("Initializing application...");

    // Fetch activities with embeddings
    console.log("Fetching activities from database...");
    const activities = await storage.getActivities();
    console.log(`Found ${activities.length} activities in database`);

    if (activities.length === 0) {
      console.warn(
        "No activities found in database. Run the data processor first."
      );
      return false;
    }

    // Load activities into vector store
    vectorStore.setData(activities);

    // Verify initialization worked
    if (!vectorStore.isInitialized()) {
      console.error("Vector store initialization failed");
      return false;
    }

    console.log("App initialized successfully with vector search capabilities");
    return true;
  } catch (error) {
    console.error("Error initializing app:", error);
    return false;
  }
}
