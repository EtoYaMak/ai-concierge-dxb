import { vectorStore } from "./lib/vectorStore";

export async function initializeApp() {
  try {
    console.log("Initializing application...");

    // Initialize vector store
    console.log("Initializing vector store...");
    const initialized = await vectorStore.initialize();

    if (!initialized) {
      console.warn(
        "Vector store initialization failed. Check if activities table has data."
      );
      return false;
    }

    console.log("App initialized successfully with vector search capabilities");
    return true;
  } catch (error) {
    console.error("Error initializing app:", error);
    return false;
  }
}
